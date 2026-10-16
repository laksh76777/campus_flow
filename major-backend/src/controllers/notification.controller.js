import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.models.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { resolveProgram, resolveStudentProgram } from "../constants/programCatalog.js";
import { Application } from "../models/application.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { ReminderJob } from "../models/reminderJob.model.js";
import { Company } from "../models/company.model.js";
import {
    isSmtpConfigured,
    getSenderAddress,
    sendBroadcastAnnouncementEmail,
    getSmtpConfigStatus,
    verifySmtpConnection,
    sendTestEmail,
    validateEmailAddress,
    reconfigureTransporter
} from "../utils/mailService.js";
import { processDueReminders } from "../services/reminderScheduler.service.js";

export const getMyNotifications = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const notifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(50);

    const unreadCount = await Notification.countDocuments({
        user: userId,
        isRead: false,
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                notifications,
                unreadCount,
            },
            "Notifications fetched successfully"
        )
    );
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { $set: { isRead: true } },
        { returnDocument: "after" }
    );

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    const unreadCount = await Notification.countDocuments({
        user: userId,
        isRead: false,
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            { notification, unreadCount },
            "Notification marked as read"
        )
    );
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    await Notification.updateMany(
        { user: userId, isRead: false },
        { $set: { isRead: true } }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { unreadCount: 0 },
            "All notifications marked as read"
        )
    );
});

/**
 * Helper to resolve audience recipients strictly and deterministically
 */
const resolveAudienceRecipients = async ({
    targetAudience = "all",
    targetProgramCode,
    targetBranch,
    targetSessionId,
    targetSessionYear,
    driveId
}) => {
    if (!["all", "branch", "program", "session", "drive_applicants"].includes(targetAudience)) {
        throw new ApiError(400, "Unsupported announcement audience selection");
    }

    let recipientList = [];

    if (targetAudience === "drive_applicants") {
        if (!driveId) throw new ApiError(400, "A placement drive ID is required for drive applicants audience");
        const apps = await Application.find({
            placementDrive: driveId,
            status: { $ne: "withdrawn" }
        }).populate({
            path: "student",
            populate: { path: "user", select: "fullName email phone isActive" }
        });

        for (const app of apps) {
            const student = app.student;
            if (!student || !student.user || student.user.isActive === false) continue;
            recipientList.push({
                userId: student.user._id,
                fullName: student.user.fullName,
                email: student.user.email || student.collegeEmail,
                branch: student.branch,
                course: student.course,
                enrollmentNumber: student.enrollmentNumber
            });
        }
    } else if (targetAudience === "session") {
        let session = null;
        if (targetSessionId) {
            session = await PlacementSession.findById(targetSessionId);
        } else if (targetSessionYear) {
            session = await PlacementSession.findOne({ sessionYear: Number(targetSessionYear) });
        }

        if (!session) {
            throw new ApiError(400, "Please select an existing placement session for this announcement");
        }

        const profiles = await StudentProfile.find({
            $or: [
                { placementSession: session._id },
                { graduationYear: session.sessionYear }
            ]
        }).populate("user", "fullName email phone isActive");

        for (const profile of profiles) {
            if (!profile.user || profile.user.isActive === false) continue;
            recipientList.push({
                userId: profile.user._id,
                fullName: profile.user.fullName,
                email: profile.user.email || profile.collegeEmail,
                branch: profile.branch,
                course: profile.course,
                enrollmentNumber: profile.enrollmentNumber
            });
        }
    } else if (targetAudience === "program" || targetAudience === "branch") {
        const program = targetProgramCode
            ? resolveProgram(targetProgramCode)
            : resolveProgram(targetBranch);

        if (!program) {
            throw new ApiError(400, "Select an approved academic program from the catalog");
        }

        const profiles = await StudentProfile.find()
            .populate("user", "fullName email phone isActive");

        for (const profile of profiles) {
            if (!profile.user || profile.user.isActive === false) continue;
            const resolved = resolveStudentProgram(profile);
            if (resolved?.code === program.code) {
                recipientList.push({
                    userId: profile.user._id,
                    fullName: profile.user.fullName,
                    email: profile.user.email || profile.collegeEmail,
                    branch: profile.branch,
                    course: profile.course,
                    enrollmentNumber: profile.enrollmentNumber
                });
            }
        }
    } else {
        // "all" students
        const profiles = await StudentProfile.find()
            .populate("user", "fullName email phone isActive");

        for (const profile of profiles) {
            if (!profile.user || profile.user.isActive === false) continue;
            recipientList.push({
                userId: profile.user._id,
                fullName: profile.user.fullName,
                email: profile.user.email || profile.collegeEmail,
                branch: profile.branch,
                course: profile.course,
                enrollmentNumber: profile.enrollmentNumber
            });
        }
    }

    // Deduplicate by userId
    const seenUserIds = new Set();
    const uniqueRecipients = [];
    for (const r of recipientList) {
        const uIdStr = String(r.userId);
        if (!seenUserIds.has(uIdStr)) {
            seenUserIds.add(uIdStr);
            uniqueRecipients.push(r);
        }
    }

    return uniqueRecipients;
};

