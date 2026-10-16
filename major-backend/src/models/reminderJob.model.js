import mongoose, { Schema } from "mongoose";

const reminderJobSchema = new Schema(
    {
        drive: {
            type: Schema.Types.ObjectId,
            ref: "PlacementDrive",
            required: true,
            index: true,
        },
        idempotencyKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        offsetHours: {
            type: Number,
            required: true,
        },
        scheduledTime: {
            type: Date,
            required: true,
            index: true,
        },
        driveDeadline: {
            type: Date,
            required: true,
        },
        channels: {
            type: [String],
            enum: ["in_app", "email"],
            default: ["in_app", "email"],
        },
        status: {
            type: String,
            enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"],
            default: "PENDING",
            index: true,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        maxAttempts: {
            type: Number,
            default: 3,
        },
        lastAttemptAt: {
            type: Date,
        },
        errorCategory: {
            type: String,
            default: "",
        },
        deliverySummary: {
            targetedCandidates: { type: Number, default: 0 },
            inAppCreated: { type: Number, default: 0 },
            emailAccepted: { type: Number, default: 0 },
            emailFailed: { type: Number, default: 0 },
            skippedAlreadyApplied: { type: Number, default: 0 },
            skippedIneligible: { type: Number, default: 0 },
            skippedMissingEmail: { type: Number, default: 0 },
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient scheduler queries
reminderJobSchema.index({ status: 1, scheduledTime: 1 });

export const ReminderJob = mongoose.model("ReminderJob", reminderJobSchema);
