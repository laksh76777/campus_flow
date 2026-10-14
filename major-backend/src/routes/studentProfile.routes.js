import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
    createStudentProfile,
    getCurrentStudentProfile,
    updateStudentProfile,
    updateStudentResume,
    getAllStudentProfiles,
    getStudentProfileById,
    addSemesterResult,
    addBacklogRecord,
    verifyStudentProfile,
    safeMigrateExistingProfiles
} from "../controllers/studentProfile.controller.js";

const router = Router();

// Student-accessible profile routes
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
router.route("/semester-result").post(verifyJWT, addSemesterResult);
router.route("/backlog-record").post(verifyJWT, addBacklogRecord);

// Admin-accessible batch & audit routes
router.route("/all-students").get(verifyJWT, verifyAdmin, getAllStudentProfiles);
router.route("/migrate-profiles").post(verifyJWT, verifyAdmin, safeMigrateExistingProfiles);

// Dynamic studentId routes
router.route("/:studentId/verify").patch(verifyJWT, verifyAdmin, verifyStudentProfile);
router.route("/:studentId").get(verifyJWT, verifyAdmin, getStudentProfileById);

export default router;