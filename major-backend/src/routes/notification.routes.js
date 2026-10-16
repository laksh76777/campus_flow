import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    broadcastAnnouncement,
    getAnnouncementPreview,
    getScheduledReminders,
    triggerReminderWorker
} from "../controllers/notification.controller.js";

const router = Router();

router.use(verifyJWT);

// Student & common endpoints
router.route("/").get(getMyNotifications);
router.route("/mark-all-read").patch(markAllNotificationsAsRead);
router.route("/:notificationId/read").patch(markNotificationAsRead);

// Admin announcement & reminder endpoints
router.route("/announcement-preview").get(verifyAdmin, getAnnouncementPreview);
router.route("/broadcast").post(verifyAdmin, broadcastAnnouncement);
router.route("/scheduled-reminders").get(verifyAdmin, getScheduledReminders);
router.route("/trigger-reminders").post(verifyAdmin, triggerReminderWorker);

export default router;
