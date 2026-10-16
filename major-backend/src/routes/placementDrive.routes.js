import { Router } from "express";

import {
    createPlacementDrive,
    getAllPlacementDrives,
    getPlacementDriveById,
    updatePlacementDrive,
    deactivatePlacementDrive,
    reactivatePlacementDrive,
    deletePlacementDrive,
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
import { upload } from "../middlewares/multer.middleware.js";
import multer from "multer";
import {
    getAutomatedDriveWorkspace,
    configureSelectionRounds,
    exportCompanyRoster,
    previewCompanyResults,
    commitCompanyResults
} from "../controllers/automatedDrive.controller.js";


const router = Router();


router
    .route("/create-placement-drive")
    .post(
        verifyJWT,
        verifyAdmin,
        upload.single("jdPdf"),
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
        upload.single("jdPdf"),
        updatePlacementDrive
    )
    .delete(
        verifyJWT,
        verifyAdmin,
        deletePlacementDrive
    );

router
    .route("/:driveId/delete")
    .delete(
        verifyJWT,
        verifyAdmin,
        deletePlacementDrive
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

// Automated Placement Drive Lifecycle & Result-Import Routes
const memoryUpload = upload.single ? multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
}) : upload;

router
    .route("/:driveId/automated-workspace")
    .get(
        verifyJWT,
        verifyAdmin,
        getAutomatedDriveWorkspace
    );

router
    .route("/:driveId/automated-rounds")
    .put(
        verifyJWT,
        verifyAdmin,
        configureSelectionRounds
    );

router
    .route("/:driveId/export-company-roster")
    .get(
        verifyJWT,
        verifyAdmin,
        exportCompanyRoster
    );

router
    .route("/:driveId/preview-results")
    .post(
        verifyJWT,
        verifyAdmin,
        memoryUpload.single("file"),
        previewCompanyResults
    );

router
    .route("/:driveId/commit-results")
    .post(
        verifyJWT,
        verifyAdmin,
        commitCompanyResults
    );

export default router;