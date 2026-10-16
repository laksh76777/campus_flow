import ExcelJS from "exceljs";
import { Readable } from "stream";
import zlib from "zlib";
import { PlacementDrive, DEFAULT_SELECTION_ROUNDS, DEFAULT_STUDENT_REQUIREMENTS } from "../models/placementDrive.model.js";
import { Application } from "../models/application.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { ImportBatch } from "../models/importBatch.model.js";
import { Notification } from "../models/notification.model.js";
import { sanitizeFormula } from "./excelImportExport.service.js";

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

    // Preserve completed round progress
    const updatedRounds = customRounds.map((r, idx) => {
        const existing = drive.selectionRounds?.find((er) => er.roundNumber === (idx + 1));
        return {
            roundNumber: idx + 1,
            name: String(r.roundName || r.name || `Round ${idx + 1}`).trim(),
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
                const val = String(cell.value || "").trim().toLowerCase();
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
            let rawUSN = colMap.usn !== -1 ? String(row.getCell(colMap.usn).value || "") : "";
            // Handle ExcelJS formula or rich text
            if (typeof rawUSN === "object" && rawUSN?.text) rawUSN = rawUSN.text;
            
            const rawName = colMap.name !== -1 ? String(row.getCell(colMap.name).value || "") : "";
            const rawEmail = colMap.email !== -1 ? String(row.getCell(colMap.email).value || "") : "";
            const rawStatus = colMap.status !== -1 ? String(row.getCell(colMap.status).value || "") : "";
            const rawBranch = colMap.branch !== -1 ? String(row.getCell(colMap.branch).value || "") : "";

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
            let colMap = { usn: 1, name: 2, email: 3, status: 4 };
            // Check header row 1
            const hRow = worksheet.getRow(1);
            hRow.eachCell((cell, colNum) => {
                const val = String(cell.value || "").trim().toLowerCase();
                if (/usn|seat|reg/i.test(val)) colMap.usn = colNum;
                else if (/name/i.test(val)) colMap.name = colNum;
                else if (/email/i.test(val)) colMap.email = colNum;
                else if (/status|result/i.test(val)) colMap.status = colNum;
            });

            for (let r = 2; r <= worksheet.rowCount; r++) {
                const row = worksheet.getRow(r);
                const rawUSN = String(row.getCell(colMap.usn).value || "");
                const cleanUSN = normalizeUSN(rawUSN);
                if (cleanUSN) {
                    parsedRows.push({
                        usn: cleanUSN,
                        rawUSN: rawUSN.trim(),
                        name: String(row.getCell(colMap.name).value || "").trim(),
                        email: String(row.getCell(colMap.email).value || "").trim(),
                        status: String(row.getCell(colMap.status).value || "").trim(),
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
}) => {
    const drive = await PlacementDrive.findById(driveId);
    if (!drive) {
        throw new Error("Placement drive not found.");
    }
    await ensureDriveRounds(drive);

    const currentRoundNum = Number(roundNumber);

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

        // Student is in the pool! Cross-check identity fields
        const actualName = appInPool.submittedSnapshot?.fullName || appInPool.student?.user?.fullName || "";
        const actualEmail = appInPool.submittedSnapshot?.email || appInPool.student?.user?.email || "";
        const actualBranch = appInPool.submittedSnapshot?.branch || appInPool.student?.branch || "";

        let identityMismatch = false;
        let mismatchReason = "";

        if (row.name && actualName) {
            const n1 = normalizeName(row.name);
            const n2 = normalizeName(actualName);
            // If neither contains the other and length > 3, flag for review
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
        }

        // Determine action based on file mode and row status
        const isNegativeOutcome = /reject|fail|eliminated/i.test(row.status);

        if (mode === "complete_results" && isNegativeOutcome) {
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
            return !advancedUSNSet.has(usn) && !rejectedUSNSet.has(usn);
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

    return {
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
    adminUserId,
}) => {
    const drive = await PlacementDrive.findById(driveId).populate("company", "companyName");
    if (!drive) {
        throw new Error("Placement drive not found.");
    }
    await ensureDriveRounds(drive);

    const currentRoundNum = Number(roundNumber);

    if (drive.isPlacementCompleted) {
        throw new Error("This placement drive is already completed and closed. No further round results can be imported.");
    }

    if (drive.currentRoundNumber && currentRoundNum < drive.currentRoundNumber) {
        throw new Error(
            `Cannot import results for Round ${currentRoundNum}. The drive has already progressed to Round ${drive.currentRoundNumber}. Earlier-round imports cannot overwrite later-round results.`
        );
    }

    const roundConfig = drive.selectionRounds?.find((r) => r.roundNumber === currentRoundNum);
    const roundName = roundConfig ? roundConfig.name : `Round ${currentRoundNum}`;
    const totalRounds = drive.selectionRounds?.length || 5;
    const isFinalRound = currentRoundNum >= totalRounds;

    // Build consolidated list of updates
    const updatesToApply = [];

    // Advances
    for (const item of confirmedAdvances) {
        updatesToApply.push({
            applicationId: item.applicationId,
            action: "advance",
            targetStatus: isFinalRound ? "selected" : (currentRoundNum === 1 ? "shortlisted" : "interview"),
            remarks: item.remarks || (isFinalRound ? `Placed at ${drive.company?.companyName}` : `Cleared ${roundName}`),
        });
    }

    // Explicit rejections
    for (const item of confirmedRejections) {
        updatesToApply.push({
            applicationId: item.applicationId,
            action: "reject",
            targetStatus: "rejected",
            remarks: item.remarks || `Not selected in ${roundName}`,
        });
    }

    // Auto-rejected absent candidates if confirmed
    if (autoRejectAbsent && Array.isArray(confirmedExceptionResolutions)) {
        for (const item of confirmedExceptionResolutions) {
            if (item.action === "reject_absent") {
                updatesToApply.push({
                    applicationId: item.applicationId,
                    action: "reject",
                    targetStatus: "rejected",
                    remarks: `Eliminated after ${roundName} (absent from shortlist)`,
                });
            } else if (item.action === "force_advance") {
                updatesToApply.push({
                    applicationId: item.applicationId,
                    action: "advance",
                    targetStatus: isFinalRound ? "selected" : (currentRoundNum === 1 ? "shortlisted" : "interview"),
                    remarks: `TPO approved match: cleared ${roundName}`,
                });
            }
        }
    }

    let advancedTotal = 0;
    let rejectedTotal = 0;
    const notificationsToCreate = [];

    // Apply updates to Application collection
    for (const update of updatesToApply) {
        const app = await Application.findById(update.applicationId).populate({
            path: "student",
            populate: { path: "user", select: "fullName email" }
        });

        if (!app) continue;

        const prevStatus = app.status;
        app.status = update.targetStatus;
        app.statusUpdatedAt = new Date();

        // Add to round ledger
        app.interviewRounds = app.interviewRounds || [];
        // Remove prior entry for same roundNumber if exists (idempotency)
        app.interviewRounds = app.interviewRounds.filter((ir) => ir.roundNumber !== currentRoundNum);
        app.interviewRounds.push({
            roundNumber: currentRoundNum,
            roundName,
            scheduledAt: new Date(),
            status: update.action === "advance" ? "cleared" : "failed",
            feedback: update.remarks,
        });

        // Add to status transition history
        app.statusHistory = app.statusHistory || [];
        app.statusHistory.push({
            fromStatus: prevStatus,
            toStatus: update.targetStatus,
            remarks: update.remarks,
            updatedBy: adminUserId,
            updatedAt: new Date(),
        });

        // Handle final round offer details
        if (isFinalRound && update.action === "advance") {
            app.offeredPackage = drive.package;
            app.offerDetails = {
                offeredAt: new Date(),
                offeredPackage: drive.package,
                designation: drive.jobTitle,
                joiningDate: drive.driveDate,
                studentDecision: "pending",
                decisionAt: null
            };
        }

        await app.save();

        if (update.action === "advance") {
            advancedTotal++;
            // Queue congratulatory in-app notification
            const studentUserId = app.student?.user?._id;
            if (studentUserId) {
                notificationsToCreate.push({
                    user: studentUserId,
                    type: isFinalRound ? "offer" : "status_update",
                    title: isFinalRound 
                        ? `🎉 Congratulations! Selected at ${drive.company?.companyName}` 
                        : `Advanced to Next Stage: ${drive.company?.companyName}`,
                    message: isFinalRound
                        ? `You have cleared the final round of ${drive.company?.companyName} (${drive.jobTitle}) and received a placement offer! Please review and accept or decline your offer in your dashboard.`
                        : `You have cleared ${roundName} for ${drive.company?.companyName} and advanced to the next selection stage.`,
                    priority: "high",
                    relatedDrive: drive._id,
                    application: app._id,
                });
            }
        } else {
            rejectedTotal++;
        }
    }

    // Update Drive Selection Round metadata
    if (drive.selectionRounds && drive.selectionRounds.length > 0) {
        const roundIdx = drive.selectionRounds.findIndex((r) => r.roundNumber === currentRoundNum);
        if (roundIdx !== -1) {
            drive.selectionRounds[roundIdx].status = "completed";
            drive.selectionRounds[roundIdx].conductedAt = new Date();
            drive.selectionRounds[roundIdx].advancedCount = advancedTotal;
            drive.selectionRounds[roundIdx].rejectedCount = rejectedTotal;
        }

        // Advance to next round or complete drive
        if (isFinalRound) {
            drive.isPlacementCompleted = true;
            drive.completedAt = new Date();
            drive.isActive = false; // Drive successfully closed
        } else {
            const nextRoundIdx = drive.selectionRounds.findIndex((r) => r.roundNumber === currentRoundNum + 1);
            if (nextRoundIdx !== -1) {
                drive.selectionRounds[nextRoundIdx].status = "in_progress";
                drive.currentRoundNumber = currentRoundNum + 1;
            }
        }

        await drive.save();
    }

    // Dispatch queued notifications safely
    if (notificationsToCreate.length > 0) {
        try {
            await Notification.insertMany(notificationsToCreate);
        } catch (notifErr) {
            console.warn("Notification dispatch warning:", notifErr.message);
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
            ? `Final selection completed! ${advancedTotal} candidate(s) marked Placed. Drive is now successfully completed and closed.`
            : `${roundName} results applied successfully! ${advancedTotal} candidate(s) advanced to Round ${currentRoundNum + 1}.`,
    };
};
