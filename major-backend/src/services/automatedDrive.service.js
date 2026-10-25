import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import zlib from "zlib";
import { PlacementDrive, DEFAULT_SELECTION_ROUNDS, DEFAULT_STUDENT_REQUIREMENTS } from "../models/placementDrive.model.js";
import { Application } from "../models/application.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Company } from "../models/company.model.js";
import { User } from "../models/user.models.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { ImportBatch } from "../models/importBatch.model.js";
import { Notification } from "../models/notification.model.js";
import { sanitizeFormula } from "./excelImportExport.service.js";

// Legal status transitions state machine
export const LEGAL_TRANSITIONS = {
    applied: ["shortlisted", "interview", "selected", "rejected", "on_hold", "withdrawn"],
    shortlisted: ["applied", "interview", "selected", "rejected", "on_hold", "withdrawn"],
    interview: ["interview", "shortlisted", "selected", "rejected", "on_hold"],
    on_hold: ["applied", "shortlisted", "interview", "selected", "rejected", "withdrawn"],
    selected: ["offer_received", "offer_accepted", "offer_declined", "rejected", "interview", "shortlisted"],
    offer_received: ["offer_accepted", "offer_declined", "rejected", "selected"],
    offer_accepted: ["offer_declined", "rejected", "selected"],
    offer_declined: ["offer_accepted", "selected", "rejected"],
    rejected: ["shortlisted", "interview", "applied", "on_hold"],
    withdrawn: ["applied"]
};

/**
 * Normalizes USN by trimming, uppercasing, and removing internal whitespace / hyphens.
 * e.g., "1ms23cs001 " -> "1MS23CS001"
 */
export const normalizeUSN = (val) => {
    if (!val) return "";
    return String(val).trim().toUpperCase().replace(/[\s\-_]/g, "");
};

/**
 * Normalizes human names for cross-checking comparisons.
 */
export const normalizeName = (val) => {
    if (!val) return "";
    return String(val).toLowerCase().replace(/[^a-z0-9]/g, "");
};

export const ensureDriveRounds = async (drive) => {
    if (!drive) return drive;
    if (!drive.selectionRounds || drive.selectionRounds.length === 0) {
        drive.selectionRounds = DEFAULT_SELECTION_ROUNDS.map((r, idx) => ({
            ...r,
            status: idx === 0 ? "in_progress" : "pending"
        }));
        if (!drive.currentRoundNumber) {
            drive.currentRoundNumber = 1;
        }
        await drive.save();
    }
    return drive;
};

/**
 * 1. Fetch selection rounds & candidate pool statistics for a placement drive
 */
export const getDriveRoundsAndPools = async (driveId) => {
    const drive = await PlacementDrive.findById(driveId)
        .populate("company", "companyName email phone website")
        .populate("placementSession", "name sessionYear");

    if (!drive) {
        throw new Error("Placement drive not found.");
    }

    await ensureDriveRounds(drive);

    // Fetch all applications for this drive
    const applications = await Application.find({ placementDrive: driveId })
        .populate({
            path: "student",
            populate: { path: "user", select: "fullName email phone" }
        })
        .lean();

    // Calculate candidate counts for each round stage
    const roundsWithStats = drive.selectionRounds.map((round) => {
        const roundNum = round.roundNumber;
        
        // Candidates who participated in this round
        const clearedInRound = applications.filter((app) => 
            app.interviewRounds?.some((ir) => ir.roundNumber === roundNum && ir.status === "cleared")
        ).length;

        const failedInRound = applications.filter((app) => 
            app.interviewRounds?.some((ir) => ir.roundNumber === roundNum && ir.status === "failed")
        ).length;

        return {
            ...round.toObject ? round.toObject() : round,
            advancedCount: round.advancedCount || clearedInRound,
            rejectedCount: round.rejectedCount || failedInRound,
        };
    });

    // General applicant summary
    const summary = {
        totalApplicants: applications.length,
        activeInProgress: applications.filter((app) => !["rejected", "withdrawn", "selected", "offer_accepted"].includes(app.status)).length,
        shortlisted: applications.filter((app) => ["shortlisted", "interview"].includes(app.status)).length,
        rejected: applications.filter((app) => app.status === "rejected").length,
        selected: applications.filter((app) => ["selected", "offer_received", "offer_accepted"].includes(app.status)).length,
        withdrawn: applications.filter((app) => app.status === "withdrawn").length,
    };

    return {
        drive: {
            _id: drive._id,
            jobTitle: drive.jobTitle,
            company: drive.company,
            placementSession: drive.placementSession,
            package: drive.package,
            location: drive.location,
            isActive: drive.isActive,
            isPlacementCompleted: drive.isPlacementCompleted || false,
            completedAt: drive.completedAt || null,
            currentRoundNumber: drive.currentRoundNumber || 1,
            selectionRounds: roundsWithStats,
        },
        summary,
        totalApplications: applications.length,
    };
};

/**
 * 2. Update or customize selection rounds for a drive
 */
export const updateDriveRoundsConfig = async (driveId, customRounds) => {
    const drive = await PlacementDrive.findById(driveId);
    if (!drive) {
        throw new Error("Placement drive not found.");
    }

    if (!Array.isArray(customRounds) || customRounds.length === 0) {
        throw new Error("At least one selection round must be configured.");
    }
    if (customRounds.length > 10) {
        throw new Error("A placement drive can have no more than 10 selection rounds.");
    }
    if (drive.isPlacementCompleted) {
        throw new Error("Completed placement drives cannot change their selection stages.");
    }
    const currentRoundNumber = Number(drive.currentRoundNumber || 1);
    if (customRounds.length < currentRoundNumber) {
        throw new Error(`Keep at least ${currentRoundNumber} round(s); the drive has already reached Round ${currentRoundNumber}.`);
    }
    const normalizedNames = customRounds.map((round, index) => String(round?.roundName || round?.name || `Round ${index + 1}`).trim());
    if (normalizedNames.some((name) => !name || name.length > 80)) {
        throw new Error("Every selection stage needs a name between 1 and 80 characters.");
    }
    if (new Set(normalizedNames.map((name) => name.toLocaleLowerCase())).size !== normalizedNames.length) {
        throw new Error("Selection stage names must be unique.");
    }
    const hasProgressAfterConfiguredRounds = (drive.selectionRounds || []).some((round) =>
        round.roundNumber > customRounds.length && round.status === "completed"
    );
    if (hasProgressAfterConfiguredRounds) {
        throw new Error("Cannot remove selection rounds that already contain completed results.");
    }

    // Preserve completed round progress
    const updatedRounds = customRounds.map((r, idx) => {
        const existing = drive.selectionRounds?.find((er) => er.roundNumber === (idx + 1));
        return {
            roundNumber: idx + 1,
            name: normalizedNames[idx],
            roundType: String(r.roundType || "Other").trim(),
            description: String(r.description || "").trim(),
            status: existing ? existing.status : (idx === 0 ? "in_progress" : "pending"),
            conductedAt: existing ? existing.conductedAt : null,
            advancedCount: existing ? existing.advancedCount : 0,
            rejectedCount: existing ? existing.rejectedCount : 0,
            batchId: existing ? existing.batchId : null,
        };
    });

    drive.selectionRounds = updatedRounds;
    await drive.save();

    return drive.selectionRounds;
};

