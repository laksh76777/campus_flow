import ExcelJS from "exceljs";
import { User } from "../models/user.models.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { Company } from "../models/company.model.js";
import { PlacementDrive, DEFAULT_STUDENT_REQUIREMENTS } from "../models/placementDrive.model.js";
import { Application } from "../models/application.model.js";
import { ImportBatch } from "../models/importBatch.model.js";
import { EligibilityService } from "./eligibility.service.js";
import { PROGRAM_CATALOG, resolveStudentProgram } from "../constants/programCatalog.js";

/**
 * Formula Injection Sanitization
 * Excel/CSV formula injection protection: if value starts with =, +, -, @, prepend single quote
 */
export const sanitizeFormula = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
    }
    return str;
};

// Styling helper for Excel headers
const styleHeaderRow = (row, color = "1E293B") => {
    row.height = 28;
    row.eachCell((cell) => {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: color }
        };
        cell.font = {
            name: "Arial",
            size: 11,
            bold: true,
            color: { argb: "FFFFFF" }
        };
        cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true
        };
        cell.border = {
            top: { style: "thin", color: { argb: "94A3B8" } },
            left: { style: "thin", color: { argb: "94A3B8" } },
            bottom: { style: "medium", color: { argb: "0F172A" } },
            right: { style: "thin", color: { argb: "94A3B8" } }
        };
    });
};

// Helper to style data rows
const styleDataRow = (row, isSample = false) => {
    row.height = 22;
    row.eachCell((cell) => {
        cell.font = {
            name: "Arial",
            size: 10,
            italic: isSample,
            color: isSample ? { argb: "64748B" } : { argb: "0F172A" }
        };
        cell.alignment = { vertical: "middle" };
        cell.border = {
            top: { style: "hair", color: { argb: "CBD5E1" } },
            left: { style: "hair", color: { argb: "CBD5E1" } },
            bottom: { style: "hair", color: { argb: "CBD5E1" } },
            right: { style: "hair", color: { argb: "CBD5E1" } }
        };
    });
};

/**
 * 1. Downloadable Excel Templates with Instructions Sheets
 */
export const generateImportTemplate = async (importType) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CampusFlow Placement Management";
    workbook.created = new Date();

    if (importType === "student_records") {
        const sheet = workbook.addWorksheet("Student Records");
        sheet.columns = [
            { header: "USN *", key: "usn", width: 16 },
            { header: "Full Name *", key: "fullName", width: 24 },
            { header: "College Email *", key: "email", width: 28 },
            { header: "Phone Number", key: "phone", width: 18 },
            { header: "Course *", key: "course", width: 14 },
            { header: "Department *", key: "department", width: 32 },
            { header: "Program Code", key: "programCode", width: 18 },
            { header: "Admission Year *", key: "admissionYear", width: 16 },
            { header: "Graduation Year *", key: "graduationYear", width: 16 },
            { header: "Current Semester", key: "semester", width: 16 },
            { header: "Gender", key: "gender", width: 14 }
        ];
        styleHeaderRow(sheet.getRow(1), "1E3A8A");

        // Add Instructions Sheet
        const infoSheet = workbook.addWorksheet("Instructions & Guide");
        infoSheet.columns = [
            { header: "Field Name", key: "field", width: 22 },
            { header: "Required?", key: "required", width: 14 },
            { header: "Accepted Formats & Rules", key: "rules", width: 45 },
            { header: "Allowed Values / Examples", key: "examples", width: 40 }
        ];
        styleHeaderRow(infoSheet.getRow(1), "0F172A");

        const instructions = [
            { field: "USN", required: "YES", rules: "Unique Student Number (alphanumeric, 6-20 chars)", examples: "Use the student's official USN" },
            { field: "Full Name", required: "YES", rules: "Official student name as per records", examples: "Enter the verified institutional record" },
            { field: "College Email", required: "YES", rules: "Must be a valid unique institutional email", examples: "Use the student's institutional address" },
            { field: "Phone Number", required: "NO", rules: "10-digit mobile number", examples: "Enter the recorded number" },
            { field: "Course", required: "NO when Program Code is provided", rules: "Approved degree type; checked against the selected program", examples: "B.E., MBA, MCA, M.Tech" },
            { field: "Department", required: "NO when Program Code is provided", rules: "Approved exact program label or an unambiguous legacy label", examples: "Computer Science & Engineering (CSE), M.Tech in Data Science" },
            { field: "Program Code", required: "YES unless Department contains an approved program label", rules: "Stable code from the CampusFlow academic program catalogue", examples: "CSE, CSE-AIML, MBA, MTECH-DS" },
            { field: "Admission Year", required: "YES", rules: "4-digit year of college entry", examples: "Use the verified admission year" },
            { field: "Graduation Year", required: "YES", rules: "Admission Year plus the selected program duration; must match a configured placement session", examples: "Calculate from the approved program catalogue" },
            { field: "Current Semester", required: "NO", rules: "Numeric semester (1 to 8)", examples: "Use the student's current semester" },
            { field: "Gender", required: "NO", rules: "Optional demographic field", examples: "Male, Female, Other, Prefer not to say" }
        ];
        instructions.forEach((item) => styleDataRow(infoSheet.addRow(item)));

    } else if (importType === "academic_history") {
        const sheet = workbook.addWorksheet("Academic History");
        sheet.columns = [
            { header: "USN *", key: "usn", width: 16 },
            { header: "Overall CGPA *", key: "cgpa", width: 16 },
            { header: "Sem 1 SGPA", key: "sem1", width: 13 },
            { header: "Sem 2 SGPA", key: "sem2", width: 13 },
            { header: "Sem 3 SGPA", key: "sem3", width: 13 },
            { header: "Sem 4 SGPA", key: "sem4", width: 13 },
            { header: "Sem 5 SGPA", key: "sem5", width: 13 },
            { header: "Sem 6 SGPA", key: "sem6", width: 13 },
            { header: "Sem 7 SGPA", key: "sem7", width: 13 },
            { header: "Sem 8 SGPA", key: "sem8", width: 13 },
            { header: "Active Backlogs", key: "activeBacklogs", width: 15 },
            { header: "Cleared Backlogs", key: "clearedBacklogs", width: 16 },
            { header: "10th Board", key: "tenthBoard", width: 14 },
            { header: "10th School Name", key: "tenthSchool", width: 24 },
            { header: "10th Year", key: "tenthYear", width: 12 },
            { header: "10th %", key: "tenthPct", width: 12 },
            { header: "12th/Diploma Type", key: "twelfthType", width: 18 },
            { header: "12th/Diploma Inst", key: "twelfthInst", width: 24 },
            { header: "12th/Diploma Year", key: "twelfthYear", width: 16 },
            { header: "12th/Diploma %", key: "twelfthPct", width: 15 },
            { header: "Has Education Gap?", key: "hasGap", width: 18 },
            { header: "Gap Reason", key: "gapReason", width: 22 },
            { header: "Gap Duration (Mo)", key: "gapDuration", width: 18 }
        ];
        styleHeaderRow(sheet.getRow(1), "047857");

        const infoSheet = workbook.addWorksheet("Instructions & Guide");
        infoSheet.columns = [
            { header: "Field Name", key: "field", width: 22 },
            { header: "Required?", key: "required", width: 14 },
            { header: "Accepted Formats & Rules", key: "rules", width: 45 },
            { header: "Allowed Values / Examples", key: "examples", width: 40 }
        ];
        styleHeaderRow(infoSheet.getRow(1), "064E3B");

        const instructions = [
            { field: "USN", required: "YES", rules: "Must match an existing student in CampusFlow", examples: "Use the student's official USN" },
            { field: "Overall CGPA", required: "YES", rules: "Official CGPA (0.00 to 10.00). NEVER averaged from SGPA", examples: "8.75, 9.20" },
            { field: "Sem 1 to 8 SGPA", required: "NO", rules: "Independent semester SGPA (0.00 to 10.00). Uncompleted remain empty", examples: "Leave uncompleted semesters empty" },
            { field: "Active Backlogs", required: "NO", rules: "Non-negative integer (defaults to 0)", examples: "Enter the verified count" },
            { field: "Cleared Backlogs", required: "NO", rules: "Historical cleared backlogs count", examples: "Enter the verified count" },
            { field: "10th Board", required: "NO", rules: "Education board for Class 10", examples: "CBSE, ICSE, State Board, Other" },
            { field: "10th %", required: "NO", rules: "Class 10 final percentage (0.0 to 100.0)", examples: "92.4, 85.0" },
            { field: "12th/Diploma Type", required: "NO", rules: "Qualification category switch", examples: "12th, Diploma, Equivalent" },
            { field: "12th/Diploma %", required: "NO", rules: "Qualifying exam percentage (0.0 to 100.0)", examples: "89.2, 91.0" },
            { field: "Has Education Gap?", required: "NO", rules: "YES / NO declaration", examples: "YES, NO" },
            { field: "Gap Reason", required: "NO", rules: "Reason if education gap exists", examples: "medical, entrance_prep, financial, personal" }
        ];
        instructions.forEach((item) => styleDataRow(infoSheet.addRow(item)));

    } else if (importType === "historical_placements") {
        const sheet = workbook.addWorksheet("Historical Placements");
        sheet.columns = [
            { header: "USN *", key: "usn", width: 16 },
            { header: "Placement Session Year *", key: "sessionYear", width: 24 },
            { header: "Company Name *", key: "companyName", width: 24 },
            { header: "Job Title / Role *", key: "jobTitle", width: 26 },
            { header: "Job Type", key: "jobType", width: 16 },
            { header: "Offer Package (LPA) *", key: "package", width: 20 },
            { header: "Placement Status *", key: "status", width: 18 },
            { header: "Offer Date (YYYY-MM-DD)", key: "offerDate", width: 22 },
            { header: "Interview Round", key: "round", width: 18 },
            { header: "Remarks", key: "remarks", width: 24 }
        ];
        styleHeaderRow(sheet.getRow(1), "6B21A8");

        const infoSheet = workbook.addWorksheet("Instructions & Guide");
        infoSheet.columns = [
            { header: "Field Name", key: "field", width: 22 },
            { header: "Required?", key: "required", width: 14 },
            { header: "Accepted Formats & Rules", key: "rules", width: 45 },
            { header: "Allowed Values / Examples", key: "examples", width: 40 }
        ];
        styleHeaderRow(infoSheet.getRow(1), "581C87");

        const instructions = [
            { field: "USN", required: "YES", rules: "Must match an existing registered student", examples: "1MS23CS001" },
            { field: "Placement Session Year", required: "YES", rules: "Must match an existing configured placement session", examples: "Use a year shown in Placement Sessions" },
            { field: "Company Name", required: "YES", rules: "Existing company record; unmatched companies are created from the supplied name only", examples: "Use the exact company name from CampusFlow" },
            { field: "Job Title / Role", required: "YES", rules: "Role as recorded in the source placement history", examples: "Enter the recorded role" },
            { field: "Job Type", required: "YES", rules: "Must be one of the supported placement categories", examples: "full-time, internship, internship-to-full-time" },
            { field: "Offer Package (LPA)", required: "YES", rules: "Annual CTC package in Lakhs Per Annum (or total INR)", examples: "12.5, 1400000" },
            { field: "Placement Status", required: "YES", rules: "Recruitment lifecycle milestone from the source record", examples: "shortlisted, interview, selected, offer_received, offer_accepted, rejected" },
            { field: "Offer Date", required: "YES", rules: "Actual historical date; no date is generated when missing", examples: "YYYY-MM-DD" }
        ];
        instructions.forEach((item) => styleDataRow(infoSheet.addRow(item)));
    }

    return workbook;
};

