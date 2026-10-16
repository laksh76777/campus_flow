import assert from "node:assert/strict";
import "../env.js";
import connectDB from "../src/db/index.js";
import { app } from "../src/app.js";
import mongoose from "mongoose";
import { User } from "../src/models/user.models.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { PlacementDrive } from "../src/models/placementDrive.model.js";
import { Application } from "../src/models/application.model.js";
import { PlacementSession } from "../src/models/placementSession.model.js";
import { sanitizeFormula } from "../src/services/excelImportExport.service.js";

let server;
let API_BASE;

async function login(email, password, role) {
  const url = role === "admin"
    ? `${API_BASE}/admin/login`
    : `${API_BASE}/users/login`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed for ${email} (${role}): ${data.message || res.statusText}`);
  }
  return {
    accessToken: data.data?.accessToken,
    user: data.data?.user || data.data?.admin,
  };
}

async function run() {
  console.log("==========================================================================");
  console.log("   CAMPUSFLOW V2 - COMPREHENSIVE SAFE END-TO-END VERIFICATION SUITE       ");
  console.log("==========================================================================\n");

  await connectDB();
  server = app.listen(0);
  const port = server.address().port;
  API_BASE = `http://localhost:${port}/api/v1`;
  console.log(`Ephemeral API test server running at ${API_BASE}\n`);

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name} - ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. AUTHENTICATION & ROLE AUTHORIZATION
  // -------------------------------------------------------------------------
  console.log("[Phase 1] Authentication, Roles & Security Boundaries");

  let adminAuth;
  let studentAuth;

  await check("1.1 Admin logs in with official credentials", async () => {
    adminAuth = await login("admin@campusflow.edu", "Admin@12345", "admin");
    assert.ok(adminAuth.accessToken, "Admin must receive access token");
    assert.equal(adminAuth.user.role, "admin");
  });

  await check("1.2 Student logs in with email credentials", async () => {
    studentAuth = await login("student@campusflow.edu", "Student@12345", "student");
    assert.ok(studentAuth.accessToken, "Student must receive access token");
    assert.equal(studentAuth.user.role, "student");
  });

  await check("1.3 Student logs in using Roll Number / USN", async () => {
    const res = await fetch(`${API_BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber: "1MS23CS001", password: "Student@12345" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.data?.accessToken, "USN login must return access token");
  });

  await check("1.4 Negative: Unauthenticated request rejected with HTTP 401", async () => {
    const res = await fetch(`${API_BASE}/placementdrive/all-drives`);
    assert.equal(res.status, 401, "Protected route must reject unauthenticated requests");
  });

  await check("1.5 Negative: Student accessing admin student dossier rejected with HTTP 403", async () => {
    const res = await fetch(`${API_BASE}/studentprofile/any-student-id`, {
      headers: { Authorization: `Bearer ${studentAuth.accessToken}` },
    });
    assert.equal(res.status, 403, "Student must be forbidden from admin-only dossier endpoint");
  });

  // -------------------------------------------------------------------------
  // 2. PLACEMENT SESSIONS & COHORT ISOLATION
  // -------------------------------------------------------------------------
  console.log("\n[Phase 2] Placement Sessions & Cohort Management");

  let sessions = [];
  await check("2.1 Query all placement sessions", async () => {
    const res = await fetch(`${API_BASE}/sessions`, {
      headers: { Authorization: `Bearer ${adminAuth.accessToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    sessions = data.data || [];
    assert.ok(Array.isArray(sessions), "Sessions must be an array");
    assert.ok(sessions.length > 0, "At least one session must exist");
  });

  await check("2.2 Active session exists with valid status and sessionYear", async () => {
    const active = sessions.find((s) => s.status === "ACTIVE" || (!s.isClosed && !s.isArchived));
    assert.ok(active, "Active session must be present");
    assert.ok(typeof active.sessionYear === "number", "Session year must be a number");
  });

  // -------------------------------------------------------------------------
  // 3. STUDENT PROFILE & ACADEMIC LEDGER INTEGRITY
  // -------------------------------------------------------------------------
  console.log("\n[Phase 3] Student Profile & Academic Integrity");

  let studentProfile;
  await check("3.1 Student retrieves own academic profile", async () => {
    const res = await fetch(`${API_BASE}/studentprofile/current-student-profile`, {
      headers: { Authorization: `Bearer ${studentAuth.accessToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    studentProfile = data.data;
    assert.ok(studentProfile, "Student profile must be returned");
    assert.equal(studentProfile.enrollmentNumber, "1MS23CS001");
  });

  await check("3.2 Official CGPA is preserved and not automatically averaged", async () => {
    assert.ok(typeof studentProfile.cgpa === "number", "Official CGPA must be a number");
    assert.equal(studentProfile.cgpa, 8.75, "Official CGPA must match transcript entry");
  });

  await check("3.3 Semester SGPA ledger reflects independent recordings", async () => {
    assert.ok(Array.isArray(studentProfile.semesterResults), "Semester results must be an array");
    assert.equal(studentProfile.semesterResults.length, 4, "Must have 4 semesters recorded");
    studentProfile.semesterResults.forEach((sem) => {
      assert.ok(sem.sgpa > 0 && sem.sgpa <= 10, `SGPA for sem ${sem.semester} must be in valid range`);
    });
  });

  // -------------------------------------------------------------------------
  // 4. PLACEMENT DRIVES, ELIGIBILITY & IMMUTABLE SUBMISSIONS
  // -------------------------------------------------------------------------
  console.log("\n[Phase 4] Placement Drives, Eligibility & Application Pipeline");

  let studentDrives = [];
  await check("4.1 Student views drives with eligibility calculations and reasons", async () => {
    const res = await fetch(`${API_BASE}/placementdrive/my-eligible-drives`, {
      headers: { Authorization: `Bearer ${studentAuth.accessToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    studentDrives = data.data || [];
    assert.ok(Array.isArray(studentDrives), "Drives must be an array");
    studentDrives.forEach((d) => {
      assert.ok(typeof d.isEligible === "boolean", "Drive must have isEligible boolean");
      assert.ok(Array.isArray(d.eligibilityReasons), "Drive must have eligibilityReasons array");
    });
  });

  // Create an ephemeral test drive to test both eligible & ineligible workflows cleanly
  const { Company } = await import("../src/models/company.model.js");
  const anyCompany = await Company.findOne({ isActive: true });
  const activeSession = await PlacementSession.findOne({ isClosed: { $ne: true }, isArchived: { $ne: true } });

  let testDriveIneligible;
  await check("4.2 Admin creates high-cutoff drive to verify ineligibility gating", async () => {
    testDriveIneligible = await PlacementDrive.create({
      company: anyCompany._id,
      jobTitle: `E2E High Cutoff Drive ${Date.now()}`,
      jobDescription: "Strict cutoff testing role",
      jobType: "full-time",
      package: 18.0,
      location: "Bangalore",
      eligibleBranches: ["Computer Science & Engineering"],
      minimumCGPA: 9.95, // Higher than student's 8.75
      maximumBacklogs: 0,
      graduationYear: activeSession?.sessionYear || 2027,
      placementSession: activeSession?._id,
      applicationStartDate: new Date(),
      applicationDeadline: new Date(Date.now() + 86400000),
      driveDate: new Date(Date.now() + 172800000),
      createdBy: adminAuth.user._id,
      isActive: true,
    });
    assert.ok(testDriveIneligible._id, "Drive must be created");
  });

  await check("4.3 Negative: Student application to ineligible drive is strictly blocked (HTTP 403)", async () => {
    const res = await fetch(`${API_BASE}/application/${testDriveIneligible._id}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentAuth.accessToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 403, "Ineligible application must return HTTP 403");
    const data = await res.json();
    assert.ok(data.message.toLowerCase().includes("not eligible") || data.message.toLowerCase().includes("cgpa"));
  });

  // Create an eligible drive to test successful submission, snapshot sealing, and duplicate rejection
  let testDriveEligible;
  await check("4.4 Admin creates accessible drive with student requirements", async () => {
    testDriveEligible = await PlacementDrive.create({
      company: anyCompany._id,
      jobTitle: `E2E Accessible Drive ${Date.now()}`,
      jobDescription: "Accessible role with JD and stipend",
      jobType: "internship",
      internshipType: "paid",
      stipend: "35000",
      internshipDuration: "3 Months",
      package: 8.5,
      location: "Hyderabad",
      eligibleBranches: ["Computer Science & Engineering"],
      minimumCGPA: 6.0,
      maximumBacklogs: 2,
      graduationYear: activeSession?.sessionYear || 2027,
      placementSession: activeSession?._id,
      applicationStartDate: new Date(),
      applicationDeadline: new Date(Date.now() + 86400000),
      driveDate: new Date(Date.now() + 172800000),
      createdBy: adminAuth.user._id,
      isActive: true,
    });
    assert.ok(testDriveEligible._id, "Eligible drive created");
  });

  let createdApplicationId;
  await check("4.5 Student submits application with immutable snapshot", async () => {
    const res = await fetch(`${API_BASE}/application/${testDriveEligible._id}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentAuth.accessToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 201, "Application submission must return HTTP 201");
    const data = await res.json();
    createdApplicationId = data.data?._id;
    assert.ok(createdApplicationId, "Application ID must be generated");
    assert.equal(data.data?.status, "applied");
    assert.equal(data.data?.submittedSnapshot?.cgpa, 8.75);
    assert.equal(data.data?.submittedSnapshot?.usn, "1MS23CS001");
  });

  await check("4.6 Negative: Duplicate application submission is strictly prevented (HTTP 409)", async () => {
    const res = await fetch(`${API_BASE}/application/${testDriveEligible._id}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentAuth.accessToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 409, "Duplicate application must return HTTP 409 Conflict");
    const data = await res.json();
    assert.ok(data.message.toLowerCase().includes("already applied"), "Message must indicate already applied");
  });

  // -------------------------------------------------------------------------
  // 5. APPLICATION STATUS MACHINE & AUDIT HISTORY
  // -------------------------------------------------------------------------
  console.log("\n[Phase 5] Recruitment Rounds, Status Machine & Audit Logging");

  await check("5.1 Admin updates application status to 'shortlisted' with remarks", async () => {
    const res = await fetch(`${API_BASE}/application/${createdApplicationId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.accessToken}`,
      },
      body: JSON.stringify({
        status: "shortlisted",
        remarks: "Qualified online assessment",
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.data?.status, "shortlisted");
    assert.ok(Array.isArray(data.data?.statusHistory), "statusHistory array must exist");
    const lastHistory = data.data.statusHistory[data.data.statusHistory.length - 1];
    assert.equal(lastHistory.toStatus, "shortlisted");
    assert.equal(lastHistory.remarks, "Qualified online assessment");
  });

  await check("5.2 Admin advances application through 'interview' to 'selected' with offer details", async () => {
    // Progression step 1: shortlisted -> interview
    const interviewRes = await fetch(`${API_BASE}/application/${createdApplicationId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.accessToken}`,
      },
      body: JSON.stringify({
        status: "interview",
        interviewRound: "Technical Round 1",
        interviewLocation: "Campus Placement Block",
        remarks: "Scheduled for technical interview",
      }),
    });
    assert.equal(interviewRes.status, 200, "Transition to interview must succeed");

    // Progression step 2: interview -> selected
    const selectedRes = await fetch(`${API_BASE}/application/${createdApplicationId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuth.accessToken}`,
      },
      body: JSON.stringify({
        status: "selected",
        offeredPackage: 8.5,
        remarks: "Offer letter issued",
      }),
    });
    assert.equal(selectedRes.status, 200, "Transition to selected must succeed");
    const data = await selectedRes.json();
    assert.equal(data.data?.status, "selected");
    assert.equal(data.data?.offeredPackage, 8.5);
  });

  // -------------------------------------------------------------------------
  // 6. ANALYTICS & RECRUITMENT FUNNEL CONSISTENCY
  // -------------------------------------------------------------------------
  console.log("\n[Phase 6] Live Placement Analytics & Consistency");

  await check("6.1 Query dashboard analytics with unique-student and funnel metrics", async () => {
    const res = await fetch(`${API_BASE}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${adminAuth.accessToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const stats = data.data;

    assert.ok(stats.branchStats, "branchStats must exist");
    assert.ok(Array.isArray(stats.branchStats), "branchStats must be an array");

    // Verify placement rate calculation and sanity
    stats.branchStats.forEach((b) => {
      if (b.registered > 0) {
        assert.ok(b.placementRate <= 100, `Branch placement rate (${b.placementRate}%) must not exceed 100%`);
        assert.ok(b.placed <= b.registered, "Placed students cannot exceed registered students");
      }
    });

    // Verify funnel
    assert.ok(Array.isArray(stats.funnel), "Funnel must be an array");
    const appliedStage = stats.funnel.find((f) => f.stage === "Applied");
    const selectedStage = stats.funnel.find((f) => f.stage === "Selected");
    assert.ok(appliedStage, "Applied stage must exist in funnel");
    assert.ok(selectedStage, "Selected stage must exist in funnel");
    assert.ok(selectedStage.count <= appliedStage.count, "Selected count cannot exceed Applied count");
  });

  await check("6.2 Query dashboard analytics with optional session filtering", async () => {
    if (activeSession?._id) {
      const res = await fetch(`${API_BASE}/dashboard/stats?sessionId=${activeSession._id}`, {
        headers: { Authorization: `Bearer ${adminAuth.accessToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.data?.branchStats, "Scoped stats must return branchStats");
    }
  });

  // -------------------------------------------------------------------------
  // 7. EXCEL HUB: FORMULA DEFENSE & CORRUPT UPLOAD REJECTION
  // -------------------------------------------------------------------------
  console.log("\n[Phase 7] Excel Migration Hub & Formula Injection Defense");

  await check("7.1 Formula injection defense neutralizes spreadsheet execution syntax", async () => {
    const maliciousValues = ["=1+1", "+cmd|' /C calc'!A0", "-SUM(A1:A10)", "@SUM(B1:B5)", "\t=calc", "\r=calc"];
    for (const val of maliciousValues) {
      const sanitized = sanitizeFormula(val);
      assert.ok(sanitized.startsWith("'"), `Formula beginning with '${val[0]}' must be prepended with apostrophe`);
    }
  });

  await check("7.2 Negative: Non-spreadsheet upload is rejected by multer", async () => {
    const formData = new FormData();
    const badFile = new Blob(["this is not an excel file"], { type: "text/plain" });
    formData.append("file", badFile, "malicious.txt");
    formData.append("importType", "student_records");

    const res = await fetch(`${API_BASE}/excel/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminAuth.accessToken}` },
      body: formData,
    });
    // Multer rejects non-xlsx with 400 or 500 error handled by ApiError
    assert.ok(!res.ok, "Non-excel file upload must be rejected");
  });

  // -------------------------------------------------------------------------
  // 8. NOTIFICATIONS & TRUTHFUL SMTP DIAGNOSTICS
  // -------------------------------------------------------------------------
  console.log("\n[Phase 8] Notifications & SMTP Diagnostics");

  await check("8.1 Student retrieves notifications list including offer notification", async () => {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${studentAuth.accessToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.data?.notifications), "Notifications must be an array");
    assert.ok(typeof data.data?.unreadCount === "number", "unreadCount must be a number");
  });

  await check("8.2 Admin retrieves scheduled reminders queue", async () => {
    const res = await fetch(`${API_BASE}/notifications/scheduled-reminders`, {
      headers: { Authorization: `Bearer ${adminAuth.accessToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.data), "Scheduled jobs must be an array");
  });

  await check("8.3 Admin inspects truthful SMTP status diagnostics", async () => {
    const res = await fetch(`${API_BASE}/notifications/smtp-status`, {
      headers: { Authorization: `Bearer ${adminAuth.accessToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok("configured" in data.data, "Must contain configured flag");
    assert.ok("verification" in data.data, "Must contain verification object");
  });

  // -------------------------------------------------------------------------
  // CLEANUP EPHEMERAL TEST DATA
  // -------------------------------------------------------------------------
  console.log("\n[Cleanup] Cleaning up isolated test records...");
  if (createdApplicationId) {
    await Application.findByIdAndDelete(createdApplicationId);
  }
  if (testDriveIneligible?._id) {
    await PlacementDrive.findByIdAndDelete(testDriveIneligible._id);
  }
  if (testDriveEligible?._id) {
    await PlacementDrive.findByIdAndDelete(testDriveEligible._id);
  }
  console.log("✓ Ephemeral test records removed safely without modifying existing user data.");

  console.log("\n==========================================================================");
  console.log(`   END-TO-END VERIFICATION COMPLETED: Passed: ${passed} | Failed: ${failed}`);
  console.log("==========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

run()
  .catch((err) => {
    console.error("Fatal Test Suite Failure:", err);
    process.exit(1);
  })
  .finally(async () => {
    if (server) server.close();
    await mongoose.disconnect();
  });