// @desc    Preview targeted audience count and sample recipients
// @route   GET /api/v1/notifications/announcement-preview
// @access  Admin
export const getAnnouncementPreview = asyncHandler(async (req, res) => {
    const {
        targetAudience = "all",
        targetProgramCode,
        targetBranch,
        targetSessionId,
        targetSessionYear,
        driveId
    } = req.query;

    const recipients = await resolveAudienceRecipients({
        targetAudience,
        targetProgramCode,
        targetBranch,
        targetSessionId,
        targetSessionYear,
        driveId
    });

    const sample = recipients.slice(0, 5).map((r) => ({
        fullName: r.fullName,
        email: r.email ? r.email.replace(/(.{2})(.*)(?=@)/, "$1***") : "No registered email",
        branch: r.branch || r.course || "N/A"
    }));

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalEligibleRecipients: recipients.length,
                sampleRecipients: sample,
                isSmtpConfigured: isSmtpConfigured(),
                senderAddress: getSenderAddress(),
                targetAudience
            },
            `Audience preview: ${recipients.length} matching candidate(s)`
        )
    );
});

// @desc    Broadcast announcement to targeted student cohort
// @route   POST /api/v1/notifications/broadcast
// @access  Admin
export const broadcastAnnouncement = asyncHandler(async (req, res) => {
    const {
        title,
        message,
        targetAudience = "all",
        targetProgramCode,
        targetBranch,
        targetSessionId,
        targetSessionYear,
        driveId,
        type = "announcement",
        channels = ["in_app"]
    } = req.body;

    if (!title || !title.trim()) {
        throw new ApiError(400, "Announcement title is required");
    }
    if (title.trim().length > 200) {
        throw new ApiError(400, "Announcement title cannot exceed 200 characters");
    }
    if (!message || !message.trim()) {
        throw new ApiError(400, "Announcement message is required");
    }
    if (message.trim().length > 5000) {
        throw new ApiError(400, "Announcement message cannot exceed 5000 characters");
    }

    const selectedChannels = Array.isArray(channels) && channels.length > 0
        ? channels
        : ["in_app"];

    const recipients = await resolveAudienceRecipients({
        targetAudience,
        targetProgramCode,
        targetBranch,
        targetSessionId,
        targetSessionYear,
        driveId
    });

    if (recipients.length === 0) {
        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    targetedCandidates: 0,
                    inAppCreated: 0,
                    emailsSent: 0,
                    emailsFailed: 0,
                    emailStatus: "SKIPPED",
                    channels: selectedChannels
                },
                "No matching candidates found for this target audience"
            )
        );
    }

    let inAppCreated = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    let skippedMissingEmail = 0;
    let emailStatus = "SKIPPED";
    let emailNote = "";

    // 1. In-App Notification Delivery
    if (selectedChannels.includes("in_app")) {
        const notificationsToInsert = recipients.map((r) => ({
            user: r.userId,
            title: title.trim(),
            message: message.trim(),
            type: type === "urgent" ? "urgent" : "announcement",
            isRead: false
        }));

        await Notification.insertMany(notificationsToInsert);
        inAppCreated = notificationsToInsert.length;
    }

    // 2. Email Delivery
    if (selectedChannels.includes("email")) {
        if (!isSmtpConfigured()) {
            emailStatus = "SMTP_NOT_CONFIGURED";
            emailNote = "Email dispatch requested, but SMTP server credentials are not configured in system environment variables.";
        } else {
            // Process bounded dispatch
            for (const recipient of recipients) {
                if (!recipient.email) {
                    skippedMissingEmail++;
                    continue;
                }

                const emailRes = await sendBroadcastAnnouncementEmail({
                    studentEmail: recipient.email,
                    studentName: recipient.fullName,
                    title: title.trim(),
                    message: message.trim(),
                    priority: type === "urgent" ? "urgent" : "announcement"
                });

                if (emailRes.accepted) {
                    emailsSent++;
                } else {
                    emailsFailed++;
                }
            }

            if (emailsSent > 0 && emailsFailed === 0) {
                emailStatus = "DELIVERED";
            } else if (emailsSent > 0 && emailsFailed > 0) {
                emailStatus = "PARTIAL_FAILURE";
            } else if (emailsSent === 0 && emailsFailed > 0) {
                emailStatus = "FAILED";
            } else if (emailsSent === 0 && skippedMissingEmail > 0) {
                emailStatus = "NO_VALID_EMAILS";
            }
        }
    }

    let outcomeMessage = `Announcement successfully processed: ${inAppCreated} in-app alerts created.`;
    if (selectedChannels.includes("email")) {
        if (emailStatus === "DELIVERED") {
            outcomeMessage += ` ${emailsSent} emails sent.`;
        } else if (emailStatus === "PARTIAL_FAILURE") {
            outcomeMessage += ` ${emailsSent} emails sent, ${emailsFailed} failed.`;
        } else if (emailStatus === "FAILED") {
            outcomeMessage += ` Email dispatch failed for all ${emailsFailed} recipient(s).`;
        } else if (emailStatus === "SMTP_NOT_CONFIGURED") {
            outcomeMessage += ` Email dispatch skipped (SMTP is not configured).`;
        }
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                targetedCandidates: recipients.length,
                inAppCreated,
                emailsSent,
                emailsFailed,
                skippedMissingEmail,
                emailStatus,
                emailNote,
                channels: selectedChannels,
                targetAudience
            },
            outcomeMessage
        )
    );
});

