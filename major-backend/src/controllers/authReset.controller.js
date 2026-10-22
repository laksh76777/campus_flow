import crypto from "node:crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
import { PasswordResetChallenge } from "../models/passwordReset.model.js";
import { sendPasswordResetOtpEmail, validateEmailAddress } from "../utils/mailService.js";

const COMMON_WEAK_PASSWORDS = new Set([
    "password",
    "password123",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "admin123",
    "campusflow",
    "campusflow123",
    "welcome123"
]);

/**
 * Safely masks an email address for privacy (e.g., j***n@domain.com)
 */
export const maskEmail = (email) => {
    if (!email || typeof email !== "string" || !email.includes("@")) return email || "";
    const [localPart, domain] = email.split("@");
    if (localPart.length <= 2) {
        return `${localPart[0]}*@${domain}`;
    }
    const visibleStart = localPart[0];
    const visibleEnd = localPart[localPart.length - 1];
    const maskedLength = Math.min(localPart.length - 2, 5);
    return `${visibleStart}${"*".repeat(maskedLength)}${visibleEnd}@${domain}`;
};

/**
 * Step 1: Request Password Reset OTP
 * Public endpoint to request a 6-digit numeric OTP.
 * Protects against account enumeration by returning the same generic response.
 */
export const requestPasswordReset = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !validateEmailAddress(email.trim())) {
        throw new ApiError(400, "A valid email address is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const publicGenericResponse = {
        email: maskEmail(normalizedEmail),
        cooldownSeconds: 60,
        expiryMinutes: 5
    };

    const user = await User.findOne({ email: normalizedEmail });

    // Account enumeration protection: Return generic success if account does not exist or is inactive
    if (!user || user.isActive === false) {
        if (process.env.NODE_ENV !== "production") {
            console.warn(`[AUTH DEV] Password reset requested for unregistered or inactive email: ${normalizedEmail}`);
        }
        return res.status(200).json(
            new ApiResponse(
                200,
                publicGenericResponse,
                "If an account matches this email, a verification code will be sent."
            )
        );
    }

    // Check resend cooldown on recent pending challenge
    const activeChallenge = await PasswordResetChallenge.findOne({
        user: user._id,
        status: "PENDING"
    }).sort({ createdAt: -1 });

    if (activeChallenge && activeChallenge.resendCooldownUntil && activeChallenge.resendCooldownUntil > new Date()) {
        const cooldownRemainingSec = Math.ceil(
            (activeChallenge.resendCooldownUntil.getTime() - Date.now()) / 1000
        );
        throw new ApiError(
            429,
            `Please wait ${cooldownRemainingSec} seconds before requesting another verification code.`
        );
    }

    // Check abuse limit: Maximum 5 OTP requests per 15 minutes per account in dev, 3 in production
    const maxRequests = process.env.NODE_ENV === "production" ? 3 : 6;
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentRequestsCount = await PasswordResetChallenge.countDocuments({
        user: user._id,
        createdAt: { $gte: fifteenMinutesAgo }
    });

    if (recentRequestsCount >= maxRequests) {
        throw new ApiError(
            429,
            "Too many password reset requests for this account. Please wait 15 minutes before trying again."
        );
    }

    // Invalidate previous pending challenges so only the newest OTP is valid
    await PasswordResetChallenge.updateMany(
        { user: user._id, status: "PENDING" },
        { $set: { status: "SUPERSEDED" } }
    );

    // Generate cryptographically random 6-digit numeric OTP
    const otpNumber = crypto.randomInt(100000, 1000000);
    const otp = otpNumber.toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL
    const resendCooldownUntil = new Date(Date.now() + 60 * 1000); // 60 seconds cooldown

    const newChallenge = await PasswordResetChallenge.create({
        user: user._id,
        email: user.email,
        otpHash,
        expiresAt,
        resendCooldownUntil,
        sendCount: recentRequestsCount + 1,
        status: "PENDING"
    });

    // Send email using existing SMTP infrastructure
    const emailResult = await sendPasswordResetOtpEmail({
        to: user.email,
        recipientName: user.fullName,
        otp,
        expiryMinutes: 5
    });

    if (emailResult.accepted === false) {
        console.error("[PasswordReset] OTP delivery issue:", emailResult.category || emailResult.error);
        // Clean up challenge on failure so user isn't locked out or penalized
        await PasswordResetChallenge.deleteOne({ _id: newChallenge._id });

        if (emailResult.category === "NOT_CONFIGURED") {
            throw new ApiError(
                503,
                "Email delivery service is currently unavailable. Please contact the placement administrator."
            );
        }
        if (emailResult.category === "AUTH_FAILED" || emailResult.category === "CONNECTION_FAILED") {
            throw new ApiError(
                503,
                "Unable to deliver verification code due to a mail server connection issue. Please try again later."
            );
        }
        throw new ApiError(
            503,
            emailResult.error || "Unable to deliver verification code email. Please try again later."
        );
    }

    if (process.env.NODE_ENV !== "production") {
        console.log(`\n======================================================`);
        console.log(`[AUTH DEV] Password Reset OTP for ${user.email}: ${otp}`);
        console.log(`======================================================\n`);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            publicGenericResponse,
            "If an account matches this email, a verification code will be sent."
        )
    );
});

