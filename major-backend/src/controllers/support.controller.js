import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { SupportConversation } from "../models/supportConversation.model.js";
import { getLiveDriveFacts, generateSupportAnswer, answerFromLocalKnowledge } from "../services/supportAssistant.service.js";
import { processAdminCopilotPrompt } from "../services/adminCopilot.service.js";
import { buildStudentAssistantContext } from "../services/aiContext.service.js";
import { describeAIFailure } from "../services/groqClient.service.js";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES_PER_CONVERSATION = 200;

const cleanText = (value, label, maxLength = MAX_MESSAGE_LENGTH) => {
    if (typeof value !== "string" || !value.trim()) {
        throw new ApiError(400, `${label} is required.`);
    }
    const cleaned = value.trim();
    if (cleaned.length > maxLength) {
        throw new ApiError(400, `${label} cannot exceed ${maxLength} characters.`);
    }
    return cleaned;
};

const findConversationForUser = async (conversationId, user) => {
    if (!mongoose.isValidObjectId(conversationId)) {
        throw new ApiError(400, "Invalid support conversation ID.");
    }
    const conversation = await SupportConversation.findById(conversationId)
        .populate("student", "fullName email");
    if (!conversation) throw new ApiError(404, "Support conversation not found.");
    if (user.role !== "admin" && String(conversation.student?._id || conversation.student) !== String(user._id)) {
        throw new ApiError(404, "Support conversation not found.");
    }
    return conversation;
};

const addStudentMessage = (conversation, user, content) => {
    conversation.messages.push({
        senderRole: "student",
        sender: user._id,
        content,
        readByStudent: true,
        readByAdmin: false,
    });
    conversation.lastMessageAt = new Date();
};

const addAssistantReply = async (conversation, studentUser = null) => {
    let response;
    const lastStudentMsg = conversation.messages
        .filter((m) => m.senderRole === "student")
        .slice(-1)[0]?.content || "";

    // Only the conversation owner's own records are retrieved (never another student's)
    const studentId = studentUser?._id || conversation.student?._id || conversation.student;
    let context = { text: "", profile: null };
    let contextFailed = false;
    if (studentId) {
        try {
            context = await buildStudentAssistantContext(studentId, lastStudentMsg);
        } catch (contextErr) {
            contextFailed = true;
            console.warn("[SupportAssistant] Could not load student context:", contextErr.message);
        }
    }

    let aiFailed = false;
    try {
        const contextText = contextFailed
            ? "STUDENT DATA: could not be loaded right now. Do not state any personal academic, eligibility or application facts; tell the student their records could not be retrieved."
            : context.text;
        response = await generateSupportAnswer({
            messages: conversation.messages,
            contextText,
        });
    } catch (error) {
        console.warn("[SupportAssistant] Groq AI unavailable, using labelled offline guidance:", error.code || error.name || error.message);
        aiFailed = true;
        const liveDrives = await getLiveDriveFacts().catch(() => []);
        const fallback = answerFromLocalKnowledge(lastStudentMsg, liveDrives, context.profile);
        // Be explicit that this is not an AI answer
        response = {
            ...fallback,
            answer: `> ${describeAIFailure(error)} Here is standard portal guidance instead.\n\n${fallback.answer}`,
        };
    }

    // Connect to human TPO only if:
    // 1. Student explicitly requests human escalation, OR
    // 2. The AI failed and the offline guidance flagged a handoff
    const explicitlyRequestsHuman = /\b(tpo|officer|talk to (a )?human|speak to (a )?(human|person|officer)|human assistance|contact tpo|connect (me )?to tpo)\b/i.test(lastStudentMsg);
    const needsAdmin = explicitlyRequestsHuman || (aiFailed && response.handoffRecommended === true);

    conversation.messages.push({
        senderRole: "assistant",
        content: response.answer,
        confidence: response.confidence ?? 0.95,
        handoffRecommended: needsAdmin,
        readByStudent: false,
        readByAdmin: true,
    });
    conversation.lastMessageAt = new Date();
    if (needsAdmin && conversation.status !== "closed") {
        conversation.status = "open";
    } else if (conversation.status !== "closed" && conversation.status !== "answered") {
        conversation.status = "bot_answered";
    }
    return { ...response, handoffRequired: needsAdmin };
};

const serializeConversation = (conversation) => ({
    _id: conversation._id,
    subject: conversation.subject,
    status: conversation.status,
    student: conversation.student,
    assignedAdmin: conversation.assignedAdmin,
    messages: conversation.messages,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
});

export const createSupportConversation = asyncHandler(async (req, res) => {
    const message = cleanText(req.body.message, "Question");
    const subject = typeof req.body.subject === "string" && req.body.subject.trim()
        ? req.body.subject.trim().slice(0, 120)
        : message.replace(/\s+/g, " ").slice(0, 90);

    const conversation = new SupportConversation({
        student: req.user._id,
        subject,
        status: "bot_answered",
        messages: [],
    });
    addStudentMessage(conversation, req.user, message);
    const assistant = await addAssistantReply(conversation, req.user);
    await conversation.save();

    return res.status(201).json(new ApiResponse(201, {
        conversation: serializeConversation(conversation),
        assistant: {
            confidence: assistant.confidence,
            handoffRequired: assistant.handoffRequired,
        },
    }, "Your question was processed by CampusFlow AI Support."));
});

