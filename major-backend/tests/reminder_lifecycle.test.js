import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
    startTestEnv, stopTestEnv, resetDb, api, sentMail, setMailFailure,
    createAdmin, createSession, createCompany, createStudent, createDrive,
} from "./helpers/testEnv.js";
import { ReminderJob } from "../src/models/reminderJob.model.js";
import { PlacementDrive } from "../src/models/placementDrive.model.js";
import { Notification } from "../src/models/notification.model.js";
import {
    syncDriveReminders, processDueReminders, STALE_PROCESSING_MS,
} from "../src/services/reminderScheduler.service.js";

const HOUR = 3600 * 1000;

before(startTestEnv);
after(stopTestEnv);
beforeEach(resetDb);

const setup = async ({ students = 1, deadlineInHours = 48 } = {}) => {
    const admin = await createAdmin();
    const session = await createSession();
    const company = await createCompany(admin.user._id);
    const created = [];
    for (let i = 0; i < students; i++) created.push(await createStudent({ session }));
    return { admin, session, company, students: created, deadlineInHours };
};

/** Make every pending job due now, then run the worker. */
const runDueNow = async () => {
    await ReminderJob.updateMany({ status: "PENDING" }, { $set: { scheduledTime: new Date(Date.now() - 1000) } });
    return processDueReminders();
};

const drivePayload = (company, session, deadline) => ({
    company: String(company._id),
    jobTitle: "Backend Engineer",
    jobType: "full-time",
    package: 10,
    eligibleProgramCodes: ["CSE"],
    minimumCGPA: 7,
    maximumBacklogs: 0,
    graduationYear: session.sessionYear,
    placementSession: String(session._id),
    applicationStartDate: new Date(Date.now() - HOUR).toISOString(),
    applicationDeadline: deadline.toISOString(),
    driveDate: new Date(deadline.getTime() + 72 * HOUR).toISOString(),
    reminderSettings: { remindersEnabled: true, reminderOffsetsHours: [24, 6], channels: ["in_app", "email"] },
});

