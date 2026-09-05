import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
    createStudentProfile,
    getCurrentStudentProfile,
    updateStudentProfile,
    updateStudentResume,
    getAllStudentProfiles
} from "../controllers/studentProfile.controller.js";

const router = Router();

router
    .route("/create-student-profile")
    .post(
        verifyJWT,
        upload.single("resume"),
        createStudentProfile
    );
router
    .route("/current-student-profile")
    .get(verifyJWT, getCurrentStudentProfile);
router.route("/update-profile").patch(verifyJWT, updateStudentProfile);
router.route("/update-resume").patch(verifyJWT, upload.single("resume"), updateStudentResume);
router.route("/all-students").get(verifyJWT, verifyAdmin, getAllStudentProfiles);

export default router;