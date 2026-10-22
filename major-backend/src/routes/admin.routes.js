import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { registerAdmin, loginAdmin, logoutAdmin, getCurrentAdmin } from "../controllers/admin.controller.js";
import {
    requestPasswordReset,
    verifyResetOtp,
    resetPasswordWithToken
} from "../controllers/authReset.controller.js";
import {
    passwordResetRequestLimiter,
    passwordResetActionLimiter
} from "../middlewares/security.middleware.js";

const router = Router();

// Password Reset Flow for Administrators
router.route("/forgot-password").post(passwordResetRequestLimiter, requestPasswordReset);
router.route("/verify-reset-otp").post(passwordResetActionLimiter, verifyResetOtp);
router.route("/reset-password").post(passwordResetActionLimiter, resetPasswordWithToken);

router.route("/register").post(registerAdmin);
router.route("/login").post(loginAdmin);
router.route("/current-admin").get(
    verifyJWT,
    verifyAdmin,
    getCurrentAdmin
);
router.route("/logout").post(
    verifyJWT,
    verifyAdmin,
    logoutAdmin
);

export default router;