/**
 * Step 2: Verify Recovery OTP
 * Checks code, verifies challenge status and attempt limits, issues a short-lived reset authorization token.
 */
export const verifyResetOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        throw new ApiError(400, "Email and 6-digit verification code are required");
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
        throw new ApiError(400, "Verification code must be exactly 6 digits");
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const challenge = await PasswordResetChallenge.findOne({
        email: normalizedEmail,
        status: "PENDING"
    }).sort({ createdAt: -1 });

    if (!challenge) {
        throw new ApiError(400, "No active verification challenge found. Please request a new code.");
    }

    // Check expiration
    if (new Date() > challenge.expiresAt) {
        challenge.status = "EXHAUSTED";
        await challenge.save();
        throw new ApiError(400, "The verification code has expired. Please request a new code.");
    }

    // Check attempt limits
    if (challenge.attempts >= challenge.maxAttempts) {
        challenge.status = "EXHAUSTED";
        await challenge.save();
        throw new ApiError(400, "Maximum verification attempts exceeded. Please request a new code.");
    }

    // Secure timing-safe hash comparison
    const candidateHash = crypto.createHash("sha256").update(cleanOtp).digest("hex");
    const isMatch = crypto.timingSafeEqual(
        Buffer.from(candidateHash),
        Buffer.from(challenge.otpHash)
    );

    if (!isMatch) {
        challenge.attempts += 1;
        const remaining = Math.max(0, challenge.maxAttempts - challenge.attempts);
        if (challenge.attempts >= challenge.maxAttempts) {
            challenge.status = "EXHAUSTED";
        }
        await challenge.save();

        if (remaining <= 0) {
            throw new ApiError(
                400,
                "Maximum verification attempts exceeded. Challenge invalidated. Please request a new code."
            );
        }

        throw new ApiError(400, `Invalid verification code. ${remaining} attempt(s) remaining.`);
    }

    // Verification succeeded: Issue opaque single-use reset authorization token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    challenge.status = "VERIFIED";
    challenge.resetTokenHash = resetTokenHash;
    challenge.verifiedAt = new Date();
    challenge.resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes to submit new password
    await challenge.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                resetToken,
                expiresIn: 600
            },
            "Verification code confirmed successfully."
        )
    );
});

/**
 * Step 3: Complete Password Reset
 * Validates reset authorization token, enforces password policy, hashes password, revokes session, and completes recovery.
 */
export const resetPasswordWithToken = asyncHandler(async (req, res) => {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || typeof resetToken !== "string" || resetToken.trim().length < 32) {
        throw new ApiError(400, "A valid reset authorization token is required");
    }

    if (!newPassword || typeof newPassword !== "string") {
        throw new ApiError(400, "New password is required");
    }

    if (newPassword.length < 8) {
        throw new ApiError(400, "Password must contain at least 8 characters");
    }

    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
        throw new ApiError(400, "Password and confirm password do not match");
    }

    if (COMMON_WEAK_PASSWORDS.has(newPassword.toLowerCase().trim())) {
        throw new ApiError(400, "Password is too common or easily guessable. Please choose a stronger password.");
    }

    const tokenHash = crypto.createHash("sha256").update(resetToken.trim()).digest("hex");

    // Atomically find and consume the verified challenge
    const challenge = await PasswordResetChallenge.findOneAndUpdate(
        {
            resetTokenHash: tokenHash,
            status: "VERIFIED"
        },
        {
            $set: {
                status: "CONSUMED",
                consumedAt: new Date(),
                resetTokenHash: null
            }
        },
        { new: false } // return original document before update
    );

    if (!challenge) {
        throw new ApiError(400, "Invalid, expired, or already used reset authorization. Please start again.");
    }

    if (!challenge.resetTokenExpiresAt || new Date() > challenge.resetTokenExpiresAt) {
        throw new ApiError(400, "Password reset authorization has expired. Please request a new verification code.");
    }

    // Update only the intended user account
    const user = await User.findById(challenge.user);
    if (!user || user.isActive === false) {
        throw new ApiError(404, "User account not found or has been deactivated");
    }

    user.password = newPassword;
    user.refreshToken = null; // Invalidate refresh token / sessions
    await user.save();

    // Invalidate any other outstanding challenges for this account
    await PasswordResetChallenge.updateMany(
        { user: user._id, status: "PENDING" },
        { $set: { status: "SUPERSEDED" } }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Password has been reset successfully. You can now log in with your new password."
        )
    );
});
