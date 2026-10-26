import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
    getDriveRoundsAndPools,
    updateDriveRoundsConfig,
    generateCompanyRosterWorkbook,
    previewRoundResults,
    commitRoundResults,
    enrollEligibleStudentsForDrive,
} from "../services/automatedDrive.service.js";

/**
 * 1. Get automated workspace state, selection rounds, and pool statistics
 * GET /api/v1/placementdrive/:driveId/automated-workspace
 */
export const getAutomatedDriveWorkspace = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(400, "Placement drive ID is required.");
    }

    const data = await getDriveRoundsAndPools(driveId);
    return res.status(200).json(
        new ApiResponse(200, data, "Automated drive workspace details retrieved successfully.")
    );
});

/**
 * 2. Configure or customize selection rounds
 * PUT /api/v1/placementdrive/:driveId/automated-rounds
 */
export const configureSelectionRounds = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    const rounds = req.body.rounds || req.body.selectionRounds;

    if (!Array.isArray(rounds) || rounds.length === 0) {
        throw new ApiError(400, "Please provide at least one valid selection round.");
    }

    const updatedRounds = await updateDriveRoundsConfig(driveId, rounds);
    return res.status(200).json(
        new ApiResponse(200, updatedRounds, "Selection rounds updated successfully.")
    );
});

/**
 * 3. Export Company Applicant Roster (Excel / CSV)
 * GET /api/v1/placementdrive/:driveId/export-company-roster
 */
export const exportCompanyRoster = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    const { roundNumber = 1, format = "xlsx" } = req.query;

    const { workbook, candidateCount, roundTitle } = await generateCompanyRosterWorkbook({
        driveId,
        roundNumber: Number(roundNumber),
    });

    const isCsv = format.toLowerCase() === "csv";
    const filename = `Company_Roster_${roundTitle.replace(/[^a-zA-Z0-9]/g, "_")}.${isCsv ? "csv" : "xlsx"}`;

    if (isCsv) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        const buffer = await workbook.csv.writeBuffer();
        return res.status(200).send(Buffer.from(buffer));
    } else {
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        const buffer = await workbook.xlsx.writeBuffer();
        return res.status(200).send(Buffer.from(buffer));
    }
});

/**
 * 4. Upload & Preview Company Result File
 * POST /api/v1/placementdrive/:driveId/preview-results
 */
export const previewCompanyResults = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    const { roundNumber = 1, mode = "shortlist_only" } = req.body;

    if (!req.file || !req.file.buffer) {
        throw new ApiError(400, "Please upload a company result file (.xlsx, .csv, or text-readable .pdf).");
    }

    const preview = await previewRoundResults({
        driveId,
        roundNumber: Number(roundNumber),
        fileBuffer: req.file.buffer,
        originalFilename: req.file.originalname,
        mode,
        adminUserId: req.user?._id,
    });

    return res.status(200).json(
        new ApiResponse(200, preview, "Company results parsed and validated successfully.")
    );
});

/**
 * 5. Commit Confirmed Round Results
 * POST /api/v1/placementdrive/:driveId/commit-results
 */
export const commitCompanyResults = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    const {
        roundNumber = 1,
        mode = "shortlist_only",
        autoRejectAbsent = true,
        confirmedAdvances = [],
        confirmedRejections = [],
        confirmedExceptionResolutions = [],
        batchId,
    } = req.body;

    if (!Array.isArray(confirmedAdvances)) {
        throw new ApiError(400, "Invalid candidate advance list.");
    }

    try {
        const result = await commitRoundResults({
            driveId,
            roundNumber: Number(roundNumber),
            mode,
            autoRejectAbsent: autoRejectAbsent === true || autoRejectAbsent === "true",
            confirmedAdvances,
            confirmedRejections: Array.isArray(confirmedRejections) ? confirmedRejections : [],
            confirmedExceptionResolutions: Array.isArray(confirmedExceptionResolutions) ? confirmedExceptionResolutions : [],
            batchId,
            adminUserId: req.user._id,
        });

        return res.status(200).json(
            new ApiResponse(200, result, result.message)
        );
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError(err.statusCode || 400, err.message || "Failed to commit round results");
    }
});

/**
 * 6. Enroll eligible cohort students into placement drive
 * POST /api/v1/placementdrive/:driveId/enroll-eligible-students
 */
export const enrollEligibleStudents = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(400, "Placement drive ID is required.");
    }

    const result = await enrollEligibleStudentsForDrive(driveId, req.user?._id);

    return res.status(200).json(
        new ApiResponse(200, result, result.message)
    );
});

