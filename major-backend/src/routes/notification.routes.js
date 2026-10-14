import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    broadcastAnnouncement,
} from "../controllers/notification.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/").get(getMyNotifications);
router.route("/mark-all-read").patch(markAllNotificationsAsRead);
router.route("/:notificationId/read").patch(markNotificationAsRead);
router.route("/broadcast").post(verifyAdmin, broadcastAnnouncement);

export default router;
