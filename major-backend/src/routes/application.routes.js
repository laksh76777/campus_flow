import { Router } from "express";
import { verifyAdmin } from "../middlewares/auth.middleware.js";
import {
    applyForPlacement,getMyApplications
    ,withdrawApplication,getApplicationsByDrive,
    updateApplicationStatus,getApplicationById
} from "../controllers/application.controller.js";

import {
    verifyJWT
} from "../middlewares/auth.middleware.js";
const router = Router();
router
    .route("/:driveId/apply")
    .post(
        verifyJWT,
        applyForPlacement
    );
router
    .route("/my-applications")
    .get(
        verifyJWT,
        getMyApplications
    );
router
    .route("/:applicationId/withdraw")
    .patch(
        verifyJWT,
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
    updateApplicationStatus
);
router.route("/:applicationId").get(
    verifyJWT,
    verifyAdmin,
    getApplicationById
);
export default router;