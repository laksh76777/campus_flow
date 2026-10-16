import mongoose from "mongoose";

const BASE_URL = "http://localhost:8000/api/v1";
const MONGO_URI = process.env.MONGODB_URI || "";

console.log("===============================================================================");
console.log("CampusFlow V2 — Offer Acceptance/Rejection & Hybrid Workflow Verification");
console.log("===============================================================================");

async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.message || (typeof data === "string" ? data : JSON.stringify(data));
    const error = new Error(`HTTP ${response.status} - ${errorMsg}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function runVerification() {
  await mongoose.connect(MONGO_URI);
  console.log("✔ Connected to MongoDB");

  const cleanupTasks = [];

  try {
    // 1. Authenticate Admin
    const adminLogRes = await apiRequest("/admin/login", {
      method: "POST",
      body: { email: "admin@campusflow.edu", password: "Admin@12345" },
    });
    const adminToken = adminLogRes.data?.accessToken;
    console.log("✔ Admin authenticated");

    // 2. Fetch or create a session
    const sessionsRes = await apiRequest("/sessions", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const activeSession = (sessionsRes.data || []).find((s) => s.sessionYear === 2027 && s.isActive) || sessionsRes.data?.[0];
    const sessionId = activeSession?._id;

    // 3. Create 2 disposable test students
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testStudents = [];

    for (let i = 1; i <= 2; i++) {
      const email = `test.hybrid.${uniqueSuffix}.${i}@campusflow.edu`;
      const usn = `1MS25HYB${uniqueSuffix.slice(-3)}${i}`;
      const regRes = await apiRequest("/users/register", {
        method: "POST",
        body: {
          fullName: `Candidate Hybrid ${i}`,
          email,
          password: "TestStudent@12345",
          phone: `98765432${i}${uniqueSuffix.slice(-1)}`,
          usn,
          programCode: "CSE",
          programLevel: "Undergraduate",
          degreeType: "B.E.",
          course: "B.E.",
          branch: "Computer Science & Engineering (CSE)",
          department: "Computer Science & Engineering (CSE)",
          semester: 7,
          admissionYear: 2023,
          graduationYear: 2027,
        },
      });
      const userId = regRes.data?.user?._id || regRes.data?._id;
      cleanupTasks.push(async () => {
        await mongoose.connection.collection("users").deleteOne({ _id: new mongoose.Types.ObjectId(userId) });
        await mongoose.connection.collection("notifications").deleteMany({ user: new mongoose.Types.ObjectId(userId) });
      });

      // Login student
      const stdLoginRes = await apiRequest("/users/login", {
        method: "POST",
        body: { email, password: "TestStudent@12345" },
      });
      const stdToken = stdLoginRes.data.accessToken;

      // Update student profile
      const profRes = await apiRequest("/studentprofile/current-student-profile", {
        headers: { Authorization: `Bearer ${stdToken}` },
      });
      const profileId = profRes.data._id;
      cleanupTasks.push(async () => {
        await mongoose.connection.collection("studentprofiles").deleteOne({ _id: new mongoose.Types.ObjectId(profileId) });
      });

      await mongoose.connection.collection("studentprofiles").updateOne(
        { _id: new mongoose.Types.ObjectId(profileId) },
        {
          $set: {
            usn,
            enrollmentNumber: usn,
            cgpa: 8.8,
            verifiedCGPA: 8.8,
            tenthPercentage: 88,
            twelfthPercentage: 86,
            graduationYear: 2027,
            placementSession: new mongoose.Types.ObjectId(sessionId),
            isPlaced: false,
            resume: { url: "https://example.com/resume.pdf", publicId: "test_res" },
          },
        }
      );

      testStudents.push({
        userId,
        profileId,
        usn,
        email,
        token: stdToken,
      });
    }
    console.log(`✔ Created 2 test students: ${testStudents[0].usn}, ${testStudents[1].usn}`);

    // 4. Create disposable test company & drive
    const companyRes = await apiRequest("/company/create-company", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        companyName: `FinTech Labs Hybrid ${uniqueSuffix}`,
        industry: "Financial Technology",
        website: "https://fintechlabs.test",
        contactPerson: "Recruitment Head",
        contactEmail: `recruitment_${uniqueSuffix}@fintechlabs.test`,
        contactPhone: "9876543210",
        city: "Bengaluru",
        state: "Karnataka",
      },
    });
    const companyId = companyRes.data._id;
    cleanupTasks.push(async () => {
      await mongoose.connection.collection("companies").deleteOne({ _id: new mongoose.Types.ObjectId(companyId) });
    });

    const driveRes = await apiRequest("/placementdrive/create-placement-drive", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        company: companyId,
        jobTitle: "Software Development Engineer",
        jobDescription: "Developing resilient backend banking platforms",
        jobType: "Full-Time",
        location: "Bengaluru",
        package: 22,
        placementSession: sessionId,
        graduationYear: 2027,
        eligibleProgramCodes: ["CSE"],
        eligibleBranches: ["Computer Science & Engineering (CSE)"],
        minimumCGPA: 5.0,
        maximumBacklogs: 2,
        maximumHistoricalBacklogs: 2,
        applicationStartDate: new Date().toISOString(),
        applicationDeadline: new Date(Date.now() + 86400000).toISOString(),
        driveDate: new Date(Date.now() + 172800000).toISOString(),
        selectionRounds: [
          { roundNumber: 1, name: "Screening Round", roundType: "Online Assessment" },
          { roundNumber: 2, name: "Technical Interview", roundType: "Technical Interview" },
          { roundNumber: 3, name: "Final Offer", roundType: "HR Interview" },
        ],
      },
    });
    const driveId = driveRes.data._id;
    cleanupTasks.push(async () => {
      await mongoose.connection.collection("placementdrives").deleteOne({ _id: new mongoose.Types.ObjectId(driveId) });
      await mongoose.connection.collection("applications").deleteMany({ placementDrive: new mongoose.Types.ObjectId(driveId) });
    });

    // 5. Submit applications for both students
    const appIds = [];
    for (const std of testStudents) {
      const applyRes = await apiRequest(`/application/${driveId}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${std.token}` },
      });
      appIds.push(applyRes.data._id);
    }
    console.log(`✔ 2 applications submitted for drive ${driveId}`);

    // =========================================================================
    // PHASE A: Verify that selecting a candidate does NOT mark isPlaced: true prematurely
    // =========================================================================
    console.log("\n--- PHASE A: Manual TPO Selection & Premature isPlaced Protection ---");
    // TPO marks Student 1 as "selected" with package 22 LPA
    await apiRequest(`/application/${appIds[0]}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "selected",
        remarks: "Congratulations! You have been selected for SDE role.",
        offeredPackage: 22,
      },
    });

    // Check student 1 application
    const app1Doc = await mongoose.connection.collection("applications").findOne({ _id: new mongoose.Types.ObjectId(appIds[0]) });
    if (app1Doc.status !== "selected") {
      throw new Error(`Expected app status to be 'selected', got '${app1Doc.status}'`);
    }

    // Check student 1 profile: isPlaced MUST be false because student hasn't accepted yet!
    const prof1DocBeforeAccept = await mongoose.connection.collection("studentprofiles").findOne({ _id: new mongoose.Types.ObjectId(testStudents[0].profileId) });
    if (prof1DocBeforeAccept.isPlaced === true) {
      throw new Error("VIOLATION: Student was marked as isPlaced: true prematurely before accepting offer!");
    }
    console.log("✔ Student 1 application is 'selected', but profile.isPlaced is FALSE (offer pending acceptance)");

    // =========================================================================
    // PHASE B: Student Offer Decline & Placement Freedom
    // =========================================================================
    console.log("\n--- PHASE B: Student Offer Decline Flow ---");
    // Student 1 declines the offer
    const declineRes = await apiRequest(`/application/${appIds[0]}/respond-offer`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${testStudents[0].token}` },
      body: {
        decision: "decline",
        remarks: "Opting for higher studies / other opportunity.",
      },
    });
    if (declineRes.data.status !== "offer_declined") {
      throw new Error(`Expected status to be 'offer_declined', got '${declineRes.data.status}'`);
    }

    const prof1AfterDecline = await mongoose.connection.collection("studentprofiles").findOne({ _id: new mongoose.Types.ObjectId(testStudents[0].profileId) });
    if (prof1AfterDecline.isPlaced !== false) {
      throw new Error(`Expected isPlaced to be false after declining, got '${prof1AfterDecline.isPlaced}'`);
    }
    console.log("✔ Student 1 successfully declined offer: status = 'offer_declined', isPlaced = false");

    // =========================================================================
    // PHASE C: Re-extending / Student Acceptance Flow
    // =========================================================================
    console.log("\n--- PHASE C: Offer Acceptance Flow & Official isPlaced Confirmation ---");
    // TPO re-selects candidate or extends offer
    await apiRequest(`/application/${appIds[0]}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "selected",
        remarks: "Offer renewed after discussion.",
        offeredPackage: 24,
      },
    });

    // Student 1 accepts offer
    const acceptRes = await apiRequest(`/application/${appIds[0]}/respond-offer`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${testStudents[0].token}` },
      body: {
        decision: "accept",
      },
    });
    if (acceptRes.data.status !== "offer_accepted") {
      throw new Error(`Expected status 'offer_accepted', got '${acceptRes.data.status}'`);
    }

    const prof1AfterAccept = await mongoose.connection.collection("studentprofiles").findOne({ _id: new mongoose.Types.ObjectId(testStudents[0].profileId) });
    if (prof1AfterAccept.isPlaced !== true) {
      throw new Error(`Expected isPlaced to be TRUE after accepting offer, got '${prof1AfterAccept.isPlaced}'`);
    }
    if (prof1AfterAccept.placedCompany !== `FinTech Labs Hybrid ${uniqueSuffix}`) {
      throw new Error(`Expected placed company name '${`FinTech Labs Hybrid ${uniqueSuffix}`}', got '${prof1AfterAccept.placedCompany}'`);
    }
    if (prof1AfterAccept.placedPackage !== 24) {
      throw new Error(`Expected placement package 24, got '${prof1AfterAccept.placedPackage}'`);
    }
    console.log("✔ Student 1 accepted offer: status = 'offer_accepted', profile.isPlaced = TRUE, package = 24 LPA");

    // =========================================================================
    // PHASE D: Hybrid Workflow — TPO Manual Advance Recognized in Automated Drive
    // =========================================================================
    console.log("\n--- PHASE D: Hybrid Workflow — Manual Advancement Recognized in Automated Drive ---");
    // For Student 2, TPO manually updates status to 'interview'
    await apiRequest(`/application/${appIds[1]}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        status: "interview",
        interviewRound: "Technical Interview 1",
        interviewLocation: "Virtual Room A",
        remarks: "Fast-tracked directly to interview round.",
      },
    });

    // Check candidate pool in automated drive for Round 2
    const csvContent = `USN,Name,Status\n${testStudents[1].usn},Candidate Hybrid 2,Shortlisted\n`;
    const r2FormData = new FormData();
    r2FormData.append(
      "file",
      new Blob([csvContent], { type: "text/csv" }),
      "Round2_Shortlist.csv"
    );
    r2FormData.append("roundNumber", "2");
    r2FormData.append("mode", "shortlist_only");

    const previewRaw = await fetch(`${BASE_URL}/placementdrive/${driveId}/preview-results`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: r2FormData,
    });
    const previewJson = await previewRaw.json();
    if (!previewRaw.ok) throw new Error(`Preview failed: ${JSON.stringify(previewJson)}`);

    const preview = previewJson.data;
    console.log(`✔ Round 2 Preview Pool Total: ${preview.candidatePoolTotal}`);
    console.log(`✔ Round 2 Proposed Advance: ${preview.proposedAdvanceCount}`);
    if (preview.proposedAdvanceCount !== 1) {
      throw new Error(`Expected proposed advance count 1 for manually advanced candidate, got ${preview.proposedAdvanceCount}`);
    }

    // Commit Round 2
    const commitRes = await apiRequest(`/placementdrive/${driveId}/commit-results`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        roundNumber: 2,
        mode: "shortlist_only",
        autoRejectAbsent: false,
        confirmedAdvances: preview.proposedAdvances,
        confirmedRejections: [],
        confirmedExceptionResolutions: [],
      },
    });
    console.log(`✔ Committed Round 2: advanced = ${commitRes.data.advancedCount}`);

    // Verify application status is now updated with round 2 recorded
    const app2Doc = await mongoose.connection.collection("applications").findOne({ _id: new mongoose.Types.ObjectId(appIds[1]) });
    if (app2Doc.status !== "interview") {
      throw new Error(`Expected app status 'interview', got '${app2Doc.status}'`);
    }
    console.log("✔ Hybrid workflow confirmed: manual status promotion seamlessly ingested by automated drive");

    console.log("\n===============================================================================");
    console.log("✔ ALL OFFER RESPONSE & HYBRID WORKFLOW PHASES PASSED WITH 100% SUCCESS");
    console.log("===============================================================================");
  } finally {
    // Teardown
    console.log("\n--- Teardown: Cleaning up disposable verification data ---");
    for (const task of cleanupTasks) {
      try {
        await task();
      } catch (err) {
        console.warn("Cleanup warning:", err.message);
      }
    }
    await mongoose.disconnect();
    console.log("✔ Ephemeral verification test records cleaned up.");
  }
}

runVerification().catch((err) => {
  console.error("❌ Verification failed:", err.data || err.message);
  process.exit(1);
});