// @desc    Get scheduled reminder jobs for admin monitoring
// @route   GET /api/v1/notifications/scheduled-reminders
// @access  Admin
export const getScheduledReminders = asyncHandler(async (req, res) => {
    const jobs = await ReminderJob.find()
        .populate({
            path: "drive",
            select: "jobTitle company applicationDeadline isActive",
            populate: { path: "company", select: "companyName industry" }
        })
        .sort({ scheduledTime: -1 })
        .limit(50);

    return res.status(200).json(
        new ApiResponse(
            200,
            jobs,
            "Scheduled reminder jobs retrieved successfully"
        )
    );
});

// @desc    Manually trigger reminder worker execution (for administration/testing)
// @route   POST /api/v1/notifications/trigger-reminders
// @access  Admin
export const triggerReminderWorker = asyncHandler(async (req, res) => {
    const result = await processDueReminders();
    return res.status(200).json(
        new ApiResponse(
            200,
            result,
            `Worker executed: ${result.processed} job(s) processed`
        )
    );
});

// @desc    Get safe SMTP server configuration & connection diagnostic status
// @route   GET /api/v1/notifications/smtp-status
// @access  Admin
export const getSmtpStatus = asyncHandler(async (req, res) => {
    reconfigureTransporter();
    const configStatus = getSmtpConfigStatus();
    const verification = await verifySmtpConnection();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                ...configStatus,
                verification
            },
            "SMTP diagnostic status evaluated successfully"
        )
    );
});

// @desc    Send a single controlled test email to an explicitly verified recipient
// @route   POST /api/v1/notifications/smtp-test-email
// @access  Admin
export const sendSmtpTestEmail = asyncHandler(async (req, res) => {
    reconfigureTransporter();
    const { testEmail } = req.body;

    if (!testEmail || !validateEmailAddress(testEmail)) {
        throw new ApiError(400, "Please provide a valid recipient email address for testing.");
    }

    const result = await sendTestEmail(testEmail);

    if (!result.accepted) {
        return res.status(400).json(
            new ApiResponse(
                400,
                result,
                result.error || "Test email delivery failed"
            )
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            result,
            "Test email accepted by SMTP server for delivery"
        )
    );
});
