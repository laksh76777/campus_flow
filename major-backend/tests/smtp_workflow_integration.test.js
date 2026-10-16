import assert from "node:assert/strict";
import { after, test } from "node:test";
import mongoose from "mongoose";
import "../env.js";
import connectDB from "../src/db/index.js";
import { app } from "../src/app.js";
import { resetTransporterForTesting } from "../src/utils/mailService.js";
import { Notification } from "../src/models/notification.model.js";
import { ReminderJob } from "../src/models/reminderJob.model.js";
import { PlacementDrive } from "../src/models/placementDrive.model.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { User } from "../src/models/user.models.js";
import { Company } from "../src/models/company.model.js";
import { PlacementSession } from "../src/models/placementSession.model.js";
import { processDueReminders } from "../src/services/reminderScheduler.service.js";

let server;
let API_BASE;
let adminToken;
let studentToken;

async function setup() {
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    API_BASE = `http://localhost:${port}/api/v1`;

    // Admin login
    const adminRes = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@campusflow.edu", password: "Admin@12345" })
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data?.accessToken;

    // Student login
    const studentRes = await fetch(`${API_BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "student@campusflow.edu", password: "Student@12345" })
    });
    const studentData = await studentRes.json();
    studentToken = studentData.data?.accessToken;
}

test("12. Unauthorized access to diagnostic and test-email endpoints is strictly blocked", async () => {
    if (!server) await setup();

    // Anonymous request (no token) -> 401
    const unauthStatus = await fetch(`${API_BASE}/notifications/smtp-status`);
    assert.equal(unauthStatus.status, 401, "Unauthenticated access to smtp-status must return 401");

    const unauthTest = await fetch(`${API_BASE}/notifications/smtp-test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail: "test@example.com" })
    });
    assert.equal(unauthTest.status, 401, "Unauthenticated access to smtp-test-email must return 401");

    // Student request (forbidden) -> 403
    const studentStatus = await fetch(`${API_BASE}/notifications/smtp-status`, {
        headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(studentStatus.status, 403, "Student access to smtp-status must return 403");

    const studentTest = await fetch(`${API_BASE}/notifications/smtp-test-email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({ testEmail: "test@example.com" })
    });
    assert.equal(studentTest.status, 403, "Student access to smtp-test-email must return 403");

    // Admin request -> 200
    const adminStatus = await fetch(`${API_BASE}/notifications/smtp-status`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminStatus.status, 200, "Admin access to smtp-status must return 200");
    const statusData = await adminStatus.json();
    assert.equal(statusData.success, true);
    assert.ok(statusData.data?.verification !== undefined);
});

test("9. Announcement email failure while in-app delivery succeeds reports partial/failure truthfully", async () => {
    if (!server) await setup();

    // Mock transporter that rejects all emails
    resetTransporterForTesting({
        sendMail: async () => {
            const err = new Error("Connection refused by SMTP host");
            err.code = "ECONNREFUSED";
            throw err;
        }
    });

    const broadcastRes = await fetch(`${API_BASE}/notifications/broadcast`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            title: `Broadcast Test ${Date.now()}`,
            message: "Testing announcement delivery outcome tracking",
            type: "announcement",
            targetAudience: "all",
            channels: ["in_app", "email"]
        })
    });

    const broadcastData = await broadcastRes.json();
    assert.equal(broadcastRes.status, 201);
    assert.ok(broadcastData.data.inAppCreated > 0, "In-app notifications must be created");
    assert.equal(broadcastData.data.emailsSent, 0, "Emails must not falsely report success");
    assert.ok(broadcastData.data.emailsFailed > 0, "Failed emails must be counted accurately");
    assert.equal(broadcastData.data.emailStatus, "FAILED", "Status must reflect failure truthfully");

    resetTransporterForTesting(null);
});

test("10 & 11. Reminder email failure, safe retry behavior, and NO duplicate in-app alerts on retries", async () => {
    if (!server) await setup();

    // Find student and company
    const studentUser = await User.findOne({ email: "student@campusflow.edu" });
    assert.ok(studentUser, "Student user must exist");
    const profile = await StudentProfile.findOne({ user: studentUser._id });
    assert.ok(profile, "Student profile must exist");
    const company = await Company.findOne({ isActive: true });
    assert.ok(company, "Active company must exist");

    // Create a temporary drive where the student is definitely eligible and has not applied
    const testDrive = await PlacementDrive.create({
        createdBy: studentUser._id,
        company: company._id,
        jobTitle: `Reminder Test Drive ${Date.now()}`,
        jobType: "full-time",
        package: 10,
        minimumCGPA: 5.0,
        maximumBacklogs: 2,
        graduationYear: profile.graduationYear || 2027,
        placementSession: profile.placementSession,
        eligibleBranches: [profile.branch || "Computer Science & Engineering (CSE)"],
        eligibleProgramCodes: profile.programCode ? [profile.programCode] : ["CSE"],
        applicationStartDate: new Date(Date.now() - 24 * 3600 * 1000),
        applicationDeadline: new Date(Date.now() + 24 * 3600 * 1000),
        driveDate: new Date(Date.now() + 48 * 3600 * 1000),
        isActive: true,
        reminderSettings: {
            remindersEnabled: true,
            reminderOffsetsHours: [6],
            channels: ["in_app", "email"]
        }
    });

    // Create a dedicated test ReminderJob due right now
    const testJob = await ReminderJob.create({
        drive: testDrive._id,
        idempotencyKey: `test_job_retry_${Date.now()}`,
        offsetHours: 6,
        scheduledTime: new Date(Date.now() - 60000), // Due in the past
        driveDeadline: testDrive.applicationDeadline,
        channels: ["in_app", "email"],
        status: "PENDING",
        attempts: 0,
        maxAttempts: 3
    });

    try {
        // Count in-app notifications before first attempt
        const initialNotifCount = await Notification.countDocuments({
            user: studentUser._id,
            title: { $regex: new RegExp(testDrive.jobTitle, "i") }
        });

        // ATTEMPT 1: Fail email sending
        resetTransporterForTesting({
            sendMail: async () => {
                const err = new Error("535 5.7.8 BadCredentials");
                err.code = "EAUTH";
                throw err;
            }
        });

        await processDueReminders();

        const jobAfterAttempt1 = await ReminderJob.findById(testJob._id);
        assert.equal(jobAfterAttempt1.attempts, 1, "Attempts must increment to 1");
        assert.equal(jobAfterAttempt1.status, "PENDING", "Must remain PENDING for retry, not silently COMPLETED");
        assert.equal(jobAfterAttempt1.inAppCompleted, true, "In-app channel must be marked completed");
        assert.equal(jobAfterAttempt1.emailCompleted, false, "Email channel must NOT be marked completed");

        const notifCountAfterAttempt1 = await Notification.countDocuments({
            user: studentUser._id,
            title: { $regex: new RegExp(testDrive.jobTitle, "i") }
        });
        assert.equal(notifCountAfterAttempt1, initialNotifCount + 1, "Exactly one in-app notification created");

        // ATTEMPT 2: Make job due again and retry (email succeeds this time)
        jobAfterAttempt1.scheduledTime = new Date(Date.now() - 60000);
        await jobAfterAttempt1.save();

        let emailSentTo = null;
        resetTransporterForTesting({
            sendMail: async (opts) => {
                emailSentTo = opts.to;
                return { messageId: "retry-success-123" };
            }
        });

        await processDueReminders();

        const jobAfterAttempt2 = await ReminderJob.findById(testJob._id);
        assert.equal(jobAfterAttempt2.attempts, 2, "Attempts must increment to 2");
        assert.equal(jobAfterAttempt2.status, "COMPLETED", "Job must be COMPLETED once email succeeds");
        assert.equal(jobAfterAttempt2.emailCompleted, true, "Email channel must be marked completed");
        assert.ok(emailSentTo, "Email must have been dispatched on retry");

        // CRITICAL: In-app notifications must NOT have been duplicated on retry!
        const notifCountAfterAttempt2 = await Notification.countDocuments({
            user: studentUser._id,
            title: { $regex: new RegExp(testDrive.jobTitle, "i") }
        });
        assert.equal(
            notifCountAfterAttempt2,
            notifCountAfterAttempt1,
            "NO duplicate in-app notification should be created during email retry!"
        );
    } finally {
        // Clean up test records
        await PlacementDrive.findByIdAndDelete(testDrive._id);
        await ReminderJob.findByIdAndDelete(testJob._id);
        resetTransporterForTesting(null);
    }
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
});

