import { Router } from "express";
import { verifyAdmin, verifyJWT, verifyStudent } from "../middlewares/auth.middleware.js";
import { applyRateLimiter } from "../middlewares/security.middleware.js";
import { validateApplicationStatus } from "../middlewares/validation.middleware.js";
import {
    applyForPlacement,
    getMyApplications,
    withdrawApplication,
    getApplicationsByDrive,
    updateApplicationStatus,
    getApplicationById,
    getAllApplications,
    respondToOffer,
    adminOverrideApplication,
    checkPreApplicationRequirements,
    exportDriveApplicants
} from "../controllers/application.controller.js";

const router = Router();

// Admin application lists
router.route("/all-applications").get(
    verifyJWT,
    verifyAdmin,
    getAllApplications
);

// Student application routes
router.route("/:driveId/apply").post(
    verifyJWT,
    verifyStudent,
    applyRateLimiter,
    applyForPlacement
);

router.route("/my-applications").get(
    verifyJWT,
    verifyStudent,
    getMyApplications
);

router.route("/:applicationId/withdraw").patch(
    verifyJWT,
    verifyStudent,
    withdrawApplication
);

router.route("/:applicationId/respond-offer").patch(
    verifyJWT,
    verifyStudent,
    respondToOffer
);

router.route("/:driveId/precheck").get(
    verifyJWT,
    verifyStudent,
    checkPreApplicationRequirements
);

// Admin drive application routes, status progression & export
router.route("/drive/:placementDriveId").get(
    verifyJWT,
    verifyAdmin,
    getApplicationsByDrive
);

router.route("/:driveId/export").post(
    verifyJWT,
    verifyAdmin,
    exportDriveApplicants
).get(
    verifyJWT,
    verifyAdmin,
    exportDriveApplicants
);

router.route("/:applicationId/status").patch(
    verifyJWT,
    verifyAdmin,
    validateApplicationStatus,
    updateApplicationStatus
);

router.route("/:applicationId/admin-override").post(
    verifyJWT,
    verifyAdmin,
    adminOverrideApplication
);

// Single application details
router.route("/:applicationId").get(
    verifyJWT,
    verifyAdmin,
    getApplicationById
);

export default router;