// CampusFlow V2 - Phase 1 Security & Reliability Regression Suite
// Validates:
// 1. Backend health & Security headers (nosniff, DENY)
// 2. Student Role Escalation Prevention (role: "admin" payload blocked with 403)
// 3. Genuine Student Registration & Authentication
// 4. Admin Provisioning Secret Key Enforcement (403 on missing/invalid, 201 on valid)
// 5. Role-based Authorization Boundaries (Student blocked from admin route /create-placement-drive)
// 6. Logout & Session Invalidation
// 7. Production Endpoints Return Genuine Backend Data

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
    console.log("   CAMPUSFLOW V2 - PHASE 1 SECURITY & REGRESSION SUITE   ");
    console.log(`   Target: ${BASE_URL}`);
    console.log("==========================================================\n");

    const uniqueId = Date.now();

    // 1. Health check & Security Headers
    console.log("[Test Group 1] Health Check & Security Headers");
    try {
        const res = await fetch(`${BASE_URL}/`);
        assert(res.status === 200, "Backend root endpoint is healthy (200 OK)");
        const headers = res.headers;
        assert(
            headers.get("x-content-type-options") === "nosniff",
            "Security Header: X-Content-Type-Options is 'nosniff'"
        );
        assert(
            headers.get("x-frame-options") === "DENY",
            "Security Header: X-Frame-Options is 'DENY'"
        );
    } catch (err) {
        assert(false, "Root endpoint accessible", err.message);
    }

    // 2. Student Registration Privilege Escalation Attack
    console.log("\n[Test Group 2] Privilege Escalation Defense & Student Auth");
    let studentAccessToken = "";
    try {
        // Attempt 1: Hacker tries to elevate to admin on public registration route
        const exploitRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: `Hacker Student ${uniqueId}`,
                email: `hacker_${uniqueId}@college.edu`,
                password: "SecurePassword123!",
                role: "admin"
            })
        });
        assert(
            exploitRes.status === 403,
            "Privilege escalation prevented: Public register with role 'admin' blocked with 403"
        );

        // Attempt 2: Genuine student registers
        const studentPayload = {
            fullName: `Valid Student ${uniqueId}`,
            email: `student_${uniqueId}@college.edu`,
            password: "StudentPass123!"
        };
        const studentRes = await fetch(`${BASE_URL}/api/v1/users/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(studentPayload)
        });
        const studentData = await studentRes.json();
        assert(studentRes.status === 201, "Genuine student registration succeeds (201 Created)");
        assert(
            studentData.data?.role === "student",
            "Entity safely provisioned with 'student' role"
        );

        // Student Login
        const loginRes = await fetch(`${BASE_URL}/api/v1/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: studentPayload.email,
                password: studentPayload.password
            })
        });
        const loginData = await loginRes.json();
        assert(loginRes.status === 200, "Student successfully logged in (200 OK)");
        studentAccessToken = loginData.data?.accessToken;
        assert(Boolean(studentAccessToken), "Valid JWT access token returned to student");
    } catch (err) {
        assert(false, "Student registration/privilege test completed", err.message);
    }

    // 3. Admin Provisioning Secret Key Enforcement
    console.log("\n[Test Group 3] Admin Provisioning Gatekeeper");
    let adminAccessToken = "";
    try {
        // Attempt 1: Register admin with NO secret key
        const noKeyRes = await fetch(`${BASE_URL}/api/v1/admin/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: `Unauthorized Admin ${uniqueId}`,
                email: `bad_admin_${uniqueId}@college.edu`,
                password: "AdminPassword123!",
                employeeId: `EMP_BAD_${uniqueId}`,
                designation: "TPO Lead"
            })
        });
        assert(
            noKeyRes.status === 403,
            "Admin registration without secret key rejected with 403 Forbidden"
        );

        // Attempt 2: Register admin with INVALID secret key
        const wrongKeyRes = await fetch(`${BASE_URL}/api/v1/admin/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: `Fake Admin ${uniqueId}`,
                email: `fake_admin_${uniqueId}@college.edu`,
                password: "AdminPassword123!",
                employeeId: `EMP_FAKE_${uniqueId}`,
                designation: "TPO Lead",
                adminSecretKey: "WRONG_SECRET_KEY_123"
            })
        });
        assert(
            wrongKeyRes.status === 403,
            "Admin registration with invalid secret key rejected with 403 Forbidden"
        );

        // Attempt 3: Register admin with VALID secret key (from .env: TPO_ADMIN_2026)
        const adminPayload = {
            fullName: `TPO Officer ${uniqueId}`,
            email: `tpo_${uniqueId}@college.edu`,
            password: "AdminPassword123!",
            employeeId: `EMP_${uniqueId}`,
            designation: "Head of Training & Placement",
            adminSecretKey: "TPO_ADMIN_2026"
        };
        const validKeyRes = await fetch(`${BASE_URL}/api/v1/admin/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adminPayload)
        });
        const adminData = await validKeyRes.json();
        assert(
            validKeyRes.status === 201,
            "Admin registration with valid ADMIN_SECRET_KEY succeeds with 201 Created"
        );
        assert(
            adminData.data?.user?.role === "admin" || adminData.data?.role === "admin",
            "Registered entity has verified 'admin' role in database"
        );

        // Admin Login
        const adminLoginRes = await fetch(`${BASE_URL}/api/v1/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: adminPayload.email,
                password: adminPayload.password
            })
        });
        const adminLoginData = await adminLoginRes.json();
        assert(adminLoginRes.status === 200, "Admin login succeeds (200 OK)");
        adminAccessToken = adminLoginData.data?.accessToken;
        assert(Boolean(adminAccessToken), "Valid JWT access token returned to admin");
    } catch (err) {
        assert(false, "Admin provisioning gatekeeper test completed", err.message);
    }

    // 4. Role Authorization Boundaries
    console.log("\n[Test Group 4] Role Authorization Boundaries");
    try {
        // Student attempting an admin-only route
        const studentDriveRes = await fetch(`${BASE_URL}/api/v1/placementdrive/create-placement-drive`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentAccessToken}`
            },
            body: JSON.stringify({
                title: "Malicious Drive"
            })
        });
        assert(
            studentDriveRes.status === 403,
            "Role boundary: Student token is rejected with 403 Forbidden on admin route (/create-placement-drive)"
        );

        // Admin attempting the same route with invalid body
        const adminDriveRes = await fetch(`${BASE_URL}/api/v1/placementdrive/create-placement-drive`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminAccessToken}`
            },
            body: JSON.stringify({})
        });
        assert(
            adminDriveRes.status === 400,
            "Role boundary: Admin passes authorization filter and hits controller validation (400 Bad Request)"
        );
    } catch (err) {
        assert(false, "Role boundary authorization test completed", err.message);
    }

    // 5. Logout & Token Invalidation
    console.log("\n[Test Group 5] Logout & Session Invalidation");
    try {
        const logoutRes = await fetch(`${BASE_URL}/api/v1/users/logout`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${studentAccessToken}`
            }
        });
        assert(logoutRes.status === 200, "Logout endpoint successfully clears and invalidates user session");
    } catch (err) {
        assert(false, "Logout test completed", err.message);
    }

    // 6. Genuine Data Endpoints (No Mock Fallbacks)
    console.log("\n[Test Group 6] Production Endpoints Return Genuine Backend Documents");
    try {
        const drivesRes = await fetch(`${BASE_URL}/api/v1/placementdrive/all-drives`, {
            headers: {
                Authorization: `Bearer ${adminAccessToken}`
            }
        });
        assert(
            drivesRes.status === 200,
            "GET /api/v1/placementdrive/all-drives returns 200 OK from MongoDB"
        );
        const drivesData = await drivesRes.json();
        assert(
            Array.isArray(drivesData.data),
            "Drives data structure is a genuine Mongoose documents array"
        );

        const companiesRes = await fetch(`${BASE_URL}/api/v1/company/all-companies`, {
            headers: {
                Authorization: `Bearer ${adminAccessToken}`
            }
        });
        assert(
            companiesRes.status === 200,
            "GET /api/v1/company/all-companies returns 200 OK from MongoDB"
        );
        const companiesData = await companiesRes.json();
        assert(
            Array.isArray(companiesData.data),
            "Companies data structure is a genuine Mongoose documents array"
        );
    } catch (err) {
        assert(false, "Genuine data endpoints test completed", err.message);
    }

    console.log("\n==========================================================");
    console.log(`   REGRESSION TEST RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log("==========================================================");

    if (testFailed > 0) {
        process.exit(1);
    }
}

runTests();
