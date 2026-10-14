import { Router } from "express";
import multer from "multer";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import {
    downloadTemplate,
    uploadAndPreview,
    commitBatch,
    listImportBatches,
    getBatchDetails,
    downloadErrorReport,
    exportEligibleStudents,
    exportSessionReport,
    exportDriveApplicants,
    exportDepartmentReport,
    exportHistoricalPlacements
} from "../controllers/excel.controller.js";

const router = Router();

// Multer memory storage configuration for Excel spreadsheets
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB limit
    },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype ===
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.originalname.endsWith(".xlsx") ||
            file.mimetype === "application/vnd.ms-excel"
        ) {
            cb(null, true);
        } else {
            cb(new Error("Only Excel spreadsheets (.xlsx) are allowed."), false);
        }
    }
});

// All excel routes require Admin / TPO authentication
router.use(verifyJWT, verifyAdmin);

// 1. Template Download
router.route("/template/:importType").get(downloadTemplate);

// 2. Upload and Preview
router.route("/preview").post(memoryUpload.single("file"), uploadAndPreview);

// 3. Confirm and Commit
router.route("/commit/:batchId").post(commitBatch);

// 4. Batch Audit History & Details
router.route("/batches").get(listImportBatches);
router.route("/batches/:batchId").get(getBatchDetails);
router.route("/batches/:batchId/error-report").get(downloadErrorReport);

// 5. Reporting Exports
router.route("/export/eligible/:driveId").get(exportEligibleStudents);
router.route("/export/drive/:driveId").get(exportDriveApplicants);
router.route("/export/session/:sessionId").get(exportSessionReport);
router.route("/export/department/:sessionId").get(exportDepartmentReport);
router.route("/export/historical").get(exportHistoricalPlacements);
router.route("/export/historical/:sessionId").get(exportHistoricalPlacements);

export default router;
