import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import { upload, validateResumeUpload } from "../middlewares/multer.middleware.js";
import {
    createStudentProfile,
    getCurrentStudentProfile,
    updateStudentProfile,
    updateStudentResume,
    deleteStudentResume,
    getAllStudentProfiles,
    getStudentProfileById,
    getStudentResumeDownloadUrl,
    addSemesterResult,
    addBacklogRecord,
    deleteBacklogRecord,
    verifyStudentProfile,
    safeMigrateExistingProfiles,
    lockStudentProfile,
    unlockStudentProfile,
    submitModificationRequest,
    getModificationRequests,
    reviewModificationRequest,
    validateCertificate,
    addCertificate,
    deleteCertificate,
    reviewCertificate
} from "../controllers/studentProfile.controller.js";
import { certificateValidationLimiter } from "../middlewares/security.middleware.js";

const router = Router();

// Student-accessible profile routes
router
    .route("/create-student-profile")
    .post(
        verifyJWT,
        upload.single("resume"),
        validateResumeUpload,
        createStudentProfile
    );
router
    .route("/current-student-profile")
    .get(verifyJWT, getCurrentStudentProfile);

router.route("/update-profile").patch(verifyJWT, updateStudentProfile);
router.route("/update-resume").patch(verifyJWT, upload.single("resume"), validateResumeUpload, updateStudentResume);
router.route("/delete-resume").delete(verifyJWT, deleteStudentResume);
router.route("/semester-result").post(verifyJWT, addSemesterResult);
router.route("/backlog-record").post(verifyJWT, addBacklogRecord);
router.route("/backlog-record/:backlogId").delete(verifyJWT, deleteBacklogRecord);

// Profile Locking & Modification Requests
router.route("/lock-profile").post(verifyJWT, lockStudentProfile);
router.route("/request-modification").post(verifyJWT, submitModificationRequest);

// Certificate Verification & Management
router.route("/certificates/validate").post(
    verifyJWT,
    certificateValidationLimiter,
    upload.single("document"),
    validateCertificate
);
router.route("/certificates").post(verifyJWT, addCertificate);
router.route("/certificates/:certId").delete(verifyJWT, deleteCertificate);

// Admin-accessible batch & audit routes
router.route("/all-students").get(verifyJWT, verifyAdmin, getAllStudentProfiles);
router.route("/:studentId/resume-download").get(verifyJWT, verifyAdmin, getStudentResumeDownloadUrl);
router.route("/migrate-profiles").post(verifyJWT, verifyAdmin, safeMigrateExistingProfiles);
router.route("/modification-requests").get(verifyJWT, verifyAdmin, getModificationRequests);
router.route("/modification-requests/:requestId/review").post(verifyJWT, verifyAdmin, reviewModificationRequest);

// Admin Certificate Review
router.route("/certificates/:studentId/:certId/review").patch(
    verifyJWT,
    verifyAdmin,
    reviewCertificate
);

// Dynamic studentId routes
router.route("/:studentId/verify").patch(verifyJWT, verifyAdmin, verifyStudentProfile);
router.route("/:studentId/unlock-profile").post(verifyJWT, verifyAdmin, unlockStudentProfile);
router.route("/:studentId").get(verifyJWT, verifyAdmin, getStudentProfileById);

export default router;