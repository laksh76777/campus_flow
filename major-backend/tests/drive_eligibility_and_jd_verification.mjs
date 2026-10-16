import assert from "node:assert/strict";
import "../env.js";
import connectDB from "../src/db/index.js";
import { app } from "../src/app.js";
import mongoose from "mongoose";

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
  console.log("=== Drive Eligibility, Paid/Unpaid Internship & JD PDF Verification ===");

  await connectDB();
  server = app.listen(0);
  const port = server.address().port;
  API_BASE = `http://localhost:${port}/api/v1`;
  console.log(`Ephemeral test server running at ${API_BASE}`);

  // 1. Log in as admin
  console.log("1. Logging in as admin...");
  const adminAuth = await login("admin@campusflow.edu", "Admin@12345", "admin");
  assert.ok(adminAuth.accessToken, "Admin should receive an access token");
  console.log("✓ Admin logged in successfully");

  // 2. Fetch companies & active session for drive creation
  console.log("2. Fetching companies and placement sessions for drive creation...");
  const compRes = await fetch(`${API_BASE}/company/all-companies`, {
    headers: { Authorization: `Bearer ${adminAuth.accessToken}` },
  });
  const compData = await compRes.json();
  assert.ok(compRes.ok, "Should fetch companies");
  const companies = compData.data?.companies || compData.data || [];
  assert.ok(companies.length > 0, "At least one company must exist");
  const targetCompany = companies[0];

  const { PlacementSession } = await import("../src/models/placementSession.model.js");
  const activeSession = await PlacementSession.findOne({ isClosed: { $ne: true }, isArchived: { $ne: true } });
  assert.ok(activeSession, "An active placement session must exist");

  // 3. Admin creates a drive with Paid Internship and JD PDF
  console.log("3. Creating test drive with Paid Internship & JD PDF...");
  const drivePayload = {
    company: targetCompany._id,
    jobTitle: `Verification Drive ${Date.now()}`,
    jobDescription: "Exciting internship role with full JD attached.",
    jobType: "Internship",
    package: 6.0,
    location: "Bangalore",
    eligibleBranches: ["Computer Science & Engineering"],
    minimumCGPA: 9.8, // Intentionally very high to test ineligibility
    maximumBacklogs: 0,
    maximumHistoricalBacklogs: 0,
    graduationYear: activeSession.sessionYear,
    placementSession: activeSession._id,
    applicationStartDate: new Date().toISOString(),
    applicationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    driveDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    internshipType: "paid",
    stipend: "45000",
    internshipDuration: "6 Months",
    jdPdfUrl: "https://example.com/sample_job_description.pdf",
    jdPdfName: "Tech_Internship_JD_2026.pdf",
  };

  const createRes = await fetch(`${API_BASE}/placementdrive/create-placement-drive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuth.accessToken}`,
    },
    body: JSON.stringify(drivePayload),
  });

  const createData = await createRes.json();
  assert.ok(createRes.ok, `Drive creation should succeed: ${createData.message}`);
  const createdDrive = createData.data;
  assert.ok(createdDrive._id, "Drive must have an _id");
  assert.equal(createdDrive.internshipType, "paid");
  assert.equal(createdDrive.stipend, "45000");
  assert.equal(createdDrive.internshipDuration, "6 Months");
  assert.equal(createdDrive.jdPdf?.url, "https://example.com/sample_job_description.pdf");
  assert.equal(createdDrive.jdPdf?.fileName, "Tech_Internship_JD_2026.pdf");
  console.log("✓ Drive created with Paid Internship, 45,000 stipend, 6 Months duration, and JD PDF");

  // 4. Log in as student
  console.log("4. Logging in as student (student@campusflow.edu)...");
  const studentAuth = await login("student@campusflow.edu", "Student@12345", "student");
  assert.ok(studentAuth.accessToken, "Student should receive an access token");
  console.log("✓ Student logged in successfully");

  // 5. Student queries drives
  console.log("5. Fetching drives from student perspective...");
  const studentDrivesRes = await fetch(`${API_BASE}/placementdrive/my-eligible-drives`, {
    headers: { Authorization: `Bearer ${studentAuth.accessToken}` },
  });
  const studentDrivesData = await studentDrivesRes.json();
  if (!studentDrivesRes.ok) {
    console.error("Student drives fetch failed with status:", studentDrivesRes.status, studentDrivesData);
  }
  assert.ok(studentDrivesRes.ok, "Student eligible drives fetch must succeed");
  const drives = studentDrivesData.data || [];
  
  const foundTestDrive = drives.find(d => String(d._id) === String(createdDrive._id));
  assert.ok(foundTestDrive, "Created drive MUST be visible to all students (even if ineligible)");
  console.log("✓ Drive is visible to the student in drive list");

  // Verify drive details are populated for student
  assert.equal(foundTestDrive.internshipType, "paid");
  assert.equal(foundTestDrive.stipend, "45000");
  assert.equal(foundTestDrive.internshipDuration, "6 Months");
  assert.equal(foundTestDrive.jdPdf?.url, "https://example.com/sample_job_description.pdf");
  console.log("✓ Drive details (paid/unpaid, stipend, duration, JD PDF) correctly delivered to student");

  // Verify eligibility evaluation attached
  assert.equal(foundTestDrive.isEligible, false, "Student with CGPA < 9.8 should be marked isEligible: false");
  assert.ok(Array.isArray(foundTestDrive.eligibilityReasons), "Should include eligibilityReasons array");
  assert.ok(foundTestDrive.eligibilityReasons.length > 0, "Must contain explanatory reason for ineligibility");
  console.log("✓ Ineligibility evaluated correctly. Ineligibility reasons:", foundTestDrive.eligibilityReasons);

  // 6. Student attempts to apply to ineligible drive
  console.log("6. Verifying student cannot apply to ineligible drive...");
  const applyRes = await fetch(`${API_BASE}/application/${createdDrive._id}/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentAuth.accessToken}`,
    },
    body: JSON.stringify({}),
  });

  const applyData = await applyRes.json();
  assert.equal(applyRes.ok, false, "Application to ineligible drive should be rejected");
  assert.ok(
    applyData.message?.toLowerCase().includes("not eligible") ||
    applyData.message?.toLowerCase().includes("cgpa") ||
    applyData.message?.toLowerCase().includes("criteria"),
    `Rejection message should explain criteria: ${applyData.message}`
  );
  console.log("✓ Application correctly prevented with note:", applyData.message);

  // 7. Student checks notifications
  console.log("7. Checking notifications endpoint for student...");
  const notifRes = await fetch(`${API_BASE}/notifications`, {
    headers: { Authorization: `Bearer ${studentAuth.accessToken}` },
  });
  const notifData = await notifRes.json();
  assert.ok(notifRes.ok, "Fetch notifications should succeed");
  assert.ok(Array.isArray(notifData.data?.notifications), "Notifications should be an array");
  console.log(`✓ Fetched ${notifData.data.notifications.length} notifications; unread: ${notifData.data.unreadCount}`);

  // Clean up created test drive
  console.log("8. Cleaning up test drive...");
  await fetch(`${API_BASE}/placementdrive/${createdDrive._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminAuth.accessToken}` },
  });
  console.log("✓ Test drive cleaned up");

  console.log("\n>>> ALL DRIVE ELIGIBILITY, PAID/UNPAID INTERNSHIP & NOTIFICATION TESTS PASSED <<<");
}

run()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) server.close();
    await mongoose.disconnect();
  });
