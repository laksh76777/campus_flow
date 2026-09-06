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
    getAllApplications
} from "../controllers/application.controller.js";

const router = Router();

router.route("/all-applications").get(
    verifyJWT,
    verifyAdmin,
    getAllApplications
);

router
    .route("/:driveId/apply")
    .post(
        verifyJWT,
        verifyStudent,
        applyRateLimiter,
        applyForPlacement
    );
router
    .route("/my-applications")
    .get(
        verifyJWT,
        verifyStudent,
        getMyApplications
    );
router
    .route("/:applicationId/withdraw")
    .patch(
        verifyJWT,
        verifyStudent,
        withdrawApplication
    );
router.route("/drive/:placementDriveId").get(
    verifyJWT,
    verifyAdmin,
    getApplicationsByDrive
);

router.route("/:applicationId/status").patch(
    verifyJWT,
    verifyAdmin,
    validateApplicationStatus,
    updateApplicationStatus
);
router.route("/:applicationId").get(
    verifyJWT,
    verifyAdmin,
    getApplicationById
);
export default router;