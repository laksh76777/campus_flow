import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        otpHash: {
            type: String,
            required: true
        },
        resetTokenHash: {
            type: String,
            default: null,
            index: true
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true
        },
        resetTokenExpiresAt: {
            type: Date,
            default: null
        },
        attempts: {
            type: Number,
            default: 0
        },
        maxAttempts: {
            type: Number,
            default: 5
        },
        resendCooldownUntil: {
            type: Date,
            default: Date.now
        },
        sendCount: {
            type: Number,
            default: 1
        },
        status: {
            type: String,
            enum: ["PENDING", "VERIFIED", "CONSUMED", "EXHAUSTED", "SUPERSEDED"],
            default: "PENDING",
            index: true
        },
        verifiedAt: {
            type: Date,
            default: null
        },
        consumedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// TTL index to automatically prune historical challenges after 48 hours
passwordResetSchema.index({ createdAt: 1 }, { expireAfterSeconds: 48 * 3600 });
passwordResetSchema.index({ email: 1, status: 1 });

export const PasswordResetChallenge = mongoose.model("PasswordResetChallenge", passwordResetSchema);