/**
 * 3. Export Company Applicant Roster (USN, Name, Email, Branch, Session, CGPA)
 */
export const generateCompanyRosterWorkbook = async ({ driveId, roundNumber = 1 }) => {
    const drive = await PlacementDrive.findById(driveId)
        .populate("company", "companyName email phone")
        .populate("placementSession", "name sessionYear");

    if (!drive) {
        throw new Error("Placement drive not found.");
    }
    await ensureDriveRounds(drive);

    // Determine the active candidate pool for this round
    const applications = await Application.find({ placementDrive: driveId })
        .populate({
            path: "student",
            populate: { path: "user", select: "fullName email phone" }
        })
        .lean();

    let candidatePool = [];
    if (Number(roundNumber) <= 1) {
        // Round 1: All active applicants
        candidatePool = applications.filter((app) => app.status !== "withdrawn" && app.status !== "rejected");
    } else {
        // Subsequent rounds: candidates who cleared round (roundNumber - 1)
        const prevRoundNum = Number(roundNumber) - 1;
        candidatePool = applications.filter((app) => {
            const hasClearedPrev = app.interviewRounds?.some(
                (ir) => ir.roundNumber === prevRoundNum && ir.status === "cleared"
            );
            // Allow hybrid flow: if TPO manually advanced candidate status in Admin Application Management
            const isManuallyAdvanced = (Number(roundNumber) === 2 && ["shortlisted", "interview"].includes(app.status)) ||
                                       (Number(roundNumber) > 2 && app.status === "interview");
            return (hasClearedPrev || isManuallyAdvanced) && app.status !== "rejected" && app.status !== "withdrawn";
        });
    }

    const currentRound = drive.selectionRounds?.find((r) => r.roundNumber === Number(roundNumber));
    const roundTitle = currentRound ? currentRound.name : `Round ${roundNumber}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CampusFlow Placement Management";
    workbook.created = new Date();

    const sheetName = `Company Roster R${roundNumber}`.slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    // Columns
    sheet.columns = [
        { header: "SL NO", key: "slNo", width: 8 },
        { header: "USN / REG NO", key: "usn", width: 18 },
        { header: "CANDIDATE NAME", key: "fullName", width: 26 },
        { header: "INSTITUTIONAL EMAIL", key: "email", width: 30 },
        { header: "DEPARTMENT / BRANCH", key: "branch", width: 26 },
        { header: "GRADUATION YEAR", key: "graduationYear", width: 18 },
        { header: "CURRENT CGPA", key: "cgpa", width: 14 },
        { header: "SELECTION OUTCOME (Shortlisted / Rejected)", key: "result", width: 28 },
    ];

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "0F172A" } // Dark Slate
        };
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Populate candidate rows
    candidatePool.forEach((app, index) => {
        const student = app.student;
        const user = student?.user;
        const snapshot = app.submittedSnapshot || {};

        const usnVal = snapshot.usn || student?.usn || "N/A";
        const nameVal = snapshot.fullName || user?.fullName || "Candidate";
        const emailVal = snapshot.email || user?.email || "";
        const branchVal = snapshot.branch || student?.branch || "";
        const gradYearVal = snapshot.graduationYear || student?.graduationYear || drive.graduationYear || "";
        const cgpaVal = snapshot.cgpa !== undefined ? snapshot.cgpa : (student?.cgpa !== undefined ? student.cgpa : "");

        const row = sheet.addRow({
            slNo: index + 1,
            usn: sanitizeFormula(usnVal),
            fullName: sanitizeFormula(nameVal),
            email: sanitizeFormula(emailVal),
            branch: sanitizeFormula(branchVal),
            graduationYear: gradYearVal,
            cgpa: cgpaVal,
            result: "" // Left empty for company to fill or specify outcome
        });

        row.height = 22;
        row.eachCell((cell, colNum) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = { vertical: "middle", horizontal: colNum === 1 || colNum === 6 || colNum === 7 ? "center" : "left" };
            cell.border = {
                top: { style: "thin", color: { argb: "E2E8F0" } },
                bottom: { style: "thin", color: { argb: "E2E8F0" } },
            };
        });
    });

    return { workbook, candidateCount: candidatePool.length, roundTitle };
};

/**
 * Helper to extract raw text lines from a text-based PDF buffer
 */
const extractTextFromPdfBuffer = (buffer) => {
    try {
        const text = buffer.toString("latin1");
        const lines = [];

        // Look for PDF stream objects
        const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
        let match;
        while ((match = streamRegex.exec(text)) !== null) {
            const rawStream = Buffer.from(match[1], "latin1");
            let decompressed;
            try {
                decompressed = zlib.inflateSync(rawStream).toString("utf-8");
            } catch {
                decompressed = match[1]; // uncompressed text fallback
            }

            // Extract string literals from PDF text operators: (Text) Tj or [(T)(e)(x)(t)] TJ
            const tjRegex = /\(([^)]+)\)\s*Tj/g;
            let tjMatch;
            let currentLine = "";
            while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
                currentLine += " " + tjMatch[1];
            }
            if (currentLine.trim()) {
                lines.push(currentLine.trim());
            }

            // Also check for array text blocks: [(...)] TJ
            const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
            let arrMatch;
            while ((arrMatch = tjArrayRegex.exec(decompressed)) !== null) {
                const innerText = arrMatch[1].replace(/\(([^)]+)\)/g, "$1 ").replace(/-?[0-9]+/g, "").trim();
                if (innerText) lines.push(innerText);
            }
        }

        // If streams didn't yield structured text, scan raw buffer for lines with USN pattern
        if (lines.length === 0) {
            const rawLines = text.split(/[\r\n]+/);
            for (const line of rawLines) {
                if (/[0-9][A-Z0-9]{5,15}/i.test(line)) {
                    lines.push(line.replace(/[\x00-\x1F\x7F-\x9F]/g, " ").trim());
                }
            }
        }

        return lines;
    } catch (err) {
        console.warn("PDF extraction warning:", err.message);
        return [];
    }
};

/**
 * 4. Parse incoming result file (.xlsx, .csv, or text-based .pdf)
 */
export const parseCompanyResultFile = async (fileBuffer, originalFilename = "") => {
    const ext = (originalFilename.split(".").pop() || "").toLowerCase();
    const parsedRows = [];
    const cellText = (cell) => {
        const value = cell?.value;
        if (value == null) return "";
        if (typeof value === "object") {
            if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
            if (typeof value.text === "string") return value.text;
            if (value.result != null) return String(value.result);
            if (value.hyperlink) return String(value.text || value.hyperlink);
        }
        return String(value);
    };

    if (ext === "xlsx" || ext === "xls") {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new Error("Uploaded Excel spreadsheet has no valid worksheets.");
        }

        let headerRowIndex = 1;
        let colMap = { usn: -1, name: -1, email: -1, status: -1, branch: -1 };

        // Scan first 5 rows to locate header row
        for (let r = 1; r <= Math.min(5, worksheet.rowCount); r++) {
            const row = worksheet.getRow(r);
            row.eachCell((cell, colNumber) => {
                const val = cellText(cell).trim().toLowerCase();
                if (/usn|seat|reg(istration)?|roll|student\s*id/i.test(val) && colMap.usn === -1) {
                    colMap.usn = colNumber;
                } else if (/name|candidate/i.test(val) && colMap.name === -1) {
                    colMap.name = colNumber;
                } else if (/email|mail/i.test(val) && colMap.email === -1) {
                    colMap.email = colNumber;
                } else if (/status|result|outcome|decision|selection/i.test(val) && colMap.status === -1) {
                    colMap.status = colNumber;
                } else if (/branch|dept|department/i.test(val) && colMap.branch === -1) {
                    colMap.branch = colNumber;
                }
            });

            if (colMap.usn !== -1) {
                headerRowIndex = r;
                break;
            }
        }

        // If no explicit USN column header found, default to column 1 or 2
        if (colMap.usn === -1) {
            colMap.usn = 1; // default to first column
        }

        // Read data rows
        for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
            const row = worksheet.getRow(r);
            const rawUSN = colMap.usn !== -1 ? cellText(row.getCell(colMap.usn)) : "";
            
            const rawName = colMap.name !== -1 ? cellText(row.getCell(colMap.name)) : "";
            const rawEmail = colMap.email !== -1 ? cellText(row.getCell(colMap.email)) : "";
            const rawStatus = colMap.status !== -1 ? cellText(row.getCell(colMap.status)) : "";
            const rawBranch = colMap.branch !== -1 ? cellText(row.getCell(colMap.branch)) : "";

            const cleanUSN = normalizeUSN(rawUSN);
            if (cleanUSN) {
                parsedRows.push({
                    usn: cleanUSN,
                    rawUSN: rawUSN.trim(),
                    name: rawName.trim(),
                    email: rawEmail.trim(),
                    status: rawStatus.trim(),
                    branch: rawBranch.trim(),
                    rowNumber: r,
                });
            }
        }
    } else if (ext === "csv") {
        const workbook = new ExcelJS.Workbook();
        const stream = Readable.from(fileBuffer);
        await workbook.csv.read(stream);
        const worksheet = workbook.worksheets[0];

        if (worksheet) {
            let colMap = { usn: -1, name: -1, email: -1, status: -1 };
            // Check header row 1
            const hRow = worksheet.getRow(1);
            hRow.eachCell((cell, colNum) => {
                const val = String(cell.value || "").trim().toLowerCase();
                if (/usn|seat|reg|roll|id/i.test(val) && colMap.usn === -1) colMap.usn = colNum;
                else if (/name|candidate/i.test(val) && colMap.name === -1) colMap.name = colNum;
                else if (/email|mail/i.test(val) && colMap.email === -1) colMap.email = colNum;
                else if (/status|result|outcome|decision|selection/i.test(val) && colMap.status === -1) colMap.status = colNum;
            });

            // Default USN column to 1 if no header explicitly named USN
            if (colMap.usn === -1) colMap.usn = 1;

            for (let r = 2; r <= worksheet.rowCount; r++) {
                const row = worksheet.getRow(r);
                const rawUSN = colMap.usn !== -1 ? String(row.getCell(colMap.usn).value || "") : "";
                const cleanUSN = normalizeUSN(rawUSN);
                if (cleanUSN) {
                    parsedRows.push({
                        usn: cleanUSN,
                        rawUSN: rawUSN.trim(),
                        name: colMap.name !== -1 ? String(row.getCell(colMap.name).value || "").trim() : "",
                        email: colMap.email !== -1 ? String(row.getCell(colMap.email).value || "").trim() : "",
                        status: colMap.status !== -1 ? String(row.getCell(colMap.status).value || "").trim() : "",
                        rowNumber: r,
                    });
                }
            }
        }
    } else if (ext === "pdf") {
        const lines = extractTextFromPdfBuffer(fileBuffer);
        // Regex pattern for university USN (e.g., 1MS23CS001, 1RV22IS045, or alphanumeric 6-15 chars)
        const usnPattern = /\b([0-9][A-Z]{2}[0-9]{2}[A-Z]{2,4}[0-9]{3,4})\b/i;
        const genericPattern = /\b([0-9A-Z]{7,14})\b/i;

        lines.forEach((line, idx) => {
            const match = line.match(usnPattern) || line.match(genericPattern);
            if (match) {
                const cleanUSN = normalizeUSN(match[1]);
                // Try extracting name and status from surrounding words in line
                const remaining = line.replace(match[0], "").trim();
                let statusVal = "";
                if (/selected|cleared|pass|shortlist/i.test(remaining)) statusVal = "Shortlisted";
                else if (/reject|fail|eliminated/i.test(remaining)) statusVal = "Rejected";

                parsedRows.push({
                    usn: cleanUSN,
                    rawUSN: match[1],
                    name: remaining.replace(/selected|cleared|pass|shortlist|reject|fail/gi, "").trim(),
                    email: "",
                    status: statusVal,
                    rowNumber: idx + 1,
                });
            }
        });
    } else {
        throw new Error(`Unsupported file type (.${ext}). Please upload an Excel (.xlsx, .xls), CSV, or text-readable PDF file.`);
    }

    return parsedRows;
};

/**
 * 5. Preview & Validate Company Result Import
 */
export const previewRoundResults = async ({
    driveId,
    roundNumber = 1,
    fileBuffer,
    originalFilename,
    mode = "shortlist_only", // "shortlist_only" | "complete_results"
    adminUserId,
}) => {
    const drive = await PlacementDrive.findById(driveId);
    if (!drive) {
        throw new Error("Placement drive not found.");
    }
    await ensureDriveRounds(drive);

    const currentRoundNum = Number(roundNumber);
    if (!Number.isInteger(currentRoundNum) || currentRoundNum < 1 || currentRoundNum > drive.selectionRounds.length) {
        throw new Error(`Round number must be between 1 and ${drive.selectionRounds.length}.`);
    }
    if (!["shortlist_only", "complete_results"].includes(mode)) {
        throw new Error("Unsupported result import mode.");
    }

    if (drive.isPlacementCompleted) {
        throw new Error("This placement drive is already completed and closed. Result previews cannot be generated.");
    }

    if (drive.currentRoundNumber && currentRoundNum < drive.currentRoundNumber) {
        throw new Error(
            `Cannot preview results for Round ${currentRoundNum}. The drive has already progressed to Round ${drive.currentRoundNumber}.`
        );
    }

    const roundConfig = drive.selectionRounds?.find((r) => r.roundNumber === currentRoundNum);
    const roundName = roundConfig ? roundConfig.name : `Round ${currentRoundNum}`;
    const isFinalRound = currentRoundNum >= (drive.selectionRounds?.length || 5);

    // Parse uploaded file
    const rawRows = await parseCompanyResultFile(fileBuffer, originalFilename);
    if (rawRows.length === 0) {
        throw new Error("No candidate USN records could be detected in the uploaded file. Please ensure the file contains valid student USNs.");
    }

    // Fetch all drive applications
    const applications = await Application.find({ placementDrive: driveId })
        .populate({
            path: "student",
            populate: { path: "user", select: "fullName email phone" }
        })
        .lean();

    // Identify current candidate pool
    let candidatePool = [];
    if (currentRoundNum <= 1) {
        candidatePool = applications.filter((app) => app.status !== "withdrawn" && app.status !== "rejected");
    } else {
        const prevRoundNum = currentRoundNum - 1;
        candidatePool = applications.filter((app) => {
            const clearedPrev = app.interviewRounds?.some(
                (ir) => ir.roundNumber === prevRoundNum && ir.status === "cleared"
            );
            // Allow hybrid flow: if TPO manually advanced candidate status in Admin Application Management
            const isManuallyAdvanced = (currentRoundNum === 2 && ["shortlisted", "interview"].includes(app.status)) ||
                                       (currentRoundNum > 2 && app.status === "interview");
            return (clearedPrev || isManuallyAdvanced) && app.status !== "rejected" && app.status !== "withdrawn";
        });
    }

    const poolUSNMap = new Map();
    candidatePool.forEach((app) => {
        const usn = normalizeUSN(app.submittedSnapshot?.usn || app.student?.usn);
        if (usn) poolUSNMap.set(usn, app);
    });

    // Check all drive applications for out-of-pool diagnostics
    const allDriveUSNMap = new Map();
    applications.forEach((app) => {
        const usn = normalizeUSN(app.submittedSnapshot?.usn || app.student?.usn);
        if (usn) allDriveUSNMap.set(usn, app);
    });

    const proposedAdvances = [];
    const proposedRejections = [];
    const exceptions = [];
    const processedUSNs = new Set();
    const candidatesPresentInFile = new Set();

    // Process each uploaded row
    for (const row of rawRows) {
        const normUSN = row.usn;

        // Check for duplicate USNs in the uploaded file
        if (processedUSNs.has(normUSN)) {
            exceptions.push({
                type: "DUPLICATE_USN_IN_FILE",
                usn: normUSN,
                uploadedName: row.name,
                message: `USN ${normUSN} appears multiple times in uploaded file.`,
                rowNumber: row.rowNumber,
                canResolve: true,
            });
            continue;
        }
        processedUSNs.add(normUSN);

        const appInPool = poolUSNMap.get(normUSN);

        if (!appInPool) {
            // Check if student applied to drive but was previously eliminated or not in this round
            const appInDrive = allDriveUSNMap.get(normUSN);
            if (appInDrive) {
                exceptions.push({
                    type: "CANDIDATE_NOT_IN_CURRENT_ROUND",
                    usn: normUSN,
                    uploadedName: row.name,
                    databaseName: appInDrive.submittedSnapshot?.fullName || appInDrive.student?.user?.fullName,
                    message: `Student ${normUSN} applied to this drive, but is not in the active candidate pool for ${roundName} (current status: ${appInDrive.status}).`,
                    applicationId: appInDrive._id,
                    rowNumber: row.rowNumber,
                    canResolve: false,
                });
            } else {
                exceptions.push({
                    type: "UNKNOWN_USN",
                    usn: normUSN,
                    uploadedName: row.name,
                    message: `USN ${normUSN} has not registered or applied for this placement drive.`,
                    rowNumber: row.rowNumber,
                    canResolve: false,
                });
            }
            continue;
        }

        // A matched row with an identity mismatch is accounted for in the exception queue,
        // but cannot be proposed for advancement or counted as an absent candidate.
        candidatesPresentInFile.add(String(appInPool._id));

        // Student is in the pool! Cross-check identity fields
        const actualName = appInPool.submittedSnapshot?.fullName || appInPool.student?.user?.fullName || "";
        const actualEmail = appInPool.submittedSnapshot?.email || appInPool.student?.user?.email || "";
        const actualBranch = appInPool.submittedSnapshot?.branch || appInPool.student?.branch || "";

        let identityMismatch = false;
        let mismatchReason = "";

        if (row.name && actualName) {
            const n1 = normalizeName(row.name);
            const n2 = normalizeName(actualName);
            if (n1.length > 3 && n2.length > 3 && !n1.includes(n2) && !n2.includes(n1)) {
                identityMismatch = true;
                mismatchReason = `Name in file "${row.name}" differs from enrolled record "${actualName}".`;
            }
        }

        if (row.email && actualEmail) {
            if (row.email.toLowerCase().trim() !== actualEmail.toLowerCase().trim()) {
                identityMismatch = true;
                mismatchReason += ` Email in file "${row.email}" differs from enrolled email "${actualEmail}".`;
            }
        }

        if (identityMismatch) {
            exceptions.push({
                type: "IDENTITY_MISMATCH",
                usn: normUSN,
                uploadedName: row.name,
                uploadedEmail: row.email,
                databaseName: actualName,
                databaseEmail: actualEmail,
                databaseBranch: actualBranch,
                applicationId: appInPool._id,
                message: mismatchReason.trim(),
                rowNumber: row.rowNumber,
                canResolve: true,
            });
            continue;
        }

        // Determine action based on file mode and row status
        const isNegativeOutcome = /reject|fail|eliminat|not\s+selected|unsuccessful|did\s+not\s+(clear|qualify)|not\s+shortlisted|no\s+hire/i.test(row.status);
        const isPositiveOutcome = /shortlist|advance|pass|clear|selected|offer|qualif|proceed|next\s+round|\byes\b|hired/i.test(row.status);

        if (mode === "shortlist_only" && isNegativeOutcome) {
            exceptions.push({
                type: "RESULT_MODE_CONFLICT",
                usn: normUSN,
                uploadedName: row.name,
                applicationId: appInPool._id,
                message: `This row says "${row.status}" but the selected mode expects a shortlist-only file. Confirm the row outcome manually.`,
                rowNumber: row.rowNumber,
                canResolve: true,
            });
            continue;
        }
        if (mode === "complete_results" && !isNegativeOutcome && !isPositiveOutcome) {
            exceptions.push({
                type: "UNRECOGNIZED_RESULT_STATUS",
                usn: normUSN,
                uploadedName: row.name,
                applicationId: appInPool._id,
                message: `The result "${row.status || "(blank)"}" is not a recognized pass or rejection outcome. Confirm it manually.`,
                rowNumber: row.rowNumber,
                canResolve: true,
            });
            continue;
        }

        if (isNegativeOutcome) {
            proposedRejections.push({
                applicationId: appInPool._id,
                usn: normUSN,
                name: actualName,
                email: actualEmail,
                branch: actualBranch,
                currentStatus: appInPool.status,
                proposedStatus: "rejected",
                remarks: `Outcome received from company in ${roundName}: Rejected`,
                identityMismatch,
                mismatchReason: mismatchReason.trim(),
            });
        } else {
            proposedAdvances.push({
                applicationId: appInPool._id,
                usn: normUSN,
                name: actualName,
                email: actualEmail,
                branch: actualBranch,
                currentStatus: appInPool.status,
                proposedStatus: isFinalRound ? "selected" : (currentRoundNum === 1 ? "shortlisted" : "interview"),
                remarks: isFinalRound 
                    ? `Final placement offer confirmed in ${roundName}` 
                    : `Shortlisted in ${roundName}; advancing to next stage`,
                identityMismatch,
                mismatchReason: mismatchReason.trim(),
            });
        }
    }

    // Identify candidate pool students absent from uploaded file
    const advancedUSNSet = new Set(proposedAdvances.map((p) => p.usn));
    const rejectedUSNSet = new Set(proposedRejections.map((p) => p.usn));
    
    const potentialAbsentCandidates = candidatePool
        .filter((app) => {
            const usn = normalizeUSN(app.submittedSnapshot?.usn || app.student?.usn);
            return !candidatesPresentInFile.has(String(app._id)) && !advancedUSNSet.has(usn) && !rejectedUSNSet.has(usn);
        })
        .map((app) => ({
            applicationId: app._id,
            usn: normalizeUSN(app.submittedSnapshot?.usn || app.student?.usn),
            name: app.submittedSnapshot?.fullName || app.student?.user?.fullName || "Candidate",
            email: app.submittedSnapshot?.email || app.student?.user?.email || "",
            branch: app.submittedSnapshot?.branch || app.student?.branch || "",
            currentStatus: app.status,
            proposedStatus: "rejected",
            remarks: `Not present in company shortlist for ${roundName}`,
        }));

    // Persist preview/import batch record for audit history
    const batchId = `BATCH_DRIVE_${drive._id}_R${currentRoundNum}_${Date.now()}`;
    let batchDoc = null;
    if (adminUserId) {
        try {
            batchDoc = await ImportBatch.create({
                batchId,
                importType: "automated_drive_results",
                placementDrive: drive._id,
                placementSession: drive.placementSession,
                roundNumber: currentRoundNum,
                originalFilename: originalFilename || `results_round_${currentRoundNum}.xlsx`,
                initiatedBy: adminUserId,
                status: "PREVIEWED",
                totalRows: rawRows.length,
                validRows: proposedAdvances.length + proposedRejections.length,
                invalidRows: exceptions.length,
                conflictRows: exceptions.filter((e) => e.type === "IDENTITY_MISMATCH" || e.type === "DUPLICATE_USN_IN_FILE").length,
                previewResults: [
                    ...proposedAdvances.map((p, idx) => ({
                        rowNumber: idx + 1,
                        identifier: p.usn,
                        name: p.name,
                        status: "VALID",
                        action: "ADVANCE",
                        proposedAction: p.proposedStatus,
                        details: { applicationId: p.applicationId, status: p.proposedStatus },
                        reason: p.remarks,
                    })),
                    ...proposedRejections.map((p, idx) => ({
                        rowNumber: idx + 1 + proposedAdvances.length,
                        identifier: p.usn,
                        name: p.name,
                        status: "VALID",
                        action: "REJECT",
                        proposedAction: "rejected",
                        details: { applicationId: p.applicationId, status: "rejected" },
                        reason: p.remarks,
                    })),
                    ...exceptions.map((e, idx) => ({
                        rowNumber: e.rowNumber || (idx + 1 + proposedAdvances.length + proposedRejections.length),
                        identifier: e.usn,
                        name: e.uploadedName || "",
                        status: "ERROR",
                        action: "ERROR",
                        proposedAction: "NONE",
                        details: { type: e.type, canResolve: e.canResolve },
                        reason: e.message,
                    })),
                ],
                summary: `Previewed ${rawRows.length} rows for Round ${currentRoundNum}: ${proposedAdvances.length} proposed advances, ${proposedRejections.length} proposed rejections, ${exceptions.length} exceptions.`,
            });
        } catch (batchErr) {
            console.warn("ImportBatch preview persist notice:", batchErr.message);
        }
    }

    return {
        batchId: batchDoc ? batchDoc.batchId : batchId,
        roundNumber: currentRoundNum,
        roundName,
        isFinalRound,
        mode,
        totalRowsDetected: rawRows.length,
        candidatePoolTotal: candidatePool.length,
        proposedAdvanceCount: proposedAdvances.length,
        proposedRejectCount: proposedRejections.length,
        absentCandidatesCount: potentialAbsentCandidates.length,
        exceptionsCount: exceptions.length,
        proposedAdvances,
        proposedRejections,
        potentialAbsentCandidates,
        exceptions,
    };
};

/**
 * 6. Commit Confirmed Round Results & Progress Candidate Pool
 */
export const commitRoundResults = async ({
    driveId,
    roundNumber = 1,
    mode = "shortlist_only",
    autoRejectAbsent = true,
    confirmedAdvances = [],
    confirmedRejections = [],
    confirmedExceptionResolutions = [],
    batchId,
    adminUserId,
}) => {
    const drive = await PlacementDrive.findById(driveId).populate("company", "companyName");
    if (!drive) {
        throw new Error("Placement drive not found.");
    }
    await ensureDriveRounds(drive);

    const currentRoundNum = Number(roundNumber);

    if (!Number.isInteger(currentRoundNum) || currentRoundNum < 1 || currentRoundNum > (drive.selectionRounds?.length || 0)) {
        throw new Error(`Round number must be between 1 and ${drive.selectionRounds?.length || 0}.`);
    }
    if (!["shortlist_only", "complete_results"].includes(mode)) {
        throw new Error("Unsupported result import mode.");
    }

    if (drive.isPlacementCompleted) {
        throw new Error("This placement drive is already completed and closed. No further round results can be imported.");
    }

    const currentRoundObj = drive.selectionRounds?.find((r) => r.roundNumber === currentRoundNum);
    const isAlreadyCompleted = currentRoundObj && currentRoundObj.status === "completed";

    if (drive.currentRoundNumber && currentRoundNum < drive.currentRoundNumber && !isAlreadyCompleted) {
        throw new Error(
            `Cannot import results for Round ${currentRoundNum}. The drive has already progressed to Round ${drive.currentRoundNumber}. Earlier-round imports cannot overwrite later-round results.`
        );
    }

    if (drive.currentRoundNumber && currentRoundNum > drive.currentRoundNumber) {
        throw new Error(
            `Cannot import results for Round ${currentRoundNum}. Drive is currently at Round ${drive.currentRoundNumber}. Round skipping is prohibited.`
        );
    }

    const roundConfig = drive.selectionRounds?.find((r) => r.roundNumber === currentRoundNum);
    const roundName = roundConfig ? roundConfig.name : `Round ${currentRoundNum}`;
    const totalRounds = drive.selectionRounds?.length || 5;
    const isFinalRound = currentRoundNum >= totalRounds;

    // 1. Fetch current applications and candidate pool
    const allDriveApplications = await Application.find({ placementDrive: driveId })
        .populate({
            path: "student",
            populate: { path: "user", select: "fullName email" },
        });

    let candidatePool = [];
    if (currentRoundNum <= 1) {
        candidatePool = allDriveApplications.filter((app) => app.status !== "withdrawn" && app.status !== "rejected");
    } else {
        const prevRoundNum = currentRoundNum - 1;
        candidatePool = allDriveApplications.filter((app) => {
            const hasClearedPrev = app.interviewRounds?.some(
                (ir) => ir.roundNumber === prevRoundNum && ir.status === "cleared"
            );
            const isManuallyAdvanced = (currentRoundNum === 2 && ["shortlisted", "interview"].includes(app.status)) ||
                                       (currentRoundNum > 2 && app.status === "interview");
            return (hasClearedPrev || isManuallyAdvanced) && app.status !== "rejected" && app.status !== "withdrawn";
        });
    }

    // Maps for revalidation
    const poolAppMap = new Map(candidatePool.map((a) => [a._id.toString(), a]));
    const allDriveAppMap = new Map(allDriveApplications.map((a) => [a._id.toString(), a]));

    // Priority 2: Prevent empty imports from completing a round or closing a drive
    const hasAnyAdvance = confirmedAdvances.length > 0;
    const hasAnyReject = confirmedRejections.length > 0;
    const hasAnyResolution = confirmedExceptionResolutions.length > 0;

    if (candidatePool.length > 0 && !hasAnyAdvance && !hasAnyReject && (!autoRejectAbsent || !hasAnyResolution)) {
        throw new Error("Cannot commit empty results. No candidate advances or rejections were provided for this round.");
    }

    // Deduplicate and aggregate candidate updates
    const seenAppIds = new Set();
    const candidateActions = new Map(); // appId -> { applicationId, action, targetStatus, remarks }

    const targetAdvanceStatus = isFinalRound ? "selected" : (currentRoundNum === 1 ? "shortlisted" : "interview");

    for (const item of confirmedAdvances) {
        if (!item || !item.applicationId) {
            throw new Error("Every confirmed advance must contain a valid applicationId.");
        }
        const appId = String(item.applicationId);
        if (seenAppIds.has(appId)) {
            throw new Error(`Duplicate entry for application ID ${appId} in commit payload.`);
        }
        seenAppIds.add(appId);
        candidateActions.set(appId, {
            applicationId: appId,
            action: "advance",
            targetStatus: targetAdvanceStatus,
            remarks: item.remarks || (isFinalRound ? `Placed at ${drive.company?.companyName}` : `Cleared ${roundName}`),
        });
    }

    for (const item of confirmedRejections) {
        if (!item || !item.applicationId) {
            throw new Error("Every confirmed rejection must contain a valid applicationId.");
        }
        const appId = String(item.applicationId);
        if (seenAppIds.has(appId)) {
            throw new Error(`Conflicting or duplicate outcome for application ID ${appId}. A candidate cannot be both advanced and rejected.`);
        }
        seenAppIds.add(appId);
        candidateActions.set(appId, {
            applicationId: appId,
            action: "reject",
            targetStatus: "rejected",
            remarks: item.remarks || `Not selected in ${roundName}`,
        });
    }

    // Exception resolutions / absent rejections
    if (Array.isArray(confirmedExceptionResolutions)) {
        for (const item of confirmedExceptionResolutions) {
            if (!item || !item.applicationId) continue;
            const appId = String(item.applicationId);
            if (seenAppIds.has(appId)) continue; // Already explicitly accounted for
            if (item.action === "reject_absent") {
                seenAppIds.add(appId);
                candidateActions.set(appId, {
                    applicationId: appId,
                    action: "reject",
                    targetStatus: "rejected",
                    remarks: `Eliminated after ${roundName} (absent from shortlist)`,
                });
            } else if (item.action === "force_advance") {
                seenAppIds.add(appId);
                candidateActions.set(appId, {
                    applicationId: appId,
                    action: "advance",
                    targetStatus: targetAdvanceStatus,
                    remarks: `TPO approved match: cleared ${roundName}`,
                });
            } else if (item.action === "reject_reviewed") {
                seenAppIds.add(appId);
                candidateActions.set(appId, {
                    applicationId: appId,
                    action: "reject",
                    targetStatus: "rejected",
                    remarks: `TPO reviewed the result and rejected this candidate for ${roundName}`,
                });
            }
        }
    }

    // Priority 3: Check Idempotency for repeated submissions
    if (isAlreadyCompleted) {
        // Check if all candidates are already in targetStatus
        const allMatch = Array.from(candidateActions.values()).every((item) => {
            const app = allDriveAppMap.get(item.applicationId);
            return app && app.status === item.targetStatus;
        });
        if (allMatch) {
            return {
                success: true,
                driveId: drive._id,
                roundNumber: currentRoundNum,
                roundName,
                isFinalRound,
                isPlacementCompleted: drive.isPlacementCompleted,
                advancedCount: currentRoundObj.advancedCount || 0,
                rejectedCount: currentRoundObj.rejectedCount || 0,
                idempotent: true,
                message: isFinalRound
                    ? `Final selection completed! ${currentRoundObj.advancedCount || 0} candidate(s) selected and offered. Drive is now completed and closed.`
                    : `${roundName} results applied successfully! ${currentRoundObj.advancedCount || 0} candidate(s) advanced to Round ${currentRoundNum + 1}.`,
            };
        }
        if (drive.currentRoundNumber && currentRoundNum < drive.currentRoundNumber) {
            throw new Error(
                `Cannot import results for Round ${currentRoundNum}. The drive has already progressed to Round ${drive.currentRoundNumber}. Earlier-round imports cannot overwrite later-round results.`
            );
        }
    }

    // Priority 1: Secure result commits - Server-side revalidation of every submitted application ID FIRST
    for (const [appId, actionItem] of candidateActions.entries()) {
        const poolApp = poolAppMap.get(appId);
        if (!poolApp) {
            // Check if application belongs to this drive at all
            const driveApp = allDriveAppMap.get(appId);
            if (driveApp) {
                throw new Error(
                    `Application ${appId} (${driveApp.submittedSnapshot?.usn || "Candidate"}) is not in the active candidate pool for ${roundName} (current status: ${driveApp.status}). Commits for out-of-round candidates are rejected.`
                );
            }
            // Check if it belongs to another drive or doesn't exist
            const otherApp = await Application.findById(appId);
            if (!otherApp) {
                throw new Error(`Application ${appId} not found.`);
            }
            if (otherApp.placementDrive?.toString() !== driveId.toString()) {
                throw new Error(
                    `Application ${appId} belongs to another placement drive (${otherApp.placementDrive}). Cross-drive application commits are strictly rejected.`
                );
            }
            throw new Error(`Application ${appId} is not in the active candidate pool for ${roundName}.`);
        }

        // Validate status transition
        const currentStatus = poolApp.status;
        const targetStatus = actionItem.targetStatus;
        if (currentStatus !== targetStatus) {
            const allowed = LEGAL_TRANSITIONS[currentStatus] || [];
            if (!allowed.includes(targetStatus)) {
                throw new Error(
                    `Invalid status transition from "${currentStatus}" to "${targetStatus}" for candidate ${poolApp.submittedSnapshot?.usn || appId}.`
                );
            }
        }
    }

    // If autoRejectAbsent is confirmed in shortlist_only mode, any pool candidate not in seenAppIds is auto-rejected
    if (autoRejectAbsent && mode === "shortlist_only") {
        for (const poolApp of candidatePool) {
            const pId = poolApp._id.toString();
            if (!seenAppIds.has(pId)) {
                seenAppIds.add(pId);
                candidateActions.set(pId, {
                    applicationId: pId,
                    action: "reject",
                    targetStatus: "rejected",
                    remarks: `Eliminated after ${roundName} (absent from shortlist)`,
                });
            }
        }
    }

    // Priority 2: Safe round completion & required outcomes
    // Ensure no candidates in candidatePool are left unresolved
    const unresolvedCandidates = candidatePool.filter((app) => !candidateActions.has(app._id.toString()));
    if (unresolvedCandidates.length > 0) {
        const unresolvedList = unresolvedCandidates.map((a) => a.submittedSnapshot?.usn || a._id).slice(0, 5).join(", ");
        throw new Error(
            `Cannot complete ${roundName}: ${unresolvedCandidates.length} candidate(s) in the round candidate pool have unresolved outcomes (${unresolvedList}...). Explicit confirmation is required to reject absent candidates or resolve all outcomes before completing the round.`
        );
    }

    // Priority 3: Database transactions with fallback recoverable strategy
    let session = null;
    let useTransaction = false;
    if (mongoose.connection?.readyState === 1) {
        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch {
            session = null;
            useTransaction = false;
        }
    }

    const appliedSnapshots = [];
    const notificationsToCreate = [];
    let advancedTotal = 0;
    let rejectedTotal = 0;

    try {
        for (const [appId, actionItem] of candidateActions.entries()) {
            const app = await Application.findById(appId).session(session || undefined);
            if (!app) continue;

            // Save snapshot for rollback if non-transactional failure occurs
            appliedSnapshots.push({
                app,
                originalStatus: app.status,
                originalStatusUpdatedAt: app.statusUpdatedAt,
                originalInterviewRounds: JSON.parse(JSON.stringify(app.interviewRounds || [])),
                originalStatusHistory: JSON.parse(JSON.stringify(app.statusHistory || [])),
                originalOfferedPackage: app.offeredPackage,
                originalOfferDetails: app.offerDetails ? JSON.parse(JSON.stringify(app.offerDetails)) : undefined,
            });

            const prevStatus = app.status;
            app.status = actionItem.targetStatus;
            app.statusUpdatedAt = new Date();

            // Update round ledger (idempotent: replace prior entry for same roundNumber)
            app.interviewRounds = (app.interviewRounds || []).filter((ir) => ir.roundNumber !== currentRoundNum);
            app.interviewRounds.push({
                roundNumber: currentRoundNum,
                roundName,
                scheduledAt: new Date(),
                status: actionItem.action === "advance" ? "cleared" : "failed",
                feedback: actionItem.remarks,
            });

            // Prevent duplicate status history entries
            const historyList = app.statusHistory || [];
            const lastHist = historyList[historyList.length - 1];
            const isDuplicateHistory = lastHist &&
                lastHist.fromStatus === prevStatus &&
                lastHist.toStatus === actionItem.targetStatus &&
                lastHist.remarks === actionItem.remarks;

            if (!isDuplicateHistory && prevStatus !== actionItem.targetStatus) {
                historyList.push({
                    fromStatus: prevStatus,
                    toStatus: actionItem.targetStatus,
                    remarks: actionItem.remarks,
                    updatedBy: adminUserId,
                    updatedAt: new Date(),
                });
                app.statusHistory = historyList;
            }

            // Final round offer details (preserve distinction: NOT placed until student accepts!)
            if (isFinalRound && actionItem.action === "advance") {
                app.offeredPackage = drive.package;
                app.offerDetails = {
                    offeredAt: new Date(),
                    offeredPackage: drive.package,
                    designation: drive.jobTitle,
                    joiningDate: drive.driveDate,
                    studentDecision: "pending",
                    decisionAt: null,
                };
            }

            await app.save({ session: session || undefined });

            if (actionItem.action === "advance") {
                advancedTotal++;
                const studentUserId = app.student?.user?._id || app.student?.user;
                if (studentUserId) {
                    const notifTitle = isFinalRound
                        ? `🎉 Congratulations! Selected at ${drive.company?.companyName}`
                        : `Advanced to Next Stage: ${drive.company?.companyName}`;

                    // Check if duplicate notification already queued
                    const alreadyQueued = notificationsToCreate.some(
                        (n) => n.user?.toString() === studentUserId.toString() && n.application?.toString() === app._id.toString()
                    );
                    if (!alreadyQueued) {
                        notificationsToCreate.push({
                            user: studentUserId,
                            type: isFinalRound ? "offer" : "status_update",
                            title: notifTitle,
                            message: isFinalRound
                                ? `You have cleared the final round of ${drive.company?.companyName} (${drive.jobTitle}) and received a placement offer! Please review and accept or decline your offer in your dashboard.`
                                : `You have cleared ${roundName} for ${drive.company?.companyName} and advanced to the next selection stage.`,
                            priority: "high",
                            relatedDrive: drive._id,
                            application: app._id,
                        });
                    }
                }
            } else {
                rejectedTotal++;
            }
        }

        // Update Drive Selection Round metadata
        const roundIdx = drive.selectionRounds?.findIndex((r) => r.roundNumber === currentRoundNum);
        if (roundIdx !== -1 && roundIdx !== undefined) {
            drive.selectionRounds[roundIdx].status = "completed";
            drive.selectionRounds[roundIdx].conductedAt = new Date();
            drive.selectionRounds[roundIdx].advancedCount = advancedTotal;
            drive.selectionRounds[roundIdx].rejectedCount = rejectedTotal;
        }

        if (isFinalRound) {
            drive.isPlacementCompleted = true;
            drive.completedAt = new Date();
            drive.isActive = false; // Drive successfully closed
        } else {
            const nextRoundIdx = drive.selectionRounds?.findIndex((r) => r.roundNumber === currentRoundNum + 1);
            if (nextRoundIdx !== -1 && nextRoundIdx !== undefined) {
                drive.selectionRounds[nextRoundIdx].status = "in_progress";
                drive.currentRoundNumber = currentRoundNum + 1;
            }
        }

        // Persist ImportBatch audit log
        const actualBatchId = batchId || `BATCH_DRIVE_${drive._id}_R${currentRoundNum}_${Date.now()}`;
        const committedBatch = await ImportBatch.findOneAndUpdate(
            { batchId: actualBatchId },
            {
                $set: {
                    batchId: actualBatchId,
                    importType: "automated_drive_results",
                    placementDrive: drive._id,
                    placementSession: drive.placementSession,
                    roundNumber: currentRoundNum,
                    initiatedBy: adminUserId,
                    status: "COMMITTED",
                    totalRows: candidateActions.size,
                    validRows: candidateActions.size,
                    invalidRows: 0,
                    insertedRows: 0,
                    updatedRows: candidateActions.size,
                    completedAt: new Date(),
                    summary: `${roundName} results committed: ${advancedTotal} advanced, ${rejectedTotal} rejected.`,
                }
            },
            { upsert: true, new: true, session: session || undefined }
        );

        if (roundIdx !== -1 && roundIdx !== undefined) {
            drive.selectionRounds[roundIdx].batchId = committedBatch.batchId;
        }

        await drive.save({ session: session || undefined });

        if (useTransaction && session) {
            await session.commitTransaction();
            session.endSession();
        }
    } catch (procErr) {
        if (useTransaction && session) {
            await session.abortTransaction();
            session.endSession();
        } else {
            // Recoverable strategy: rollback applied applications to previous states
            for (const snap of appliedSnapshots) {
                try {
                    snap.app.status = snap.originalStatus;
                    snap.app.statusUpdatedAt = snap.originalStatusUpdatedAt;
                    snap.app.interviewRounds = snap.originalInterviewRounds;
                    snap.app.statusHistory = snap.originalStatusHistory;
                    snap.app.offeredPackage = snap.originalOfferedPackage;
                    snap.app.offerDetails = snap.originalOfferDetails;
                    await snap.app.save();
                } catch (rollbackErr) {
                    console.error("Rollback error for app:", snap.app._id, rollbackErr.message);
                }
            }
            if (batchId) {
                await ImportBatch.findOneAndUpdate(
                    { batchId },
                    { $set: { status: "FAILED", summary: `Commit failed: ${procErr.message}. All partial updates rolled back.` } }
                ).catch(() => {});
            }
        }
        throw new Error(`Failed to commit round results: ${procErr.message}. Batch processing halted; no partial outcomes committed.`);
    }

    // Safely dispatch notifications without duplicates
    if (notificationsToCreate.length > 0) {
        try {
            // Check for existing notifications in DB to ensure idempotency
            const filteredNotifs = [];
            for (const notif of notificationsToCreate) {
                const existing = await Notification.findOne({
                    user: notif.user,
                    application: notif.application,
                    title: notif.title,
                });
                if (!existing) {
                    filteredNotifs.push(notif);
                }
            }
            if (filteredNotifs.length > 0) {
                await Notification.insertMany(filteredNotifs);
            }
        } catch (notifErr) {
            console.warn("Notification dispatch notice:", notifErr.message);
        }
    }

    return {
        success: true,
        driveId: drive._id,
        roundNumber: currentRoundNum,
        roundName,
        isFinalRound,
        isPlacementCompleted: drive.isPlacementCompleted,
        advancedCount: advancedTotal,
        rejectedCount: rejectedTotal,
        message: isFinalRound
            ? `Final selection completed! ${advancedTotal} candidate(s) selected and offered. Drive is now completed and closed.`
            : `${roundName} results applied successfully! ${advancedTotal} candidate(s) advanced to Round ${currentRoundNum + 1}.`,
    };
};

/**
 * Enroll all eligible cohort students into a drive who have not yet applied
 */
export const enrollEligibleStudentsForDrive = async (driveId, adminUserId = null) => {
    const drive = await PlacementDrive.findById(driveId).populate("placementSession");
    if (!drive) {
        throw new Error("Placement drive not found.");
    }

    const filter = {};

    // 1. Graduation year / Placement session cohort
    const gradYear = drive.placementSession?.sessionYear || drive.placementSession?.graduationYear || drive.graduationYear;
    if (gradYear) {
        filter.graduationYear = Number(gradYear);
    }

    // 2. Department / Eligible branches
    if (drive.eligibleBranches && drive.eligibleBranches.length > 0) {
        const branches = drive.eligibleBranches.map((b) => b.trim());
        const hasAll = branches.some((b) => b.toLowerCase() === "all");
        if (!hasAll) {
            const escapedRegexes = branches.map(
                (b) => new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
            );
            filter.$or = [
                { branch: { $in: escapedRegexes } },
                { department: { $in: escapedRegexes } },
            ];
        }
    }

    // 3. Minimum CGPA
    if (drive.minimumCGPA && Number(drive.minimumCGPA) > 0) {
        filter.cgpa = { $gte: Number(drive.minimumCGPA) };
    }

    // 4. Maximum backlogs
    if (typeof drive.maximumBacklogs === "number" && drive.maximumBacklogs >= 0) {
        filter.activeBacklogs = { $lte: Number(drive.maximumBacklogs) };
    }

    // Find all matching student profiles
    const eligibleStudents = await StudentProfile.find(filter)
        .populate("user", "fullName email")
        .select("_id user usn enrollmentNumber branch department cgpa graduationYear");

    // Existing applications for this drive
    const existingApps = await Application.find({ placementDrive: drive._id }).select("student");
    const existingStudentIds = new Set(existingApps.map((a) => a.student.toString()));

    const toEnroll = eligibleStudents.filter((s) => !existingStudentIds.has(s._id.toString()));

    if (toEnroll.length > 0) {
        const newApps = toEnroll.map((student) => ({
            student: student._id,
            placementDrive: drive._id,
            status: "applied",
            currentRound: 1,
            submittedSnapshot: {
                fullName: student.user?.fullName || "",
                email: student.user?.email || "",
                usn: student.usn || student.enrollmentNumber || "",
                branch: student.branch || student.department || "",
                cgpa: student.cgpa || 0,
                graduationYear: student.graduationYear || gradYear,
            },
            timeline: [
                {
                    status: "applied",
                    updatedAt: new Date(),
                    remarks: "Eligible candidate enrolled into placement drive",
                },
            ],
            interviewRounds: [],
        }));

        await Application.insertMany(newApps);
    }

    const totalApplicants = await Application.countDocuments({ placementDrive: drive._id });

    return {
        success: true,
        enrolledCount: toEnroll.length,
        totalApplicants,
        eligiblePoolSize: eligibleStudents.length,
        message:
            toEnroll.length > 0
                ? `Enrolled ${toEnroll.length} eligible student(s) into this drive.`
                : `All ${eligibleStudents.length} eligible students are already enrolled.`,
    };
};

