import { Router } from "express";
import { verifyAdmin, verifyJWT, verifyStudent } from "../middlewares/auth.middleware.js";
import { supportAssistantLimiter } from "../middlewares/security.middleware.js";
import {
    createSupportConversation,
    getMySupportConversations,
    getAdminSupportInbox,
    getSupportConversation,
    sendStudentSupportMessage,
    requestAdminReply,
    replyToSupportConversation,
    updateSupportConversationStatus,
} from "../controllers/support.controller.js";

const router = Router();
router.use(verifyJWT);

router.get("/admin/inbox", verifyAdmin, getAdminSupportInbox);
router.get("/my-conversations", verifyStudent, getMySupportConversations);
router.post("/conversations", verifyStudent, supportAssistantLimiter, createSupportConversation);
router.get("/conversations/:conversationId", getSupportConversation);
router.post("/conversations/:conversationId/messages", verifyStudent, supportAssistantLimiter, sendStudentSupportMessage);
router.post("/conversations/:conversationId/request-admin", verifyStudent, requestAdminReply);
router.post("/admin/:conversationId/reply", verifyAdmin, replyToSupportConversation);
router.patch("/admin/:conversationId/status", verifyAdmin, updateSupportConversationStatus);

export default router;
