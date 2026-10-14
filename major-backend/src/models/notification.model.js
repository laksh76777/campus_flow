import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ["status_update", "interview", "selection", "rejection", "general", "announcement", "urgent"],
            default: "status_update",
        },
        status: {
            type: String,
            enum: ["applied", "shortlisted", "interview", "selected", "rejected", "withdrawn"],
        },
        companyName: {
            type: String,
            default: "",
        },
        jobTitle: {
            type: String,
            default: "",
        },
        remarks: {
            type: String,
            default: "",
        },
        interviewDate: {
            type: Date,
        },
        interviewRound: {
            type: String,
            default: "",
        },
        interviewLocation: {
            type: String,
            default: "",
        },
        offeredPackage: {
            type: Number,
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        application: {
            type: Schema.Types.ObjectId,
            ref: "Application",
        },
    },
    {
        timestamps: true,
    }
);

export const Notification = mongoose.model("Notification", notificationSchema);
