import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Notification } from "../models/notification.model.js";

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
