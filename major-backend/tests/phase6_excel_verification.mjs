import mongoose from "mongoose";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import { User } from "../src/models/user.models.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { PlacementSession } from "../src/models/placementSession.model.js";
import { Department } from "../src/models/department.model.js";
import { Company } from "../src/models/company.model.js";
import { PlacementDrive } from "../src/models/placementDrive.model.js";
import { Application } from "../src/models/application.model.js";
import { ImportBatch } from "../src/models/importBatch.model.js";
import {
    sanitizeFormula,
    generateImportTemplate,
    previewImport,
    commitImportBatch,
    generateEligibleStudentsExport,
    generateSessionReportExport,
    generateErrorReportExport,
    generateDriveApplicantsExport,
    generateDepartmentReportExport,
    generateHistoricalPlacementSummaryExport
} from "../src/services/excelImportExport.service.js";
import { resolveMongoConnection } from "../src/db/index.js";

dotenv.config({ path: "./.env" });

const runPhase6Verification = async () => {
    console.log("================================================================================");
    console.log("   CAMPUSFLOW V2 PHASE 6: EXCEL IMPORT, MIGRATION & EXPORTS TEST SUITE         ");
    console.log("================================================================================");

    const baseUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
    const { connectionUri, databaseName } = resolveMongoConnection(baseUri);
    const isolatedDb = process.env.TEST_DATABASE_NAME || (databaseName === "Place-on" ? `Place-on_e2e_phase6_${Date.now()}` : databaseName);
    const parsed = new URL(connectionUri);
    parsed.pathname = `/${isolatedDb}`;
    await mongoose.connect(parsed.toString());
    console.log(` connected to isolated test database: ${parsed.host}/${isolatedDb}\n`);

    const stats = { passed: 0, failed: 0 };
    const assert = (condition, message) => {
        if (condition) {
            console.log(` [PASS] ${message}`);
            stats.passed++;
        } else {
            console.error(`❌ [FAIL] ${message}`);
            stats.failed++;
        }
    };

    try {
        // -------------------------------------------------------------------------
        // 1. Formula Injection Sanitization
        // -------------------------------------------------------------------------
        console.log(">>> TEST 1: Spreadsheet Formula Injection Sanitization");
        assert(sanitizeFormula("=1+1") === "'=1+1", "Sanitizes leading '=' character");
        assert(sanitizeFormula("+cmd|' /C calc'!A0") === "'+cmd|' /C calc'!A0", "Sanitizes leading '+' character");
        assert(sanitizeFormula("-2+5") === "'-2+5", "Sanitizes leading '-' character");
        assert(sanitizeFormula("@SUM(1,2)") === "'@SUM(1,2)", "Sanitizes leading '@' character");
        assert(sanitizeFormula("Normal Student") === "Normal Student", "Leaves normal strings unaltered");
        assert(sanitizeFormula(null) === "", "Handles null gracefully");

        // -------------------------------------------------------------------------
        // 2. Downloadable Excel Templates
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 2: Template Generation for All 3 Import Types");
        const studentTpl = await generateImportTemplate("student_records");
        assert(studentTpl.worksheets.length === 2, "Student records template contains 2 worksheets (Data + Instructions)");
        assert(studentTpl.getWorksheet("Student Records") !== undefined, "Contains 'Student Records' sheet");
        assert(studentTpl.getWorksheet("Instructions & Guide") !== undefined, "Contains 'Instructions & Guide' sheet");

        const academicTpl = await generateImportTemplate("academic_history");
        assert(academicTpl.worksheets.length === 2, "Academic history template contains 2 worksheets");
        assert(academicTpl.getWorksheet("Academic History") !== undefined, "Contains 'Academic History' sheet");

        const historicalTpl = await generateImportTemplate("historical_placements");
        assert(historicalTpl.worksheets.length === 2, "Historical placements template contains 2 worksheets");
        assert(historicalTpl.getWorksheet("Historical Placements") !== undefined, "Contains 'Historical Placements' sheet");

        // -------------------------------------------------------------------------
        // Setup Test Placement Session & Admin User
        // -------------------------------------------------------------------------
        console.log("\n>>> Setting up Test Fixtures (Session, Admin User, Departments)...");
        let session = await PlacementSession.findOne({ sessionYear: 2026 });
        if (!session) {
            session = await PlacementSession.create({
                name: "Batch of 2026",
                academicYear: "2025-2026",
                sessionYear: 2026,
                courseDurations: [{ courseName: "B.Tech", durationYears: 4 }],
                status: "ACTIVE"
            });
        }

        let adminUser = await User.findOne({ role: "admin" });
        if (!adminUser) {
            adminUser = await User.create({
                fullName: "TPO Lead",
                email: "tpo_p6_test@college.edu",
                password: "Password@123",
                role: "admin",
                isEmailVerified: true
            });
        }

        // -------------------------------------------------------------------------
        // 3. Student Records Excel Import (Preview & Commit)
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 3: Student Records Import (Preview & Atomic Commit)");

        // Build mock student workbook in memory
        const studentWb = new ExcelJS.Workbook();
        const sSheet = studentWb.addWorksheet("Students");
        sSheet.columns = [
            { header: "USN *", key: "usn" },
            { header: "Full Name *", key: "fullName" },
            { header: "College Email *", key: "email" },
            { header: "Phone Number", key: "phone" },
            { header: "Course *", key: "course" },
            { header: "Department *", key: "department" },
            { header: "Admission Year *", key: "admissionYear" },
            { header: "Graduation Year *", key: "graduationYear" },
            { header: "Current Semester", key: "semester" },
            { header: "Gender", key: "gender" }
        ];

        const testUsn1 = "1MS26CS901";
        const testUsn2 = "1MS26EC902";
        const testEmail1 = "p6_student1@college.edu";
        const testEmail2 = "p6_student2@college.edu";

        // Clean up previous test runs if any
        await User.deleteMany({ email: { $in: [testEmail1, testEmail2, "p6_dup@college.edu"] } });
        await StudentProfile.deleteMany({ enrollmentNumber: { $in: [testUsn1, testUsn2] } });

        sSheet.addRow({
            usn: testUsn1,
            fullName: "Aarav Sharma",
            email: testEmail1,
            phone: "9876543210",
            course: "B.Tech",
            department: "Computer Science and Engineering",
            admissionYear: 2022,
            graduationYear: 2026,
            semester: 7,
            gender: "Male"
        });

        sSheet.addRow({
            usn: testUsn2,
            fullName: "Diya Patel",
            email: testEmail2,
            phone: "9876543211",
            course: "B.Tech",
            department: "Electronics and Communication Engineering",
            admissionYear: 2022,
            graduationYear: 2026,
            semester: 7,
            gender: "Female"
        });

        // Add a duplicate row in the sheet to test intra-file duplicate detection
        sSheet.addRow({
            usn: testUsn1,
            fullName: "Aarav Duplicate",
            email: "p6_dup@college.edu",
            phone: "9876543212",
            course: "B.Tech",
            department: "Computer Science and Engineering",
            admissionYear: 2022,
            graduationYear: 2026,
            semester: 7,
            gender: "Male"
        });

        const studentBuf = await studentWb.xlsx.writeBuffer();
        const studentPreviewBatch = await previewImport({
            buffer: studentBuf,
            importType: "student_records",
            placementSessionId: session._id,
            conflictStrategy: "skip",
            filename: "Student_Batch_Test.xlsx",
            adminUser
        });

        assert(studentPreviewBatch.totalRows === 3, `Parsed 3 total rows in spreadsheet`);
        assert(studentPreviewBatch.validRows === 2, `Identified 2 valid rows`);
        assert(studentPreviewBatch.invalidRows === 1, `Identified 1 invalid/duplicate row`);
        assert(studentPreviewBatch.status === "PREVIEWED", `Batch status is PREVIEWED (requires confirmation before write)`);

        // Check duplicate error report
        const dupErr = studentPreviewBatch.errorReport.find((e) => e.identifier === testUsn1);
        assert(dupErr && dupErr.reason.includes("Duplicate USN"), "Intra-spreadsheet duplicate USN properly detected");

        // Now explicitly commit the batch
        const committedBatch = await commitImportBatch(studentPreviewBatch.batchId, adminUser);
        assert(committedBatch.status === "COMMITTED", `Committed batch successfully`);
        assert(committedBatch.insertedRows === 2, `Inserted 2 new student records`);

        // Verify database persistence
        const createdUser1 = await User.findOne({ email: testEmail1 });
        const createdProfile1 = await StudentProfile.findOne({ enrollmentNumber: testUsn1 });
        assert(createdUser1 !== null, "User account created in DB");
        assert(createdProfile1 !== null, "StudentProfile created in DB");
        assert(String(createdProfile1.placementSession) === String(session._id), "Student correctly assigned to target placement session");

        // -------------------------------------------------------------------------
        // 4. Academic History Import (Independent SGPA 1-8, 10th/12th, Backlogs, Gaps)
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 4: Academic History Import & Verification Protection");

        const academicWb = new ExcelJS.Workbook();
        const aSheet = academicWb.addWorksheet("Academics");
        aSheet.columns = [
            { header: "USN *", key: "usn" },
            { header: "Overall CGPA *", key: "cgpa" },
            { header: "SGPA Sem 1", key: "sgpa1" },
            { header: "SGPA Sem 2", key: "sgpa2" },
            { header: "SGPA Sem 3", key: "sgpa3" },
            { header: "SGPA Sem 4", key: "sgpa4" },
            { header: "SGPA Sem 5", key: "sgpa5" },
            { header: "SGPA Sem 6", key: "sgpa6" },
            { header: "Class 10 Board *", key: "tenthBoard" },
            { header: "Class 10 Institution", key: "tenthSchool" },
            { header: "Class 10 Passing Year", key: "tenthYear" },
            { header: "Class 10 % *", key: "tenthPct" },
            { header: "Class 12 Board", key: "twelfthBoard" },
            { header: "Class 12 Institution", key: "twelfthSchool" },
            { header: "Class 12 Passing Year", key: "twelfthYear" },
            { header: "Class 12 / Diploma % *", key: "twelfthPct" },
            { header: "Active Backlogs", key: "activeBacklogs" },
            { header: "Cleared Backlogs", key: "clearedBacklogs" },
            { header: "Education Gap (Years)", key: "gapYears" },
            { header: "Gap Reason", key: "gapReason" }
        ];

        // Valid academic row for Aarav (testUsn1)
        aSheet.addRow({
            usn: testUsn1,
            cgpa: 8.75,
            sgpa1: 8.5,
            sgpa2: 8.6,
            sgpa3: 8.8,
            sgpa4: 9.0,
            sgpa5: 8.9,
            sgpa6: 8.7,
            tenthBoard: "CBSE",
            tenthSchool: "Delhi Public School",
            tenthYear: 2020,
            tenthPct: 92.4,
            twelfthBoard: "CBSE",
            twelfthSchool: "Delhi Public School",
            twelfthYear: 2022,
            twelfthPct: 89.6,
            activeBacklogs: 0,
            clearedBacklogs: 1,
            gapYears: 0,
            gapReason: "No gap"
        });

        // Unknown USN row
        aSheet.addRow({
            usn: "UNKNOWN_USN_999",
            cgpa: 7.5,
            tenthBoard: "CBSE",
            tenthPct: 80.0,
            twelfthPct: 80.0
        });

        const academicBuf = await academicWb.xlsx.writeBuffer();
        const academicPreviewBatch = await previewImport({
            buffer: academicBuf,
            importType: "academic_history",
            placementSessionId: session._id,
            conflictStrategy: "skip",
            filename: "Academics_Batch_Test.xlsx",
            adminUser
        });

        assert(academicPreviewBatch.validRows === 1, "Academic preview: 1 valid row matched to existing student");
        assert(academicPreviewBatch.invalidRows === 1, "Academic preview: 1 invalid row for unknown USN");

        // Commit academic batch
        const committedAcad = await commitImportBatch(academicPreviewBatch.batchId, adminUser);
        assert(committedAcad.updatedRows === 1 || committedAcad.insertedRows === 1, "Academic batch committed successfully");

        // Verify updated student profile fields
        const updatedProfile = await StudentProfile.findOne({ enrollmentNumber: testUsn1 });
        assert(updatedProfile.cgpa === 8.75, "Overall CGPA updated correctly to 8.75");
        assert(updatedProfile.activeBacklogs === 0, "Active backlogs updated correctly");
        assert(updatedProfile.historicalBacklogs === 1, "Historical/cleared backlogs updated correctly");
        assert(updatedProfile.tenthDetails.percentage === 92.4, "Class 10 details updated");
        assert(updatedProfile.twelfthOrDiplomaDetails.percentage === 89.6, "Class 12 details updated");

        // Check semester SGPA preserves independent values without calculating CGPA
        const s1 = updatedProfile.semesterResults.find((r) => r.semester === 1);
        const s4 = updatedProfile.semesterResults.find((r) => r.semester === 4);
        assert(s1 && s1.sgpa === 8.5, "Independent SGPA Sem 1 preserved");
        assert(s4 && s4.sgpa === 9.0, "Independent SGPA Sem 4 preserved");

        // -------------------------------------------------------------------------
        // 5. Conflict Resolution: Protect Verified Records
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 5: Verified Student Profile Conflict Protection");

        // Mark student as VERIFIED by TPO
        updatedProfile.verificationStatus = "VERIFIED";
        await updatedProfile.save();

        // Attempt to import conflicting CGPA 6.00 for verified student
        const conflictWb = new ExcelJS.Workbook();
        const cSheet = conflictWb.addWorksheet("Academics");
        cSheet.columns = aSheet.columns;
        cSheet.addRow({
            usn: testUsn1,
            cgpa: 6.0,
            tenthBoard: "CBSE",
            tenthPct: 70.0,
            twelfthPct: 70.0
        });

        const conflictBuf = await conflictWb.xlsx.writeBuffer();
        const conflictPreview = await previewImport({
            buffer: conflictBuf,
            importType: "academic_history",
            placementSessionId: session._id,
            conflictStrategy: "skip",
            filename: "Conflict_Test.xlsx",
            adminUser
        });

        assert(conflictPreview.conflictRows === 1, "Conflict detected for TPO-verified record");
        assert(conflictPreview.previewResults[0].status === "CONFLICT", "Row marked with CONFLICT status");
        assert(conflictPreview.previewResults[0].proposedAction === "SKIP", "Default proposed action is SKIP");

        // Commit with skip strategy
        await commitImportBatch(conflictPreview.batchId, adminUser);
        const profileAfterSkip = await StudentProfile.findOne({ enrollmentNumber: testUsn1 });
        assert(profileAfterSkip.cgpa === 8.75, "Verified CGPA remained protected at 8.75 (NOT overwritten by 6.00)");

        // -------------------------------------------------------------------------
        // 6. Historical Placement Outcomes Import
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 6: Historical Placement Outcomes Import");

        const histWb = new ExcelJS.Workbook();
        const hSheet = histWb.addWorksheet("Placements");
        hSheet.columns = [
            { header: "USN *", key: "usn" },
            { header: "Company Name *", key: "company" },
            { header: "Job Title", key: "jobTitle" },
            { header: "Placement Session *", key: "session" },
            { header: "Offer CTC (LPA) *", key: "package" },
            { header: "Outcome Status *", key: "status" },
            { header: "Offer / Drive Date", key: "offerDate" },
            { header: "Interview Stage", key: "interviewRound" },
            { header: "Remarks", key: "remarks" }
        ];

        hSheet.addRow({
            usn: testUsn1,
            company: "Infosys Technologies",
            jobTitle: "Systems Engineer Specialist",
            session: "2026",
            package: 9.5,
            status: "offer_accepted",
            offerDate: "2025-11-10",
            interviewRound: "HR Final",
            remarks: "Offered on campus"
        });

        const histBuf = await histWb.xlsx.writeBuffer();
        const histPreview = await previewImport({
            buffer: histBuf,
            importType: "historical_placements",
            placementSessionId: session._id,
            conflictStrategy: "skip",
            filename: "Historical_Batch_Test.xlsx",
            adminUser
        });

        assert(histPreview.validRows === 1, "Historical placement row matched to validated student");
        const committedHist = await commitImportBatch(histPreview.batchId, adminUser);
        assert(committedHist.insertedRows === 1, "Historical placement committed");

        // Verify placement status updated on profile
        const placedProfile = await StudentProfile.findOne({ enrollmentNumber: testUsn1 });
        assert(placedProfile.isPlaced === true, "Student marked as placed in database");
        assert(placedProfile.placedCompany === "Infosys Technologies", "Student placedCompany updated");

        // Verify application record created
        const app = await Application.findOne({ student: placedProfile._id });
        assert(app !== null, "Application record created for historical placement");
        assert(app.status === "offer_accepted", "Application status set to offer_accepted");
        assert(app.offeredPackage === 9.5, "Application offered package set to 9.5 LPA");

        // -------------------------------------------------------------------------
        // 7. Reporting Exports (Eligible, Session, Department, Historical)
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 7: Reporting Exports Generation");

        // Create a mock placement drive
        let comp = await Company.findOne({ companyName: "Infosys Technologies" });
        if (!comp) {
            comp = await Company.create({
                companyName: "Infosys Technologies",
                website: "https://infosys.com",
                industry: "Information Technology"
            });
        }

        await StudentProfile.findOneAndUpdate(
            { enrollmentNumber: testUsn1 },
            { $set: { resume: { url: "https://campusflow.storage/resumes/aarav.pdf" }, branch: "Computer Science and Engineering" } }
        );

        const drive = await PlacementDrive.create({
            company: comp._id,
            jobTitle: "Software Developer",
            jobType: "full-time",
            package: 10,
            location: "Bangalore",
            eligibleBranches: ["Computer Science and Engineering", "Information Science and Engineering"],
            minimumCGPA: 7.0,
            maximumBacklogs: 0,
            graduationYear: 2026,
            placementSession: session._id,
            applicationStartDate: new Date(),
            applicationDeadline: new Date(Date.now() + 7 * 86400000),
            driveDate: new Date(Date.now() + 14 * 86400000),
            createdBy: adminUser._id
        });

        // 7a. Drive Eligible Students Export
        const eligibleWb = await generateEligibleStudentsExport(drive._id);
        const eligibleSheet = eligibleWb.getWorksheet("Eligible Candidates");
        assert(eligibleSheet !== undefined, "Eligible candidates export sheet generated");
        assert(eligibleSheet.rowCount >= 2, `Eligible sheet contains header and candidate row (rows: ${eligibleSheet.rowCount})`);

        // 7b. Session Cohort Report Export
        const sessionWb = await generateSessionReportExport(session._id);
        assert(sessionWb.getWorksheet("Cohort Summary") !== undefined, "Session export contains Cohort Summary sheet");
        assert(sessionWb.getWorksheet("Student Roster") !== undefined, "Session export contains Student Roster sheet");

        // 7c. Department Analytics Export
        const deptWb = await generateDepartmentReportExport({ sessionId: session._id });
        assert(deptWb.getWorksheet("Department Analytics") !== undefined, "Department analytics export generated");

        // 7d. Historical Placement Summary Export
        const histSummWb = await generateHistoricalPlacementSummaryExport({ sessionId: session._id });
        assert(histSummWb.getWorksheet("Historical Placement Outcomes") !== undefined, "Historical outcomes summary export generated");

        // 7e. Error Report Export
        const errWb = await generateErrorReportExport(studentPreviewBatch.batchId);
        assert(errWb.getWorksheet("Import Error Report") !== undefined, "Error report export generated with actionable reasons");

        // 7f. Company-Facing Applicant Export (Respecting Privacy)
        const companyRosterWb = await generateDriveApplicantsExport({
            driveId: drive._id,
            status: "all",
            isCompanyFacing: true
        });
        const companySheet = companyRosterWb.worksheets[0];
        assert(companySheet !== undefined, "Company-facing roster export generated");
        // Ensure sensitive fields (parent names, full private address) are excluded
        const headers = companySheet.getRow(1).values;
        assert(!headers.includes("Father's Name"), "Private parent info excluded from company-facing export");
        assert(!headers.includes("Residential Address"), "Private residential address excluded from company-facing export");

        // Clean up mock drive
        await PlacementDrive.findByIdAndDelete(drive._id);

        console.log("\n================================================================================");
        console.log(` PHASE 6 VERIFICATION COMPLETE: ${stats.passed} PASSED, ${stats.failed} FAILED `);
        console.log("================================================================================");

        await mongoose.disconnect();

        if (stats.failed === 0) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ Exception during Phase 6 verification:", error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    }
};

runPhase6Verification();
