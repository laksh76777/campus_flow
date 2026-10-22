import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllMyNotifications,
    broadcastAnnouncement,
    getAnnouncementPreview,
    getBroadcastHistory,
    deleteBroadcastAnnouncement,
    freshstartAllNotifications,
    getScheduledReminders,
    triggerReminderWorker,
    getSmtpStatus,
    sendSmtpTestEmail
} from "../controllers/notification.controller.js";

const router = Router();

router.use(verifyJWT);

// Student & common notification endpoints
router.route("/").get(getMyNotifications);
router.route("/mark-all-read").patch(markAllNotificationsAsRead);
router.route("/clear-all").delete(clearAllMyNotifications);
router.route("/:notificationId").delete(deleteNotification);
router.route("/:notificationId/read").patch(markNotificationAsRead);

// Admin announcement & reminder endpoints
router.route("/announcement-preview").get(verifyAdmin, getAnnouncementPreview);
router.route("/broadcast").post(verifyAdmin, broadcastAnnouncement);
router.route("/broadcast-history").get(verifyAdmin, getBroadcastHistory);
router.route("/broadcast/:identifier").delete(verifyAdmin, deleteBroadcastAnnouncement);
router.route("/admin/freshstart").post(verifyAdmin, freshstartAllNotifications);
router.route("/scheduled-reminders").get(verifyAdmin, getScheduledReminders);
router.route("/trigger-reminders").post(verifyAdmin, triggerReminderWorker);

// Admin safe SMTP diagnostic & test-email endpoints
router.route("/smtp-status").get(verifyAdmin, getSmtpStatus);
router.route("/smtp-test-email").post(verifyAdmin, sendSmtpTestEmail);

export default router;
