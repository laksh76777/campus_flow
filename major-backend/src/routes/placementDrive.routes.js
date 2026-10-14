import { Router } from "express";

import {
    createPlacementDrive,
    getAllPlacementDrives,
    getPlacementDriveById,
    updatePlacementDrive,
    deactivatePlacementDrive,
    reactivatePlacementDrive,
    getEligibleStudents,
    getMyEligibleDrives,
    checkDriveEligibility,
    getDriveEligibilityPreview,
    getFieldCatalogue
} from "../controllers/placementDrive.controller.js";

import {
    verifyJWT,
    verifyAdmin
} from "../middlewares/auth.middleware.js";


const router = Router();


router
    .route("/create-placement-drive")
    .post(
        verifyJWT,
        verifyAdmin,
        createPlacementDrive
    );
router
    .route("/all-drives")
    .get(
        verifyJWT,
        getAllPlacementDrives
    );
router
    .route("/field-catalogue")
    .get(
        verifyJWT,
        getFieldCatalogue
    );
// Specific route FIRST
router
    .route("/my-eligible-drives")
    .get(
        verifyJWT,
        getMyEligibleDrives
    );

// Specific route FIRST
router
    .route("/:placementDriveId/eligible-students")
    .get(
        verifyJWT,
        verifyAdmin,
        getEligibleStudents
    );

router
    .route("/:placementDriveId/eligibility-check")
    .get(
        verifyJWT,
        checkDriveEligibility
    );

router
    .route("/:placementDriveId/eligibility-preview")
    .get(
        verifyJWT,
        verifyAdmin,
        getDriveEligibilityPreview
    );

// Dynamic route AFTER specific routes
router
    .route("/:driveId")
    .get(
        verifyJWT,
        getPlacementDriveById
    )
    .patch(
        verifyJWT,
        verifyAdmin,
        updatePlacementDrive
    );

router
    .route("/:driveId/deactivate")
    .patch(
        verifyJWT,
        verifyAdmin,
        deactivatePlacementDrive
    );

router
    .route("/:driveId/reactivate")
    .patch(
        verifyJWT,
        verifyAdmin,
        reactivatePlacementDrive
    );

export default router;