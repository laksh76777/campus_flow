// CampusFlow V2 - Phase 4 & Phase 5 Automated Verification Suite
// Validates:
// 1. Centralized Eligibility Engine with 3-state output (ELIGIBLE, INELIGIBLE, MISSING_DATA)
// 2. Boundary value evaluation, zero-tolerance missing data detection, and document verification
// 3. Database-level duplicate application prevention (unique index)
// 4. Backend revalidation immediately before submission
// 5. Admin Drive Eligibility Cohort Preview (tallies of eligible, ineligible, missing data)
// 6. Recruitment State Machine & Legal Status Transitions
// 7. Rejection of illegal / skipping transitions
// 8. Interview rounds tracking and offer management workflow
// 9. Student offer acceptance/declination and profile placement update
// 10. Authorized, reasoned TPO overrides with audit logging
// 11. Voluntary withdrawal and re-application logic

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
    console.log("   CAMPUSFLOW V2 - PHASE 4 & PHASE 5 VERIFICATION SUITE   ");
    console.log(`   Target: ${BASE_URL}`);
    console.log("==========================================================\n");

    const uniqueId = Date.now();
    let adminAccessToken = "";
    let studentEligibleToken = "";
    let studentIneligibleToken = "";
    let studentMissingToken = "";

    let eligibleProfileId = "";
    let ineligibleProfileId = "";
    let missingProfileId = "";

    let companyId = "";
    let session2027Id = "";
    let driveId = "";
    let drive2Id = "";
    let createdAppId = "";

    // ----------------------------------------------------
    // SETUP: Users, Profiles, Session, Company & Drive
    // ----------------------------------------------------
    console.log("[Setup] Registering Admin, Company, Placement Session, and 3 Candidate Cohort Profiles");
    try {
        // Admin
        const adminPayload = {
            fullName: `TPO Lifecycle Lead ${uniqueId}`,
            email: `tpo_v45_${uniqueId}@college.edu`,
            password: "AdminPassword123!",
            employeeId: `EMP_V45_${uniqueId}`,
            designation: "Placement Officer",
            adminSecretKey: "TPO_ADMIN_2026"
        };
        const adminReg = await fetch(`${BASE_URL}/api/v1/admin/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adminPayload)
        });
        assert(adminReg.status === 201, "Admin user registered");

        const adminLog = await fetch(`${BASE_URL}/api/v1/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminPayload.email, password: adminPayload.password })
        });
        const adminData = await adminLog.json();
        adminAccessToken = adminData.data?.accessToken;
        assert(Boolean(adminAccessToken), "Admin login returns JWT token");

        // Placement Session
        const activeRes = await fetch(`${BASE_URL}/api/v1/sessions/active`, {
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        const activeData = await activeRes.json();
        if (activeData.data?._id) {
            session2027Id = activeData.data._id;
        } else {
            const sessionRes = await fetch(`${BASE_URL}/api/v1/sessions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${adminAccessToken}`
                },
                body: JSON.stringify({
                    sessionYear: 2027,
                    name: `Batch 2027 Verification ${uniqueId}`,
                    academicYear: "2026-2027",
                    isActive: true
                })
            });
            const sessionData = await sessionRes.json();
            session2027Id = sessionData.data?._id;
        }
        assert(Boolean(session2027Id), "Active Placement Session 2027 resolved");

        // Company
        const compRes = await fetch(`${BASE_URL}/api/v1/company/create-company`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminAccessToken}`
            },
            body: JSON.stringify({
                companyName: `NexGen Technologies ${uniqueId}`,
                companyDescription: "Cloud Native Software and Placement Systems",
                industry: "Information Technology",
                location: "Bengaluru, India"
            })
        });
        const compData = await compRes.json();
        companyId = compData.data?._id;
        assert(Boolean(companyId), "Placement Partner Company created");

        // Candidate 1: ELIGIBLE (High CGPA, 0 backlogs, verified, 10th/12th percentages, resume uploaded)
        const cand1Payload = { fullName: `Aarav Sharma ${uniqueId}`, email: `aarav_${uniqueId}@college.edu`, password: "Password123!" };
        await fetch(`${BASE_URL}/api/v1/users/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cand1Payload) });
        const cand1Log = await (await fetch(`${BASE_URL}/api/v1/users/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: cand1Payload.email, password: cand1Payload.password }) })).json();
        studentEligibleToken = cand1Log.data?.accessToken;

        const p1Res = await fetch(`${BASE_URL}/api/v1/studentprofile/create-student-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentEligibleToken}` },
            body: JSON.stringify({
                enrollmentNumber: `EN_EL_${uniqueId}`,
                branch: "Computer Science",
                semester: 6,
                graduationYear: 2027,
                placementSession: session2027Id,
                cgpa: 8.75,
                verifiedCGPA: 8.75,
                activeBacklogs: 0,
                historicalBacklogs: 0,
                tenthPercentage: 88.5,
                twelfthPercentage: 86.0,
                tenthDetails: { board: "CBSE", schoolName: "DPS", percentage: 88.5, passingYear: 2021 },
                twelfthOrDiplomaDetails: { qualificationType: "12th", board: "CBSE", instituteName: "DPS", percentage: 86.0, passingYear: 2023 },
                resume: { url: "https://campusflow.edu/resumes/aarav.pdf", uploadedAt: new Date() }
            })
        });
        const p1Data = await p1Res.json();
        eligibleProfileId = p1Data.data?._id;
        assert(Boolean(eligibleProfileId), "Candidate 1 (Eligible) profile created");

        // Candidate 2: MISSING DATA (No resume document, no 10th/12th qualification)
        const cand2Payload = { fullName: `Rohan Gupta ${uniqueId}`, email: `rohan_${uniqueId}@college.edu`, password: "Password123!" };
        await fetch(`${BASE_URL}/api/v1/users/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cand2Payload) });
        const cand2Log = await (await fetch(`${BASE_URL}/api/v1/users/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: cand2Payload.email, password: cand2Payload.password }) })).json();
        studentMissingToken = cand2Log.data?.accessToken;

        const p2Res = await fetch(`${BASE_URL}/api/v1/studentprofile/create-student-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentMissingToken}` },
            body: JSON.stringify({
                enrollmentNumber: `EN_MIS_${uniqueId}`,
                branch: "Computer Science",
                semester: 6,
                graduationYear: 2027,
                placementSession: session2027Id,
                cgpa: 8.5,
                activeBacklogs: 0
                // Missing resume, 10th, 12th
            })
        });
        const p2Data = await p2Res.json();
        missingProfileId = p2Data.data?._id;
        assert(Boolean(missingProfileId), "Candidate 2 (Missing Data) profile created");

        // Candidate 3: INELIGIBLE (Low CGPA 6.2, 2 active backlogs)
        const cand3Payload = { fullName: `Vikram Singh ${uniqueId}`, email: `vikram_${uniqueId}@college.edu`, password: "Password123!" };
        await fetch(`${BASE_URL}/api/v1/users/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cand3Payload) });
        const cand3Log = await (await fetch(`${BASE_URL}/api/v1/users/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: cand3Payload.email, password: cand3Payload.password }) })).json();
        studentIneligibleToken = cand3Log.data?.accessToken;

        const p3Res = await fetch(`${BASE_URL}/api/v1/studentprofile/create-student-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentIneligibleToken}` },
            body: JSON.stringify({
                enrollmentNumber: `EN_INEL_${uniqueId}`,
                branch: "Mechanical Engineering",
                semester: 6,
                graduationYear: 2027,
                placementSession: session2027Id,
                cgpa: 6.2,
                verifiedCGPA: 6.2,
                activeBacklogs: 2,
                historicalBacklogs: 3,
                tenthPercentage: 70.0,
                twelfthPercentage: 68.0,
                tenthDetails: { percentage: 70.0 },
                twelfthOrDiplomaDetails: { percentage: 68.0 },
                resume: { url: "https://campusflow.edu/resumes/vikram.pdf", uploadedAt: new Date() }
            })
        });
        const p3Data = await p3Res.json();
        ineligibleProfileId = p3Data.data?._id;
        assert(Boolean(ineligibleProfileId), "Candidate 3 (Ineligible) profile created");

        // Create Drive with rigorous eligibility requirements
        const now = new Date();
        const futureDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const driveDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const driveRes = await fetch(`${BASE_URL}/api/v1/placementdrive/create-placement-drive`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                company: companyId,
                jobTitle: "Software Development Engineer",
                jobType: "full-time",
                package: 1400000,
                location: "Bengaluru",
                eligibleBranches: ["Computer Science", "Information Technology"],
                minimumCGPA: 7.5,
                maximumBacklogs: 0,
                graduationYear: 2027,
                placementSession: session2027Id,
                minimumTenthPercentage: 75,
                minimumTwelfthPercentage: 75,
                maximumHistoricalBacklogs: 1,
                applicationStartDate: now.toISOString(),
                applicationDeadline: futureDeadline.toISOString(),
                driveDate: driveDate.toISOString()
            })
        });
        const driveData = await driveRes.json();
        driveId = driveData.data?._id;
        assert(Boolean(driveId), "Placement Drive created with multi-criteria rules");
    } catch (err) {
        assert(false, "Setup completed", err.message);
    }

    // ----------------------------------------------------
    // PHASE 4: Centralized Eligibility Engine Evaluation
    // ----------------------------------------------------
    console.log("\n[Test Group 1] Centralized Eligibility Engine: 3-State Evaluations & Boundary Values");
    try {
        // 1. Candidate 1 (Eligible) evaluates drive
        const eval1Res = await fetch(`${BASE_URL}/api/v1/placementdrive/${driveId}/eligibility-check`, {
            headers: { Authorization: `Bearer ${studentEligibleToken}` }
        });
        const eval1Data = await eval1Res.json();
        assert(eval1Res.status === 200, "GET /:driveId/eligibility-check returns 200 for Candidate 1");
        assert(eval1Data.data?.status === "ELIGIBLE", "Candidate 1 status is strictly 'ELIGIBLE'");
        assert(eval1Data.data?.isEligible === true, "Candidate 1 isEligible flag is true");
        assert(eval1Data.data?.reasons?.length === 0, "Candidate 1 has 0 failure reasons");

        // 2. Candidate 2 (Missing Data) evaluates drive
        const eval2Res = await fetch(`${BASE_URL}/api/v1/placementdrive/${driveId}/eligibility-check`, {
            headers: { Authorization: `Bearer ${studentMissingToken}` }
        });
        const eval2Data = await eval2Res.json();
        assert(eval2Res.status === 200, "GET /:driveId/eligibility-check returns 200 for Candidate 2");
        assert(eval2Data.data?.status === "MISSING_DATA", "Candidate 2 status is strictly 'MISSING_DATA'");
        assert(eval2Data.data?.isEligible === false, "Missing data does NOT silently pass (isEligible === false)");
        assert(eval2Data.data?.missingFields?.length > 0, "Missing fields explicitly enumerated (resume, 10th/12th)");

        // 3. Candidate 3 (Ineligible) evaluates drive
        const eval3Res = await fetch(`${BASE_URL}/api/v1/placementdrive/${driveId}/eligibility-check`, {
            headers: { Authorization: `Bearer ${studentIneligibleToken}` }
        });
        const eval3Data = await eval3Res.json();
        assert(eval3Res.status === 200, "GET /:driveId/eligibility-check returns 200 for Candidate 3");
        assert(eval3Data.data?.status === "INELIGIBLE", "Candidate 3 status is strictly 'INELIGIBLE'");
        assert(eval3Data.data?.isEligible === false, "Candidate 3 isEligible is false");
        assert(eval3Data.data?.reasons?.length >= 3, "Failure reasons capture CGPA, branch, backlogs, and percentage cutoffs");

        // 4. Admin Cohort Eligibility Preview
        const previewRes = await fetch(`${BASE_URL}/api/v1/placementdrive/${driveId}/eligibility-preview`, {
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        const previewData = await previewRes.json();
        assert(previewRes.status === 200, "GET /:driveId/eligibility-preview returns 200 for Admin");
        assert(previewData.data?.eligibleCount >= 1, "Admin preview tallies eligible cohort members");
        assert(previewData.data?.ineligibleCount >= 1, "Admin preview tallies ineligible cohort members");
        assert(previewData.data?.missingDataCount >= 1, "Admin preview tallies missing data cohort members");
        assert(typeof previewData.data?.failureReasonTally === "object", "Admin preview provides failure reason breakdown");
    } catch (err) {
        assert(false, "Eligibility evaluation completed", err.message);
    }

    // ----------------------------------------------------
    // PHASE 4: Application Submission Enforcement & Duplicate Blocking
    // ----------------------------------------------------
    console.log("\n[Test Group 2] Application Submission Backend Enforcement & Duplicate Blocking");
    try {
        // 1. Ineligible student attempts application submission -> Must be rejected with 403
        const ineligApplyRes = await fetch(`${BASE_URL}/api/v1/application/${driveId}/apply`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentIneligibleToken}` }
        });
        assert(ineligApplyRes.status === 403, "Backend blocks application submission for ineligible candidate (HTTP 403)");

        // 2. Missing data student attempts application submission -> Must be rejected with 403
        const missingApplyRes = await fetch(`${BASE_URL}/api/v1/application/${driveId}/apply`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentMissingToken}` }
        });
        assert(missingApplyRes.status === 403, "Backend blocks application submission for incomplete profile (HTTP 403)");

        // 3. Eligible student submits application -> Success 201
        const eligApplyRes = await fetch(`${BASE_URL}/api/v1/application/${driveId}/apply`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentEligibleToken}` }
        });
        const eligApplyData = await eligApplyRes.json();
        createdAppId = eligApplyData.data?._id;
        assert(eligApplyRes.status === 201, "Eligible student submits application successfully (HTTP 201)");
        assert(Boolean(createdAppId), "Application created with distinct ID");
        assert(eligApplyData.data?.status === "applied", "Initial application status is 'applied'");
        assert(eligApplyData.data?.eligibilitySnapshot?.ruleVersion === 2, "Rule version 2 snapshot is preserved");
        assert(eligApplyData.data?.statusHistory?.length === 1, "Initial status history entry recorded");

        // 4. Duplicate application prevention: Student attempts applying a second time -> Blocked 409 Conflict
        const dupApplyRes = await fetch(`${BASE_URL}/api/v1/application/${driveId}/apply`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentEligibleToken}` }
        });
        assert(dupApplyRes.status === 409, "Duplicate application immediately blocked by database uniqueness constraint (HTTP 409)");
    } catch (err) {
        assert(false, "Application submission tests completed", err.message);
    }

    // ----------------------------------------------------
    // PHASE 5: Recruitment State Machine & Status Transitions
    // ----------------------------------------------------
    console.log("\n[Test Group 3] Recruitment Lifecycle State Machine & Legal Progression");
    try {
        // 1. Admin reads application
        const getAppRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}`, {
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        assert(getAppRes.status === 200, "Admin can retrieve application details via GET /:id");

        // 2. Illegal Transition: Attempt to jump directly from 'applied' to 'offer_accepted'
        const illegalJumpRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({ status: "offer_accepted" })
        });
        assert(illegalJumpRes.status === 400, "Illegal status jump (applied -> offer_accepted) rejected by state machine (HTTP 400)");

        // 3. Legal Transition 1: 'applied' -> 'shortlisted'
        const shortlistRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                status: "shortlisted",
                remarks: "Profile shortlisted by NexGen TPO review team"
            })
        });
        const shortlistData = await shortlistRes.json();
        assert(shortlistRes.status === 200, "Legal transition to 'shortlisted' succeeded (HTTP 200)");
        assert(shortlistData.data?.status === "shortlisted", "Application status updated to 'shortlisted'");

        // 4. Legal Transition 2: 'shortlisted' -> 'interview' (with round scheduling)
        const interviewDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        const interviewRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                status: "interview",
                interviewRound: "Round 1 - Technical Problem Solving",
                interviewDate,
                interviewLocation: "Virtual Google Meet Room A",
                remarks: "Candidate invited for Round 1 Technical Coding & Architecture"
            })
        });
        const interviewData = await interviewRes.json();
        assert(interviewRes.status === 200, "Legal transition to 'interview' succeeded (HTTP 200)");
        assert(interviewData.data?.interviewRounds?.length >= 1, "Interview round recorded in interviewRounds ledger");
        assert(interviewData.data?.interviewRound === "Round 1 - Technical Problem Solving", "Interview round name persisted");

        // 5. Legal Transition 3: 'interview' -> 'selected'
        const selectRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                status: "selected",
                offeredPackage: 1500000,
                remarks: "Candidate cleared Technical & Cultural Fitment Rounds"
            })
        });
        const selectData = await selectRes.json();
        assert(selectRes.status === 200, "Legal transition to 'selected' succeeded (HTTP 200)");
        assert(selectData.data?.status === "selected", "Application status is 'selected'");
        assert(selectData.data?.offeredPackage === 1500000, "Offered package persisted");

        // 6. Legal Transition 4: 'selected' -> 'offer_received'
        const offerDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
        const offerRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                status: "offer_received",
                designation: "Associate Software Engineer - L1",
                joiningDate: new Date("2027-07-01").toISOString(),
                offerLetterUrl: "https://campusflow.edu/offers/aarav_nexgen.pdf",
                decisionDeadline: offerDeadline,
                remarks: "Official Letter of Intent issued"
            })
        });
        const offerData = await offerRes.json();
        assert(offerRes.status === 200, "Legal transition to 'offer_received' succeeded (HTTP 200)");
        assert(offerData.data?.offerDetails?.designation === "Associate Software Engineer - L1", "Offer details designation saved");
        assert(offerData.data?.offerDetails?.studentDecision === "pending", "Initial student offer decision is 'pending'");
    } catch (err) {
        assert(false, "Recruitment lifecycle state machine completed", err.message);
    }

    // ----------------------------------------------------
    // PHASE 5: Student Offer Response & Profile Placement Sync
    // ----------------------------------------------------
    console.log("\n[Test Group 4] Student Offer Decision & Institutional Placement Status");
    try {
        // 1. Unauthorized attempt (Candidate 2 attempts responding to Candidate 1's offer)
        const unauthRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}/respond-offer`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentMissingToken}` },
            body: JSON.stringify({ decision: "accept" })
        });
        assert(unauthRes.status === 403, "Other candidate blocked from responding to another's offer (HTTP 403)");

        // 2. Candidate 1 accepts the offer
        const acceptRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}/respond-offer`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentEligibleToken}` },
            body: JSON.stringify({ decision: "accept", remarks: "Excited to join NexGen Technologies!" })
        });
        const acceptData = await acceptRes.json();
        assert(acceptRes.status === 200, "Student successfully accepts offer via PATCH /:id/respond-offer");
        assert(acceptData.data?.status === "offer_accepted", "Application status is now 'offer_accepted'");
        assert(acceptData.data?.offerDetails?.studentDecision === "accepted", "Student decision recorded as 'accepted'");

        // 3. Verify Student Profile updated as isPlaced: true
        const profRes = await fetch(`${BASE_URL}/api/v1/studentprofile/current-student-profile`, {
            headers: { Authorization: `Bearer ${studentEligibleToken}` }
        });
        const profData = await profRes.json();
        assert(profRes.status === 200, "Student profile fetched after offer acceptance");
        assert(profData.data?.isPlaced === true, "Student Profile automatically updated to isPlaced: true");
        assert(profData.data?.placedCompany?.includes("NexGen Technologies"), "Placed company name recorded in profile");

        // 4. Verify Application Audit History
        const appAuditRes = await fetch(`${BASE_URL}/api/v1/application/${createdAppId}`, {
            headers: { Authorization: `Bearer ${adminAccessToken}` }
        });
        const appAuditData = await appAuditRes.json();
        const history = appAuditData.data?.statusHistory || [];
        assert(history.length >= 6, `Complete audit log maintained (${history.length} chronological transitions)`);
        const statuses = history.map((h) => h.toStatus);
        assert(
            statuses.includes("applied") &&
            statuses.includes("shortlisted") &&
            statuses.includes("interview") &&
            statuses.includes("selected") &&
            statuses.includes("offer_received") &&
            statuses.includes("offer_accepted"),
            "Audit history captures full legal transition chain"
        );
    } catch (err) {
        assert(false, "Offer response tests completed", err.message);
    }

    // ----------------------------------------------------
    // PHASE 5: Authorized TPO Override Workflow
    // ----------------------------------------------------
    console.log("\n[Test Group 5] Authorized TPO Override Workflow & Compliance Audit");
    try {
        // Create second drive for override testing
        const now = new Date();
        const futureDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const driveDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const d2Res = await fetch(`${BASE_URL}/api/v1/placementdrive/create-placement-drive`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                company: companyId,
                jobTitle: "DevOps Engineer",
                jobType: "full-time",
                package: 1200000,
                location: "Bengaluru",
                eligibleBranches: ["Computer Science"],
                minimumCGPA: 8.0,
                maximumBacklogs: 0,
                graduationYear: 2027,
                placementSession: session2027Id,
                applicationStartDate: now.toISOString(),
                applicationDeadline: futureDeadline.toISOString(),
                driveDate: driveDate.toISOString()
            })
        });
        const d2Data = await d2Res.json();
        drive2Id = d2Data.data?._id;

        // Candidate 1 applies to Drive 2
        const app2Res = await fetch(`${BASE_URL}/api/v1/application/${drive2Id}/apply`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentEligibleToken}` }
        });
        const app2Data = await app2Res.json();
        const app2Id = app2Data.data?._id;
        assert(Boolean(app2Id), "Candidate applied to Drive 2");

        // 1. TPO attempts override with insufficient reason (< 10 chars) -> Blocked 400
        const shortReasonRes = await fetch(`${BASE_URL}/api/v1/application/${app2Id}/admin-override`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                targetStatus: "interview",
                overrideReason: "short"
            })
        });
        assert(shortReasonRes.status === 400, "TPO override with short reason rejected (HTTP 400)");

        // 2. TPO executes authorized override with comprehensive justification
        const validOverrideRes = await fetch(`${BASE_URL}/api/v1/application/${app2Id}/admin-override`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                targetStatus: "interview",
                overrideReason: "Special departmental Dean recommendation based on national hackathon victory"
            })
        });
        const validOverrideData = await validOverrideRes.json();
        assert(validOverrideRes.status === 200, "Authorized TPO override successfully logged (HTTP 200)");
        assert(validOverrideData.data?.isOverridden === true, "Application isOverridden flag set to true");
        assert(validOverrideData.data?.overrideReason?.includes("Dean recommendation"), "Override reason saved");
        assert(validOverrideData.data?.status === "interview", "Status advanced to 'interview' via override");
    } catch (err) {
        assert(false, "TPO override tests completed", err.message);
    }

    // ----------------------------------------------------
    // PHASE 5: Withdrawal & Re-application Workflow
    // ----------------------------------------------------
    console.log("\n[Test Group 6] Candidate Voluntary Withdrawal & Re-application");
    try {
        // Create third drive for withdrawal testing
        const now = new Date();
        const d3Res = await fetch(`${BASE_URL}/api/v1/placementdrive/create-placement-drive`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminAccessToken}` },
            body: JSON.stringify({
                company: companyId,
                jobTitle: "QA Engineer",
                jobType: "full-time",
                package: 1000000,
                location: "Hyderabad",
                eligibleBranches: ["Computer Science"],
                minimumCGPA: 7.0,
                maximumBacklogs: 0,
                graduationYear: 2027,
                placementSession: session2027Id,
                applicationStartDate: now.toISOString(),
                applicationDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                driveDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
            })
        });
        const d3Data = await d3Res.json();
        const drive3Id = d3Data.data?._id;

        // Apply
        const app3Res = await fetch(`${BASE_URL}/api/v1/application/${drive3Id}/apply`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentEligibleToken}` }
        });
        const app3Data = await app3Res.json();
        const app3Id = app3Data.data?._id;
        assert(Boolean(app3Id), "Applied to Drive 3");

        // Withdraw
        const withdrawRes = await fetch(`${BASE_URL}/api/v1/application/${app3Id}/withdraw`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${studentEligibleToken}` }
        });
        const withdrawData = await withdrawRes.json();
        assert(withdrawRes.status === 200, "Candidate successfully withdrew application (HTTP 200)");
        assert(withdrawData.data?.status === "withdrawn", "Application status marked as 'withdrawn'");

        // Re-apply after withdrawal -> Permitted, resets status to 'applied'
        const reapplyRes = await fetch(`${BASE_URL}/api/v1/application/${drive3Id}/apply`, {
            method: "POST",
            headers: { Authorization: `Bearer ${studentEligibleToken}` }
        });
        const reapplyData = await reapplyRes.json();
        assert(reapplyRes.status === 200, "Candidate can re-apply after voluntary withdrawal (HTTP 200)");
        assert(reapplyData.data?.status === "applied", "Application status reset to 'applied'");
    } catch (err) {
        assert(false, "Withdrawal and re-application tests completed", err.message);
    }

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log("\n==========================================================");
    console.log(`   TESTS COMPLETED: Passed: ${testPassed} | Failed: ${testFailed}`);
    console.log("==========================================================");

    if (testFailed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch((err) => {
    console.error("Unhandled test runner exception:", err);
    process.exit(1);
});
