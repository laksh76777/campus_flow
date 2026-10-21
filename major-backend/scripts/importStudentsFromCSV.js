/**
 * CampusFlow V2 — Automated Bulk Student Account Registration Script
 *
 * Reads students from the official synthetic CSV file, validates their records
 * against the official program catalogue and placement sessions, creates persistent
 * User authentication accounts (role: "student", bcrypt password: "123456789"),
 * and saves corresponding StudentProfile documents linked to the user account.
 *
 * Safe execution features:
 * - Full dry-run mode (--dry-run)
 * - Bounded offset and limit support (--offset=0 --limit=80)
 * - Idempotency: Duplicate detection by email and USN (skips existing without overwriting)
 * - Atomic rollback: If profile insertion fails, created user account is safely removed
 * - Preserves synthetic sample indicators (verificationStatus: PENDING, isPlaced: false)
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import connectDB from "../src/db/index.js";
import { User } from "../src/models/user.models.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { PlacementSession } from "../src/models/placementSession.model.js";
import { getCatalogProgram } from "../src/constants/programCatalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from major-backend/.env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEFAULT_INITIAL_PASSWORD = "123456789";

// CSV parsing helper handling quoted fields with commas
function parseCSVLine(text) {
    const parts = [];
    let insideQuote = false;
    let entry = "";
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            insideQuote = !insideQuote;
        } else if (c === "," && !insideQuote) {
            parts.push(entry);
            entry = "";
        } else {
            entry += c;
        }
    }
    parts.push(entry);
    return parts;
}

function parseSemesterSGPAs(str) {
    if (!str) return [];
    const results = [];
    const segments = str.split(";").map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
        const match = seg.match(/S?(\d+)\s*:\s*([\d.]+)/i);
        if (match) {
            results.push({
                semester: Number(match[1]),
                sgpa: Number(match[2]),
                credits: 20,
                passedCredits: 20
            });
        }
    }
    return results;
}

function parseSkills(str) {
    if (!str) return [];
    return str.split(";").map((s) => s.trim()).filter(Boolean);
}

function parseCertificates(row) {
    if (!row.certificateTitle) return [];
    return [
        {
            title: row.certificateTitle.trim(),
            issuer: row.certificateIssuer ? row.certificateIssuer.trim() : "",
            issueDate: row.certificateIssueDate ? row.certificateIssueDate.trim() : "",
            certificateUrl: row.certificateUrl ? row.certificateUrl.trim() : "",
            credentialId: row.credentialId ? row.credentialId.trim() : ""
        }
    ];
}

export async function readCSVRecords(csvFilePath) {
    const fileStream = fs.createReadStream(csvFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let header = null;
    const records = [];
    let rowNumber = 0;

    for await (const line of rl) {
        rowNumber++;
        if (!line.trim()) continue;
        const parts = parseCSVLine(line);
        if (!header) {
            header = parts.map((h) => h.trim());
            continue;
        }
        const row = {};
        header.forEach((h, i) => {
            row[h] = parts[i] !== undefined ? parts[i].trim() : "";
        });
        row.__rowNumber = rowNumber;
        records.push(row);
    }

    return records;
}

export async function runBulkImport({
    csvFilePath,
    dryRun = false,
    offset = 0,
    limit = 160
}) {
    console.log(`\n======================================================`);
    console.log(`CampusFlow V2 — Bulk Student Account Registration`);
    console.log(`Mode: ${dryRun ? "DRY-RUN (No database writes)" : "LIVE EXECUTION"}`);
    console.log(`Target Window: Offset ${offset}, Limit ${limit}`);
    console.log(`CSV Source: ${csvFilePath}`);
    console.log(`======================================================\n`);

    if (!fs.existsSync(csvFilePath)) {
        throw new Error(`CSV file not found at: ${csvFilePath}`);
    }

    const allRecords = await readCSVRecords(csvFilePath);
    console.log(`Total records in CSV: ${allRecords.length}`);

    const targetRecords = allRecords.slice(offset, offset + limit);
    console.log(`Processing ${targetRecords.length} records (index ${offset} to ${offset + targetRecords.length - 1})...\n`);

    // Connect to MongoDB
    await connectDB();

    // Verify PlacementSession for Class of 2027 exists
    const session2027 = await PlacementSession.findOne({ sessionYear: 2027 });
    if (!session2027) {
        throw new Error("Placement session for Class of 2027 was not found in database.");
    }
    console.log(`Matched Placement Session: Class of ${session2027.sessionYear} (${session2027.name}, ID: ${session2027._id})`);

    const summary = {
        totalRead: targetRecords.length,
        created: 0,
        skippedDuplicate: 0,
        failed: 0,
        errors: [],
        createdRecords: []
    };

    for (let i = 0; i < targetRecords.length; i++) {
        const row = targetRecords[i];
        const recordIndex = offset + i + 1;
        const studentName = row.fullName?.trim();
        const collegeEmail = row.collegeEmail?.toLowerCase().trim();
        const usn = row.usn?.trim().toUpperCase();
        const enrollmentNumber = row.enrollmentNumber?.trim().toUpperCase() || usn;
        const programCode = row.programCode?.trim().toUpperCase();

        try {
            // 1. Validation
            if (!studentName || !collegeEmail || !usn || !programCode) {
                throw new Error("Missing mandatory fields (fullName, collegeEmail, usn, or programCode)");
            }

            const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
            if (!emailRegex.test(collegeEmail)) {
                throw new Error(`Invalid email format: ${collegeEmail}`);
            }

            const program = getCatalogProgram(programCode);
            if (!program) {
                throw new Error(`Unrecognized programCode: '${programCode}'`);
            }

            const admissionYear = Number(row.admissionYear) || 2023;
            const graduationYear = Number(row.graduationYear) || 2027;
            const semesterNum = Number(row.currentSemester || row.semester || 7);

            // 2. Check for existing User or StudentProfile (Idempotency)
            const existingUser = await User.findOne({ email: collegeEmail });
            const existingProfile = await StudentProfile.findOne({
                $or: [{ usn }, { enrollmentNumber }]
            });

            if (existingUser || existingProfile) {
                summary.skippedDuplicate++;
                console.log(`[SKIP ${recordIndex}/${offset + targetRecords.length}] Duplicate: ${collegeEmail} (${usn}) already exists.`);
                continue;
            }

            // In dry run, record as created without writing to database
            if (dryRun) {
                summary.created++;
                summary.createdRecords.push({
                    usn,
                    collegeEmail,
                    programCode,
                    department: program.name,
                    fullName: studentName
                });
                if (summary.created <= 5 || summary.created % 20 === 0) {
                    console.log(`[DRY-RUN VALID ${recordIndex}/${offset + targetRecords.length}] ${usn} | ${studentName} | ${program.name}`);
                }
                continue;
            }

            // 3. Live Execution: Create User
            const user = await User.create({
                fullName: studentName,
                email: collegeEmail,
                password: DEFAULT_INITIAL_PASSWORD, // Hashed by User pre-save hook
                role: "student",
                phone: row.phone ? row.phone.trim() : "",
                isEmailVerified: true,
                isActive: true
            });

            // 4. Live Execution: Create StudentProfile linked to User
            let studentProfile;
            try {
                // Semester results: Only completed semesters (< semesterNum). If student is in sem 7, sem 7 is ongoing and has no marks yet.
                const sResults = parseSemesterSGPAs(row.semesterSGPAs).filter(r => r.semester < semesterNum);
                let cgpaVal = null;
                if (sResults.length > 0) {
                    const sum = sResults.reduce((acc, curr) => acc + curr.sgpa, 0);
                    cgpaVal = Number((sum / sResults.length).toFixed(2));
                }

                studentProfile = await StudentProfile.create({
                    user: user._id,
                    enrollmentNumber,
                    usn,
                    course: "B.E.",
                    programCode: program.code,
                    programLevel: program.programLevel,
                    degreeType: program.degreeType,
                    branch: program.name,
                    department: program.name,
                    admissionYear,
                    graduationYear,
                    semester: semesterNum,
                    currentSemester: semesterNum,
                    section: row.section ? row.section.trim() : "A",
                    placementSession: session2027._id,

                    gender: row.gender || "Prefer not to say",
                    dob: row.dob ? new Date(row.dob) : null,
                    personalEmail: row.personalEmail ? row.personalEmail.toLowerCase().trim() : "",
                    collegeEmail,
                    alternatePhone: row.alternatePhone ? row.alternatePhone.trim() : "",

                    family: {
                        fatherName: row.fatherName || "",
                        fatherOccupation: row.fatherOccupation || "",
                        fatherEmployer: row.fatherEmployer || "",
                        fatherPhone: row.fatherPhone || "",
                        fatherEmail: row.fatherEmail || "",
                        motherName: row.motherName || "",
                        motherOccupation: row.motherOccupation || "",
                        motherEmployer: row.motherEmployer || "",
                        motherPhone: row.motherPhone || "",
                        motherEmail: row.motherEmail || "",
                        guardianName: row.guardianName || "",
                        guardianRelation: row.guardianRelation || "",
                        guardianOccupation: row.guardianOccupation || "",
                        guardianPhone: row.guardianPhone || ""
                    },

                    currentAddress: {
                        street: row.currentStreet || "",
                        locality: row.currentLocality || "",
                        city: row.currentCity || "",
                        district: row.currentDistrict || "",
                        state: row.currentState || "",
                        pincode: row.currentPincode || "",
                        country: row.currentCountry || "India"
                    },

                    permanentAddress: {
                        street: row.permanentStreet || "",
                        locality: row.permanentLocality || "",
                        city: row.permanentCity || "",
                        district: row.permanentDistrict || "",
                        state: row.permanentState || "",
                        pincode: row.permanentPincode || "",
                        country: row.permanentCountry || "India"
                    },
                    sameAsCurrent: String(row.sameAsCurrent).toUpperCase() === "TRUE",

                    tenthDetails: {
                        schoolName: row.tenthSchoolName || "",
                        board: row.tenthBoard || "CBSE",
                        state: row.tenthState || "",
                        passingYear: row.tenthPassingYear ? Number(row.tenthPassingYear) : null,
                        marksObtained: row.tenthMarksObtained ? Number(row.tenthMarksObtained) : null,
                        maxMarks: row.tenthMaxMarks ? Number(row.tenthMaxMarks) : null,
                        percentage: row.tenthPercentage ? Number(row.tenthPercentage) : null
                    },

                    twelfthOrDiplomaDetails: {
                        qualificationType: row.twelfthQualificationType === "Diploma" ? "Diploma" : "12th",
                        institutionName: row.twelfthInstitutionName || "",
                        boardOrUniversity: row.twelfthBoardOrUniversity || "",
                        state: row.twelfthState || "",
                        diplomaBranch: row.diplomaBranch || "",
                        passingYear: row.twelfthPassingYear ? Number(row.twelfthPassingYear) : null,
                        marksObtained: row.twelfthMarksObtained ? Number(row.twelfthMarksObtained) : null,
                        maxMarks: row.twelfthMaxMarks ? Number(row.twelfthMaxMarks) : null,
                        percentage: row.twelfthPercentage ? Number(row.twelfthPercentage) : null
                    },

                    hasEducationGap: String(row.hasEducationGap).toUpperCase() === "TRUE",
                    semesterResults: sResults,
                    cgpa: cgpaVal,
                    verifiedCGPA: cgpaVal,

                    backlogs: Number(row.backlogs || 0),
                    activeBacklogs: Number(row.activeBacklogs || 0),
                    historicalBacklogs: Number(row.historicalBacklogs || 0),
                    clearedBacklogsCount: Number(row.clearedBacklogsCount || 0),

                    skills: parseSkills(row.skills),
                    certificates: parseCertificates(row),
                    about: row.about ? row.about.trim() : "",

                    verificationStatus: "PENDING",
                    verificationRemarks: row.verificationRemarks || "Synthetic demo record; verify before use.",
                    profileCompleteness: Number(row.profileCompleteness) || 75,

                    isPlaced: false,
                    isProfileLocked: String(row.isProfileLocked).toUpperCase() === "TRUE"
                });
            } catch (profileErr) {
                // Rollback user account if profile creation failed
                await User.findByIdAndDelete(user._id);
                throw profileErr;
            }

            summary.created++;
            summary.createdRecords.push({
                userId: user._id.toString(),
                profileId: studentProfile._id.toString(),
                usn,
                collegeEmail,
                department: program.name
            });

            if (summary.created % 20 === 0 || summary.created === targetRecords.length) {
                console.log(`[CREATED ${summary.created}/${targetRecords.length}] Record #${recordIndex}: ${usn} | ${studentName} (${collegeEmail})`);
            }
        } catch (err) {
            summary.failed++;
            summary.errors.push({
                row: recordIndex,
                usn,
                email: collegeEmail,
                message: err.message
            });
            console.error(`[ERROR Record #${recordIndex}] ${usn || "N/A"}: ${err.message}`);
        }
    }

    console.log(`\n======================================================`);
    console.log(`Execution Summary:`);
    console.log(`- Target Batch Count:    ${summary.totalRead}`);
    console.log(`- Successfully Created: ${summary.created}`);
    console.log(`- Skipped (Duplicates): ${summary.skippedDuplicate}`);
    console.log(`- Failed (Errors):      ${summary.failed}`);
    console.log(`======================================================\n`);

    return summary;
}

// Direct CLI Invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const isDryRun = process.argv.includes("--dry-run");
    const offsetArg = process.argv.find((a) => a.startsWith("--offset="));
    const limitArg = process.argv.find((a) => a.startsWith("--limit="));
    const csvArg = process.argv.find((a) => a.startsWith("--csv="));

    const offset = offsetArg ? parseInt(offsetArg.split("=")[1], 10) : 0;
    const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 160;
    const defaultCsv = path.resolve(__dirname, "../../campusflow_ug_students_2023_2027_sem7_160.csv");
    const csvFilePath = csvArg ? path.resolve(csvArg.split("=")[1]) : defaultCsv;

    runBulkImport({ csvFilePath, dryRun: isDryRun, offset, limit })
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("Bulk import failed:", err);
            process.exit(1);
        });
}
