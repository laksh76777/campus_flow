import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword,
    currentUser,
    updateAccountDetails,
    refreshAccessToken,
    updateUserAvatar,
    deleteUserAvatar
} from "../controllers/user.controllers.js";
import {
    requestPasswordReset,
    verifyResetOtp,
    resetPasswordWithToken
} from "../controllers/authReset.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    authRateLimiter,
    passwordResetRequestLimiter,
    passwordResetActionLimiter
} from "../middlewares/security.middleware.js";
import { validateRegister, validateLogin } from "../middlewares/validation.middleware.js";

const router = Router();

// Password Reset Flow (Public, Rate-limited)
router.route("/forgot-password").post(passwordResetRequestLimiter, requestPasswordReset);
router.route("/verify-reset-otp").post(passwordResetActionLimiter, verifyResetOtp);
router.route("/reset-password").post(passwordResetActionLimiter, resetPasswordWithToken);

router.route("/register").post(
    authRateLimiter,
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }
    ]),
    validateRegister,
    registerUser
);

router.route("/login").post(
    authRateLimiter,
    validateLogin,
    loginUser
);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/current-user").get(verifyJWT, currentUser);
router.route("/update-account-details").patch(verifyJWT, updateAccountDetails);
router.route("/update-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/delete-avatar").delete(verifyJWT, deleteUserAvatar);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

export default router;