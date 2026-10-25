import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema(
    {
        senderRole: {
            type: String,
            enum: ["student", "assistant", "admin"],
            required: true,
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000,
        },
        confidence: { type: Number, min: 0, max: 1, default: null },
        handoffRecommended: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        readByStudent: { type: Boolean, default: false },
        readByAdmin: { type: Boolean, default: false },
    },
    { _id: true }
);

const supportConversationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        status: {
            type: String,
            enum: ["open", "answered", "bot_answered", "closed"],
            default: "open",
            index: true,
        },
        messages: {
            type: [supportMessageSchema],
            validate: [(messages) => messages.length <= 200, "A conversation cannot exceed 200 messages."],
        },
        lastMessageAt: { type: Date, default: Date.now, index: true },
        assignedAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

supportConversationSchema.index({ status: 1, lastMessageAt: -1 });
supportConversationSchema.index({ student: 1, lastMessageAt: -1 });

export const SupportConversation = mongoose.model("SupportConversation", supportConversationSchema);
