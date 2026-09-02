import { Router } from "express";
import { registerUser,loginUser,logoutUser
    ,changeCurrentPassword, currentUser, updateAccountDetails, refreshAccessToken
 } from "../controllers/user.controllers.js";
 import { upload } from "../middlewares/multer.middleware.js";
 import { verifyJWT } from "../middlewares/auth.middleware.js";
 const router = Router();
 router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        }
    ]),registerUser)
    router.route("/login").post(loginUser);
    router.route("/logout").post(verifyJWT,logoutUser);
    router.route("/refresh-token").post(refreshAccessToken);
    router.route("/current-user").get(verifyJWT,currentUser);
    router.route("/update-account-details").patch(verifyJWT,updateAccountDetails);
    router.route("/change-password").post(verifyJWT,changeCurrentPassword);
    export default router;