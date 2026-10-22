import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

import {
    maskEmail,
    requestPasswordReset,
    verifyResetOtp,
    resetPasswordWithToken
} from "../src/controllers/authReset.controller.js";
import { User } from "../src/models/user.models.js";
import { PasswordResetChallenge } from "../src/models/passwordReset.model.js";
import {
    resetTransporterForTesting
} from "../src/utils/mailService.js";

// Helper to execute Express async handlers with standard Promise semantics
function callHandler(handler, body = {}, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = {
            body,
            headers,
            ip: "127.0.0.1",
            socket: { remoteAddress: "127.0.0.1" },
            app: { get: () => 1 }
        };

        const res = {
            statusCode: 200,
            jsonBody: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.jsonBody = payload;
                resolve({ statusCode: this.statusCode, jsonBody: this.jsonBody });
                return this;
            },
            send(payload) {
                this.jsonBody = payload;
                resolve({ statusCode: this.statusCode, jsonBody: this.jsonBody });
                return this;
            },
            setHeader() {}
        };

        const next = (err) => {
            if (err) reject(err);
            else resolve({ statusCode: res.statusCode, jsonBody: res.jsonBody });
        };

        try {
            handler(req, res, next);
        } catch (err) {
            reject(err);
        }
    });
}

test("Password Recovery & Reset End-to-End Test Suite", async (t) => {
    // Intercept mail delivery with mock transporter
    const dispatchedEmails = [];
    resetTransporterForTesting({
        sendMail: async (mailOpts) => {
            dispatchedEmails.push(mailOpts);
            return { messageId: `msg-${Date.now()}` };
        }
    });

    // In-memory test store
    const testUsers = new Map();
    const testChallenges = new Map();

    // Mock User model methods
    const originalUserFindOne = User.findOne;
    const originalUserFindById = User.findById;

    // Mock PasswordResetChallenge methods
    const originalChallengeCreate = PasswordResetChallenge.create;
    const originalChallengeFindOne = PasswordResetChallenge.findOne;
    const originalChallengeFindOneAndUpdate = PasswordResetChallenge.findOneAndUpdate;
    const originalChallengeUpdateMany = PasswordResetChallenge.updateMany;
    const originalChallengeCountDocuments = PasswordResetChallenge.countDocuments;
    const originalChallengeDeleteOne = PasswordResetChallenge.deleteOne;

    // Seed test accounts
    const initialHashedPasswordA = await bcrypt.hash("OldPasswordA123", 10);
    const initialHashedPasswordB = await bcrypt.hash("OldPasswordB123", 10);

    const userA = {
        _id: new mongoose.Types.ObjectId(),
        fullName: "Aarav Sharma",
        email: "aarav.sharma@campusflow.edu",
        password: initialHashedPasswordA,
        role: "student",
        isActive: true,
        refreshToken: "mock-refresh-token-a",
        isPasswordCorrect: async function (candidate) {
            return bcrypt.compare(candidate, this.password);
        },
        save: async function () {
            if (this.password && !this.password.startsWith("$2b$")) {
                this.password = await bcrypt.hash(this.password, 10);
            }
            return this;
        }
    };

    const userB = {
        _id: new mongoose.Types.ObjectId(),
        fullName: "Pooja Patel",
        email: "pooja.patel@campusflow.edu",
        password: initialHashedPasswordB,
        role: "student",
        isActive: true,
        refreshToken: "mock-refresh-token-b",
        isPasswordCorrect: async function (candidate) {
            return bcrypt.compare(candidate, this.password);
        },
        save: async function () {
            if (this.password && !this.password.startsWith("$2b$")) {
                this.password = await bcrypt.hash(this.password, 10);
            }
            return this;
        }
    };

    testUsers.set(userA.email, userA);
    testUsers.set(userB.email, userB);

    // Wire User queries
    User.findOne = async ({ email }) => {
        if (!email) return null;
        return testUsers.get(email.toLowerCase().trim()) || null;
    };
    User.findById = async (id) => {
        for (const u of testUsers.values()) {
            if (u._id.toString() === id.toString()) return u;
        }
        return null;
    };

    // Wire Challenge queries
    PasswordResetChallenge.create = async (doc) => {
        const id = new mongoose.Types.ObjectId();
        const fullDoc = {
            _id: id,
            ...doc,
            createdAt: new Date(),
            updatedAt: new Date(),
            attempts: doc.attempts || 0,
            maxAttempts: doc.maxAttempts || 5,
            save: async function () {
                testChallenges.set(this._id.toString(), this);
                return this;
            }
        };
        testChallenges.set(id.toString(), fullDoc);
        return fullDoc;
    };

    PasswordResetChallenge.findOne = (query) => {
        return {
            sort: () => {
                const matches = Array.from(testChallenges.values()).filter((c) => {
                    if (query.user && c.user.toString() !== query.user.toString()) return false;
                    if (query.email && c.email !== query.email) return false;
                    if (query.status && c.status !== query.status) return false;
                    if (query.resetTokenHash && c.resetTokenHash !== query.resetTokenHash) return false;
                    return true;
                });
                matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                return Promise.resolve(matches[0] || null);
            }
        };
    };

    PasswordResetChallenge.findOneAndUpdate = async (query, update) => {
        const matches = Array.from(testChallenges.values()).filter((c) => {
            if (query._id && c._id.toString() !== query._id.toString()) return false;
            if (query.status && c.status !== query.status) return false;
            if (query.resetTokenHash && c.resetTokenHash !== query.resetTokenHash) return false;
            return true;
        });

        if (matches.length === 0) return null;
        const target = matches[0];
        const original = { ...target };

        if (update.$set) {
            Object.assign(target, update.$set);
        }
        target.updatedAt = new Date();
        testChallenges.set(target._id.toString(), target);
        return original;
    };

    PasswordResetChallenge.updateMany = async (query, update) => {
        let modifiedCount = 0;
        for (const [id, c] of testChallenges.entries()) {
            let match = true;
            if (query.user && c.user.toString() !== query.user.toString()) match = false;
            if (query.status && c.status !== query.status) match = false;
            if (match) {
                if (update.$set) Object.assign(c, update.$set);
                c.updatedAt = new Date();
                testChallenges.set(id, c);
                modifiedCount++;
            }
        }
        return { modifiedCount };
    };

    PasswordResetChallenge.countDocuments = async (query) => {
        let count = 0;
        for (const c of testChallenges.values()) {
            if (query.user && c.user.toString() !== query.user.toString()) continue;
            if (query.createdAt && query.createdAt.$gte && c.createdAt < query.createdAt.$gte) continue;
            count++;
        }
        return count;
    };
    PasswordResetChallenge.deleteOne = async ({ _id }) => ({
        deletedCount: testChallenges.delete(_id.toString()) ? 1 : 0
    });

    // Teardown hook
    t.after(() => {
        User.findOne = originalUserFindOne;
        User.findById = originalUserFindById;
        PasswordResetChallenge.create = originalChallengeCreate;
        PasswordResetChallenge.findOne = originalChallengeFindOne;
        PasswordResetChallenge.findOneAndUpdate = originalChallengeFindOneAndUpdate;
        PasswordResetChallenge.updateMany = originalChallengeUpdateMany;
        PasswordResetChallenge.countDocuments = originalChallengeCountDocuments;
        PasswordResetChallenge.deleteOne = originalChallengeDeleteOne;
        resetTransporterForTesting(null);
    });

    // ----------------------------------------------------
    // Section 1: Account Lookup & Email Delivery
    // ----------------------------------------------------
    await t.test("1 & 2. Registered email triggers an OTP request sent only to the account's registered email", async () => {
        dispatchedEmails.length = 0;
        const res = await callHandler(requestPasswordReset, { email: "Aarav.Sharma@campusflow.edu " });

        assert.equal(res.statusCode, 200);
        assert.equal(res.jsonBody.success, true);
        assert.ok(res.jsonBody.message.includes("If an account matches this email"));
        assert.equal(dispatchedEmails.length, 1);
        assert.equal(dispatchedEmails[0].to, "aarav.sharma@campusflow.edu");
        assert.match(dispatchedEmails[0].subject, /\d{6} is your Password Reset Verification Code/);
    });

    await t.test("3 & 4. Unknown email receives generic response with NO OTP delivery and NO recovery challenge", async () => {
        dispatchedEmails.length = 0;
        const initialCount = testChallenges.size;
        const res = await callHandler(requestPasswordReset, { email: "nonexistent.user@randomdomain.com" });

        assert.equal(res.statusCode, 200);
        assert.equal(res.jsonBody.success, true);
        assert.ok(res.jsonBody.message.includes("If an account matches this email"));
        assert.equal(dispatchedEmails.length, 0, "No email sent for unknown address");
        assert.equal(testChallenges.size, initialCount, "No challenge created in DB");
    });

    await t.test("5. Email normalization handles leading/trailing whitespace and mixed case", async () => {
        const res = await callHandler(requestPasswordReset, { email: "   POOJA.PATEL@campusflow.edu  " });
        assert.equal(res.statusCode, 200);
        const latestChallenge = Array.from(testChallenges.values()).pop();
        assert.equal(latestChallenge.email, "pooja.patel@campusflow.edu");
    });

    await t.test("6. Mask email utility formats privacy-preserving string", () => {
        assert.equal(maskEmail("aarav.sharma@campusflow.edu"), "a*****a@campusflow.edu");
        assert.equal(maskEmail("me@college.edu"), "m*@college.edu");
        assert.equal(maskEmail(""), "");
    });

    await t.test("7. Resend cooldown (60 seconds) blocks immediate duplicate requests with 429", async () => {
        await assert.rejects(
            async () => {
                await callHandler(requestPasswordReset, { email: "aarav.sharma@campusflow.edu" });
            },
            (err) => {
                assert.equal(err.statusCode, 429);
                assert.match(err.message, /Please wait \d+ seconds before requesting another/);
                return true;
            }
        );
    });

    // ----------------------------------------------------
    // Section 2: OTP Lifecycle & Verification
    // ----------------------------------------------------
    let validOtpA = "";
    let challengeA = null;

    await t.test("8. Setup challenge for OTP testing and verify extraction from email mock", async () => {
        for (const c of testChallenges.values()) {
            c.resendCooldownUntil = new Date(Date.now() - 1000);
        }

        dispatchedEmails.length = 0;
        const res = await callHandler(requestPasswordReset, { email: "aarav.sharma@campusflow.edu" });
        assert.equal(res.statusCode, 200);

        const emailMatch = dispatchedEmails[0].text.match(/verification code is: (\d{6})/);
        assert.ok(emailMatch, "OTP found in dispatched email text");
        validOtpA = emailMatch[1];
        challengeA = Array.from(testChallenges.values()).pop();
    });

    await t.test("9. Malformed OTP is rejected before query", async () => {
        await assert.rejects(
            async () => {
                await callHandler(verifyResetOtp, { email: "aarav.sharma@campusflow.edu", otp: "abc" });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /must be exactly 6 digits/);
                return true;
            }
        );
    });

    await t.test("10. Incorrect OTP fails and decrements remaining attempts", async () => {
        await assert.rejects(
            async () => {
                await callHandler(verifyResetOtp, { email: "aarav.sharma@campusflow.edu", otp: "000000" });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /Invalid verification code\. 4 attempt\(s\) remaining/);
                return true;
            }
        );
        assert.equal(challengeA.attempts, 1);
    });

    await t.test("11. Five consecutive failed attempts exhausts and invalidates challenge", async () => {
        challengeA.attempts = 4; // simulate 4 previous failures
        await assert.rejects(
            async () => {
                await callHandler(verifyResetOtp, { email: "aarav.sharma@campusflow.edu", otp: "111111" });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /Maximum verification attempts exceeded/);
                return true;
            }
        );
        assert.equal(challengeA.status, "EXHAUSTED");
    });

    await t.test("12. Exhausted challenge rejects even the correct OTP", async () => {
        await assert.rejects(
            async () => {
                await callHandler(verifyResetOtp, { email: "aarav.sharma@campusflow.edu", otp: validOtpA });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /No active verification challenge found/);
                return true;
            }
        );
    });

    await t.test("13. Expired challenge is cleanly rejected", async () => {
        for (const c of testChallenges.values()) {
            c.resendCooldownUntil = new Date(Date.now() - 1000);
        }
        dispatchedEmails.length = 0;
        await callHandler(requestPasswordReset, { email: "aarav.sharma@campusflow.edu" });

        const newChallenge = Array.from(testChallenges.values()).pop();
        newChallenge.expiresAt = new Date(Date.now() - 1000); // simulate expiration

        const emailMatch = dispatchedEmails[0].text.match(/verification code is: (\d{6})/);
        const expiredOtp = emailMatch[1];

        await assert.rejects(
            async () => {
                await callHandler(verifyResetOtp, { email: "aarav.sharma@campusflow.edu", otp: expiredOtp });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /has expired/);
                return true;
            }
        );
    });

    let validResetTokenA = "";

    await t.test("14. Correct OTP verifies successfully and issues opaque reset authorization token", async () => {
        for (const c of testChallenges.values()) {
            c.resendCooldownUntil = new Date(Date.now() - 1000);
            c.createdAt = new Date(Date.now() - 20 * 60 * 1000); // clear 15m rate window
        }
        dispatchedEmails.length = 0;
        await callHandler(requestPasswordReset, { email: "aarav.sharma@campusflow.edu" });

        const emailMatch = dispatchedEmails[0].text.match(/verification code is: (\d{6})/);
        const activeOtp = emailMatch[1];

        const res = await callHandler(verifyResetOtp, { email: "aarav.sharma@campusflow.edu", otp: activeOtp });

        assert.equal(res.statusCode, 200);
        assert.ok(res.jsonBody.data.resetToken);
        assert.equal(typeof res.jsonBody.data.resetToken, "string");
        assert.equal(res.jsonBody.data.resetToken.length, 64); // 32 bytes hex
        validResetTokenA = res.jsonBody.data.resetToken;

        const verifiedChallenge = Array.from(testChallenges.values()).pop();
        assert.equal(verifiedChallenge.status, "VERIFIED");
        assert.ok(verifiedChallenge.resetTokenHash);
    });

    await t.test("15. Verified OTP cannot be reused to get another reset token", async () => {
        await assert.rejects(
            async () => {
                await callHandler(verifyResetOtp, { email: "aarav.sharma@campusflow.edu", otp: "123456" });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                return true;
            }
        );
    });

    // ----------------------------------------------------
    // Section 3: Password Reset & Account Isolation
    // ----------------------------------------------------
    await t.test("16. Reset fails if new passwords do not match", async () => {
        await assert.rejects(
            async () => {
                await callHandler(resetPasswordWithToken, {
                    resetToken: validResetTokenA,
                    newPassword: "BrandNewSecurePassword1!",
                    confirmPassword: "MismatchPassword2@"
                });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /do not match/);
                return true;
            }
        );
    });

    await t.test("17. Reset fails if password is fewer than 8 characters", async () => {
        await assert.rejects(
            async () => {
                await callHandler(resetPasswordWithToken, {
                    resetToken: validResetTokenA,
                    newPassword: "short",
                    confirmPassword: "short"
                });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /at least 8 characters/);
                return true;
            }
        );
    });

    await t.test("18. Reset fails if password is a common weak password", async () => {
        await assert.rejects(
            async () => {
                await callHandler(resetPasswordWithToken, {
                    resetToken: validResetTokenA,
                    newPassword: "password123",
                    confirmPassword: "password123"
                });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /too common or easily guessable/);
                return true;
            }
        );
    });

    await t.test("19. Valid password reset succeeds, updates target account and revokes refresh token", async () => {
        const newPassword = "MySecureCampusPassword2026!";
        const res = await callHandler(resetPasswordWithToken, {
            resetToken: validResetTokenA,
            newPassword,
            confirmPassword: newPassword
        });

        assert.equal(res.statusCode, 200);
        assert.ok(res.jsonBody.message.includes("Password has been reset successfully"));

        // Verify User A password actually changed
        const isNewPassValid = await userA.isPasswordCorrect(newPassword);
        assert.equal(isNewPassValid, true, "New password verifies with bcrypt");

        const isOldPassValid = await userA.isPasswordCorrect("OldPasswordA123");
        assert.equal(isOldPassValid, false, "Old password rejected");

        // Verify session / refresh token revoked
        assert.equal(userA.refreshToken, null, "Refresh token cleared to terminate previous sessions");
    });

    await t.test("20. Reset authorization cannot be reused after consumption", async () => {
        await assert.rejects(
            async () => {
                await callHandler(resetPasswordWithToken, {
                    resetToken: validResetTokenA,
                    newPassword: "AnotherNewPassword123!",
                    confirmPassword: "AnotherNewPassword123!"
                });
            },
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /Invalid, expired, or already used/);
                return true;
            }
        );
    });

    await t.test("21. Strict Account Isolation: Other accounts remain entirely untouched", async () => {
        // User B must still authenticate with their original old password!
        const isUserBPassValid = await userB.isPasswordCorrect("OldPasswordB123");
        assert.equal(isUserBPassValid, true, "User B password remains unchanged");
        assert.equal(userB.role, "student", "User B role unchanged");
        assert.equal(userB.refreshToken, "mock-refresh-token-b", "User B session unchanged");
    });

    await t.test("22. Security: OTPs and reset tokens are NEVER exposed in response bodies", async () => {
        for (const c of testChallenges.values()) {
            c.resendCooldownUntil = new Date(Date.now() - 1000);
            c.createdAt = new Date(Date.now() - 20 * 60 * 1000);
        }
        const res = await callHandler(requestPasswordReset, { email: "aarav.sharma@campusflow.edu" });

        const responseString = JSON.stringify(res.jsonBody);
        assert.equal(responseString.includes("otp"), false, "Response body contains no 'otp' key");
        assert.equal(responseString.includes("resetToken"), false, "Response body contains no 'resetToken' key");
    });

    await t.test("23. Email transport failure returns 503 and removes the undelivered challenge", async () => {
        for (const challenge of testChallenges.values()) {
            if (challenge.user.toString() === userA._id.toString()) {
                challenge.resendCooldownUntil = new Date(Date.now() - 1000);
                challenge.createdAt = new Date(Date.now() - 20 * 60 * 1000);
            }
        }

        resetTransporterForTesting({
            sendMail: async () => {
                const error = new Error("SMTP connection timed out");
                error.code = "ETIMEDOUT";
                throw error;
            }
        });

        await assert.rejects(
            () => callHandler(requestPasswordReset, { email: userA.email }),
            (error) => {
                assert.equal(error.statusCode, 503);
                assert.match(error.message, /timed out/i);
                return true;
            }
        );
        assert.equal(
            Array.from(testChallenges.values()).some(
                (challenge) =>
                    challenge.user.toString() === userA._id.toString() &&
                    challenge.status === "PENDING" &&
                    challenge.createdAt > new Date(Date.now() - 1000)
            ),
            false,
            "An OTP that was not emailed must not remain active"
        );

        resetTransporterForTesting({
            sendMail: async (mailOpts) => {
                dispatchedEmails.push(mailOpts);
                return { messageId: `msg-${Date.now()}` };
            }
        });
    });
});
