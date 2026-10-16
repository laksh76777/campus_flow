import assert from "assert";

const BASE_URL = "http://localhost:8000";

let adminToken = "";
let student1Token = "";
let student2Token = "";
let student1ProfileId = "";
let student2ProfileId = "";
let student1UserId = "";
let companyId = "";
let placementSessionId = "";
let testDriveId = "";
let strictDriveId = "";

const uniqueId = Date.now().toString().slice(-6);

async function run() {
    console.log("==========================================================================");
    console.log("   CAMPUSFLOW V2 - PROFILE, REQUIREMENTS & COMPANY EXPORT VERIFICATION    ");
    console.log(`   Target: ${BASE_URL}`);
    console.log("==========================================================================\n");

    let passedTests = 0;
    let failedTests = 0;

    const test = (description, fn) => {
        try {
            fn();
            console.log(`  [PASS] ${description}`);
            passedTests++;
        } catch (err) {
            console.error(`  [FAIL] ${description} - ${err.message}`);
            failedTests++;
        }
    };

    console.log("[Setup] Registering Admin, Company, Placement Session, and 2 Students");

    // 1. Admin registration & login
    const adminEmail = `admin_prf_${uniqueId}@campus.edu`;
    await fetch(`${BASE_URL}/api/v1/admin/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "TPO Officer",
            email: adminEmail,
            password: "AdminPassword@123",
            employeeId: `EMP_PRF_${uniqueId}`,
            designation: "TPO Director",
            adminSecretKey: "TPO_ADMIN_2026"
        })
    });

    const adminLoginRes = await fetch(`${BASE_URL}/api/v1/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: "AdminPassword@123" })
    });
    const adminLoginData = await adminLoginRes.json();
    adminToken = adminLoginData.data?.accessToken;

    test("Admin login succeeds and returns JWT", () => {
        assert.ok(adminToken, "Admin access token should exist");
    });

    // 2. Active Session 2027
    const sessionRes = await fetch(`${BASE_URL}/api/v1/sessions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            sessionYear: 2027,
            name: "Placement Session 2026-2027",
            academicYear: "2026-2027",
            status: "ACTIVE"
        })
    });
    const sessionData = await sessionRes.json();
    placementSessionId = sessionData.data?._id;

    if (!placementSessionId) {
        const getSessionsRes = await fetch(`${BASE_URL}/api/v1/sessions`);
        const sessionsData = await getSessionsRes.json();
        const session2027 = sessionsData.data?.find((s) => s.sessionYear === 2027);
        placementSessionId = session2027?._id;
    }

    if (!placementSessionId) {
        throw new Error("Unable to create or resolve the placement session for graduation year 2027");
    }

    const activateSessionRes = await fetch(`${BASE_URL}/api/v1/sessions/${placementSessionId}/activate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!activateSessionRes.ok) {
        throw new Error(`Unable to activate the 2027 placement session (HTTP ${activateSessionRes.status})`);
    }

    test("Placement Session resolved", () => {
        assert.ok(placementSessionId, "Placement session must exist");
    });

    // 3. Register Company
    const compRes = await fetch(`${BASE_URL}/api/v1/company/create-company`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            companyName: `GlobalTech_${uniqueId}`,
            companyDescription: "Cloud Solutions Enterprise",
            companyWebsite: "https://globaltech.corp",
            industry: "Technology",
            location: "Bengaluru",
            contactEmail: `hr_${uniqueId}@globaltech.corp`,
            contactPhone: "9876543210"
        })
    });
    const compData = await compRes.json();
    companyId = compData.data?._id;

    test("Partner Company registered", () => {
        assert.ok(companyId, "Company ID must exist");
    });

    // 4. Register Student 1
    const s1Email = `student1_${uniqueId}@campus.edu`;
    const s1USN = `1MS23CS${uniqueId.slice(-3)}`;
    const s1RegRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "Aarav Gupta",
            email: s1Email,
            password: "StudentPassword@123",
            confirmPassword: "StudentPassword@123",
            usn: s1USN,
            department: "Computer Science and Engineering",
            course: "B.Tech",
            admissionYear: 2023,
            graduationYear: 2027,
            placementSession: placementSessionId,
            currentSemester: 6
        })
    });
    const s1RegData = await s1RegRes.json();
    student1Token = s1RegData.data?.accessToken || "";
    student1ProfileId = s1RegData.data?.studentProfile?._id || "";
    student1UserId = s1RegData.data?.user?._id || "";

    test("Student 1 registered and profile linked", () => {
        assert.equal(s1RegRes.status, 201);
        assert.ok(student1Token, "Student 1 token should exist");
        assert.ok(student1ProfileId, "Student 1 profile ID should exist");
    });
    if (!student1Token || !student1ProfileId) {
        throw new Error(`Student 1 registration failed (HTTP ${s1RegRes.status}): ${s1RegData.message || "missing account data"}`);
    }

    // 5. Register Student 2
    const s2Email = `student2_${uniqueId}@campus.edu`;
    const s2USN = `1MS23EC${uniqueId.slice(-3)}`;
    const s2RegRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "Rohan Varma",
            email: s2Email,
            password: "StudentPassword@123",
            confirmPassword: "StudentPassword@123",
            usn: s2USN,
            department: "Electronics and Communication Engineering",
            course: "B.Tech",
            admissionYear: 2023,
            graduationYear: 2027,
            placementSession: placementSessionId,
            currentSemester: 6
        })
    });
    const s2RegData = await s2RegRes.json();
    student2Token = s2RegData.data?.accessToken || "";
    student2ProfileId = s2RegData.data?.studentProfile?._id || "";

    test("Student 2 registered and profile linked", () => {
        assert.equal(s2RegRes.status, 201);
        assert.ok(student2Token, "Student 2 token should exist");
    });
    if (!student2Token || !student2ProfileId) {
        throw new Error(`Student 2 registration failed (HTTP ${s2RegRes.status}): ${s2RegData.message || "missing account data"}`);
    }

    console.log("\n[Test Group 1] Structured Academic Profile, Independent SGPA & Overall CGPA");

    // Test saving overall CGPA independently without averaging from SGPA
    const updateRes1 = await fetch(`${BASE_URL}/api/v1/studentprofile/update-profile`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${student1Token}`
        },
        body: JSON.stringify({
            cgpa: 8.75, // Official CGPA from transcript
            tenthDetails: {
                schoolName: "St. Joseph's Boys High School",
                board: "ICSE",
                state: "Karnataka",
                passingYear: 2021,
                percentage: 92.4,
                marksObtained: 554,
                maxMarks: 600
            },
            twelfthOrDiplomaDetails: {
                qualificationType: "12th",
                institutionName: "National Pre-University College",
                boardOrUniversity: "State Board",
                state: "Karnataka",
                passingYear: 2023,
                percentage: 89.5,
                marksObtained: 537,
                maxMarks: 600
            },
            resume: {
                url: "https://cloudinary.com/campusflow/resumes/aarav_gupta_v2.pdf",
                publicId: "aarav_gupta_v2"
            }
        })
    });
    const updateData1 = await updateRes1.json();

    test("Profile saved with official CGPA and 10th/12th details (HTTP 200)", () => {
        assert.equal(updateRes1.status, 200);
        assert.equal(updateData1.data?.cgpa, 8.75);
        assert.equal(updateData1.data?.tenthDetails?.percentage, 92.4);
        assert.equal(updateData1.data?.twelfthOrDiplomaDetails?.percentage, 89.5);
    });

    // Add individual semester SGPA results
    const sem1Res = await fetch(`${BASE_URL}/api/v1/studentprofile/semester-result`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${student1Token}`
        },
        body: JSON.stringify({ semester: 1, sgpa: 8.2 })
    });
    test("Semester 1 SGPA saved independently", () => {
        assert.equal(sem1Res.status, 200);
    });

    const sem2Res = await fetch(`${BASE_URL}/api/v1/studentprofile/semester-result`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${student1Token}`
        },
        body: JSON.stringify({ semester: 2, sgpa: 8.5 })
    });
    test("Semester 2 SGPA saved independently", () => {
        assert.equal(sem2Res.status, 200);
    });

    // Verify official CGPA was NOT overwritten or averaged into SGPA
    const profCheckRes = await fetch(`${BASE_URL}/api/v1/studentprofile/current-student-profile`, {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    const profCheckData = await profCheckRes.json();

    test("Overall CGPA is preserved as 8.75 and NOT averaged from SGPAs (8.2 & 8.5)", () => {
        assert.equal(profCheckData.data?.cgpa, 8.75);
        assert.equal(profCheckData.data?.semesterResults?.length, 2);
    });

    console.log("\n[Test Group 2] Education Gaps, Family Details & Address Management");

    const updateRes2 = await fetch(`${BASE_URL}/api/v1/studentprofile/update-profile`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${student1Token}`
        },
        body: JSON.stringify({
            hasEducationGap: true,
            educationGaps: [
                {
                    hasGap: true,
                    gapType: "12th_to_College",
                    startYear: 2021,
                    endYear: 2022,
                    durationMonths: 12,
                    reason: "Entrance examination preparation",
                    explanation: "Prepared for JEE Advanced and State CET entrance exams"
                }
            ],
            family: {
                fatherName: "Sanjay Gupta",
                fatherOccupation: "Chief Engineer",
                fatherEmployer: "Bharat Electronics Limited",
                fatherPhone: "9845012345",
                motherName: "Sunita Gupta",
                motherOccupation: "Senior High School Teacher",
                guardianPhone: "9845012345"
            },
            currentAddress: {
                street: "Flat 402, Green Glen Apartments, Outer Ring Road",
                locality: "Bellandur",
                city: "Bengaluru",
                district: "Bengaluru Urban",
                state: "Karnataka",
                pincode: "560103"
            },
            sameAsCurrent: true
        })
    });
    const updateData2 = await updateRes2.json();

    test("Education gap, confidential family details, and address saved (HTTP 200)", () => {
        assert.equal(updateRes2.status, 200);
        assert.equal(updateData2.data?.hasEducationGap, true);
        assert.equal(updateData2.data?.educationGaps?.length, 1);
        assert.equal(updateData2.data?.educationGaps[0].reason, "Entrance examination preparation");
        assert.equal(updateData2.data?.family?.fatherName, "Sanjay Gupta");
        assert.equal(updateData2.data?.currentAddress?.city, "Bengaluru");
        assert.equal(updateData2.data?.sameAsCurrent, true);
    });

    console.log("\n[Test Group 3] Authorization Boundaries & Session Immutability");

    // Student cannot modify placementSession
    const rogueSessionUpdate = await fetch(`${BASE_URL}/api/v1/studentprofile/update-profile`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${student1Token}`
        },
        body: JSON.stringify({
            placementSession: "670da414b537f2a890123999" // arbitrary session ID
        })
    });
    const rogueSessionData = await rogueSessionUpdate.json();

    test("Student cannot alter assigned placementSession without TPO authorization", () => {
        assert.equal(rogueSessionUpdate.status, 200);
        // placementSession should still be original placementSessionId
        assert.equal(
            rogueSessionData.data?.placementSession?._id?.toString() || rogueSessionData.data?.placementSession?.toString(),
            placementSessionId
        );
    });

    // Student 2 cannot update Student 1's profile by injecting userId
    const unauthorizedUpdate = await fetch(`${BASE_URL}/api/v1/studentprofile/update-profile`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${student2Token}`
        },
        body: JSON.stringify({
            userId: student1UserId,
            cgpa: 3.0 // Attempting to tamper with Student 1's CGPA
        })
    });
    const unauthorizedData = await unauthorizedUpdate.json();

    test("Student cannot tamper with another student's profile via userId payload", () => {
        assert.equal(unauthorizedUpdate.status, 200);
        // The update must have applied to Student 2, not Student 1
        assert.equal(unauthorizedData.data?.user?._id?.toString(), s2RegData.data.user._id);
    });

    console.log("\n[Test Group 4] Drive Student Information Requirements & Pre-Application Checklist");

    // Fetch default catalogue
    const catalogueRes = await fetch(`${BASE_URL}/api/v1/placementdrive/field-catalogue`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const catalogueData = await catalogueRes.json();

    test("GET /field-catalogue returns controlled student requirements catalogue", () => {
        assert.equal(catalogueRes.status, 200);
        assert.ok(Array.isArray(catalogueData.data), "Catalogue must be an array");
        assert.ok(catalogueData.data.some((f) => f.fieldKey === "fullName"));
        assert.ok(catalogueData.data.some((f) => f.fieldKey === "resume"));
        assert.ok(catalogueData.data.some((f) => f.fieldKey === "familyDetails"));
    });

    // Create a strict placement drive requiring mandatory Class 10 Passing Year & 12th details
    const now = Date.now();
    const createDriveRes = await fetch(`${BASE_URL}/api/v1/placementdrive/create-placement-drive`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            company: companyId,
            jobTitle: "Senior Systems Engineer",
            jobType: "full-time",
            package: 16.5,
            eligibleBranches: ["Computer Science and Engineering", "CSE"],
            minimumCGPA: 8.0,
            graduationYear: 2027,
            placementSession: placementSessionId,
            applicationStartDate: new Date(now).toISOString(),
            applicationDeadline: new Date(now + 10 * 86400000).toISOString(),
            driveDate: new Date(now + 20 * 86400000).toISOString(),
            studentRequirements: [
                { fieldKey: "fullName", label: "Student Full Name", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
                { fieldKey: "usn", label: "USN", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
                { fieldKey: "email", label: "Institutional Email", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
                { fieldKey: "branch", label: "Department / Branch", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
                { fieldKey: "cgpa", label: "Overall CGPA", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
                { fieldKey: "tenthPercentage", label: "Class 10 Percentage", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
                { fieldKey: "tenthPassingYear", label: "Class 10 Passing Year", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
                { fieldKey: "twelfthOrDiploma", label: "Class 12 Percentage", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
                { fieldKey: "resume", label: "Master Resume Document", category: "documents", requiredToApply: true, visibleToTpo: true, shareWithCompany: true }
            ]
        })
    });
    const createDriveData = await createDriveRes.json();
    strictDriveId = createDriveData.data?._id;

    test("TPO creates placement drive with configured student information requirements (HTTP 201)", () => {
        assert.equal(createDriveRes.status, 201);
        assert.ok(strictDriveId, "Drive ID must exist");
        assert.equal(createDriveData.data?.studentRequirements?.length, 9);
    });

    // Check pre-application checklist for Student 1 (all satisfied)
    const precheckRes1 = await fetch(`${BASE_URL}/api/v1/application/${strictDriveId}/precheck`, {
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    const precheckData1 = await precheckRes1.json();

    test("Pre-check endpoint returns 200 with canApply: true for complete profile", () => {
        assert.equal(precheckRes1.status, 200);
        assert.equal(precheckData1.data?.canApply, true);
        assert.equal(precheckData1.data?.missingRequiredFields?.length, 0);
    });

    // Check pre-application checklist for Student 2 (missing CGPA, 10th, 12th, resume)
    const precheckRes2 = await fetch(`${BASE_URL}/api/v1/application/${strictDriveId}/precheck`, {
        headers: { Authorization: `Bearer ${student2Token}` }
    });
    const precheckData2 = await precheckRes2.json();

    test("Pre-check endpoint returns canApply: false and lists missing requirements for Student 2", () => {
        assert.equal(precheckRes2.status, 200);
        assert.equal(precheckData2.data?.canApply, false);
        assert.ok(precheckData2.data?.missingRequiredFields?.length > 0);
    });

    // Student 2 attempts to apply without completing requirements -> BLOCKED (HTTP 403)
    const applyBlockRes = await fetch(`${BASE_URL}/api/v1/application/${strictDriveId}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${student2Token}` }
    });
    const applyBlockData = await applyBlockRes.json();

    test("Application submission rejected when required drive fields are missing (HTTP 403)", () => {
        assert.equal(applyBlockRes.status, 403);
        assert.ok(applyBlockData.message.includes("missing"), "Rejection must cite missing information");
    });

    console.log("\n[Test Group 5] Immutable Submission Snapshot & Profile Changes Preservation");

    // Student 1 applies with CGPA 8.75 and resume v2
    const applyRes = await fetch(`${BASE_URL}/api/v1/application/${strictDriveId}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${student1Token}` }
    });
    const applyData = await applyRes.json();
    const createdAppId = applyData.data?._id;

    test("Eligible student applies successfully with immutable snapshot preserved (HTTP 201)", () => {
        assert.equal(applyRes.status, 201);
        assert.ok(createdAppId, "Application ID must exist");
        assert.ok(applyData.data?.submittedSnapshot, "submittedSnapshot must be attached");
        assert.equal(applyData.data?.submittedSnapshot?.cgpa, 8.75);
        assert.equal(applyData.data?.submittedSnapshot?.fullName, "Aarav Gupta");
    });

    // Student 1 subsequently modifies profile (changes CGPA to 9.20 and resume to v3)
    await fetch(`${BASE_URL}/api/v1/studentprofile/update-profile`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${student1Token}`
        },
        body: JSON.stringify({
            cgpa: 9.20,
            resume: {
                url: "https://cloudinary.com/campusflow/resumes/aarav_gupta_v3_updated.pdf",
                publicId: "aarav_gupta_v3"
            }
        })
    });

    // Inspect the existing submitted application
    const appDetailRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const appDetailData = await appDetailRes.json();

    test("Application submittedSnapshot retains original submitted CGPA (8.75) after profile edit", () => {
        assert.equal(appDetailRes.status, 200);
        assert.equal(appDetailData.data?.submittedSnapshot?.cgpa, 8.75);
        assert.equal(
            appDetailData.data?.submittedSnapshot?.resume?.url,
            "https://cloudinary.com/campusflow/resumes/aarav_gupta_v2.pdf"
        );
    });

    console.log("\n[Test Group 6] Company Candidate Export & Compliance Audit Log");

    // TPO exports candidates for the drive in CSV format
    const exportRes = await fetch(`${BASE_URL}/api/v1/application/${strictDriveId}/export`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            status: "all",
            format: "csv",
            includeSensitiveFamily: false
        })
    });
    const exportArrayBuffer = await exportRes.arrayBuffer();
    const exportBuffer = Buffer.from(exportArrayBuffer);
    const hasBom = exportBuffer[0] === 0xEF && exportBuffer[1] === 0xBB && exportBuffer[2] === 0xBF;
    const exportText = exportBuffer.toString("utf-8");

    test("POST /export returns 200 with text/csv attachment header", () => {
        assert.equal(exportRes.status, 200);
        assert.ok(exportRes.headers.get("content-type")?.includes("text/csv"));
        assert.ok(exportRes.headers.get("content-disposition")?.includes("attachment"));
    });

    test("Exported CSV includes UTF-8 BOM and candidate snapshot row", () => {
        assert.ok(hasBom || exportText.startsWith("\uFEFF"), "CSV must include UTF-8 BOM for Microsoft Excel compatibility");
        assert.ok(exportText.includes("Aarav Gupta"), "Candidate name from snapshot must appear");
        assert.ok(exportText.includes(s1USN), "Candidate USN from snapshot must appear");
        assert.ok(exportText.includes("8.75"), "Candidate submitted CGPA (8.75) must appear");
    });

    test("Exported CSV excludes sensitive family details by default", () => {
        // Father name "Sanjay Gupta" must NOT be in the export
        assert.ok(!exportText.includes("Sanjay Gupta"), "Father name must be excluded from default company export");
    });

    console.log("\n==========================================================================");
    console.log(`   TESTS COMPLETED: Passed: ${passedTests} | Failed: ${failedTests}`);
    console.log("==========================================================================\n");

    if (failedTests > 0) {
        process.exit(1);
    }
}

run().catch((err) => {
    console.error("Fatal Test Suite Error:", err);
    process.exit(1);
});
