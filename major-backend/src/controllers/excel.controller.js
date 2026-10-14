import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ImportBatch } from "../models/importBatch.model.js";
import {
    generateImportTemplate,
    previewImport,
    commitImportBatch,
    generateEligibleStudentsExport,
    generateSessionReportExport,
    generateErrorReportExport,
    generateDriveApplicantsExport,
    generateDepartmentReportExport,
    generateHistoricalPlacementSummaryExport
} from "../services/excelImportExport.service.js";

// @desc    Download standard Excel templates with instructions
// @route   GET /api/v1/excel/template/:importType
// @access  Admin
export const downloadTemplate = asyncHandler(async (req, res) => {
    const { importType } = req.params;
    const allowed = ["student_records", "academic_history", "historical_placements"];

    if (!allowed.includes(importType)) {
        throw new ApiError(400, `Invalid import type. Allowed: ${allowed.join(", ")}`);
    }

    const workbook = await generateImportTemplate(importType);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="CampusFlow_Template_${importType}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
});

// @desc    Upload spreadsheet, validate structure and preview parsed rows
// @route   POST /api/v1/excel/preview
// @access  Admin
export const uploadAndPreview = asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer) {
        throw new ApiError(400, "Please upload an Excel file (.xlsx)");
    }

    const { importType, placementSessionId, conflictStrategy } = req.body;
    const allowed = ["student_records", "academic_history", "historical_placements"];

    if (!allowed.includes(importType)) {
        throw new ApiError(400, `Invalid import type. Allowed: ${allowed.join(", ")}`);
    }

    const batch = await previewImport({
        buffer: req.file.buffer,
        importType,
        placementSessionId,
        conflictStrategy: conflictStrategy || "skip",
        filename: req.file.originalname,
        adminUser: req.user
    });

    return res.status(200).json(
        new ApiResponse(200, batch, "Spreadsheet parsed and preview generated successfully")
    );
});

// @desc    Confirm and commit previewed import batch
// @route   POST /api/v1/excel/commit/:batchId
// @access  Admin
export const commitBatch = asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    if (!batchId) {
        throw new ApiError(400, "Batch ID is required.");
    }

    const committedBatch = await commitImportBatch(batchId, req.user);

    return res.status(200).json(
        new ApiResponse(200, committedBatch, committedBatch.summary)
    );
});

// @desc    List previous import batches (audit history)
// @route   GET /api/v1/excel/batches
// @access  Admin
export const listImportBatches = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, importType, placementSession } = req.query;

    const query = {};
    if (importType) query.importType = importType;
    if (placementSession) query.placementSession = placementSession;

    const batches = await ImportBatch.find(query)
        .populate("initiatedBy", "fullName email")
        .populate("placementSession", "name sessionYear academicYear")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select("-previewResults");

    const total = await ImportBatch.countDocuments(query);

    return res.status(200).json(
        new ApiResponse(
            200,
            { batches, total, page: Number(page), limit: Number(limit) },
            "Import history fetched successfully"
        )
    );
});

// @desc    Get batch details with preview rows and errors
// @route   GET /api/v1/excel/batches/:batchId
// @access  Admin
export const getBatchDetails = asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    const batch = await ImportBatch.findOne({ batchId })
        .populate("initiatedBy", "fullName email")
        .populate("placementSession", "name sessionYear");

    if (!batch) {
        throw new ApiError(404, "Import batch not found.");
    }

    return res.status(200).json(
        new ApiResponse(200, batch, "Batch details retrieved successfully")
    );
});

// @desc    Download error report for batch
// @route   GET /api/v1/excel/batches/:batchId/error-report
// @access  Admin
export const downloadErrorReport = asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    const workbook = await generateErrorReportExport(batchId);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="CampusFlow_Errors_${batchId}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
});

// @desc    Export Eligible Students for a Placement Drive
// @route   GET /api/v1/excel/export/eligible/:driveId
// @access  Admin
export const exportEligibleStudents = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    const workbook = await generateEligibleStudentsExport(driveId);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="CampusFlow_Eligible_Candidates_${driveId}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
});

// @desc    Export Session Cohort Report
// @route   GET /api/v1/excel/export/session/:sessionId
// @access  Admin
export const exportSessionReport = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const workbook = await generateSessionReportExport(sessionId);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="CampusFlow_Session_Report_${sessionId}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
});

// @desc    Export Drive Applicants / Shortlisted / Interview list
// @route   GET /api/v1/excel/export/drive/:driveId
// @access  Admin
export const exportDriveApplicants = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    const { status, isCompanyFacing } = req.query;

    const workbook = await generateDriveApplicantsExport({
        driveId,
        status: status || "all",
        isCompanyFacing: isCompanyFacing === "true" || isCompanyFacing === true
    });
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="CampusFlow_Drive_Applicants_${driveId}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
});

// @desc    Export Department-Wise Performance Report
// @route   GET /api/v1/excel/export/department/:sessionId
// @access  Admin
export const exportDepartmentReport = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const workbook = await generateDepartmentReportExport({ sessionId });
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="CampusFlow_Department_Analytics_${sessionId}.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
});

// @desc    Export Historical Placement Outcomes
// @route   GET /api/v1/excel/export/historical/:sessionId?
// @access  Admin
export const exportHistoricalPlacements = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const workbook = await generateHistoricalPlacementSummaryExport({ sessionId });
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="CampusFlow_Historical_Placements.xlsx"`
    );
    return res.status(200).send(Buffer.from(buffer));
});

