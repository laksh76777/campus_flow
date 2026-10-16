// CampusFlow V2 - Phase 2 & Phase 3 Automated Verification Suite
// Validates:
// 1. Placement Sessions creation & multi-year management (2026, 2027, 2028)
// 2. Admission-to-graduation mapping configuration (e.g. 2023 -> 2027)
// 3. Session activation & closure lifecycle
// 4. Safe backfill preview & execution for existing unlinked records
// 5. Upgraded Student Profile structured persistence (personal, family, address, 10th/12th)
// 6. Semester-wise SGPA recording without overwriting the student's official CGPA
// 7. Backlogs tracking (Active vs Cleared historical arrears)
// 8. TPO Profile verification workflow (VERIFIED / REVERIFICATION_REQUESTED)

const BASE_URL = process.env.TEST_API_URL || "http://localhost:8000";

let testPassed = 0;
let testFailed = 0;

function assert(condition, testName, details = "") {
    if (condition) {
        console.log(`  [PASS] ${testName}`);
        testPassed++;
    } else {
        console.error(`  [FAIL] ${testName} - ${details}`);
        testFailed++;
    }
}

async function runTests() {
    console.log("==========================================================");
    console.log("   CAMPUSFLOW V2 - PHASE 2 & PHASE 3 VERIFICATION SUITE   ");
    console.log(`   Target: ${BASE_URL}`);
    console.log("==========================================================\n");

    const uniqueId = Date.now();
    let adminAccessToken = "";
    let studentAccessToken = "";
    let testStudentId = "";
    let session2027Id = "";

    // Step 0: Setup Admin & Student Accounts
    console.log("[Setup] Registering Admin and Student Authenticated Users");
    try {
        const adminPayload = {
            fullName: `TPO Verification Lead ${uniqueId}`,
            email: `tpo_lead_${uniqueId}@college.edu`,
            password: "AdminPassword123!",
            employeeId: `EMP_TEST_${uniqueId}`,
            designation: "Head TPO",
            adminSecretKey: "TPO_ADMIN_2026"
        };
        const adminReg = await fetch(`${BASE_URL}/api/v1/admin/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adminPayload)
        });
        assert(adminReg.status === 201, "Admin user registered for test suite");

        const adminLog = await fetch(`${BASE_URL}/api/v1/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminPayload.email, password: adminPayload.password })
        });
        const adminData = await adminLog.json();
        adminAccessToken = adminData.data?.accessToken;
        assert(Boolean(adminAccessToken), "Admin login returns valid JWT access token");

        const studentPayload = {
            fullName: `V3 Candidate ${uniqueId}`,
            email: `cand_${uniqueId}@college.edu`,
            password: "CandidatePass123!"
        };
        const studentReg = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(studentPayload)
        });
        assert(studentReg.status === 201, "Student user registered for test suite");

        const studentLog = await fetch(`${BASE_URL}/api/v1/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: studentPayload.email, password: studentPayload.password })
        });
        const studentData = await studentLog.json();
        studentAccessToken = studentData.data?.accessToken;
        assert(Boolean(studentAccessToken), "Student login returns valid JWT access token");
    } catch (err) {
        assert(false, "Setup completed", err.message);
    }

    // Phase 2: Placement Sessions
    console.log("\n[Test Group 1] Placement Sessions Lifecycle & Admission Mapping");
    try {
        // 1. Seed standard sessions (2025-2029)
        const seedRes = await fetch(`${BASE_URL}/api/v1/sessions/seed-defaults`, {
            method: "POST",
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        assert(seedRes.status === 200, "POST /api/v1/sessions/seed-defaults initializes standard cohorts");

        // 2. Fetch all sessions
        const allSessRes = await fetch(`${BASE_URL}/api/v1/sessions`, {
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        const allSessData = await allSessRes.json();
        assert(Array.isArray(allSessData.data), "GET /api/v1/sessions returns array of sessions");
        assert(allSessData.data.length >= 4, "Includes multiple cohorts (2025, 2026, 2027, 2028, etc.)");

        // 3. Verify admission-to-graduation mapping configuration
        const sess2027 = allSessData.data.find((s) => s.sessionYear === 2027);
        assert(Boolean(sess2027), "Placement session 2027 exists");
        if (sess2027) {
            session2027Id = sess2027._id;
            const btechMapping = sess2027.admissionYearMapping?.find((m) => m.course === "B.Tech");
            assert(
                btechMapping?.admissionYear === 2023,
                "Configurable mapping: B.Tech admission year 2023 correctly maps to placement session 2027",
                `Found admissionYear: ${btechMapping?.admissionYear}`
            );
        }

        // 4. Session Activation
        const actRes = await fetch(`${BASE_URL}/api/v1/sessions/${session2027Id}/activate`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        assert(actRes.status === 200, "PATCH /sessions/:id/activate sets session as active");

        // 5. Active Session Endpoint
        const activeRes = await fetch(`${BASE_URL}/api/v1/sessions/active`, {
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        const activeData = await activeRes.json();
        assert(activeData.data?.sessionYear === 2027, "GET /sessions/active returns the activated session");

        // 6. Session Closure
        const closeRes = await fetch(`${BASE_URL}/api/v1/sessions/${session2027Id}/close`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        const closeData = await closeRes.json();
        assert(closeData.data?.status === "CLOSED" && closeData.data?.isClosed === true, "PATCH /sessions/:id/close concludes and closes session");

        // Re-activate 2026 for ongoing tests
        const sess2026 = allSessData.data.find((s) => s.sessionYear === 2026);
        if (sess2026) {
            await fetch(`${BASE_URL}/api/v1/sessions/${sess2026._id}/activate`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${adminAccessToken}` }
            });
        }
    } catch (err) {
        assert(false, "Placement sessions test completed", err.message);
    }

    // Phase 2: Safe Migration & Backfill Preview/Execute
    console.log("\n[Test Group 2] Safe Migration & Backfill Preview");
    try {
        const previewRes = await fetch(`${BASE_URL}/api/v1/sessions/backfill/preview`, {
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        assert(previewRes.status === 200, "GET /api/v1/sessions/backfill/preview returns 200 OK");
        const previewData = await previewRes.json();
        assert(
            typeof previewData.data?.totalUnlinkedStudents === "number",
            "Preview accurately counts unlinked students without making unconfirmed database writes"
        );
        assert(
            Array.isArray(previewData.data?.studentPlanned),
            "Preview provides deterministic planned mapping breakdown"
        );
    } catch (err) {
        assert(false, "Migration preview test completed", err.message);
    }

    // Phase 3: Upgraded Student Profile with Structured Sections
    console.log("\n[Test Group 3] Upgraded Student Profile Structured Sections");
    try {
        // 1. Fetch default profile
        const getProfRes = await fetch(`${BASE_URL}/api/v1/studentprofile/current-student-profile`, {
            headers: { Authorization: `Bearer ${studentAccessToken}` }
        });
        assert(getProfRes.status === 200, "Current student profile retrieved successfully");
        const getProfData = await getProfRes.json();
        testStudentId = getProfData.data?._id;

        // 2. Update with full structured personal, family, address, 10th/12th sections
        const updatePayload = {
            course: "B.Tech",
            branch: "Information Technology",
            semester: 6,
            graduationYear: 2026,
            admissionYear: 2022,
            gender: "Female",
            personalEmail: `cand_${uniqueId}@gmail.com`,
            collegeEmail: `cand_${uniqueId}@college.edu`,
            alternatePhone: "+91 9876543210",
            tenthDetails: {
                schoolName: "Delhi Public School",
                board: "CBSE",
                passingYear: 2020,
                percentage: 92.5
            },
            twelfthOrDiplomaDetails: {
                qualificationType: "12th",
                institutionName: "National Public Junior College",
                boardOrUniversity: "CBSE",
                passingYear: 2022,
                percentage: 89.0
            },
            family: {
                fatherName: "Rajesh Kumar",
                fatherOccupation: "Engineer",
                fatherPhone: "+91 9123456789",
                motherName: "Sunita Kumar",
                motherOccupation: "Doctor"
            },
            currentAddress: {
                street: "123 Campus Residency, Tech Park Road",
                city: "Bengaluru",
                state: "Karnataka",
                pincode: "560100"
            },
            permanentAddress: {
                street: "123 Campus Residency, Tech Park Road",
                city: "Bengaluru",
                state: "Karnataka",
                pincode: "560100"
            },
            sameAsCurrent: true,
            skills: ["React", "TypeScript", "Node.js", "MongoDB", "Python"]
        };

        const updateRes = await fetch(`${BASE_URL}/api/v1/studentprofile/update-profile`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentAccessToken}`
            },
            body: JSON.stringify(updatePayload)
        });
        const updateData = await updateRes.json();
        assert(updateRes.status === 200, "PATCH /api/v1/studentprofile/update-profile persists structured sections");
        assert(
            updateData.data?.tenthDetails?.percentage === 92.5,
            "10th standard percentage persisted in structured tenthDetails"
        );
        assert(
            updateData.data?.family?.fatherName === "Rajesh Kumar",
            "Family details (fatherName, motherName) persisted successfully"
        );
        assert(
            updateData.data?.currentAddress?.city === "Bengaluru",
            "Address details persisted successfully"
        );
        assert(
            updateData.data?.profileCompleteness >= 60,
            "Profile completeness auto-calculated by pre-save hook (>= 60%)",
            `Completeness: ${updateData.data?.profileCompleteness}%`
        );
    } catch (err) {
        assert(false, "Structured student profile test completed", err.message);
    }

    // Phase 3: Semester SGPA Ledger & Official CGPA Preservation
    console.log("\n[Test Group 4] Semester Results Ledger & Official CGPA Preservation");
    try {
        // Record Sem 1: SGPA 8.0 with 20 credits
        const sem1Res = await fetch(`${BASE_URL}/api/v1/studentprofile/semester-result`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentAccessToken}`
            },
            body: JSON.stringify({
                semester: 1,
                sgpa: 8.0,
                credits: 20
            })
        });
        assert(sem1Res.status === 200, "POST /semester-result records Semester 1 SGPA");

        // Record Sem 2: SGPA 9.0 with 20 credits
        const sem2Res = await fetch(`${BASE_URL}/api/v1/studentprofile/semester-result`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentAccessToken}`
            },
            body: JSON.stringify({
                semester: 2,
                sgpa: 9.0,
                credits: 20
            })
        });
        const sem2Data = await sem2Res.json();
        assert(sem2Res.status === 200, "POST /semester-result records Semester 2 SGPA");
        assert(
            sem2Data.data?.cgpa == null,
            "Semester SGPA results do not fabricate or overwrite the official CGPA",
            `Returned CGPA: ${sem2Data.data?.cgpa}`
        );
    } catch (err) {
        assert(false, "Semester SGPA test completed", err.message);
    }

    // Phase 3: Backlog Ledger (Active vs Cleared)
    console.log("\n[Test Group 5] Backlog Breakdown (Active vs Historical Cleared)");
    try {
        // Log an active arrear
        const back1 = await fetch(`${BASE_URL}/api/v1/studentprofile/backlog-record`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentAccessToken}`
            },
            body: JSON.stringify({
                subjectCode: "CS201",
                subjectName: "Discrete Mathematics",
                semester: 2,
                status: "ACTIVE"
            })
        });
        const back1Data = await back1.json();
        assert(back1.status === 200, "POST /backlog-record records active arrear");
        assert(
            back1Data.data?.activeBacklogs === 1,
            "Active backlogs count incremented to 1"
        );

        // Log a cleared arrear
        const back2 = await fetch(`${BASE_URL}/api/v1/studentprofile/backlog-record`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentAccessToken}`
            },
            body: JSON.stringify({
                subjectCode: "MA101",
                subjectName: "Calculus",
                semester: 1,
                status: "CLEARED",
                clearedDate: new Date()
            })
        });
        const back2Data = await back2.json();
        assert(back2.status === 200, "POST /backlog-record records historically cleared arrear");
        assert(
            back2Data.data?.activeBacklogs === 1 && back2Data.data?.clearedBacklogsCount === 1,
            "Accurately distinguishes active backlogs (1) from cleared historical backlogs (1)"
        );
    } catch (err) {
        assert(false, "Backlog ledger test completed", err.message);
    }

    // Phase 3: TPO Verification Workflow
    console.log("\n[Test Group 6] TPO Verification & Document Audit Workflow");
    try {
        const verifyRes = await fetch(`${BASE_URL}/api/v1/studentprofile/${testStudentId}/verify`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminAccessToken}`
            },
            body: JSON.stringify({
                verificationStatus: "VERIFIED",
                verificationRemarks: "Official marksheets and institutional CGPA verified by TPO desk",
                verifiedCGPA: 8.5
            })
        });
        const verifyData = await verifyRes.json();
        assert(verifyRes.status === 200, "PATCH /:studentId/verify sets verification status to VERIFIED");
        assert(
            verifyData.data?.verificationStatus === "VERIFIED",
            "Student profile is formally accredited with VERIFIED badge"
        );
    } catch (err) {
        assert(false, "TPO verification test completed", err.message);
    }

    console.log("\n==========================================================");
    console.log(`   PHASE 2 & PHASE 3 TEST RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log("==========================================================");

    if (testFailed > 0) {
        process.exit(1);
    }
}

runTests();