/**
 * 2. Upload Preview & Safe Validation
 * Parses workbook buffer, validates columns and constraints, checks duplicates and conflicts,
 * and saves an ImportBatch in status "PREVIEWED" without committing to main tables.
 */
export const previewImport = async ({
    buffer,
    importType,
    placementSessionId,
    conflictStrategy = "skip",
    filename = "upload.xlsx",
    adminUser
}) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
        throw new Error("Spreadsheet does not contain any readable worksheets.");
    }

    const batchId = `BATCH-${importType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const previewResults = [];
    const errorReport = [];

    // Track duplicates within the sheet itself
    const seenUsns = new Set();
    const seenEmails = new Set();

    let validCount = 0;
    let invalidCount = 0;
    let conflictCount = 0;

    // Build header map from row 1 for robust column detection
    const headerRow = sheet.getRow(1);
    const headerMap = {};
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let text = cell.value;
        if (text && typeof text === "object") {
            text = text.text || text.result || "";
        }
        const normalized = String(text || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
        if (normalized) {
            headerMap[normalized] = colNumber;
        }
    });

    const getCell = (row, aliases, fallbackColIndex) => {
        for (const alias of aliases) {
            const normalized = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (headerMap[normalized]) {
                const cell = row.getCell(headerMap[normalized]);
                let val = cell.value;
                if (val instanceof Date) {
                    return val.toISOString().slice(0, 10);
                }
                if (val && typeof val === "object") {
                    val = val.text || val.result || val.richText?.map((r) => r.text).join("") || "";
                }
                return val !== null && val !== undefined ? String(val).trim() : "";
            }
        }
        if (fallbackColIndex) {
            const cell = row.getCell(fallbackColIndex);
            let val = cell.value;
            if (val instanceof Date) {
                return val.toISOString().slice(0, 10);
            }
            if (val && typeof val === "object") {
                val = val.text || val.result || "";
            }
            return val !== null && val !== undefined ? String(val).trim() : "";
        }
        return "";
    };

    const rowCount = sheet.rowCount;
    if (rowCount < 2) {
        throw new Error("Spreadsheet is empty or contains no data rows.");
    }

    // Resolve target session if provided
    let targetSession = null;
    if (placementSessionId) {
        targetSession = await PlacementSession.findById(placementSessionId);
        if (!targetSession) {
            throw new Error("Selected placement session does not exist.");
        }
    }

    // Process rows starting from Row 2
    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);

        // Check if row has any non-empty cell
        let hasContent = false;
        row.eachCell({ includeEmpty: true }, (c) => {
            if (c.value !== null && c.value !== undefined && String(c.value).trim() !== "") {
                hasContent = true;
            }
        });
        if (!hasContent) continue;

        // Skip sample row if labeled with sample
        const firstFew = [row.getCell(1).value, row.getCell(2).value].join(" ").toLowerCase();
        if (firstFew.includes("sample student") || firstFew.includes("#sample")) {
            continue;
        }

        if (importType === "student_records") {
            const rawUsn = getCell(row, ["usn", "enrollment", "rollno"], 1);
            const rawName = getCell(row, ["fullname", "studentname", "name"], 2);
            const rawEmail = getCell(row, ["collegeemail", "email", "institutionalemail"], 3);
            const rawPhone = getCell(row, ["phonenumber", "phone", "mobile"], 4);
            const rawCourse = getCell(row, ["course", "degree", "program"], 5);
            const rawDept = getCell(row, ["department", "branch"], 6);
            const rawProgramCode = getCell(row, ["programcode", "programid", "academicprogram"]);
            const rawAdmYear = getCell(row, ["admissionyear", "admyear"], 8);
            const rawGradYear = getCell(row, ["graduationyear", "gradyear", "batch"], 9);
            const rawSem = getCell(row, ["currentsemester", "semester", "sem"], 10);
            const rawGender = getCell(row, ["gender", "sex"], 11);

            const usn = (rawUsn || "").toUpperCase().trim();
            const fullName = (rawName || "").trim();
            const email = (rawEmail || "").toLowerCase().trim();
            const department = (rawDept || "").trim();
            const program = resolveStudentProgram({
                ...(rawProgramCode ? { programCode: rawProgramCode } : {}),
                course: rawCourse,
                branch: department,
                department
            });
            const course = program?.degreeType || (rawCourse || "").trim();
            const admYear = Number(rawAdmYear);
            const gradYear = Number(rawGradYear);
            const sem = Number(rawSem || 1);

            // Validation checks
            const errors = [];
            if (!usn) errors.push("USN is required");
            if (!fullName) errors.push("Full Name is required");
            if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push("Valid College Email is required");
            if (!program) errors.push("Program code or label is missing, unknown, ambiguous, or inconsistent with the degree type");
            if (!admYear || isNaN(admYear) || admYear < 2000 || admYear > 2050) errors.push("Valid 4-digit Admission Year is required");
            if (!gradYear || isNaN(gradYear) || !program || gradYear !== admYear + program.durationYears) errors.push("Graduation Year must match the selected program duration and Admission Year");
            const rowSession = targetSession || (gradYear ? await PlacementSession.findOne({ sessionYear: gradYear }) : null);
            if (!rowSession || Number(rowSession.sessionYear) !== gradYear) errors.push("A placement session matching the Graduation Year must be configured");

            // In-sheet duplicate check
            if (usn) {
                if (seenUsns.has(usn)) {
                    errors.push(`Duplicate USN '${usn}' found within this spreadsheet`);
                }
                seenUsns.add(usn);
            }
            if (email) {
                if (seenEmails.has(email)) {
                    errors.push(`Duplicate Email '${email}' found within this spreadsheet`);
                }
                seenEmails.add(email);
            }

            if (errors.length > 0) {
                invalidCount++;
                const reason = errors.join("; ");
                previewResults.push({
                    rowNumber,
                    identifier: usn || `Row ${rowNumber}`,
                    name: fullName || "Unknown",
                    status: "ERROR",
                    action: "ERROR",
                    reason
                });
                errorReport.push({
                    rowNumber,
                    identifier: usn || `Row ${rowNumber}`,
                    failedField: "Validation",
                    reason
                });
                continue;
            }

            // Database conflict checks
            const existingUser = await User.findOne({ email });
            const existingProfile = await StudentProfile.findOne({ enrollmentNumber: usn });

            let status = "VALID";
            let action = "INSERT";
            let reason = "New student record ready to be registered";

            if (existingUser || existingProfile) {
                status = "CONFLICT";
                action = "SKIP";
                reason = `Student with USN '${usn}' or Email '${email}' already exists in database.`;
                const isSameAccount = existingProfile && existingUser && String(existingProfile.user) === String(existingUser._id);
                const isVerified = existingProfile?.verificationStatus === "VERIFIED" ||
                    existingProfile?.academicVerificationStatus === "VERIFIED";
                const existingProgram = existingProfile ? resolveStudentProgram(existingProfile) : null;
                const unchangedProgramAndCohort = Boolean(
                    existingProgram?.code === program.code &&
                    Number(existingProfile.admissionYear) === admYear &&
                    Number(existingProfile.graduationYear) === gradYear &&
                    (!existingProfile.placementSession || String(existingProfile.placementSession) === String(rowSession._id))
                );

                if (conflictStrategy === "update_unverified" && isSameAccount && !isVerified && unchangedProgramAndCohort) {
                    action = "UPDATE";
                    reason = "Existing unverified record has the same approved program and cohort; canonical program metadata may be refreshed.";
                } else if (!unchangedProgramAndCohort) {
                    reason = "Existing program or cohort differs or is unresolved; preserve the record and resolve the conflict through authorized profile review.";
                } else if (isVerified) {
                    reason = "Existing academic record is verified and will not be overwritten.";
                }
                conflictCount++;
            }

            validCount++;
            previewResults.push({
                rowNumber,
                identifier: usn,
                name: fullName,
                status,
                action,
                proposedAction: action,
                details: {
                    usn,
                    fullName,
                    email,
                    phone: rawPhone ? String(rawPhone).trim() : "",
                    course,
                    programCode: program.code,
                    programLevel: program.programLevel,
                    degreeType: program.degreeType,
                    department: program.name,
                    placementSession: rowSession._id,
                    admissionYear: admYear,
                    graduationYear: gradYear,
                    currentSemester: sem,
                    gender: rawGender || "Prefer not to say"
                },
                reason
            });

        } else if (importType === "academic_history") {
            const rawUsn = getCell(row, ["usn", "enrollment", "rollno"], 1);
            const rawCgpa = getCell(row, ["cgpa", "overallcgpa"], 2);
            const rawSem1 = getCell(row, ["sgpasem1", "sem1sgpa", "sem1", "sgpa1"], 3);
            const rawSem2 = getCell(row, ["sgpasem2", "sem2sgpa", "sem2", "sgpa2"], 4);
            const rawSem3 = getCell(row, ["sgpasem3", "sem3sgpa", "sem3", "sgpa3"], 5);
            const rawSem4 = getCell(row, ["sgpasem4", "sem4sgpa", "sem4", "sgpa4"], 6);
            const rawSem5 = getCell(row, ["sgpasem5", "sem5sgpa", "sem5", "sgpa5"], 7);
            const rawSem6 = getCell(row, ["sgpasem6", "sem6sgpa", "sem6", "sgpa6"], 8);
            const rawSem7 = getCell(row, ["sgpasem7", "sem7sgpa", "sem7", "sgpa7"], 9);
            const rawSem8 = getCell(row, ["sgpasem8", "sem8sgpa", "sem8", "sgpa8"], 10);
            const rawActiveBacklogs = getCell(row, ["activebacklogs", "activebacklogscount", "backlogs"], 11);
            const rawHistBacklogs = getCell(row, ["clearedbacklogs", "historicalbacklogs"], 12);
            const raw10Board = getCell(row, ["class10board", "10thboard", "tenthboard"], 13);
            const raw10School = getCell(row, ["class10institution", "class10school", "10thinstitution", "tenthschool"], 14);
            const raw10Year = getCell(row, ["class10passingyear", "10thpassingyear", "10thyear", "tenthyear"], 15);
            const raw10Pct = getCell(row, ["class10", "class10percentage", "10th", "10thpercentage", "tenthpercentage", "tenthpct"], 16);
            const raw12Type = getCell(row, ["class12diplomatype", "12thdiplomatype", "twelfthtype"], 17);
            const raw12Inst = getCell(row, ["class12institution", "12thinstitution", "twelfthschool"], 18);
            const raw12Year = getCell(row, ["class12passingyear", "12thpassingyear", "12thyear", "twelfthyear"], 19);
            const raw12Pct = getCell(row, ["class12diploma", "class12diplomapercentage", "12thdiploma", "12th", "12thpercentage", "twelfthpct", "twelfthpercentage"], 20);
            const rawHasGap = getCell(row, ["haseducationgap", "educationgap", "gapyears"], 21);
            const rawGapReason = getCell(row, ["gapreason", "educationgapreason"], 22);
            const rawGapDur = getCell(row, ["gapdurationmonths", "gapduration"], 23);

            const usn = (rawUsn || "").toUpperCase().trim();
            const cgpa = Number(rawCgpa);
            const activeBacklogs = rawActiveBacklogs !== "" ? Number(rawActiveBacklogs) : 0;
            const histBacklogs = rawHistBacklogs !== "" ? Number(rawHistBacklogs) : 0;

            const errors = [];
            if (!usn) errors.push("USN is required");
            if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) errors.push("Overall CGPA must be a valid number between 0.00 and 10.00");
            if (isNaN(activeBacklogs) || activeBacklogs < 0) errors.push("Active Backlogs cannot be negative");
            if (isNaN(histBacklogs) || histBacklogs < 0) errors.push("Cleared Backlogs cannot be negative");

            // In-sheet duplicate check
            if (usn) {
                if (seenUsns.has(usn)) {
                    errors.push(`Duplicate academic row for USN '${usn}' within spreadsheet`);
                }
                seenUsns.add(usn);
            }

            if (errors.length > 0) {
                invalidCount++;
                const reason = errors.join("; ");
                previewResults.push({
                    rowNumber,
                    identifier: usn || `Row ${rowNumber}`,
                    name: "Academic Record",
                    status: "ERROR",
                    action: "ERROR",
                    reason
                });
                errorReport.push({
                    rowNumber,
                    identifier: usn || `Row ${rowNumber}`,
                    failedField: "Academic Validation",
                    reason
                });
                continue;
            }

            // Cross-reference existing student profile
            const profile = await StudentProfile.findOne({ enrollmentNumber: usn }).populate("user", "fullName email");
            if (!profile) {
                invalidCount++;
                const reason = `Unknown USN '${usn}'. Student must be registered before importing academic history.`;
                previewResults.push({
                    rowNumber,
                    identifier: usn,
                    name: "Unknown Student",
                    status: "ERROR",
                    action: "ERROR",
                    reason
                });
                errorReport.push({
                    rowNumber,
                    identifier: usn,
                    failedField: "USN Resolution",
                    reason
                });
                continue;
            }

            let status = "VALID";
            let action = "UPDATE";
            let reason = `Academic records ready to update for ${profile.user?.fullName || usn}`;

            // Check if profile is already verified by TPO
            if (profile.verificationStatus === "VERIFIED" || profile.academicVerificationStatus === "VERIFIED") {
                status = "CONFLICT";
                action = "SKIP";
                reason = `Profile is already officially VERIFIED by TPO. Cannot overwrite verified academic data.`;
                conflictCount++;
            }

            // Build semester SGPAs
            const semesterResults = [];
            [rawSem1, rawSem2, rawSem3, rawSem4, rawSem5, rawSem6, rawSem7, rawSem8].forEach((sg, idx) => {
                if (sg !== "" && !isNaN(Number(sg))) {
                    const val = Number(sg);
                    if (val >= 0 && val <= 10) {
                        semesterResults.push({
                            semester: idx + 1,
                            sgpa: val,
                            credits: 20,
                            passedCredits: 20,
                            isVerified: false
                        });
                    }
                }
            });

            const hasGap = String(rawHasGap).toUpperCase() === "YES" || String(rawHasGap) === "TRUE" || (rawHasGap && Number(rawHasGap) > 0);

            const p10 = raw10Pct !== "" && !isNaN(Number(raw10Pct)) ? Number(raw10Pct) : null;
            const p12 = raw12Pct !== "" && !isNaN(Number(raw12Pct)) ? Number(raw12Pct) : null;
            const y10 = raw10Year !== "" && !isNaN(Number(raw10Year)) ? Number(raw10Year) : null;
            const y12 = raw12Year !== "" && !isNaN(Number(raw12Year)) ? Number(raw12Year) : null;

            validCount++;
            previewResults.push({
                rowNumber,
                identifier: usn,
                name: profile.user?.fullName || usn,
                status,
                action,
                proposedAction: action,
                details: {
                    profileId: profile._id,
                    cgpa,
                    activeBacklogs,
                    historicalBacklogs: histBacklogs,
                    semesterResults,
                    tenthDetails: {
                        board: raw10Board || "CBSE",
                        schoolName: raw10School || "",
                        passingYear: y10,
                        percentage: p10
                    },
                    twelfthOrDiplomaDetails: {
                        qualificationType: ["12th", "Diploma", "Other", "None"].includes(raw12Type) ? raw12Type : "12th",
                        institutionName: raw12Inst || "",
                        passingYear: y12,
                        percentage: p12
                    },
                    hasEducationGap: Boolean(hasGap),
                    educationGaps: hasGap ? [{
                        startYear: (y10 || 2021) + 2,
                        endYear: (y10 || 2021) + 3,
                        durationMonths: rawGapDur && !isNaN(Number(rawGapDur)) ? Number(rawGapDur) : 12,
                        reason: "Personal reasons",
                        explanation: `Imported gap: ${rawGapReason || "Education gap"}`
                    }] : []
                },
                reason
            });

        } else if (importType === "historical_placements") {
            const rawUsn = getCell(row, ["usn", "enrollment", "rollno", "student"], 1);
            const rawCompName = getCell(row, ["companyname", "company", "recruiter", "employer"], 2);
            const rawJobTitle = getCell(row, ["jobtitlerole", "jobtitle", "role", "designation", "job"], 3);
            const rawSessionYear = getCell(row, ["placementsession", "placementsessionyear", "sessionyear", "session", "batch"], 4);
            const rawPkg = getCell(row, ["offerpackagelpa", "offerpackage", "package", "offerctclpa", "ctc", "salary"], 5);
            const rawStatus = getCell(row, ["placementstatus", "outcomestatus", "status", "outcome"], 6);
            const rawOfferDate = getCell(row, ["offerdatedrivename", "offerdate", "offerdrivedate", "date", "drivedate"], 7);
            const rawRound = getCell(row, ["interviewround", "interviewstage", "round", "stage"], 8);
            const rawRemarks = getCell(row, ["remarks", "notes", "comment", "comments"], 9);
            const rawJobType = getCell(row, ["jobtype", "type"], 10);

            const usn = (rawUsn || "").toUpperCase().trim();
            const sessionYear = Number(rawSessionYear);
            const compName = (rawCompName || "").trim();
            const jobTitle = (rawJobTitle || "").trim();
            const pkg = Number(rawPkg);
            const status = (rawStatus || "").toLowerCase().trim();
            const jobType = (rawJobType || "full-time").toLowerCase().trim();
            const offerDate = rawOfferDate ? new Date(rawOfferDate) : null;

            const errors = [];
            if (!usn) errors.push("USN is required");
            if (!Number.isInteger(sessionYear) || sessionYear < 1900 || sessionYear > 2200) errors.push("A valid Placement Session Year is required");
            if (!compName) errors.push("Company Name is required");
            if (!jobTitle) errors.push("Job Title is required");
            if (isNaN(pkg) || pkg <= 0) errors.push("Valid offer package is required");
            if (!["full-time", "internship", "internship-to-full-time"].includes(jobType)) {
                errors.push("Job Type must be full-time, internship, or internship-to-full-time");
            }
            if (!offerDate || Number.isNaN(offerDate.getTime())) errors.push("A valid historical Offer Date is required");
            const configuredSession = Number.isInteger(sessionYear)
                ? await PlacementSession.findOne({ sessionYear })
                : null;
            if (!configuredSession) errors.push(`No configured placement session exists for year ${sessionYear || "provided"}`);

            const allowedStatuses = ["applied", "shortlisted", "interview", "selected", "offer_received", "offer_accepted", "rejected"];
            if (!allowedStatuses.includes(status)) {
                errors.push(`Invalid status '${status}'. Allowed: ${allowedStatuses.join(", ")}`);
            }

            if (errors.length > 0) {
                invalidCount++;
                const reason = errors.join("; ");
                previewResults.push({
                    rowNumber,
                    identifier: usn || `Row ${rowNumber}`,
                    name: compName || "Placement Record",
                    status: "ERROR",
                    action: "ERROR",
                    reason
                });
                errorReport.push({
                    rowNumber,
                    identifier: usn || `Row ${rowNumber}`,
                    failedField: "Placement Validation",
                    reason
                });
                continue;
            }

            // Find student profile
            const profile = await StudentProfile.findOne({ enrollmentNumber: usn }).populate("user", "fullName email");
            if (!profile) {
                invalidCount++;
                const reason = `Student USN '${usn}' not found in database. Cannot map placement outcome.`;
                previewResults.push({
                    rowNumber,
                    identifier: usn,
                    name: "Unknown Student",
                    status: "ERROR",
                    action: "ERROR",
                    reason
                });
                errorReport.push({
                    rowNumber,
                    identifier: usn,
                    failedField: "Student Resolution",
                    reason
                });
                continue;
            }

            const profileSession = profile.placementSession
                ? await PlacementSession.findById(profile.placementSession).select("sessionYear")
                : null;
            if (
                Number(profile.graduationYear) !== sessionYear ||
                (profile.placementSession && Number(profileSession?.sessionYear) !== sessionYear)
            ) {
                invalidCount++;
                const reason = `Student cohort (${profile.graduationYear}) does not match placement session year ${sessionYear}.`;
                previewResults.push({
                    rowNumber,
                    identifier: usn,
                    name: profile.user?.fullName || usn,
                    status: "ERROR",
                    action: "ERROR",
                    reason
                });
                errorReport.push({
                    rowNumber,
                    identifier: usn,
                    failedField: "Placement Session",
                    reason
                });
                continue;
            }

            validCount++;
            const program = resolveStudentProgram(profile);
            previewResults.push({
                rowNumber,
                identifier: usn,
                name: profile.user?.fullName || usn,
                status: "VALID",
                action: "INSERT",
                proposedAction: "INSERT",
                details: {
                    profileId: profile._id,
                    studentUserId: profile.user?._id,
                    sessionYear,
                    companyName: compName,
                    jobTitle,
                    jobType,
                    package: pkg,
                    status,
                    offerDate,
                    interviewRound: rawRound || "",
                    remarks: rawRemarks || "",
                    branch: profile.branch || profile.department || "",
                    department: profile.department || profile.branch || "",
                    course: profile.course || "",
                    programCode: program?.code || "",
                    programLevel: program?.programLevel || "",
                    degreeType: program?.degreeType || ""
                },
                reason: `Placement outcome '${status}' with ${compName} ready to migrate`
            });
        }
    }

    // Create persistent ImportBatch document
    const batch = await ImportBatch.create({
        batchId,
        importType,
        placementSession: targetSession?._id,
        originalFilename: filename,
        initiatedBy: adminUser._id,
        status: "PREVIEWED",
        conflictStrategy,
        totalRows: rowCount - 1,
        validRows: validCount,
        invalidRows: invalidCount,
        conflictRows: conflictCount,
        previewResults,
        errorReport,
        summary: `Parsed ${rowCount - 1} rows: ${validCount} valid, ${conflictCount} conflicts, ${invalidCount} invalid/errors.`
    });

    return batch;
};

/**
 * 3. Commit Approved Import Batch
 * Commits pre-validated batch to database, enforcing uniqueness, transaction safety & audit trails.
 */
export const commitImportBatch = async (batchId, adminUser) => {
    const batch = await ImportBatch.findOne({ batchId });
    if (!batch) {
        throw new Error("Import batch not found.");
    }
    if (batch.status === "COMMITTED") {
        throw new Error("This import batch has already been committed.");
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of batch.previewResults) {
        if (item.action === "ERROR" || item.status === "ERROR") {
            failed++;
            continue;
        }

        if (item.action === "SKIP") {
            skipped++;
            continue;
        }

        try {
            if (batch.importType === "student_records") {
                const d = item.details;
                let session = batch.placementSession;
                if (session && !session.sessionYear) {
                    session = await PlacementSession.findById(session);
                } else if (!session && d.graduationYear) {
                    session = await PlacementSession.findOne({ sessionYear: Number(d.graduationYear) });
                }
                if (!session || Number(session.sessionYear) !== Number(d.graduationYear)) {
                    throw new Error("A matching placement session is no longer available for this student's graduation cohort.");
                }

                if (item.action === "INSERT") {
                    const tempPassword = `Student@${d.usn.slice(-4) || "1234"}`;
                    const newUser = await User.create({
                        fullName: d.fullName,
                        email: d.email,
                        password: tempPassword,
                        phone: d.phone || "",
                        role: "student",
                        isActive: true
                    });

                    try {
                        await StudentProfile.create({
                            user: newUser._id,
                            enrollmentNumber: d.usn,
                            usn: d.usn,
                            course: d.course,
                            programCode: d.programCode,
                            programLevel: d.programLevel,
                            degreeType: d.degreeType,
                            department: d.department,
                            branch: d.department,
                            admissionYear: d.admissionYear,
                            graduationYear: d.graduationYear,
                            currentSemester: d.currentSemester,
                            semester: d.currentSemester,
                            placementSession: session?._id,
                            gender: d.gender,
                            cgpa: null,
                            semesterResults: [],
                            activeBacklogs: 0,
                            historicalBacklogs: 0
                        });
                        inserted++;
                    } catch (profileErr) {
                        await User.findByIdAndDelete(newUser._id);
                        throw profileErr;
                    }
                } else if (item.action === "UPDATE") {
                    const updatedProfile = await StudentProfile.findOneAndUpdate(
                        {
                            enrollmentNumber: d.usn,
                            verificationStatus: { $nin: ["VERIFIED"] },
                            academicVerificationStatus: { $nin: ["VERIFIED"] }
                        },
                        {
                            $set: {
                                course: d.course,
                                programCode: d.programCode,
                                programLevel: d.programLevel,
                                degreeType: d.degreeType,
                                department: d.department,
                                branch: d.department,
                                currentSemester: d.currentSemester,
                                semester: d.currentSemester,
                                admissionYear: d.admissionYear,
                                graduationYear: d.graduationYear,
                                placementSession: d.placementSession
                            }
                        },
                        { new: true }
                    );
                    if (!updatedProfile) {
                        throw new Error("Student profile became verified or unavailable after preview; no record was updated.");
                    }
                    updated++;
                }

            } else if (batch.importType === "academic_history") {
                const d = item.details;
                const updateFields = {
                    cgpa: d.cgpa,
                    verifiedCGPA: d.cgpa,
                    activeBacklogs: d.activeBacklogs,
                    historicalBacklogs: d.historicalBacklogs,
                    semesterResults: d.semesterResults,
                    tenthDetails: d.tenthDetails,
                    twelfthOrDiplomaDetails: d.twelfthOrDiplomaDetails,
                    hasEducationGap: d.hasEducationGap,
                    educationGaps: d.educationGaps
                };
                if (d.tenthDetails?.percentage != null && !isNaN(d.tenthDetails.percentage)) {
                    updateFields.tenthPercentage = d.tenthDetails.percentage;
                }
                if (d.twelfthOrDiplomaDetails?.percentage != null && !isNaN(d.twelfthOrDiplomaDetails.percentage)) {
                    updateFields.twelfthPercentage = d.twelfthOrDiplomaDetails.percentage;
                }
                await StudentProfile.findByIdAndUpdate(d.profileId, { $set: updateFields });
                updated++;

            } else if (batch.importType === "historical_placements") {
                const d = item.details;
                const session = await PlacementSession.findOne({ sessionYear: d.sessionYear });
                if (!session) {
                    throw new Error(`No configured placement session exists for year ${d.sessionYear}.`);
                }
                const profile = await StudentProfile.findById(d.profileId).select("graduationYear placementSession");
                if (
                    !profile ||
                    Number(profile.graduationYear) !== d.sessionYear ||
                    (profile.placementSession && String(profile.placementSession) !== String(session._id))
                ) {
                    throw new Error("The student's placement-session assignment no longer matches the imported historical outcome.");
                }

                // Find or create Company
                let comp = await Company.findOne({
                    companyName: { $regex: new RegExp(`^${d.companyName}$`, "i") }
                });
                if (!comp) {
                    comp = await Company.create({
                        companyName: d.companyName,
                        createdBy: adminUser._id
                    });
                }

                // Find or create Placement Drive
                let drive = await PlacementDrive.findOne({
                    company: comp._id,
                    jobTitle: d.jobTitle
                });
                if (!drive) {
                    drive = await PlacementDrive.create({
                        company: comp._id,
                        jobTitle: d.jobTitle,
                        jobType: d.jobType,
                        package: d.package,
                        eligibleBranches: PROGRAM_CATALOG.map((program) => program.name),
                        eligibleProgramCodes: PROGRAM_CATALOG.map((program) => program.code),
                        minimumCGPA: 0,
                        graduationYear: d.sessionYear,
                        placementSession: session?._id,
                        applicationStartDate: new Date(Date.now() - 30 * 86400000),
                        applicationDeadline: new Date(Date.now() - 5 * 86400000),
                        driveDate: d.offerDate,
                        createdBy: adminUser._id,
                        studentRequirements: DEFAULT_STUDENT_REQUIREMENTS
                    });
                }

                // Create or update historical Application
                const existingApp = await Application.findOne({
                    student: d.profileId,
                    placementDrive: drive._id
                });

                if (!existingApp) {
                    await Application.create({
                        student: d.profileId,
                        placementDrive: drive._id,
                        status: d.status,
                        appliedAt: new Date(d.offerDate.getTime() - 7 * 86400000),
                        offeredPackage: d.package,
                        interviewRound: d.interviewRound,
                        interviewDate: d.offerDate,
                        statusHistory: [
                            { status: "applied", changedAt: new Date(d.offerDate.getTime() - 7 * 86400000), remarks: "Imported historical application" },
                            { status: d.status, changedAt: d.offerDate, remarks: d.remarks }
                        ],
                        submittedSnapshot: {
                            studentProfileId: d.profileId,
                            usn: item.identifier,
                            fullName: item.name,
                            branch: d.branch,
                            department: d.department,
                            course: d.course,
                            programCode: d.programCode,
                            programLevel: d.programLevel,
                            degreeType: d.degreeType
                        }
                    });
                    inserted++;
                } else {
                    existingApp.status = d.status;
                    existingApp.offeredPackage = d.package;
                    await existingApp.save();
                    updated++;
                }

                // Update isPlaced flag on student profile if accepted
                if (d.status === "offer_accepted" || d.status === "selected") {
                    await StudentProfile.findByIdAndUpdate(d.profileId, {
                        $set: { isPlaced: true, placedCompany: d.companyName }
                    });
                }
            }
        } catch (err) {
            console.error(`Error committing row ${item.rowNumber}:`, err.message);
            failed++;
            batch.errorReport.push({
                rowNumber: item.rowNumber,
                identifier: item.identifier,
                failedField: "Database Persistence",
                reason: err.message
            });
        }
    }

    batch.insertedRows = inserted;
    batch.updatedRows = updated;
    batch.skippedRows = skipped;
    batch.failedRows = failed;
    batch.status = "COMMITTED";
    batch.completedAt = new Date();
    batch.summary = `Committed batch: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${failed} failed.`;
    await batch.save();

    return batch;
};

/**
 * 4. Reporting Exports (Eligible, Applicants, Session, Department)
 */

// Export Eligible Students for a Placement Drive
export const generateEligibleStudentsExport = async (driveId) => {
    const drive = await PlacementDrive.findById(driveId)
        .populate("company", "companyName")
        .populate("placementSession", "name sessionYear academicYear");

    if (!drive) {
        throw new Error("Placement Drive not found.");
    }

    // Query candidate cohort
    const query = {};
    if (drive.placementSession) query.placementSession = drive.placementSession._id;
    else if (drive.graduationYear) query.graduationYear = drive.graduationYear;

    const students = await StudentProfile.find(query)
        .populate("user", "fullName email phone")
        .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Eligible Candidates");

    sheet.columns = [
        { header: "Sl No", key: "slNo", width: 8 },
        { header: "USN", key: "usn", width: 16 },
        { header: "Student Name", key: "fullName", width: 24 },
        { header: "College Email", key: "email", width: 28 },
        { header: "Department", key: "branch", width: 28 },
        { header: "CGPA", key: "cgpa", width: 10 },
        { header: "Active Backlogs", key: "backlogs", width: 16 },
        { header: "10th %", key: "tenth", width: 12 },
        { header: "12th %", key: "twelfth", width: 12 },
        { header: "Eligibility Status", key: "status", width: 18 },
        { header: "Reasons / Evaluation Details", key: "reasons", width: 36 }
    ];
    styleHeaderRow(sheet.getRow(1), "1E3A8A");

    let count = 0;
    for (const student of students) {
        const evalResult = EligibilityService.evaluate(student, drive);
        if (evalResult.isEligible) {
            count++;
            const row = sheet.addRow({
                slNo: count,
                usn: sanitizeFormula(student.enrollmentNumber || student.usn),
                fullName: sanitizeFormula(student.user?.fullName || ""),
                email: sanitizeFormula(student.user?.email || student.collegeEmail || ""),
                branch: sanitizeFormula(resolveStudentProgram(student)?.name || student.branch || student.department || ""),
                cgpa: student.cgpa ?? "",
                backlogs: student.activeBacklogs ?? 0,
                tenth: student.tenthDetails?.percentage ?? student.tenthPercentage ?? "",
                twelfth: student.twelfthOrDiplomaDetails?.percentage ?? student.twelfthPercentage ?? "",
                status: "ELIGIBLE",
                reasons: "Satisfies all drive criteria"
            });
            styleDataRow(row);
        }
    }

    return workbook;
};

// Export Session-Wise Cohort Report
export const generateSessionReportExport = async (sessionId) => {
    const session = await PlacementSession.findById(sessionId);
    if (!session) {
        throw new Error("Placement Session not found.");
    }

    const students = await StudentProfile.find({ placementSession: session._id })
        .populate("user", "fullName email")
        .lean();

    const totalStudents = students.length;
    const placedStudents = students.filter((s) => s.isPlaced);
    const placedCount = placedStudents.length;
    const placementRate = totalStudents > 0 ? ((placedCount / totalStudents) * 100).toFixed(1) : "0.0";

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Executive Summary
    const summarySheet = workbook.addWorksheet("Cohort Summary");
    summarySheet.columns = [
        { header: "Metric", key: "metric", width: 32 },
        { header: "Value", key: "value", width: 32 }
    ];
    styleHeaderRow(summarySheet.getRow(1), "0F172A");

    const summaryData = [
        { metric: "Placement Session Name", value: session.name },
        { metric: "Academic Year", value: session.academicYear },
        { metric: "Graduating Batch Year", value: session.sessionYear },
        { metric: "Total Registered Students", value: totalStudents },
        { metric: "Total Placed Students", value: placedCount },
        { metric: "Placement Success Rate", value: `${placementRate}%` },
        { metric: "Session Status", value: session.status }
    ];
    summaryData.forEach((item) => styleDataRow(summarySheet.addRow(item)));

    // Sheet 2: Candidate Roster
    const rosterSheet = workbook.addWorksheet("Student Roster");
    rosterSheet.columns = [
        { header: "Sl No", key: "slNo", width: 8 },
        { header: "USN", key: "usn", width: 16 },
        { header: "Student Name", key: "name", width: 24 },
        { header: "Department", key: "dept", width: 28 },
        { header: "CGPA", key: "cgpa", width: 10 },
        { header: "Placement Status", key: "status", width: 18 },
        { header: "Placed Company", key: "company", width: 24 }
    ];
    styleHeaderRow(rosterSheet.getRow(1), "1E3A8A");

    students.forEach((s, idx) => {
        const row = rosterSheet.addRow({
            slNo: idx + 1,
            usn: sanitizeFormula(s.enrollmentNumber || s.usn),
            name: sanitizeFormula(s.user?.fullName || ""),
            dept: sanitizeFormula(resolveStudentProgram(s)?.name || s.branch || s.department || ""),
            cgpa: s.cgpa ?? "",
            status: s.isPlaced ? "PLACED" : "UNPLACED",
            company: sanitizeFormula(s.placedCompany || "")
        });
        styleDataRow(row);
    });

    return workbook;
};

// Export Error Report for Batch
export const generateErrorReportExport = async (batchId) => {
    const batch = await ImportBatch.findOne({ batchId });
    if (!batch) {
        throw new Error("Import batch not found.");
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Import Error Report");

    sheet.columns = [
        { header: "Row #", key: "rowNumber", width: 10 },
        { header: "Identifier (USN / ID)", key: "identifier", width: 24 },
        { header: "Failed Field / Category", key: "failedField", width: 24 },
        { header: "Actionable Error Reason", key: "reason", width: 45 }
    ];
    styleHeaderRow(sheet.getRow(1), "B91C1C");

    batch.errorReport.forEach((err) => {
        const row = sheet.addRow({
            rowNumber: err.rowNumber,
            identifier: sanitizeFormula(err.identifier),
            failedField: sanitizeFormula(err.failedField),
            reason: sanitizeFormula(err.reason)
        });
        styleDataRow(row);
    });

    return workbook;
};

// Export Drive Applicants / Shortlisted / Interview lists (respecting company-sharing configuration if company-facing)
export const generateDriveApplicantsExport = async ({ driveId, status, isCompanyFacing = false }) => {
    const drive = await PlacementDrive.findById(driveId)
        .populate("company", "companyName email phone")
        .populate("placementSession", "name sessionYear");

    if (!drive) {
        throw new Error("Placement Drive not found.");
    }

    const appQuery = { placementDrive: driveId };
    if (status && status !== "all") {
        appQuery.status = status;
    }

    const applications = await Application.find(appQuery)
        .populate({
            path: "student",
            populate: { path: "user", select: "fullName email phone" }
        })
        .lean();

    const workbook = new ExcelJS.Workbook();
    const sheetTitle = isCompanyFacing
        ? `Company Roster - ${drive.company?.companyName || "Drive"}`
        : `Applicants - ${status ? status.toUpperCase() : "ALL"}`;
    const sheet = workbook.addWorksheet(sheetTitle.slice(0, 31));

    // Dynamic columns respecting drive.studentRequirements when isCompanyFacing is true
    // Sensitive data (parent info, residential address) is strictly excluded
    const reqs = drive.studentRequirements || DEFAULT_STUDENT_REQUIREMENTS;
    const canShare = (key) => {
        if (!isCompanyFacing) return true;
        const found = reqs.find((r) => r.fieldKey === key);
        return found ? found.shareWithCompany : false;
    };

    const columns = [
        { header: "Sl No", key: "slNo", width: 8 },
        { header: "USN", key: "usn", width: 16 },
        { header: "Candidate Name", key: "name", width: 24 }
    ];

    if (canShare("email") || !isCompanyFacing) {
        columns.push({ header: "Email Address", key: "email", width: 28 });
    }
    if (canShare("phone") || !isCompanyFacing) {
        columns.push({ header: "Phone Number", key: "phone", width: 18 });
    }
    if (canShare("branch") || !isCompanyFacing) {
        columns.push({ header: "Department", key: "branch", width: 26 });
        columns.push({ header: "Program Code", key: "programCode", width: 18 });
    }
    if (canShare("cgpa") || !isCompanyFacing) {
        columns.push({ header: "CGPA", key: "cgpa", width: 10 });
    }
    if (canShare("activeBacklogs") || !isCompanyFacing) {
        columns.push({ header: "Active Backlogs", key: "backlogs", width: 16 });
    }
    if (canShare("tenthPercentage") || !isCompanyFacing) {
        columns.push({ header: "10th %", key: "tenth", width: 12 });
    }
    if (canShare("twelfthOrDiploma") || !isCompanyFacing) {
        columns.push({ header: "12th / Diploma %", key: "twelfth", width: 16 });
    }

    columns.push(
        { header: "Application Status", key: "status", width: 18 },
        { header: "Offered CTC (LPA)", key: "package", width: 18 },
        { header: "Interview Round", key: "interviewRound", width: 20 },
        { header: "Applied Date", key: "appliedDate", width: 16 }
    );

    sheet.columns = columns;
    styleHeaderRow(sheet.getRow(1), isCompanyFacing ? "047857" : "1E3A8A");

    applications.forEach((app, idx) => {
        const student = app.student || {};
        const user = student.user || {};

        const rowData = {
            slNo: idx + 1,
            usn: sanitizeFormula(student.enrollmentNumber || student.usn || app.submittedSnapshot?.usn || "N/A"),
            name: sanitizeFormula(user.fullName || app.submittedSnapshot?.fullName || "N/A"),
            status: (app.status || "applied").toUpperCase(),
            package: app.offeredPackage ?? "",
            interviewRound: sanitizeFormula(app.interviewRound || (app.interviewRounds?.length ? `Round ${app.interviewRounds.length}` : "-")),
            appliedDate: app.createdAt ? new Date(app.createdAt).toISOString().split("T")[0] : ""
        };

        if (canShare("email") || !isCompanyFacing) rowData.email = sanitizeFormula(user.email || student.collegeEmail || "");
        if (canShare("phone") || !isCompanyFacing) rowData.phone = sanitizeFormula(user.phone || student.phone || "");
        if (canShare("branch") || !isCompanyFacing) {
            const program = resolveStudentProgram(student);
            rowData.branch = sanitizeFormula(program?.name || student.branch || student.department || "");
            rowData.programCode = sanitizeFormula(program?.code || "");
        }
        if (canShare("cgpa") || !isCompanyFacing) rowData.cgpa = student.cgpa ?? "";
        if (canShare("activeBacklogs") || !isCompanyFacing) rowData.backlogs = student.activeBacklogs ?? 0;
        if (canShare("tenthPercentage") || !isCompanyFacing) rowData.tenth = student.tenthDetails?.percentage ?? student.tenthPercentage ?? "";
        if (canShare("twelfthOrDiploma") || !isCompanyFacing) rowData.twelfth = student.twelfthOrDiplomaDetails?.percentage ?? student.twelfthPercentage ?? "";

        const row = sheet.addRow(rowData);
        styleDataRow(row);
    });

    return workbook;
};

// Export Department-Wise Placement Performance Report
export const generateDepartmentReportExport = async ({ sessionId }) => {
    const session = await PlacementSession.findById(sessionId);
    if (!session) {
        throw new Error("Placement Session not found.");
    }

    const students = await StudentProfile.find({ placementSession: session._id })
        .populate("user", "fullName email")
        .lean();

    // Group stats by branch
    const deptStats = {};
    for (const student of students) {
        const program = resolveStudentProgram(student);
        const originalValue = student.branch || student.department || "Unassigned";
        const programKey = program?.code || `LEGACY:${originalValue}`;
        const dept = program?.name || originalValue;
        if (!deptStats[programKey]) {
            deptStats[programKey] = {
                programCode: program?.code || "UNRESOLVED",
                department: dept,
                total: 0,
                placed: 0,
                unplaced: 0,
                placedCompanies: new Set()
            };
        }
        deptStats[programKey].total++;
        if (student.isPlaced) {
            deptStats[programKey].placed++;
            if (student.placedCompany) deptStats[programKey].placedCompanies.add(student.placedCompany);
        } else {
            deptStats[programKey].unplaced++;
        }
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Department Analytics");

    sheet.columns = [
        { header: "Sl No", key: "slNo", width: 8 },
        { header: "Program Code", key: "programCode", width: 18 },
        { header: "Department / Branch", key: "department", width: 32 },
        { header: "Total Students", key: "total", width: 16 },
        { header: "Placed Students", key: "placed", width: 16 },
        { header: "Unplaced Students", key: "unplaced", width: 16 },
        { header: "Placement %", key: "rate", width: 16 },
        { header: "Recruiting Companies Count", key: "companiesCount", width: 26 }
    ];
    styleHeaderRow(sheet.getRow(1), "0F172A");

    let count = 0;
    for (const dept of Object.keys(deptStats).sort()) {
        count++;
        const stat = deptStats[dept];
        const rate = stat.total > 0 ? ((stat.placed / stat.total) * 100).toFixed(1) : "0.0";
        const row = sheet.addRow({
            slNo: count,
            programCode: sanitizeFormula(stat.programCode),
            department: sanitizeFormula(stat.department),
            total: stat.total,
            placed: stat.placed,
            unplaced: stat.unplaced,
            rate: `${rate}%`,
            companiesCount: stat.placedCompanies.size
        });
        styleDataRow(row);
    }

    return workbook;
};

// Export Historical Placement Outcomes Summary
export const generateHistoricalPlacementSummaryExport = async ({ sessionId }) => {
    const query = {};
    if (sessionId) {
        query.placementSession = sessionId;
    }

    const drives = await PlacementDrive.find(query)
        .populate("company", "companyName")
        .populate("placementSession", "name sessionYear")
        .lean();

    const driveIds = drives.map((d) => d._id);

    const applications = await Application.find({
        placementDrive: { $in: driveIds },
        status: { $in: ["selected", "offer_accepted", "offer_rejected"] }
    })
        .populate({
            path: "student",
            populate: { path: "user", select: "fullName email phone" }
        })
        .populate({
            path: "placementDrive",
            populate: [
                { path: "company", select: "companyName" },
                { path: "placementSession", select: "name sessionYear" }
            ]
        })
        .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Historical Placement Outcomes");

    sheet.columns = [
        { header: "Sl No", key: "slNo", width: 8 },
        { header: "USN", key: "usn", width: 16 },
        { header: "Student Name", key: "studentName", width: 24 },
        { header: "Academic Program", key: "branch", width: 42 },
        { header: "Program Code", key: "programCode", width: 18 },
        { header: "Company Name", key: "companyName", width: 28 },
        { header: "Job Title", key: "jobTitle", width: 24 },
        { header: "Offered CTC (LPA)", key: "package", width: 18 },
        { header: "Offer Status", key: "status", width: 18 },
        { header: "Placement Session", key: "session", width: 22 },
        { header: "Offer / Drive Date", key: "date", width: 16 }
    ];
    styleHeaderRow(sheet.getRow(1), "1E3A8A");

    applications.forEach((app, idx) => {
        const student = app.student || {};
        const user = student.user || {};
        const drive = app.placementDrive || {};
        const company = drive.company || {};
        const session = drive.placementSession || {};
        const snapshot = app.submittedSnapshot || {};
        const programSource = snapshot.programCode
            ? {
                  programCode: snapshot.programCode,
                  course: snapshot.course,
                  branch: snapshot.branch || snapshot.department
              }
            : snapshot.programCode === "" && (snapshot.branch || snapshot.department)
                ? {
                      course: snapshot.course,
                      branch: snapshot.branch || snapshot.department
                  }
                : snapshot.programCode !== undefined
                    ? { programCode: snapshot.programCode }
                    : student;
        const program = resolveStudentProgram(programSource);

        const row = sheet.addRow({
            slNo: idx + 1,
            usn: sanitizeFormula(student.enrollmentNumber || student.usn || app.submittedSnapshot?.usn || "N/A"),
            studentName: sanitizeFormula(user.fullName || app.submittedSnapshot?.fullName || "N/A"),
            branch: sanitizeFormula(program?.name || snapshot.branch || snapshot.department || student.branch || student.department || "N/A"),
            programCode: sanitizeFormula(program?.code || (snapshot.programCode !== undefined ? snapshot.programCode : student.programCode) || ""),
            companyName: sanitizeFormula(company.companyName || "N/A"),
            jobTitle: sanitizeFormula(drive.jobTitle || "Graduate Trainee"),
            package: app.offeredPackage ?? drive.package ?? "N/A",
            status: (app.status || "selected").toUpperCase(),
            session: sanitizeFormula(session.name || session.sessionYear ? String(session.sessionYear) : "N/A"),
            date: app.interviewDate ? new Date(app.interviewDate).toISOString().split("T")[0] : (app.createdAt ? new Date(app.createdAt).toISOString().split("T")[0] : "")
        });
        styleDataRow(row);
    });

    return workbook;
};