test("creating a drive through the API schedules one job per reminder offset", async () => {
    const { admin, session, company } = await setup();
    const deadline = new Date(Date.now() + 72 * HOUR);
    const res = await api("POST", "/placementdrive/create-placement-drive", {
        token: admin.token, json: drivePayload(company, session, deadline),
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const jobs = await ReminderJob.find({ drive: res.body.data._id, status: "PENDING" }).sort({ offsetHours: 1 });
    assert.deepEqual(jobs.map((j) => j.offsetHours), [6, 24]);
    assert.equal(jobs[1].scheduledTime.getTime(), deadline.getTime() - 24 * HOUR);
});

test("editing the deadline cancels the old schedule and creates the new one", async () => {
    const { admin, session, company } = await setup();
    const deadline = new Date(Date.now() + 72 * HOUR);
    const created = await api("POST", "/placementdrive/create-placement-drive", { token: admin.token, json: drivePayload(company, session, deadline) });
    const driveId = created.body.data._id;

    const newDeadline = new Date(Date.now() + 120 * HOUR);
    const res = await api("PATCH", `/placementdrive/${driveId}`, {
        token: admin.token,
        json: { applicationDeadline: newDeadline.toISOString(), driveDate: new Date(newDeadline.getTime() + 72 * HOUR).toISOString() },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const pending = await ReminderJob.find({ drive: driveId, status: "PENDING" });
    assert.equal(pending.length, 2);
    assert.ok(pending.every((j) => j.driveDeadline.getTime() === newDeadline.getTime()));
    const cancelled = await ReminderJob.countDocuments({ drive: driveId, status: "CANCELLED" });
    assert.equal(cancelled, 2, "both jobs for the old deadline are cancelled");
});

test("repeated syncs and updates never create duplicate jobs", async () => {
    const { admin, session, company } = await setup();
    const drive = await createDrive({ admin: admin.user, company, session, deadlineInHours: 72 });
    await Promise.all([syncDriveReminders(drive._id), syncDriveReminders(drive._id), syncDriveReminders(drive._id)]);
    await syncDriveReminders(drive._id);
    assert.equal(await ReminderJob.countDocuments({ drive: drive._id }), 1);
});

test("removing an offset cancels only that offset's job", async () => {
    const { admin, session, company } = await setup();
    const drive = await createDrive({ admin: admin.user, company, session, deadlineInHours: 72, overrides: { reminderSettings: { remindersEnabled: true, reminderOffsetsHours: [24, 6], channels: ["in_app"] } } });
    await syncDriveReminders(drive._id);
    await api("PATCH", `/placementdrive/${drive._id}`, { token: admin.token, json: { reminderSettings: { reminderOffsetsHours: [6] } } });
    const pending = await ReminderJob.find({ drive: drive._id, status: "PENDING" });
    assert.deepEqual(pending.map((j) => j.offsetHours), [6]);
});

test("deleting a drive cancels its pending reminders and nothing is delivered", async () => {
    const { admin, session, company } = await setup({ students: 2 });
    const drive = await createDrive({ admin: admin.user, company, session });
    await syncDriveReminders(drive._id);
    const res = await api("DELETE", `/placementdrive/${drive._id}`, { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(await ReminderJob.countDocuments({ drive: drive._id, status: "PENDING" }), 0);
    await runDueNow();
    assert.equal(sentMail.length, 0);
    assert.equal(await Notification.countDocuments({}), 0);
});

test("closed and completed drives do not send reminders even if a job is still pending", async () => {
    const { admin, session, company } = await setup();
    const drive = await createDrive({ admin: admin.user, company, session });
    await syncDriveReminders(drive._id);
    // Simulate completion written directly (e.g. by another process) without a sync
    await PlacementDrive.updateOne({ _id: drive._id }, { $set: { isPlacementCompleted: true, isActive: false } });
    await runDueNow();
    const job = await ReminderJob.findOne({ drive: drive._id });
    assert.equal(job.status, "CANCELLED");
    assert.match(job.errorCategory, /completed/i);
    assert.equal(sentMail.length, 0);
});

test("a job scheduled for an old deadline cannot deliver after the deadline changed", async () => {
    const { admin, session, company } = await setup();
    const drive = await createDrive({ admin: admin.user, company, session, deadlineInHours: 48 });
    await syncDriveReminders(drive._id);
    // Deadline changed underneath the job (race: no sync has run yet)
    await PlacementDrive.updateOne({ _id: drive._id }, { $set: { applicationDeadline: new Date(Date.now() + 200 * HOUR) } });
    await runDueNow();
    const job = await ReminderJob.findOne({ drive: drive._id });
    assert.equal(job.status, "CANCELLED");
    assert.match(job.errorCategory, /deadline changed/i);
    assert.equal(sentMail.length, 0);
});

test("a valid due job notifies each eligible student exactly once", async () => {
    const { admin, session, company } = await setup({ students: 3 });
    const drive = await createDrive({ admin: admin.user, company, session });
    await syncDriveReminders(drive._id);
    await runDueNow();
    const job = await ReminderJob.findOne({ drive: drive._id });
    assert.equal(job.status, "COMPLETED");
    assert.equal(sentMail.length, 3);
    assert.equal(await Notification.countDocuments({ type: "urgent" }), 3);

    // Running the worker again (e.g. after a restart) delivers nothing new
    await processDueReminders();
    await runDueNow();
    assert.equal(sentMail.length, 3);
    assert.equal(await Notification.countDocuments({ type: "urgent" }), 3);
});

test("failed emails are retried only for the students who did not receive them", async () => {
    const { admin, session, company, students } = await setup({ students: 3 });
    const failingEmail = students[1].user.email;
    setMailFailure((opts) => opts.to === failingEmail || String(opts.to).includes(failingEmail));
    const drive = await createDrive({ admin: admin.user, company, session });
    await syncDriveReminders(drive._id);

    await runDueNow();
    let job = await ReminderJob.findOne({ drive: drive._id });
    assert.equal(job.status, "PENDING", "job is re-queued for retry");
    assert.ok(job.scheduledTime > new Date(), "retry is scheduled with backoff");
    assert.equal(sentMail.length, 2);
    assert.equal(job.emailedStudentIds.length, 2);

    setMailFailure(() => false);
    await runDueNow();
    job = await ReminderJob.findOne({ drive: drive._id });
    assert.equal(job.status, "COMPLETED");
    assert.equal(sentMail.length, 3, "only the failed recipient is emailed on retry");
    const recipients = sentMail.map((m) => String(m.to));
    assert.equal(new Set(recipients).size, 3, "no student received a duplicate");
    assert.equal(await Notification.countDocuments({ type: "urgent" }), 3, "in-app notifications are not duplicated by the retry");
});

test("email retries stop after the retry limit", async () => {
    const { admin, session, company } = await setup({ students: 1 });
    setMailFailure(() => true);
    const drive = await createDrive({ admin: admin.user, company, session });
    await syncDriveReminders(drive._id);
    for (let i = 0; i < 4; i++) await runDueNow();
    const job = await ReminderJob.findOne({ drive: drive._id });
    assert.equal(job.status, "FAILED");
    assert.equal(job.attempts, job.maxAttempts);
});

test("a job stranded in PROCESSING by a crash is recovered without duplicate delivery", async () => {
    const { admin, session, company, students } = await setup({ students: 2 });
    const drive = await createDrive({ admin: admin.user, company, session });
    await syncDriveReminders(drive._id);
    // Simulate a worker that crashed after notifying the first student
    await ReminderJob.updateOne(
        { drive: drive._id },
        {
            $set: { status: "PROCESSING", lastAttemptAt: new Date(Date.now() - STALE_PROCESSING_MS - 1000), scheduledTime: new Date(Date.now() - 1000), attempts: 1 },
            $addToSet: { emailedStudentIds: students[0].profile._id, notifiedStudentIds: students[0].profile._id },
        }
    );
    await processDueReminders();
    const job = await ReminderJob.findOne({ drive: drive._id });
    assert.equal(job.status, "COMPLETED");
    assert.equal(sentMail.length, 1, "only the student not reached before the crash is emailed");
    assert.match(String(sentMail[0].to), new RegExp(students[1].user.email.replace(".", "\\.")));
});

test("reopening a closed drive restores its cancelled reminders", async () => {
    const { admin, session, company } = await setup();
    const drive = await createDrive({ admin: admin.user, company, session, deadlineInHours: 72 });
    await syncDriveReminders(drive._id);
    await api("PATCH", `/placementdrive/${drive._id}/deactivate`, { token: admin.token });
    assert.equal(await ReminderJob.countDocuments({ drive: drive._id, status: "PENDING" }), 0);
    await api("PATCH", `/placementdrive/${drive._id}/reactivate`, { token: admin.token });
    assert.equal(await ReminderJob.countDocuments({ drive: drive._id, status: "PENDING" }), 1);
    assert.equal(await ReminderJob.countDocuments({ drive: drive._id }), 1, "restored rather than duplicated");
});
