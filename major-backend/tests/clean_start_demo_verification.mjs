import assert from "assert";

const BASE_URL = "http://localhost:8000";

async function run() {
    console.log("==========================================================================");
    console.log("   CAMPUSFLOW V2 - FRESH INITIALIZATION, DEMO & NEW STUDENT TEST SUITE   ");
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

    console.log("[Test Group 1] TPO Admin Authentication & Portal Inspection");

    // 1. Admin login with official credentials
    const adminLoginRes = await fetch(`${BASE_URL}/api/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "admin@campusflow.edu",
            password: "Admin@12345"
        })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data?.accessToken;

    test("TPO Admin logs in successfully with official credentials (HTTP 200)", () => {
        assert.equal(adminLoginRes.status, 200);
        assert.ok(adminToken, "Admin access token must be returned");
        assert.equal(adminLoginData.data?.user?.email, "admin@campusflow.edu");
        assert.equal(adminLoginData.data?.user?.role, "admin");
        assert.equal(adminLoginData.data?.admin?.designation, "Head of Training & Placement");
    });

    // 2. Admin retrieves Placement Sessions
    const sessionsRes = await fetch(`${BASE_URL}/api/v1/sessions`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const sessionsData = await sessionsRes.json();

    test("TPO retrieves Placement Sessions list with Active Session 2027", () => {
        assert.equal(sessionsRes.status, 200);
        assert.ok(Array.isArray(sessionsData.data), "Sessions must be an array");
        const active2027 = sessionsData.data.find((s) => s.sessionYear === 2027);
        assert.ok(active2027, "Session 2027 must exist");
        assert.equal(active2027.status, "ACTIVE");
    });

    // 3. Admin retrieves Departments
    const deptsRes = await fetch(`${BASE_URL}/api/v1/departments`);
    const deptsData = await deptsRes.json();

    test("Departments catalog is populated with 7 standard programs", () => {
        assert.equal(deptsRes.status, 200);
        assert.ok(deptsData.data?.length >= 7, "At least 7 departments must be active");
        assert.ok(deptsData.data.some((d) => d.code === "CSE"));
    });

    // 4. Admin inspects placement drives
    const drivesRes = await fetch(`${BASE_URL}/api/v1/placementdrive/all-drives`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const drivesData = await drivesRes.json();
    const testDrive = drivesData.data?.[0];

    test("Active placement drive is configured with student requirements", () => {
        assert.equal(drivesRes.status, 200);
        assert.ok(testDrive, "At least 1 placement drive should exist");
        assert.ok(testDrive.studentRequirements?.length > 0, "Drive must have student requirements");
    });

    console.log("\n[Test Group 2] Official Demo Student Authentication & Complete Profile Verification");

    // 5. Demo Student logs in via Email
    const studentLoginRes = await fetch(`${BASE_URL}/api/v1/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "student@campusflow.edu",
            password: "Student@12345"
        })
    });
    const studentLoginData = await studentLoginRes.json();
    const demoStudentToken = studentLoginData.data?.accessToken;

    test("Demo student logs in successfully via email (HTTP 200)", () => {
        assert.equal(studentLoginRes.status, 200);
        assert.ok(demoStudentToken, "Student access token must be returned");
        assert.equal(studentLoginData.data?.user?.email, "student@campusflow.edu");
        assert.equal(studentLoginData.data?.user?.role, "student");
    });

    // 6. Demo Student logs in via Roll Number / USN
    const usnLoginRes = await fetch(`${BASE_URL}/api/v1/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            rollNumber: "1MS23CS001",
            password: "Student@12345"
        })
    });
    const usnLoginData = await usnLoginRes.json();

    test("Demo student logs in successfully via USN (1MS23CS001)", () => {
        assert.equal(usnLoginRes.status, 200);
        assert.ok(usnLoginData.data?.accessToken, "USN login returns JWT");
        assert.equal(usnLoginData.data?.user?.email, "student@campusflow.edu");
    });

    // 7. Demo student checks profile
    const demoProfileRes = await fetch(`${BASE_URL}/api/v1/studentprofile/current-student-profile`, {
        headers: { Authorization: `Bearer ${demoStudentToken}` }
    });
    const demoProfileData = await demoProfileRes.json();

    test("Demo student profile contains valid academic, address, and gap data", () => {
        assert.equal(demoProfileRes.status, 200);
        const profile = demoProfileData.data;
        assert.equal(profile.enrollmentNumber, "1MS23CS001");
        assert.equal(profile.cgpa, 8.75);
        assert.equal(profile.activeBacklogs, 0);
        assert.equal(profile.semesterResults?.length, 4);
        assert.equal(profile.hasEducationGap, false);
        assert.equal(profile.tenthDetails?.percentage, 92.4);
        assert.equal(profile.twelfthOrDiplomaDetails?.percentage, 89.2);
    });

    // 8. Demo student prechecks eligibility for active drive
    const precheckRes = await fetch(`${BASE_URL}/api/v1/application/${testDrive._id}/precheck`, {
        headers: { Authorization: `Bearer ${demoStudentToken}` }
    });
    const precheckData = await precheckRes.json();

    test("Demo student satisfies all pre-application checklist requirements (canApply: true)", () => {
        assert.equal(precheckRes.status, 200);
        assert.equal(precheckData.data?.canApply, true);
        assert.equal(precheckData.data?.missingRequiredFields?.length, 0);
    });

    // 9. Demo student applies for the drive
    const applyRes = await fetch(`${BASE_URL}/api/v1/application/${testDrive._id}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${demoStudentToken}` }
    });
    const applyData = await applyRes.json();

    test("Demo student submits application successfully with immutable snapshot (HTTP 201)", () => {
        assert.equal(applyRes.status, 201);
        assert.equal(applyData.data?.status, "applied");
        assert.equal(applyData.data?.submittedSnapshot?.cgpa, 8.75);
        assert.equal(applyData.data?.submittedSnapshot?.usn, "1MS23CS001");
    });

    console.log("\n[Test Group 3] Brand New Student Flow: Zero Data Start, Creation & Self-Update");

    const uniqueNum = Date.now().toString().slice(-4);
    const newStudentEmail = `neha_${uniqueNum}@campusflow.edu`;
    const newStudentUSN = `1MS23CS${uniqueNum}`;

    // 10. Register a brand new student
    const newStudentRegRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "Neha Kulkarni",
            email: newStudentEmail,
            password: "StudentPassword@123",
            confirmPassword: "StudentPassword@123",
            usn: newStudentUSN,
            department: "Computer Science and Engineering",
            course: "B.Tech",
            admissionYear: 2023,
            graduationYear: 2027,
            currentSemester: 1
        })
    });
    const newStudentRegData = await newStudentRegRes.json();
    const newStudentToken = newStudentRegData.data?.accessToken;

    test("New student registers from scratch and is assigned to Session 2027 (HTTP 201)", () => {
        assert.equal(newStudentRegRes.status, 201);
        assert.ok(newStudentToken, "New student token created");
        assert.equal(newStudentRegData.data?.studentProfile?.enrollmentNumber, newStudentUSN);
    });

    // 11. Verify new student profile starts with zero/fresh data
    const newProfileRes = await fetch(`${BASE_URL}/api/v1/studentprofile/current-student-profile`, {
        headers: { Authorization: `Bearer ${newStudentToken}` }
    });
    const newProfileData = await newProfileRes.json();

    test("New student starts with fresh profile and zero/empty academic data", () => {
        assert.equal(newProfileRes.status, 200);
        const profile = newProfileData.data;
        // Academic fields are fresh/unentered (null/undefined, never fabricated)
        assert.ok(!profile.cgpa || profile.cgpa === null, "Fresh profile must not have fabricated CGPA");
        assert.equal(profile.semesterResults?.length, 0);
        assert.equal(profile.hasEducationGap, false);
        assert.ok(!profile.resume?.url, "Fresh profile must not have a resume uploaded yet");
    });

    // 12. New student completes their academic profile
    const updateProfileRes = await fetch(`${BASE_URL}/api/v1/studentprofile/update-profile`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newStudentToken}`
        },
        body: JSON.stringify({
            cgpa: 8.92,
            activeBacklogs: 0,
            historicalBacklogs: 0,
            tenthPercentage: 94.0,
            twelfthPercentage: 91.5,
            tenthDetails: {
                board: "CBSE",
                schoolName: "National Public School",
                percentage: 94.0,
                passingYear: 2021
            },
            twelfthOrDiplomaDetails: {
                qualificationType: "12th",
                instituteName: "National Public School",
                board: "CBSE",
                percentage: 91.5,
                passingYear: 2023
            },
            semesterResults: [
                { semester: 1, sgpa: 8.8, status: "PASS" },
                { semester: 2, sgpa: 9.0, status: "PASS" }
            ],
            resume: {
                url: "https://campusflow.edu/resumes/neha_kulkarni.pdf",
                publicId: "resume_neha"
            }
        })
    });
    const updateProfileData = await updateProfileRes.json();

    test("New student saves and updates their academic records in MongoDB (HTTP 200)", () => {
        assert.equal(updateProfileRes.status, 200);
        assert.equal(updateProfileData.data?.cgpa, 8.92);
        assert.equal(updateProfileData.data?.tenthPercentage, 94.0);
        assert.equal(updateProfileData.data?.semesterResults?.length, 2);
    });

    // 13. New student now applies for the active placement drive
    const newStudentApplyRes = await fetch(`${BASE_URL}/api/v1/application/${testDrive._id}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${newStudentToken}` }
    });
    const newStudentApplyData = await newStudentApplyRes.json();

    test("New student successfully submits application after completing profile (HTTP 201)", () => {
        assert.equal(newStudentApplyRes.status, 201);
        assert.equal(newStudentApplyData.data?.status, "applied");
        assert.equal(newStudentApplyData.data?.submittedSnapshot?.cgpa, 8.92);
        assert.equal(newStudentApplyData.data?.submittedSnapshot?.fullName, "Neha Kulkarni");
    });

    console.log("\n[Test Group 4] TPO Roster, Applicant Inspection & Company Export");

    // 14. TPO retrieves applicants for the drive
    const driveAppsRes = await fetch(`${BASE_URL}/api/v1/application/drive/${testDrive._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });
    const driveAppsData = await driveAppsRes.json();

    test("TPO sees exactly 2 applicants (Demo student + New student)", () => {
        assert.equal(driveAppsRes.status, 200);
        assert.equal(driveAppsData.data?.length, 2);
    });

    // 15. TPO exports applicant report with UTF-8 BOM
    const exportRes = await fetch(`${BASE_URL}/api/v1/application/${testDrive._id}/export`, {
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

    test("TPO candidate export contains UTF-8 BOM and candidate snapshot data", () => {
        assert.equal(exportRes.status, 200);
        assert.ok(hasBom, "Export must have UTF-8 BOM for Microsoft Excel compatibility");
        assert.ok(exportText.includes("Aarav Sharma"), "Demo student name must appear");
        assert.ok(exportText.includes("Neha Kulkarni"), "New student name must appear");
        assert.ok(exportText.includes("1MS23CS001"), "Demo student USN must appear");
        assert.ok(!exportText.includes("Rajesh Sharma"), "Confidential family details must be excluded");
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
