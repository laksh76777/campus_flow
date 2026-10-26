import { ReminderJob } from "../models/reminderJob.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Application } from "../models/application.model.js";
import { Notification } from "../models/notification.model.js";
import { EligibilityService } from "./eligibility.service.js";
import { studentMatchesDriveProgram } from "./programTargeting.service.js";
import { sendDeadlineReminderEmail } from "../utils/mailService.js";
import { formatDateTime } from "../utils/dateFormat.js";

let schedulerInterval = null;
let isProcessing = false;

// A job left in PROCESSING longer than this (e.g. the server crashed mid-run)
// is handed back to the queue. Delivery is idempotent per student, so a
// recovered job never re-sends to students it already reached.
export const STALE_PROCESSING_MS = 15 * 60 * 1000;
// How long a drive-validity check may be reused while a job is dispatching.
const REVALIDATE_INTERVAL_MS = 1000;

const DEFAULT_CHANNELS = ["in_app", "email"];

const normalizeOffsets = (drive) => {
    const raw = Array.isArray(drive?.reminderSettings?.reminderOffsetsHours) && drive.reminderSettings.reminderOffsetsHours.length > 0
        ? drive.reminderSettings.reminderOffsetsHours
        : [6];
    return [...new Set(raw.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
};

const normalizeChannels = (drive) => {
    const channels = Array.isArray(drive?.reminderSettings?.channels)
        ? drive.reminderSettings.channels.filter((c) => DEFAULT_CHANNELS.includes(c))
        : [];
    return channels.length > 0 ? channels : DEFAULT_CHANNELS;
};

export const buildIdempotencyKey = (driveId, offsetHours, deadline) =>
    `${driveId}_${offsetHours}_${new Date(deadline).getTime()}`;

/**
 * Why a drive should not receive deadline reminders right now (null = it should).
 * Shared by scheduling and by the worker's pre-send revalidation.
 */
export const getReminderBlockReason = (drive, now = new Date()) => {
    if (!drive) return "Drive no longer exists";
    if (drive.isDeleted) return "Drive was deleted";
    if (drive.isPlacementCompleted) return "Drive placement process completed";
    if (!drive.isActive) return "Drive is closed";
    if (!drive.reminderSettings?.remindersEnabled) return "Reminders disabled for this drive";
    const deadline = new Date(drive.applicationDeadline);
    if (Number.isNaN(deadline.getTime())) return "Drive has no valid application deadline";
    if (now >= deadline) return "Application deadline has passed";
    return null;
};

/** Cancel every not-yet-started reminder for a drive. */
export const cancelDriveReminders = async (driveId, reason) => {
    const result = await ReminderJob.updateMany(
        { drive: driveId, status: "PENDING" },
        { $set: { status: "CANCELLED", errorCategory: reason } }
    );
    return result.modifiedCount || 0;
};

/**
 * 1. Synchronize scheduled reminders with the drive's current state.
 * Called whenever a drive is created, edited, closed, reopened, completed or deleted.
 * Pending jobs that no longer match (old deadline, removed offset, closed drive)
 * are cancelled; the desired jobs are upserted by a stable idempotency key so
 * repeated calls never create duplicates.
 */
export const syncDriveReminders = async (driveId) => {
    const drive = await PlacementDrive.findById(driveId);
    const now = new Date();

    const blockReason = getReminderBlockReason(drive, now);
    if (blockReason) {
        const cancelledCount = await cancelDriveReminders(driveId, blockReason);
        return { synced: true, scheduledCount: 0, cancelledCount, status: drive ? "DISABLED" : "MISSING", reason: blockReason };
    }

    const deadline = new Date(drive.applicationDeadline);
    const channels = normalizeChannels(drive);
    const desired = normalizeOffsets(drive)
        .map((offsetHours) => ({
            offsetHours,
            scheduledTime: new Date(deadline.getTime() - offsetHours * 3600 * 1000),
            idempotencyKey: buildIdempotencyKey(drive._id, offsetHours, deadline),
        }))
        .filter((job) => job.scheduledTime > now);
    const desiredKeys = desired.map((job) => job.idempotencyKey);

    // Invalidate anything pending that the current drive settings no longer call for
    const { modifiedCount: cancelledCount = 0 } = await ReminderJob.updateMany(
        { drive: drive._id, status: "PENDING", idempotencyKey: { $nin: desiredKeys } },
        { $set: { status: "CANCELLED", errorCategory: "Superseded by updated drive deadline or reminder settings" } }
    );

    let scheduledCount = 0;
    for (const job of desired) {
        try {
            const result = await ReminderJob.updateOne(
                { idempotencyKey: job.idempotencyKey },
                {
                    $setOnInsert: {
                        drive: drive._id,
                        idempotencyKey: job.idempotencyKey,
                        offsetHours: job.offsetHours,
                        scheduledTime: job.scheduledTime,
                        driveDeadline: deadline,
                        status: "PENDING",
                        attempts: 0,
                    },
                    $set: { channels },
                },
                { upsert: true }
            );
            if (result.upsertedCount) scheduledCount++;
        } catch (err) {
            // Two concurrent syncs raced on the same key; the other one created it.
            if (err?.code !== 11000) throw err;
        }

        // A job cancelled earlier (drive closed, then reopened) becomes pending again.
        // Completed/failed jobs stay as they are so a reminder is never re-sent.
        const restored = await ReminderJob.updateOne(
            { idempotencyKey: job.idempotencyKey, status: "CANCELLED" },
            { $set: { status: "PENDING", errorCategory: "", scheduledTime: job.scheduledTime, attempts: 0 } }
        );
        if (restored.modifiedCount) scheduledCount++;
    }

    return { synced: true, scheduledCount, cancelledCount, status: "SCHEDULED" };
};

/** Return jobs stuck in PROCESSING (crashed worker) to the queue, or fail them when out of attempts. */
const recoverStaleJobs = async (now) => {
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
    await ReminderJob.updateMany(
        { status: "PROCESSING", lastAttemptAt: { $lt: staleBefore }, $expr: { $lt: ["$attempts", "$maxAttempts"] } },
        { $set: { status: "PENDING", errorCategory: "Recovered after interrupted processing" } }
    );
    await ReminderJob.updateMany(
        { status: "PROCESSING", lastAttemptAt: { $lt: staleBefore }, $expr: { $gte: ["$attempts", "$maxAttempts"] } },
        { $set: { status: "FAILED", errorCategory: "Interrupted processing; retry limit reached" } }
    );
};

/**
 * Re-read the drive and decide whether this job may still deliver. A job is
 * stale when the drive is gone/closed/completed, or its deadline/offset no
 * longer matches what the job was scheduled for.
 */
const loadValidDrive = async (job) => {
    const drive = await PlacementDrive.findById(job.drive)
        .populate("company", "companyName")
        .populate("placementSession", "sessionYear name");
    const blockReason = getReminderBlockReason(drive);
    if (blockReason) return { drive: null, reason: blockReason };
    if (new Date(drive.applicationDeadline).getTime() !== new Date(job.driveDeadline).getTime()) {
        return { drive: null, reason: "Drive application deadline changed after scheduling" };
    }
    if (!normalizeOffsets(drive).includes(Number(job.offsetHours))) {
        return { drive: null, reason: "Reminder offset removed from drive settings" };
    }
    return { drive, reason: null };
};

const retryDelayMs = (attempts) => Math.min(Math.max(attempts, 1) * 5 * 60 * 1000, 30 * 60 * 1000);

const runJob = async (job) => {
    const { drive, reason } = await loadValidDrive(job);
    if (!drive) {
        job.status = "CANCELLED";
        job.errorCategory = reason;
        await job.save();
        return false;
    }

    // Revalidate the drive right before sending, so an edit/delete that lands
    // while this job is running stops further deliveries.
    let lastCheck = Date.now();
    const stillValid = async () => {
        if (Date.now() - lastCheck < REVALIDATE_INTERVAL_MS) return true;
        lastCheck = Date.now();
        const check = await loadValidDrive(job);
        if (!check.drive) {
            job.status = "CANCELLED";
            job.errorCategory = check.reason;
            return false;
        }
        return true;
    };

    const cohortFilter = {};
    if (drive.placementSession) {
        cohortFilter.placementSession = drive.placementSession._id;
    } else if (drive.graduationYear) {
        cohortFilter.graduationYear = Number(drive.graduationYear);
    }

    const students = await StudentProfile.find(cohortFilter)
        .populate("user", "fullName email phone isActive")
        .lean();

    const existingApplications = await Application.find({
        placementDrive: drive._id,
        status: { $ne: "withdrawn" },
    }).select("student").lean();
    const appliedStudentIds = new Set(existingApplications.map((a) => String(a.student)));
    const notified = new Set((job.notifiedStudentIds || []).map(String));
    const emailed = new Set((job.emailedStudentIds || []).map(String));

    const channels = Array.isArray(job.channels) && job.channels.length > 0 ? job.channels : DEFAULT_CHANNELS;
    const summary = {
        targetedCandidates: 0,
        inAppCreated: 0,
        emailAccepted: 0,
        emailFailed: 0,
        skippedAlreadyApplied: 0,
        skippedIneligible: 0,
        skippedMissingEmail: 0,
    };
    let interrupted = false;

    for (const student of students) {
        const studentId = String(student._id);
        if (appliedStudentIds.has(studentId)) {
            summary.skippedAlreadyApplied++;
            continue;
        }
        if (!studentMatchesDriveProgram(student, drive) || !EligibilityService.evaluate(student, drive).isEligible) {
            summary.skippedIneligible++;
            continue;
        }
        summary.targetedCandidates++;

        const needsInApp = channels.includes("in_app") && !notified.has(studentId) && student.user?._id;
        const recipientEmail = student.user?.email || student.collegeEmail;
        const needsEmail = channels.includes("email") && !emailed.has(studentId);
        if (!needsInApp && !needsEmail) continue;

        if (!(await stillValid())) {
            interrupted = true;
            break;
        }

        if (needsInApp) {
            await Notification.create({
                user: student.user._id,
                title: `⏰ Deadline Alert: ${drive.company?.companyName || "Drive"} (${drive.jobTitle})`,
                message: `Application closes in ${job.offsetHours} hours (${formatDateTime(drive.applicationDeadline)}). Submit your application before the portal closes.`,
                type: "urgent",
                companyName: drive.company?.companyName || "",
                jobTitle: drive.jobTitle,
                isRead: false,
            });
            await ReminderJob.updateOne({ _id: job._id }, { $addToSet: { notifiedStudentIds: student._id } });
            notified.add(studentId);
            summary.inAppCreated++;
        }

        if (needsEmail) {
            if (!recipientEmail) {
                summary.skippedMissingEmail++;
            } else {
                const emailRes = await sendDeadlineReminderEmail({
                    studentEmail: recipientEmail,
                    studentName: student.user?.fullName || "",
                    companyName: drive.company?.companyName || "Campus Recruitment",
                    jobTitle: drive.jobTitle,
                    deadline: drive.applicationDeadline,
                    offsetHours: job.offsetHours,
                    packageLPA: drive.package,
                });
                if (emailRes?.accepted) {
                    await ReminderJob.updateOne({ _id: job._id }, { $addToSet: { emailedStudentIds: student._id } });
                    emailed.add(studentId);
                    summary.emailAccepted++;
                } else {
                    summary.emailFailed++;
                }
            }
        }
    }

    // Reload the ledger written above so the final save doesn't overwrite it.
    const fresh = await ReminderJob.findById(job._id).select("notifiedStudentIds emailedStudentIds deliverySummary").lean();
    job.notifiedStudentIds = fresh?.notifiedStudentIds || [];
    job.emailedStudentIds = fresh?.emailedStudentIds || [];
    job.deliverySummary = {
        ...summary,
        inAppCreated: (fresh?.deliverySummary?.inAppCreated || 0) + summary.inAppCreated,
        emailAccepted: (fresh?.deliverySummary?.emailAccepted || 0) + summary.emailAccepted,
        emailFailed: (fresh?.deliverySummary?.emailFailed || 0) + summary.emailFailed,
    };

    if (interrupted) {
        await job.save();
        return false;
    }

    if (channels.includes("in_app")) job.inAppCompleted = true;

    if (channels.includes("email") && summary.emailFailed > 0) {
        job.emailCompleted = false;
        if (job.attempts < job.maxAttempts) {
            // Only the students whose email failed are retried (others are in the ledger).
            job.status = "PENDING";
            job.scheduledTime = new Date(Date.now() + retryDelayMs(job.attempts));
            job.errorCategory = `EMAIL_DELIVERY_FAILED (${summary.emailFailed} failed)`;
        } else {
            job.status = "FAILED";
            job.errorCategory = `EMAIL_DELIVERY_EXHAUSTED (${summary.emailFailed} failed)`;
        }
    } else {
        if (channels.includes("email")) job.emailCompleted = true;
        job.status = "COMPLETED";
        job.errorCategory = "";
    }
    await job.save();
    return true;
};

/**
 * 2. Process due reminders (worker step).
 * Jobs are claimed atomically (PENDING -> PROCESSING), so several backend
 * instances can run the worker without delivering the same job twice.
 */
export const processDueReminders = async () => {
    if (isProcessing) return { processed: 0, message: "Worker already in progress" };
    isProcessing = true;

    let processedCount = 0;
    try {
        const now = new Date();
        await recoverStaleJobs(now);

        const dueJobs = await ReminderJob.find({ status: "PENDING", scheduledTime: { $lte: now } })
            .sort({ scheduledTime: 1 })
            .limit(15)
            .select("_id");

        for (const candidate of dueJobs) {
            const job = await ReminderJob.findOneAndUpdate(
                { _id: candidate._id, status: "PENDING", scheduledTime: { $lte: new Date() } },
                { $set: { status: "PROCESSING", lastAttemptAt: new Date() }, $inc: { attempts: 1 } },
                { returnDocument: "after" }
            );
            if (!job) continue; // claimed elsewhere, cancelled, or rescheduled meanwhile

            try {
                if (await runJob(job)) processedCount++;
            } catch (jobErr) {
                console.error(`[ReminderJob Error] Failed to execute job ${job._id}:`, jobErr.message);
                const exhausted = job.attempts >= job.maxAttempts;
                await ReminderJob.updateOne(
                    { _id: job._id, status: "PROCESSING" },
                    {
                        $set: {
                            status: exhausted ? "FAILED" : "PENDING",
                            errorCategory: jobErr.message,
                            ...(exhausted ? {} : { scheduledTime: new Date(Date.now() + retryDelayMs(job.attempts)) }),
                        },
                    }
                );
            }
        }
    } finally {
        isProcessing = false;
    }

    return { processed: processedCount };
};

/**
 * 3. Start persisted scheduler lifecycle
 */
export const startReminderScheduler = (intervalMs = 60000) => {
    if (schedulerInterval) return;

    // Run immediately on boot to handle missed or pending jobs
    processDueReminders().catch((err) =>
        console.error("[ReminderScheduler] Initial startup check notice:", err.message)
    );

    schedulerInterval = setInterval(() => {
        processDueReminders().catch((err) =>
            console.error("[ReminderScheduler] Interval execution notice:", err.message)
        );
    }, intervalMs);
    schedulerInterval.unref?.();

    console.log(`[ReminderScheduler] Persisted deadline reminder worker active (Interval: ${intervalMs / 1000}s)`);
};

export const stopReminderScheduler = () => {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
};
