import { ReminderJob } from "../models/reminderJob.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { Company } from "../models/company.model.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Application } from "../models/application.model.js";
import { Notification } from "../models/notification.model.js";
import { EligibilityService } from "./eligibility.service.js";
import { studentMatchesDriveProgram } from "./programTargeting.service.js";
import { sendDeadlineReminderEmail } from "../utils/mailService.js";

let schedulerInterval = null;
let isProcessing = false;

/**
 * 1. Synchronize Scheduled Reminders for a Placement Drive
 * Called when a drive is created, updated, or when deadlines / reminder settings change.
 */
export const syncDriveReminders = async (driveId) => {
    const drive = await PlacementDrive.findById(driveId);
    if (!drive) return { synced: false, reason: "Drive not found" };

    // If reminders disabled or drive is closed/inactive
    if (!drive.isActive || !drive.reminderSettings?.remindersEnabled) {
        await ReminderJob.updateMany(
            { drive: driveId, status: "PENDING" },
            { $set: { status: "CANCELLED", errorCategory: "Reminders disabled or drive inactive" } }
        );
        return { synced: true, scheduledCount: 0, status: "DISABLED" };
    }

    const deadline = new Date(drive.applicationDeadline);
    const now = new Date();

    // If deadline has already passed
    if (now >= deadline) {
        await ReminderJob.updateMany(
            { drive: driveId, status: "PENDING" },
            { $set: { status: "CANCELLED", errorCategory: "Deadline already passed" } }
        );
        return { synced: true, scheduledCount: 0, status: "EXPIRED" };
    }

    const offsets = Array.isArray(drive.reminderSettings.reminderOffsetsHours) && drive.reminderSettings.reminderOffsetsHours.length > 0
        ? drive.reminderSettings.reminderOffsetsHours
        : [6];

    // Cancel obsolete pending jobs for this drive where deadline has changed
    await ReminderJob.updateMany(
        { drive: drive._id, status: "PENDING", driveDeadline: { $ne: deadline } },
        { $set: { status: "CANCELLED", errorCategory: "Drive application deadline modified" } }
    );

    let scheduledCount = 0;

    for (const offset of offsets) {
        const offsetNum = Number(offset);
        if (isNaN(offsetNum) || offsetNum <= 0) continue;

        const scheduledTime = new Date(deadline.getTime() - offsetNum * 3600 * 1000);
        const idempotencyKey = `${drive._id}_${offsetNum}_${deadline.getTime()}`;

        // Only schedule if the reminder time is in the future
        if (scheduledTime > now) {
            const existingJob = await ReminderJob.findOne({ idempotencyKey });
            if (!existingJob) {
                await ReminderJob.create({
                    drive: drive._id,
                    idempotencyKey,
                    offsetHours: offsetNum,
                    scheduledTime,
                    driveDeadline: deadline,
                    channels: drive.reminderSettings.channels || ["in_app", "email"],
                    status: "PENDING",
                    attempts: 0,
                });
                scheduledCount++;
            } else if (existingJob.status === "CANCELLED") {
                // If previously cancelled (e.g. reminders toggled off then on), restore to PENDING
                existingJob.status = "PENDING";
                existingJob.errorCategory = "";
                existingJob.channels = drive.reminderSettings.channels || ["in_app", "email"];
                existingJob.driveDeadline = deadline;
                existingJob.scheduledTime = scheduledTime;
                await existingJob.save();
                scheduledCount++;
            }
        }
    }

    return { synced: true, scheduledCount, status: "SCHEDULED" };
};

/**
 * 2. Process Due Reminders (Worker execution step)
 * Atomically claims pending jobs and dispatches multi-channel alerts.
 */