export const getMySupportConversations = asyncHandler(async (req, res) => {
    const conversations = await SupportConversation.aggregate([
        { $match: { student: new mongoose.Types.ObjectId(req.user._id) } },
        { $sort: { lastMessageAt: -1 } },
        { $limit: 50 },
        { $project: {
            subject: 1,
            status: 1,
            lastMessageAt: 1,
            createdAt: 1,
            lastMessage: { $arrayElemAt: [{ $ifNull: ["$messages", []] }, -1] },
        } },
    ]);
    return res.status(200).json(new ApiResponse(200, conversations, "Support conversations retrieved."));
});

export const getAdminSupportInbox = asyncHandler(async (req, res) => {
    const allowedStatuses = ["open", "answered", "bot_answered", "closed"];
    const requestedStatus = req.query.status;
    const filter = requestedStatus && allowedStatuses.includes(requestedStatus)
        ? { status: requestedStatus }
        : requestedStatus === "all" ? {} : { status: "open" };

    const conversations = await SupportConversation.aggregate([
        { $match: filter },
        { $sort: { lastMessageAt: -1 } },
        { $limit: 100 },
        { $project: {
            subject: 1,
            status: 1,
            student: 1,
            assignedAdmin: 1,
            lastMessageAt: 1,
            unreadCount: {
                $size: {
                    $filter: {
                        input: { $ifNull: ["$messages", []] },
                        as: "message",
                        cond: { $and: [
                            { $eq: ["$$message.senderRole", "student"] },
                            { $eq: ["$$message.readByAdmin", false] },
                        ] },
                    },
                },
            },
            lastMessage: { $arrayElemAt: [{ $ifNull: ["$messages", []] }, -1] },
        } },
    ]);
    const data = await SupportConversation.populate(conversations, [
        { path: "student", select: "fullName email" },
        { path: "assignedAdmin", select: "fullName" },
    ]);
    return res.status(200).json(new ApiResponse(200, data, "Student support inbox retrieved."));
});

export const getSupportConversation = asyncHandler(async (req, res) => {
    const conversation = await findConversationForUser(req.params.conversationId, req.user);
    const readField = req.user.role === "admin" ? "readByAdmin" : "readByStudent";
    let changed = false;
    for (const message of conversation.messages) {
        if (message.senderRole !== req.user.role && !message[readField]) {
            message[readField] = true;
            changed = true;
        }
    }
    if (changed) await conversation.save();
    return res.status(200).json(new ApiResponse(200, serializeConversation(conversation), "Support conversation retrieved."));
});

export const sendStudentSupportMessage = asyncHandler(async (req, res) => {
    const message = cleanText(req.body.message, "Message");
    const conversation = await findConversationForUser(req.params.conversationId, req.user);
    if (conversation.messages.length >= MAX_MESSAGES_PER_CONVERSATION - 2) {
        throw new ApiError(409, "This conversation reached its message limit. Please open a new support question.");
    }
    addStudentMessage(conversation, req.user, message);
    const assistant = await addAssistantReply(conversation, req.user);
    await conversation.save();
    return res.status(201).json(new ApiResponse(201, {
        conversation: serializeConversation(conversation),
        assistant: {
            confidence: assistant.confidence,
            handoffRequired: assistant.handoffRequired,
        },
    }, "Your follow-up was sent."));
});

export const requestAdminReply = asyncHandler(async (req, res) => {
    const conversation = await findConversationForUser(req.params.conversationId, req.user);
    if (conversation.status === "closed") {
        throw new ApiError(409, "This conversation is closed. Send a new message to reopen it.");
    }
    if (conversation.messages.length >= MAX_MESSAGES_PER_CONVERSATION) {
        throw new ApiError(409, "This conversation reached its message limit. Please open a new support question.");
    }
    conversation.status = "open";
    conversation.messages.push({
        senderRole: "student",
        sender: req.user._id,
        content: "Please have a TPO administrator reply to my question.",
        readByStudent: true,
        readByAdmin: false,
    });
    conversation.lastMessageAt = new Date();
    await conversation.save();
    return res.status(201).json(new ApiResponse(201, serializeConversation(conversation), "Your question is now in the TPO support inbox."));
});

export const replyToSupportConversation = asyncHandler(async (req, res) => {
    const content = cleanText(req.body.message, "Reply");
    const conversation = await findConversationForUser(req.params.conversationId, req.user);
    if (conversation.messages.length >= MAX_MESSAGES_PER_CONVERSATION) {
        throw new ApiError(409, "This conversation reached its message limit. Ask the student to start a new question.");
    }
    conversation.messages.push({
        senderRole: "admin",
        sender: req.user._id,
        content,
        readByStudent: false,
        readByAdmin: true,
    });
    conversation.assignedAdmin = req.user._id;
    conversation.status = "answered";
    conversation.lastMessageAt = new Date();
    await conversation.save();
    return res.status(201).json(new ApiResponse(201, serializeConversation(conversation), "Your reply was sent to the student."));
});

export const updateSupportConversationStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!new Set(["open", "closed"]).has(status)) {
        throw new ApiError(400, "Status must be open or closed.");
    }
    const conversation = await findConversationForUser(req.params.conversationId, req.user);
    conversation.status = status;
    if (status === "open") conversation.assignedAdmin = req.user._id;
    await conversation.save();
    return res.status(200).json(new ApiResponse(200, serializeConversation(conversation), "Conversation status updated."));
});

export const handleAdminCopilotPrompt = asyncHandler(async (req, res) => {
    const prompt = cleanText(req.body.prompt, "Prompt");
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    try {
        const result = await processAdminCopilotPrompt({
            prompt,
            adminUser: req.user,
            messages,
        });
        return res.status(200).json(
            new ApiResponse(200, result, "Admin Copilot response generated successfully.")
        );
    } catch (copilotErr) {
        console.error("[handleAdminCopilotPrompt] Error:", copilotErr);
        throw copilotErr;
    }
});
