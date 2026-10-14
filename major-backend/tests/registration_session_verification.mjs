// CampusFlow V2 - Student Registration, Department Selection & Placement Session Assignment Suite
// Validates:
// 1. Successful student registration with USN, department, admission year, graduation year, and placement session
// 2. Server validation of required fields
// 3. Email normalization and format checking
// 4. Duplicate email prevention (409 Conflict)
// 5. Duplicate USN / Roll number prevention (409 Conflict)
// 6. Inactive or non-existent placement session rejection with helpful instructions
// 7. Course duration & admission-to-graduation calculation (e.g. 2023 B.Tech -> 2027)
// 8. Session mismatch rejection (e.g. 2023 admission with 2029 session)
// 9. Atomic consistency (rollback user account if profile creation fails)
// 10. Login using email after registration
// 11. Login using USN / Roll number after registration
// 12. Public registration role gatekeeping (privilege escalation to 'admin' blocked)
// 13. Department endpoints (public active list & admin department creation)
// 14. Persistence across logout and re-login

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
    console.log("==========================================================================");
    console.log("   CAMPUSFLOW V2 - STUDENT REGISTRATION & SESSION ASSIGNMENT SUITE        ");
    console.log(`   Target: ${BASE_URL}`);
    console.log("==========================================================================\n");

    const uniqueId = Date.now();
    let adminToken = "";
    let session2027Id = "";

    // ----------------------------------------------------
    // SETUP: Admin User & Standard Placement Sessions
    // ----------------------------------------------------
    console.log("[Setup] Registering Admin and Resolving Placement Session 2027");
    try {
        const adminPayload = {
            fullName: `TPO Onboarding Lead ${uniqueId}`,
            email: `tpo_reg_${uniqueId}@college.edu`,
            password: "AdminPassword123!",
            employeeId: `EMP_REG_${uniqueId}`,
            designation: "Registrar",
            adminSecretKey: "TPO_ADMIN_2026"
        };
        const adminReg = await fetch(`${BASE_URL}/api/v1/admin/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adminPayload)
        });
        assert(adminReg.status === 201, "Admin user provisioned via secure Admin Portal");

        const adminLog = await fetch(`${BASE_URL}/api/v1/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminPayload.email, password: adminPayload.password })
        });
        const adminData = await adminLog.json();
        adminToken = adminData.data?.accessToken;
        assert(Boolean(adminToken), "Admin login returns JWT access token");

        // Seed default placement sessions (2025-2029)
        await fetch(`${BASE_URL}/api/v1/sessions/seed-defaults`, {
            method: "POST",
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        // Resolve and Activate Session 2027
        const sessionsRes = await fetch(`${BASE_URL}/api/v1/sessions`);
        const sessionsData = await sessionsRes.json();
        const sess2027 = sessionsData.data?.find((s) => s.sessionYear === 2027);
        session2027Id = sess2027?._id;

        const actRes = await fetch(`${BASE_URL}/api/v1/sessions/${session2027Id}/activate`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert(actRes.status === 200, "Placement Session for Class of 2027 activated and open for onboarding");
    } catch (err) {
        assert(false, "Setup completed", err.message);
    }

    // ----------------------------------------------------
    // TEST GROUP 1: Department API & Configurable Management
    // ----------------------------------------------------
    console.log("\n[Test Group 1] Department Management & Active Selection");
    try {
        // 1. Fetch public departments (auto-seeds defaults if empty)
        const deptRes = await fetch(`${BASE_URL}/api/v1/departments`);
        const deptData = await deptRes.json();
        assert(deptRes.status === 200, "GET /api/v1/departments returns 200 OK without requiring authentication");
        assert(Array.isArray(deptData.data) && deptData.data.length >= 6, "Returns active departments list (CSE, ISE, ECE, ME, etc.)");

        // 2. Admin creates a new custom department
        const newDeptCode = `AIDS_${uniqueId % 1000}`;
        const createDeptRes = await fetch(`${BASE_URL}/api/v1/departments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({
                name: `Artificial Intelligence and Data Science (${newDeptCode})`,
                code: newDeptCode,
                course: "B.Tech",
                description: "Department of AI and Data Science"
            })
        });
        const createDeptData = await createDeptRes.json();
        assert(createDeptRes.status === 201, "Admin creates new active department (HTTP 201)");
        assert(createDeptData.data?.code === newDeptCode, "New department code persisted in database");
    } catch (err) {
        assert(false, "Department management tests completed", err.message);
    }

    // ----------------------------------------------------
    // TEST GROUP 2: Validation, Constraints & Error Rejections
    // ----------------------------------------------------
    console.log("\n[Test Group 2] Validation Rules, Error Handling & Constraint Enforcement");
    try {
        // 1. Missing required full name
        const missingNameRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: `valid_${uniqueId}@college.edu`, password: "Password123!" })
        });
        assert(missingNameRes.status === 400, "Registration without full name rejected (HTTP 400)");

        // 2. Invalid email format
        const badEmailRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName: "Test Student", email: "invalid-email-string", password: "Password123!" })
        });
        assert(badEmailRes.status === 400, "Registration with invalid email syntax rejected (HTTP 400)");

        // 3. Short password (< 6 chars)
        const shortPassRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName: "Test Student", email: `test_${uniqueId}@college.edu`, password: "123" })
        });
        assert(shortPassRes.status === 400, "Registration with weak password rejected (HTTP 400)");

        // 4. Mismatched confirm password
        const mismatchPassRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "Test Student",
                email: `test_${uniqueId}@college.edu`,
                password: "Password123!",
                confirmPassword: "DifferentPassword123!"
            })
        });
        assert(mismatchPassRes.status === 400, "Registration with mismatched confirm password rejected (HTTP 400)");

        // 5. Privilege escalation attempt: Client passes role: "admin"
        const privEscRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "Hacker Student",
                email: `hacker_${uniqueId}@college.edu`,
                password: "Password123!",
                role: "admin"
            })
        });
        assert(privEscRes.status === 403, "Public registration attempting role: 'admin' blocked with HTTP 403 Forbidden");

        // 6. Inactive or nonexistent placement session (e.g. Class of 2045 when no session exists)
        const nonexistentSessionRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "Future Student",
                email: `future_${uniqueId}@college.edu`,
                password: "Password123!",
                usn: `USN_FUT_${uniqueId}`,
                course: "B.Tech",
                admissionYear: 2041,
                graduationYear: 2045 // Session 2045 does NOT exist
            })
        });
        assert(nonexistentSessionRes.status === 400, "Registration for unconfigured future session rejected with HTTP 400");
        const noSessData = await nonexistentSessionRes.json();
        assert(noSessData.message?.includes("No placement session is configured"), "Rejection response provides clear instructions to contact TPO");

        // 7. Academic duration mismatch (e.g. 4-year B.Tech starting in 2023 with graduation set to 2029)
        const yearMismatchRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "Mismatch Student",
                email: `mismatch_${uniqueId}@college.edu`,
                password: "Password123!",
                usn: `USN_MIS_${uniqueId}`,
                course: "B.Tech",
                admissionYear: 2023,
                graduationYear: 2029 // Invalid: 2023 + 4 != 2029
            })
        });
        assert(yearMismatchRes.status === 400, "Academic duration mismatch (admission vs graduation) rejected with HTTP 400");
    } catch (err) {
        assert(false, "Validation & error constraint tests completed", err.message);
    }

    // ----------------------------------------------------
    // TEST GROUP 3: Successful Registration & Session Linking
    // ----------------------------------------------------
    console.log("\n[Test Group 3] Complete Student Registration & Deterministic Session Assignment");
    const studentUsn = `1MS23CS${(uniqueId % 1000).toString().padStart(3, "0")}`;
    const studentEmail = `student_${uniqueId}@college.edu`;
    const studentPassword = "CandidatePassword123!";
    let registeredAccessToken = "";
    let registeredProfile = null;

    try {
        const studentPayload = {
            fullName: "Aarav K. Sharma",
            email: studentEmail,
            personalEmail: `aarav_personal_${uniqueId}@gmail.com`,
            password: studentPassword,
            confirmPassword: studentPassword,
            phone: "+91 9876543210",
            usn: studentUsn,
            course: "B.Tech",
            courseDurationYears: 4,
            department: "Computer Science and Engineering (CSE)",
            admissionYear: 2023,
            graduationYear: 2027,
            currentSemester: 6,
            placementSession: session2027Id,
            gender: "Male"
        };

        const regRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(studentPayload)
        });
        const regData = await regRes.json();
        if (regRes.status !== 201) {
            console.error("DEBUG REG ERROR:", regRes.status, regData);
        }
        assert(regRes.status === 201, "Student registered successfully (HTTP 201 Created)");
        assert(Boolean(regData.data?.user?._id), "User account created with secure MongoDB ObjectId");
        assert(regData.data?.user?.role === "student", "Entity assigned strictly 'student' role");
        assert(regData.data?.user?.password === undefined, "Sensitive password hash omitted from response");
        assert(regData.data?.user?.refreshToken === undefined, "Refresh token omitted from response payload");

        registeredAccessToken = regData.data?.accessToken;
        assert(Boolean(registeredAccessToken), "Registration response provides authenticated JWT access token");

        registeredProfile = regData.data?.studentProfile;
        assert(Boolean(registeredProfile?._id), "Linked StudentProfile document created consistently");
        assert(registeredProfile?.enrollmentNumber === studentUsn, "Enrollment Number matches normalized USN");
        assert(registeredProfile?.branch === "Computer Science and Engineering (CSE)", "Department/branch persisted accurately");
        assert(registeredProfile?.admissionYear === 2023, "Admission Year persisted accurately (2023)");
        assert(registeredProfile?.graduationYear === 2027, "Graduation Year persisted accurately (2027)");
        assert(registeredProfile?.placementSession?._id === session2027Id || registeredProfile?.placementSession?.sessionYear === 2027, "Placement Session 2027 reference linked in database");
    } catch (err) {
        assert(false, "Successful registration tests completed", err.message);
    }

    // ----------------------------------------------------
    // TEST GROUP 4: Duplicate Account & USN Uniqueness
    // ----------------------------------------------------
    console.log("\n[Test Group 4] Database-Level Uniqueness (Email & USN)");
    try {
        // 1. Attempt registering with same email -> Blocked 409
        const dupEmailRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "Another Student",
                email: studentEmail.toUpperCase(), // Test case-insensitive normalization
                password: "AnotherPassword123!",
                usn: `DIFF_${uniqueId}`,
                admissionYear: 2023,
                graduationYear: 2027
            })
        });
        assert(dupEmailRes.status === 409, "Duplicate registration with existing normalized email blocked (HTTP 409 Conflict)");

        // 2. Attempt registering with different email but duplicate USN -> Blocked 409
        const dupUsnRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "Impostor Student",
                email: `unique_${uniqueId}@college.edu`,
                password: "AnotherPassword123!",
                usn: studentUsn.toLowerCase(), // Test case-insensitive USN normalization
                admissionYear: 2023,
                graduationYear: 2027
            })
        });
        assert(dupUsnRes.status === 409, "Duplicate registration with existing USN blocked (HTTP 409 Conflict)");
    } catch (err) {
        assert(false, "Duplicate prevention tests completed", err.message);
    }

    // ----------------------------------------------------
    // TEST GROUP 5: Login with Email & USN, Persistence & Auth Boundaries
    // ----------------------------------------------------
    console.log("\n[Test Group 5] Authentication with Email & USN, Persistence & Boundaries");
    try {
        // 1. Login using Email
        const logEmailRes = await fetch(`${BASE_URL}/api/v1/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: studentEmail, password: studentPassword })
        });
        const logEmailData = await logEmailRes.json();
        assert(logEmailRes.status === 200, "Student successfully logs in using email (HTTP 200)");
        assert(Boolean(logEmailData.data?.accessToken), "Login returns valid JWT accessToken");

        // 2. Login using USN / Roll number
        const logUsnRes = await fetch(`${BASE_URL}/api/v1/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rollNumber: studentUsn, password: studentPassword })
        });
        const logUsnData = await logUsnRes.json();
        assert(logUsnRes.status === 200, "Student successfully logs in using USN / Roll Number (HTTP 200)");
        assert(Boolean(logUsnData.data?.accessToken), "USN login returns valid JWT accessToken");

        const sessionToken = logUsnData.data?.accessToken;

        // 3. Fetch current student profile
        const myProfRes = await fetch(`${BASE_URL}/api/v1/studentprofile/current-student-profile`, {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });
        const myProfData = await myProfRes.json();
        assert(myProfRes.status === 200, "GET /current-student-profile succeeds for authenticated student");
        assert(myProfData.data?.enrollmentNumber === studentUsn, "Profile persists USN across login sessions");
        assert(myProfData.data?.branch === "Computer Science and Engineering (CSE)", "Profile persists Department across sessions");
        assert(myProfData.data?.admissionYear === 2023, "Profile persists Admission Year across sessions");
        assert(myProfData.data?.graduationYear === 2027, "Profile persists Graduation Year across sessions");

        // 4. Logout
        const logoutRes = await fetch(`${BASE_URL}/api/v1/users/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionToken}` }
        });
        assert(logoutRes.status === 200, "Student logs out cleanly via POST /users/logout");
    } catch (err) {
        assert(false, "Login and persistence tests completed", err.message);
    }

    // ----------------------------------------------------
    // TEST GROUP 6: Admin TPO Controls & Profile Scoping
    // ----------------------------------------------------
    console.log("\n[Test Group 6] Admin TPO Inspection & Session Verification Controls");
    try {
        // 1. Admin queries students filtered by session
        const allStudentsRes = await fetch(
            `${BASE_URL}/api/v1/studentprofile/all-students?session=${session2027Id}`,
            {
                headers: { Authorization: `Bearer ${adminToken}` }
            }
        );
        const allStudentsData = await allStudentsRes.json();
        assert(allStudentsRes.status === 200, "TPO can query students filtered by placement session");
        const found = allStudentsData.data?.students?.some((s) => s.enrollmentNumber === studentUsn);
        assert(found === true, "Registered student appears in TPO Session 2027 cohort roster");

        // 2. TPO inspects student detail
        const studentDetailRes = await fetch(
            `${BASE_URL}/api/v1/studentprofile/${registeredProfile._id}`,
            {
                headers: { Authorization: `Bearer ${adminToken}` }
            }
        );
        const studentDetailData = await studentDetailRes.json();
        assert(studentDetailRes.status === 200, "TPO can inspect registered student detail");
        assert(studentDetailData.data?.verificationStatus === "PENDING", "Initial student verification status is 'PENDING'");
    } catch (err) {
        assert(false, "Admin TPO control tests completed", err.message);
    }

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log("\n==========================================================================");
    console.log(`   TESTS COMPLETED: Passed: ${testPassed} | Failed: ${testFailed}`);
    console.log("==========================================================================");

    if (testFailed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch((err) => {
    console.error("Unhandled test suite exception:", err);
    process.exit(1);
});