export const processDueReminders = async () => {
    if (isProcessing) return { processed: 0, message: "Worker already in progress" };
    isProcessing = true;

    let processedCount = 0;

    try {
        const now = new Date();
        const dueJobs = await ReminderJob.find({
            status: "PENDING",
            scheduledTime: { $lte: now }
        }).limit(15);

        for (const candidateJob of dueJobs) {
            // Atomic state claim to prevent duplicate delivery
            const job = await ReminderJob.findOneAndUpdate(
                { _id: candidateJob._id, status: "PENDING" },
                {
                    $set: { status: "PROCESSING", lastAttemptAt: new Date() },
                    $inc: { attempts: 1 }
                },
                { returnDocument: "after" }
            );

            if (!job) continue; // Claimed by another execution

            try {
                const drive = await PlacementDrive.findById(job.drive)
                    .populate("company", "companyName")
                    .populate("placementSession", "sessionYear name");

                // Check validity: if drive inactive, deadline passed, or reminders disabled
                if (!drive || !drive.isActive || !drive.reminderSettings?.remindersEnabled) {
                    job.status = "CANCELLED";
                    job.errorCategory = "Drive is inactive or reminders were disabled";
                    await job.save();
                    continue;
                }

                if (new Date() >= job.driveDeadline) {
                    job.status = "CANCELLED";
                    job.errorCategory = "Application deadline passed before execution";
                    await job.save();
                    continue;
                }

                // Query target candidate cohort
                const cohortFilter = {};
                if (drive.placementSession) {
                    cohortFilter.placementSession = drive.placementSession._id;
                } else if (drive.graduationYear) {
                    cohortFilter.graduationYear = Number(drive.graduationYear);
                }

                const students = await StudentProfile.find(cohortFilter)
                    .populate("user", "fullName email phone isActive")
                    .lean();

                // Query students who have already submitted an application
                const existingApplications = await Application.find({
                    placementDrive: drive._id,
                    status: { $ne: "withdrawn" }
                }).select("student").lean();

                const appliedStudentIds = new Set(existingApplications.map((a) => String(a.student)));

                let targetedCandidates = 0;
                let inAppCreated = 0;
                let emailAccepted = 0;
                let emailFailed = 0;
                let skippedAlreadyApplied = 0;
                let skippedIneligible = 0;
                let skippedMissingEmail = 0;

                const channels = Array.isArray(job.channels) && job.channels.length > 0
                    ? job.channels
                    : ["in_app", "email"];

                for (const student of students) {
                    // 1. Exclude already applied
                    if (appliedStudentIds.has(String(student._id))) {
                        skippedAlreadyApplied++;
                        continue;
                    }

                    // 2. Exclude mismatched academic programs
                    if (!studentMatchesDriveProgram(student, drive)) {
                        skippedIneligible++;
                        continue;
                    }

                    // 3. Exclude students not meeting eligibility rules (CGPA, backlogs, etc.)
                    const evalResult = EligibilityService.evaluate(student, drive);
                    if (!evalResult.isEligible) {
                        skippedIneligible++;
                        continue;
                    }

                    targetedCandidates++;

                    // A. Dispatch in-app notification (only if in_app channel requested and not previously completed)
                    const shouldDispatchInApp = channels.includes("in_app") && !job.inAppCompleted;
                    if (shouldDispatchInApp && student.user?._id) {
                        await Notification.create({
                            user: student.user._id,
                            title: `⏰ Deadline Alert: ${drive.company?.companyName || "Drive"} (${drive.jobTitle})`,
                            message: `Application closes in ${job.offsetHours} hours (${new Date(drive.applicationDeadline).toLocaleString()}). Submit your profile before the portal closes.`,
                            type: "urgent",
                            companyName: drive.company?.companyName || "",
                            jobTitle: drive.jobTitle,
                            isRead: false
                        });
                        inAppCreated++;
                    }

                    // B. Dispatch institutional email notification (only if email channel requested and not previously completed)
                    const shouldDispatchEmail = channels.includes("email") && !job.emailCompleted;
                    if (shouldDispatchEmail) {
                        const recipientEmail = student.user?.email || student.collegeEmail;
                        if (!recipientEmail) {
                            skippedMissingEmail++;
                        } else {
                            const emailRes = await sendDeadlineReminderEmail({
                                studentEmail: recipientEmail,
                                studentName: student.user?.fullName || "",
                                companyName: drive.company?.companyName || "Campus Recruitment",
                                jobTitle: drive.jobTitle,
                                deadline: drive.applicationDeadline,
                                offsetHours: job.offsetHours,
                                packageLPA: drive.package
                            });

                            if (emailRes.accepted) {
                                emailAccepted++;
                            } else {
                                emailFailed++;
                            }
                        }
                    }
                }

                // Channel-isolated completion tracking
                if (channels.includes("in_app") && !job.inAppCompleted) {
                    job.inAppCompleted = true;
                }

                const totalInAppCreated = (job.deliverySummary?.inAppCreated || 0) + inAppCreated;
                const totalEmailAccepted = (job.deliverySummary?.emailAccepted || 0) + emailAccepted;
                const totalEmailFailed = (job.deliverySummary?.emailFailed || 0) + emailFailed;

                job.deliverySummary = {
                    targetedCandidates,
                    inAppCreated: totalInAppCreated,
                    emailAccepted: totalEmailAccepted,
                    emailFailed: totalEmailFailed,
                    skippedAlreadyApplied,
                    skippedIneligible,
                    skippedMissingEmail
                };

                // Delivery-state determination:
                // If email dispatch had failures, do NOT silently mark COMPLETED!
                if (channels.includes("email") && !job.emailCompleted) {
                    if (emailFailed > 0) {
                        job.emailCompleted = false;
                        if (job.attempts < job.maxAttempts) {
                            job.status = "PENDING";
                            job.scheduledTime = new Date(Date.now() + Math.min(job.attempts * 5 * 60 * 1000, 30 * 60 * 1000));
                            job.errorCategory = `EMAIL_DELIVERY_FAILED (${emailFailed} failed)`;
                        } else {
                            job.status = "FAILED";
                            job.errorCategory = `EMAIL_DELIVERY_EXHAUSTED (${emailFailed} failed)`;
                        }
                    } else {
                        job.emailCompleted = true;
                        job.status = "COMPLETED";
                    }
                } else {
                    job.status = "COMPLETED";
                }

                await job.save();
                processedCount++;

            } catch (jobErr) {
                console.error(`[ReminderJob Error] Failed to execute job ${job._id}:`, jobErr.message);
                job.status = job.attempts >= job.maxAttempts ? "FAILED" : "PENDING";
                job.errorCategory = jobErr.message;
                await job.save();
            }
        }
    } finally {
        isProcessing = false;
    }

    return { processed: processedCount };
};

/**
 * 3. Start Persisted Scheduler Lifecycle
 */
export const startReminderScheduler = (intervalMs = 60000) => {
    if (schedulerInterval) return;

    // Run immediately on boot to handle missed or pending jobs
    processDueReminders().catch((err) =>
        console.error("[ReminderScheduler] Initial startup check notice:", err.message)
    );

    // Bounded interval polling
    schedulerInterval = setInterval(() => {
        processDueReminders().catch((err) =>
            console.error("[ReminderScheduler] Interval execution notice:", err.message)
        );
    }, intervalMs);

    console.log(`[ReminderScheduler] Persisted deadline reminder worker active (Interval: ${intervalMs / 1000}s)`);
};

export const stopReminderScheduler = () => {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
};
