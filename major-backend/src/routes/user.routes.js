import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword,
    currentUser,
    updateAccountDetails,
    refreshAccessToken
} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/security.middleware.js";
import { validateRegister, validateLogin } from "../middlewares/validation.middleware.js";

const router = Router();

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
    router.route("/logout").post(verifyJWT,logoutUser);
    router.route("/refresh-token").post(refreshAccessToken);
    router.route("/current-user").get(verifyJWT,currentUser);
    router.route("/update-account-details").patch(verifyJWT,updateAccountDetails);
    router.route("/change-password").post(verifyJWT,changeCurrentPassword);
    export default router;