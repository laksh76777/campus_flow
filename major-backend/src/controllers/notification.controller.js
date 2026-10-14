import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.models.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Application } from "../models/application.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";

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

// @desc    Broadcast announcement to targeted student cohort
// @route   POST /api/v1/notifications/broadcast
// @access  Admin
export const broadcastAnnouncement = asyncHandler(async (req, res) => {
    const {
        title,
        message,
        targetAudience = "all",
        targetBranch,
        targetSessionYear,
        driveId,
        type = "announcement"
    } = req.body;

    if (!title || !message) {
        throw new ApiError(400, "Announcement title and message are required");
    }

    let targetUserIds = [];

    if (targetAudience === "drive_applicants" && driveId) {
        const apps = await Application.find({
            placementDrive: driveId,
            status: { $ne: "withdrawn" }
        }).populate("student");

        targetUserIds = apps
            .map((a) => a.student?.user)
            .filter(Boolean);
    } else {
        const profileFilter = {};
        if (targetAudience === "branch" && targetBranch) {
            profileFilter.branch = targetBranch;
        }
        if (targetAudience === "session" && targetSessionYear) {
            profileFilter.graduationYear = Number(targetSessionYear);
        }

        if (Object.keys(profileFilter).length > 0) {
            const profiles = await StudentProfile.find(profileFilter).select("user");
            targetUserIds = profiles.map((p) => p.user).filter(Boolean);
        } else {
            // All students
            const students = await User.find({ role: "student", isActive: true }).select("_id");
            targetUserIds = students.map((s) => s._id);
        }
    }

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set(targetUserIds.map((id) => String(id)))];

    if (uniqueUserIds.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, { dispatchedCount: 0 }, "No matching candidates found for this target audience")
        );
    }

    // Bulk insert notifications
    const notificationsToInsert = uniqueUserIds.map((uId) => ({
        user: uId,
        title: title.trim(),
        message: message.trim(),
        type,
        isRead: false
    }));

    await Notification.insertMany(notificationsToInsert);

    return res.status(201).json(
        new ApiResponse(
            201,
            { dispatchedCount: uniqueUserIds.length, targetAudience },
            `Announcement successfully broadcast to ${uniqueUserIds.length} candidate(s)`
        )
    );
});

