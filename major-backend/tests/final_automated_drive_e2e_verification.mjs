import ExcelJS from "exceljs";
import mongoose from "mongoose";

const BASE_URL = "http://localhost:8000/api/v1";

async function runVerification() {
    console.log("===============================================================================");
    console.log("CampusFlow V2 — Automated Placement Drive Complete Lifecycle E2E Verification");
    console.log("===============================================================================\n");

    const runId = Date.now();
    const testUSNs = Array.from({ length: 10 }, (_, i) => `1MS25CS${801 + i}`);
    const testEmails = testUSNs.map((usn) => `test.${usn.toLowerCase()}@campusflow.edu`);
    const testPassword = "TestStudent@12345";

    let adminToken = "";
    let studentTokens = {};
    let testCompanyId = "";
    let testDriveId = "";
    let testApplicationIds = [];
    let testUserIds = [];
    let testStudentProfileIds = [];
    let testSessionId = "";

    try {
        // -------------------------------------------------------------------------
        // 1. Admin Authentication
        // -------------------------------------------------------------------------
        console.log("--- 1. Authenticating Admin ---");
        const adminLogRes = await fetch(`${BASE_URL}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@campusflow.edu", password: "Admin@12345" })
        });
        const adminLogData = await adminLogRes.json();
        if (!adminLogRes.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLogData)}`);
        adminToken = adminLogData.data?.accessToken;
        console.log("✔ Admin logged in successfully");

        // Get an active placement session for 2027
        const sessionsRes = await fetch(`${BASE_URL}/sessions`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const sessionsData = await sessionsRes.json();
        const activeSession = (sessionsData.data || []).find((s) => s.sessionYear === 2027 && s.isActive) || sessionsData.data?.[0];
        if (!activeSession) throw new Error("No active placement session found.");
        testSessionId = activeSession._id;
        console.log(`✔ Using placement session: ${activeSession.name} (${activeSession.sessionYear})`);

        // -------------------------------------------------------------------------
        // 2. Setup Disposable Test Data (10 Students + Company + Placement Drive)
        // -------------------------------------------------------------------------
        console.log("\n--- 2. Creating Isolated Disposable Data: 10 Students, 1 Company, 1 Drive ---");
        
        // Create 10 Students
        for (let i = 0; i < 10; i++) {
            const usn = testUSNs[i];
            const email = testEmails[i];
            const fullName = `Candidate ${i + 1} Automation`;

            // Register User
            const clientIp = `192.168.10.${100 + i}`;
            const regRes = await fetch(`${BASE_URL}/users/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-forwarded-for": clientIp
                },
                body: JSON.stringify({
                    fullName,
                    email,
                    password: testPassword,
                    phone: `987654321${i}`,
                    usn,
                    programCode: "CSE",
                    programLevel: "Undergraduate",
                    degreeType: "B.E.",
                    course: "B.E.",
                    branch: "Computer Science & Engineering (CSE)",
                    department: "Computer Science & Engineering (CSE)",
                    semester: 7,
                    admissionYear: 2023,
                    graduationYear: 2027
                })
            });
            const regData = await regRes.json();
            if (!regRes.ok) throw new Error(`Student ${usn} registration failed: ${JSON.stringify(regData)}`);
            
            const userId = regData.data?.user?._id;
            testUserIds.push(userId);

            // Log in student to get token
            const sLog = await (await fetch(`${BASE_URL}/users/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-forwarded-for": clientIp
                },
                body: JSON.stringify({ email, password: testPassword })
            })).json();
            studentTokens[usn] = sLog.data?.accessToken;

            // Fetch created profile
            const profileRes = await (await fetch(`${BASE_URL}/studentprofile/current-student-profile`, {
                headers: { Authorization: `Bearer ${studentTokens[usn]}` }
            })).json();
            if (profileRes.data?._id) {
                testStudentProfileIds.push(profileRes.data._id);
            }
        }
        console.log(`✔ Created 10 disposable student profiles (${testUSNs[0]} ... ${testUSNs[9]})`);

        // Set CGPA and Master Resume on all 10 test student profiles for drive eligibility
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        await mongoose.connection.db.collection("studentprofiles").updateMany(
            { _id: { $in: testStudentProfileIds.map((id) => new mongoose.Types.ObjectId(id)) } },
            {
                $set: {
                    cgpa: 8.5,
                    verifiedCGPA: 8.5,
                    tenthPercentage: 88,
                    twelfthPercentage: 86,
                    activeBacklogs: 0,
                    historicalBacklogs: 0,
                    resume: {
                        url: "https://res.cloudinary.com/chi9p4nw/image/upload/v1/campusflow/resumes/sample.pdf",
                        publicId: "campusflow/resumes/sample"
                    }
                }
            }
        );
        await mongoose.disconnect();
        console.log(`✔ Initialized CGPA (8.5) and Master Resume on 10 test student profiles`);

        // Create Disposable Company
        const compRes = await fetch(`${BASE_URL}/company/create-company`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                companyName: `ACME Robotics E2E ${runId}`,
                companyDescription: "Autonomous Systems and Robotics",
                companyWebsite: "https://acme-robotics.com",
                industry: "Robotics",
                location: "Bengaluru",
                contactEmail: `recruitment${runId}@acme.com`,
                contactPhone: "9876543210"
            })
        });
        const compData = await compRes.json();
        if (!compRes.ok) throw new Error(`Company creation failed: ${JSON.stringify(compData)}`);
        testCompanyId = compData.data?._id;
        console.log(`✔ Created disposable company: "${compData.data?.companyName}"`);

        // Create Disposable Placement Drive with 3 Selection Rounds
        const driveRes = await fetch(`${BASE_URL}/placementdrive/create-placement-drive`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                company: testCompanyId,
                jobTitle: "Autonomous Systems Engineer",
                jobDescription: "Developing autonomous mobile robotics algorithms",
                jobType: "Full-Time",
                location: "Bengaluru",
                package: 18.5,
                placementSession: testSessionId,
                graduationYear: activeSession.sessionYear,
                eligibleProgramCodes: ["CSE"],
                eligibleBranches: ["Computer Science & Engineering (CSE)"],
                minimumCGPA: 5.0,
                maximumBacklogs: 2,
                maximumHistoricalBacklogs: 2,
                applicationStartDate: new Date().toISOString(),
                applicationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                driveDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                selectionRounds: [
                    { roundNumber: 1, name: "Online Screening Assessment", roundType: "Online Assessment", description: "Coding + Aptitude" },
                    { roundNumber: 2, name: "Technical Systems Interview", roundType: "Technical Interview", description: "DSA & System Architecture" },
                    { roundNumber: 3, name: "Executive Leadership & Final Offer", roundType: "HR Interview", description: "Leadership & Final Fitment" }
                ]
            })
        });
        const driveData = await driveRes.json();
        if (!driveRes.ok) throw new Error(`Drive creation failed: ${JSON.stringify(driveData)}`);
        testDriveId = driveData.data?._id;
        console.log(`✔ Created disposable placement drive: "${driveData.data?.jobTitle}" (ID: ${testDriveId}) with 3 configured selection rounds`);

        // Submit 10 Applications
        for (let i = 0; i < 10; i++) {
            const usn = testUSNs[i];
            const token = studentTokens[usn];
            const appRes = await fetch(`${BASE_URL}/application/${testDriveId}/apply`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({})
            });
            const appData = await appRes.json();
            if (!appRes.ok) throw new Error(`Application for ${usn} failed: ${JSON.stringify(appData)}`);
            testApplicationIds.push(appData.data?._id);
        }
        console.log(`✔ 10 applications submitted to drive (All initially at status: "applied")`);

        // -------------------------------------------------------------------------
        // 3. Step 4: Company Applicant Roster Export & Round 1 Ingestion
        // -------------------------------------------------------------------------
        console.log("\n--- 3. Testing Step 4: Export Roster, Parse Round 1 Results (7 Shortlisted, 3 Absent) ---");

        // 3a. Export Company Roster
        const exportRes = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/export-company-roster?roundNumber=1`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        if (!exportRes.ok) throw new Error(`Roster export failed with status ${exportRes.status}`);
        const rosterBuffer = await exportRes.arrayBuffer();
        console.log(`✔ Exported company applicant roster: ${rosterBuffer.byteLength} bytes downloaded`);

        // Read exported roster with ExcelJS to verify contents
        const rosterWorkbook = new ExcelJS.Workbook();
        await rosterWorkbook.xlsx.load(Buffer.from(rosterBuffer));
        const rosterSheet = rosterWorkbook.worksheets[0];
        console.log(`✔ Exported workbook sheet: "${rosterSheet.name}", total rows: ${rosterSheet.rowCount}`);

        // 3b. Create Company Result File: 7 Shortlisted candidates (candidates 0 to 6), candidates 7, 8, 9 absent
        const r1Workbook = new ExcelJS.Workbook();
        const r1Sheet = r1Workbook.addWorksheet("Round 1 Results");
        r1Sheet.addRow(["USN", "Candidate Name", "Email", "Status", "Score", "Remarks"]);
        
        for (let i = 0; i < 7; i++) {
            r1Sheet.addRow([
                testUSNs[i],
                `Candidate ${i + 1} Automation`,
                testEmails[i],
                "Shortlisted",
                85 + i,
                "Cleared online test"
            ]);
        }
        const r1FileBuf = await r1Workbook.xlsx.writeBuffer();

        // 3c. Preview Round 1 Results (Mode A: shortlist_only)
        const r1FormData = new FormData();
        r1FormData.append("file", new Blob([r1FileBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Round1_Company_Shortlist.xlsx");
        r1FormData.append("roundNumber", "1");
        r1FormData.append("mode", "shortlist_only");

        const r1PreviewRes = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/preview-results`, {
            method: "POST",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: r1FormData
        });
        const r1PreviewData = await r1PreviewRes.json();
        if (!r1PreviewRes.ok) throw new Error(`Round 1 preview failed: ${JSON.stringify(r1PreviewData)}`);
        
        const r1P = r1PreviewData.data;
        console.log("✔ Round 1 Preview Results:", {
            totalRowsDetected: r1P.totalRowsDetected,
            candidatePoolTotal: r1P.candidatePoolTotal,
            proposedAdvanceCount: r1P.proposedAdvanceCount,
            absentCandidatesCount: r1P.absentCandidatesCount,
            exceptionsCount: r1P.exceptionsCount
        });

        if (r1P.proposedAdvanceCount !== 7) throw new Error(`Expected 7 advances, got ${r1P.proposedAdvanceCount}`);
        if (r1P.absentCandidatesCount !== 3) throw new Error(`Expected 3 absent candidates, got ${r1P.absentCandidatesCount}`);

        // 3d. Commit Round 1 Results (Confirm import with autoRejectAbsent: true)
        const r1CommitPayload = {
            roundNumber: 1,
            mode: "shortlist_only",
            autoRejectAbsent: true,
            confirmedAdvances: r1P.proposedAdvances,
            confirmedRejections: [],
            confirmedExceptionResolutions: (r1P.potentialAbsentCandidates || []).map((c) => ({
                applicationId: c.applicationId,
                usn: c.usn,
                action: "reject_absent"
            }))
        };

        const r1CommitRes = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/commit-results`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify(r1CommitPayload)
        });
        const r1CommitData = await r1CommitRes.json();
        if (!r1CommitRes.ok) throw new Error(`Round 1 commit failed: ${JSON.stringify(r1CommitData)}`);
        console.log(`✔ Round 1 committed successfully: advanced ${r1CommitData.data?.advancedCount}, rejected ${r1CommitData.data?.rejectedCount}`);

        // 3e. Verify DB State after Round 1
        const r1WorkspaceRes = await (await fetch(`${BASE_URL}/placementdrive/${testDriveId}/automated-workspace`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        })).json();
        const r1Drive = r1WorkspaceRes.data?.drive;
        console.log(`✔ Drive status after Round 1: currentRoundNumber = ${r1Drive.currentRoundNumber}, isPlacementCompleted = ${r1Drive.isPlacementCompleted}`);
        if (r1Drive.currentRoundNumber !== 2) throw new Error(`Expected currentRoundNumber 2, got ${r1Drive.currentRoundNumber}`);

        // Check applications status in DB
        const r1PoolRes = await (await fetch(`${BASE_URL}/application/drive/${testDriveId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        })).json();
        const driveAppsR1 = r1PoolRes.data || [];
        const r1Shortlisted = driveAppsR1.filter((a) => a.status === "shortlisted");
        const r1Rejected = driveAppsR1.filter((a) => a.status === "rejected");
        console.log(`✔ Database application counts: ${r1Shortlisted.length} shortlisted, ${r1Rejected.length} rejected`);
        if (r1Shortlisted.length !== 7) throw new Error(`Expected 7 shortlisted in DB, got ${r1Shortlisted.length}`);
        if (r1Rejected.length !== 3) throw new Error(`Expected 3 rejected in DB, got ${r1Rejected.length}`);

        // -------------------------------------------------------------------------
        // 4. Step 5: Round 2 Progression & Rejection Handling (5 of 7 Selected)
        // -------------------------------------------------------------------------
        console.log("\n--- 4. Testing Step 5: Round 2 Progression (5 Advanced, 2 Rejected) ---");

        // 4a. Create Round 2 Results: 5 candidates shortlisted (candidates 0 to 4), candidates 5 & 6 absent
        const r2Workbook = new ExcelJS.Workbook();
        const r2Sheet = r2Workbook.addWorksheet("Round 2 Results");
        r2Sheet.addRow(["USN", "Candidate Name", "Email", "Status", "Score", "Remarks"]);
        
        for (let i = 0; i < 5; i++) {
            r2Sheet.addRow([
                testUSNs[i],
                `Candidate ${i + 1} Automation`,
                testEmails[i],
                "Cleared Technical Interview",
                90 + i,
                "Strong DSA and system design"
            ]);
        }
        const r2FileBuf = await r2Workbook.xlsx.writeBuffer();

        // 4b. Preview Round 2
        const r2FormData = new FormData();
        r2FormData.append("file", new Blob([r2FileBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Round2_Technical_Results.xlsx");
        r2FormData.append("roundNumber", "2");
        r2FormData.append("mode", "shortlist_only");

        const r2PreviewRes = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/preview-results`, {
            method: "POST",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: r2FormData
        });
        const r2PreviewData = await r2PreviewRes.json();
        if (!r2PreviewRes.ok) throw new Error(`Round 2 preview failed: ${JSON.stringify(r2PreviewData)}`);
        
        const r2P = r2PreviewData.data;
        console.log("✔ Round 2 Preview Results:", {
            totalRowsDetected: r2P.totalRowsDetected,
            candidatePoolTotal: r2P.candidatePoolTotal,
            proposedAdvanceCount: r2P.proposedAdvanceCount,
            absentCandidatesCount: r2P.absentCandidatesCount
        });

        if (r2P.candidatePoolTotal !== 7) throw new Error(`Expected candidate pool of 7, got ${r2P.candidatePoolTotal}`);
        if (r2P.proposedAdvanceCount !== 5) throw new Error(`Expected 5 advances, got ${r2P.proposedAdvanceCount}`);
        if (r2P.absentCandidatesCount !== 2) throw new Error(`Expected 2 absent candidates, got ${r2P.absentCandidatesCount}`);

        // 4c. Commit Round 2
        const r2CommitPayload = {
            roundNumber: 2,
            mode: "shortlist_only",
            autoRejectAbsent: true,
            confirmedAdvances: r2P.proposedAdvances,
            confirmedRejections: [],
            confirmedExceptionResolutions: (r2P.potentialAbsentCandidates || []).map((c) => ({
                applicationId: c.applicationId,
                usn: c.usn,
                action: "reject_absent"
            }))
        };

        const r2CommitRes = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/commit-results`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify(r2CommitPayload)
        });
        const r2CommitData = await r2CommitRes.json();
        if (!r2CommitRes.ok) throw new Error(`Round 2 commit failed: ${JSON.stringify(r2CommitData)}`);
        console.log(`✔ Round 2 committed: advanced ${r2CommitData.data?.advancedCount}, rejected ${r2CommitData.data?.rejectedCount}`);

        // 4d. Verify DB State after Round 2
        const r2WorkspaceRes = await (await fetch(`${BASE_URL}/placementdrive/${testDriveId}/automated-workspace`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        })).json();
        const r2Drive = r2WorkspaceRes.data?.drive;
        console.log(`✔ Drive status after Round 2: currentRoundNumber = ${r2Drive.currentRoundNumber}`);
        if (r2Drive.currentRoundNumber !== 3) throw new Error(`Expected currentRoundNumber 3, got ${r2Drive.currentRoundNumber}`);

        const r2PoolRes = await (await fetch(`${BASE_URL}/application/drive/${testDriveId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        })).json();
        const driveAppsR2 = r2PoolRes.data || [];
        const r2Interview = driveAppsR2.filter((a) => a.status === "interview");
        const r2RejectedTotal = driveAppsR2.filter((a) => a.status === "rejected");
        console.log(`✔ Database application counts: ${r2Interview.length} in interview, ${r2RejectedTotal.length} total rejected`);
        if (r2Interview.length !== 5) throw new Error(`Expected 5 in interview, got ${r2Interview.length}`);
        if (r2RejectedTotal.length !== 5) throw new Error(`Expected 5 rejected total, got ${r2RejectedTotal.length}`);

        // -------------------------------------------------------------------------
        // 5. Step 6: Edge Cases, Normalization, Ambiguities & Exceptions
        // -------------------------------------------------------------------------
        console.log("\n--- 5. Testing Step 6: USN Normalization, Conflicting Names, Unknown USNs, Duplicates ---");

        const edgeWorkbook = new ExcelJS.Workbook();
        const edgeSheet = edgeWorkbook.addWorksheet("Edge Cases");
        edgeSheet.addRow(["USN", "Candidate Name", "Email", "Status"]);

        // Row 1: Whitespace and lowercase with hyphens for active candidate 1MS25CS801
        edgeSheet.addRow(["  1ms-25-cs-801  ", "Candidate 1 Automation", testEmails[0], "Cleared"]);

        // Row 2: Conflicting identity name for Candidate 2
        edgeSheet.addRow([testUSNs[1], "Completely Different Person Name", testEmails[1], "Cleared"]);

        // Row 3: Duplicate row for Candidate 1
        edgeSheet.addRow([testUSNs[0], "Candidate 1 Automation", testEmails[0], "Cleared"]);

        // Row 4: Unknown USN not in drive or database
        edgeSheet.addRow(["1MS25CS999", "Unknown Student", "unknown@campusflow.edu", "Cleared"]);

        // Row 5: Candidate previously rejected in Round 1 (Candidate 8)
        edgeSheet.addRow([testUSNs[7], "Candidate 8 Automation", testEmails[7], "Cleared"]);

        const edgeBuf = await edgeWorkbook.xlsx.writeBuffer();
        const edgeFormData = new FormData();
        edgeFormData.append("file", new Blob([edgeBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "EdgeCases.xlsx");
        edgeFormData.append("roundNumber", "3");
        edgeFormData.append("mode", "shortlist_only");

        const edgePreviewRes = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/preview-results`, {
            method: "POST",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: edgeFormData
        });
        const edgePreviewData = await edgePreviewRes.json();
        if (!edgePreviewRes.ok) throw new Error(`Edge cases preview failed: ${JSON.stringify(edgePreviewData)}`);
        
        const edgeP = edgePreviewData.data;
        console.log(`✔ Edge cases parsed: ${edgeP.totalRowsDetected} rows, ${edgeP.exceptionsCount} exceptions detected`);
        
        const exceptionTypes = (edgeP.exceptions || []).map((e) => e.type);
        console.log("✔ Detected exception types:", exceptionTypes);

        // Verify each exception was caught
        if (!exceptionTypes.includes("DUPLICATE_USN_IN_FILE")) {
            throw new Error("Missing DUPLICATE_USN_IN_FILE exception");
        }
        if (!exceptionTypes.includes("UNKNOWN_USN")) {
            throw new Error("Missing UNKNOWN_USN exception");
        }
        if (!exceptionTypes.includes("CANDIDATE_NOT_IN_CURRENT_ROUND")) {
            throw new Error("Missing CANDIDATE_NOT_IN_CURRENT_ROUND exception");
        }
        // Verify identity mismatch was flagged for row 2
        const nameMismatch = (edgeP.proposedAdvances || []).find((a) => a.usn === testUSNs[1] && a.identityMismatch) ||
                             (edgeP.exceptions || []).find((e) => e.type === "IDENTITY_MISMATCH" && e.usn === testUSNs[1]);
        if (!nameMismatch) {
            throw new Error("Missing identityMismatch flag for conflicting student name");
        }
        console.log("✔ All edge cases (normalization, unknown USN, candidate not in round, duplicate USN, conflicting name) verified successfully");

        // -------------------------------------------------------------------------
        // 6. Step 7: Student Dashboard Verification
        // -------------------------------------------------------------------------
        console.log("\n--- 6. Testing Step 7: Student Dashboard Reflection ---");

        // Advanced student (Candidate 1)
        const s1AppsRes = await fetch(`${BASE_URL}/application/my-applications`, {
            headers: { Authorization: `Bearer ${studentTokens[testUSNs[0]]}` }
        });
        const s1AppsData = await s1AppsRes.json();
        const s1DriveApp = (s1AppsData.data || []).find((a) => (a.placementDrive?._id || a.placementDrive) === testDriveId);
        console.log(`✔ Candidate 1 application status: "${s1DriveApp?.status}" (Interview rounds cleared: ${s1DriveApp?.interviewRounds?.length})`);
        if (s1DriveApp?.status !== "interview") throw new Error(`Candidate 1 should be 'interview', got '${s1DriveApp?.status}'`);

        // Check notifications for Candidate 1
        const s1NotifsRes = await fetch(`${BASE_URL}/notifications`, {
            headers: { Authorization: `Bearer ${studentTokens[testUSNs[0]]}` }
        });
        const s1NotifsData = await s1NotifsRes.json();
        const s1Notifs = s1NotifsData.data?.notifications || s1NotifsData.data || [];
        console.log(`✔ Candidate 1 notifications: ${s1Notifs.length} notifications received`);
        if (s1Notifs.length === 0) throw new Error("Candidate 1 should have received advancement notifications");

        // Eliminated student (Candidate 10)
        const s10AppsRes = await fetch(`${BASE_URL}/application/my-applications`, {
            headers: { Authorization: `Bearer ${studentTokens[testUSNs[9]]}` }
        });
        const s10AppsData = await s10AppsRes.json();
        const s10DriveApp = (s10AppsData.data || []).find((a) => (a.placementDrive?._id || a.placementDrive) === testDriveId);
        console.log(`✔ Candidate 10 application status: "${s10DriveApp?.status}" (Remarks: "${s10DriveApp?.statusHistory?.slice(-1)[0]?.remarks}")`);
        if (s10DriveApp?.status !== "rejected") throw new Error(`Candidate 10 should be 'rejected', got '${s10DriveApp?.status}'`);

        // -------------------------------------------------------------------------
        // 7. Step 8: Earlier-Round Protection & Authorization Checks
        // -------------------------------------------------------------------------
        console.log("\n--- 7. Testing Step 8: Earlier-Round Protection & Authorization ---");

        // 7a. Attempt to re-commit Round 1 when drive is on Round 3
        const illegalR1Commit = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/commit-results`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                roundNumber: 1,
                mode: "shortlist_only",
                confirmedAdvances: []
            })
        });
        const illegalR1Data = await illegalR1Commit.json();
        console.log(`✔ Earlier-round import attempt response: HTTP ${illegalR1Commit.status} - "${illegalR1Data.message}"`);
        if (illegalR1Commit.status === 200) throw new Error("Earlier-round import should have been rejected!");

        // 7b. Attempt unauthenticated commit
        const unauthCommit = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/commit-results`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roundNumber: 3, confirmedAdvances: [] })
        });
        console.log(`✔ Unauthenticated commit attempt response: HTTP ${unauthCommit.status}`);
        if (unauthCommit.status !== 401) throw new Error("Unauthenticated commit should return 401");

        // 7c. Attempt student commit
        const studentCommit = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/commit-results`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentTokens[testUSNs[0]]}`
            },
            body: JSON.stringify({ roundNumber: 3, confirmedAdvances: [] })
        });
        console.log(`✔ Student unauthorized commit attempt response: HTTP ${studentCommit.status}`);
        if (studentCommit.status !== 403) throw new Error("Student commit should return 403 Forbidden");

        // -------------------------------------------------------------------------
        // 8. Step 9: Final Round Selection & Automatic Drive Closure
        // -------------------------------------------------------------------------
        console.log("\n--- 8. Testing Step 9: Final Selection & Automatic Drive Closure ---");

        // Create Round 3 File: Candidates 0, 1, 2 selected (3 of the 5 candidates placed)
        const r3Workbook = new ExcelJS.Workbook();
        const r3Sheet = r3Workbook.addWorksheet("Final Round Results");
        r3Sheet.addRow(["USN", "Candidate Name", "Email", "Status", "Remarks"]);
        
        for (let i = 0; i < 3; i++) {
            r3Sheet.addRow([
                testUSNs[i],
                `Candidate ${i + 1} Automation`,
                testEmails[i],
                "Selected / Offer Extended",
                "Offered Autonomous Systems Engineer role"
            ]);
        }
        const r3FileBuf = await r3Workbook.xlsx.writeBuffer();

        // Preview Round 3
        const r3FormData = new FormData();
        r3FormData.append("file", new Blob([r3FileBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Final_Offers.xlsx");
        r3FormData.append("roundNumber", "3");
        r3FormData.append("mode", "shortlist_only");

        const r3PreviewRes = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/preview-results`, {
            method: "POST",
            headers: { Authorization: `Bearer ${adminToken}` },
            body: r3FormData
        });
        const r3PreviewData = await r3PreviewRes.json();
        if (!r3PreviewRes.ok) throw new Error(`Round 3 preview failed: ${JSON.stringify(r3PreviewData)}`);
        
        const r3P = r3PreviewData.data;
        console.log("✔ Round 3 (Final) Preview Results:", {
            isFinalRound: r3P.isFinalRound,
            proposedAdvanceCount: r3P.proposedAdvanceCount,
            absentCandidatesCount: r3P.absentCandidatesCount
        });
        if (!r3P.isFinalRound) throw new Error("Round 3 must be recognized as final round");

        // Commit Final Round Results
        const r3CommitPayload = {
            roundNumber: 3,
            mode: "shortlist_only",
            autoRejectAbsent: true,
            confirmedAdvances: r3P.proposedAdvances,
            confirmedRejections: [],
            confirmedExceptionResolutions: (r3P.potentialAbsentCandidates || []).map((c) => ({
                applicationId: c.applicationId,
                usn: c.usn,
                action: "reject_absent"
            }))
        };

        const r3CommitRes = await fetch(`${BASE_URL}/placementdrive/${testDriveId}/commit-results`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify(r3CommitPayload)
        });
        const r3CommitData = await r3CommitRes.json();
        if (!r3CommitRes.ok) throw new Error(`Final round commit failed: ${JSON.stringify(r3CommitData)}`);
        
        console.log("✔ Final round committed successfully:", {
            isFinalRound: r3CommitData.data?.isFinalRound,
            isPlacementCompleted: r3CommitData.data?.isPlacementCompleted,
            advancedCount: r3CommitData.data?.advancedCount,
            rejectedCount: r3CommitData.data?.rejectedCount
        });

        // Verify Drive is Automatically Completed and Closed
        const closedDriveRes = await (await fetch(`${BASE_URL}/placementdrive/${testDriveId}/automated-workspace`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        })).json();
        const closedDrive = closedDriveRes.data?.drive;
        console.log(`✔ Verified Drive State: isPlacementCompleted = ${closedDrive.isPlacementCompleted}, isActive = ${closedDrive.isActive}, completedAt = ${closedDrive.completedAt}`);
        
        if (!closedDrive.isPlacementCompleted) throw new Error("Drive must have isPlacementCompleted = true");
        if (closedDrive.isActive !== false) throw new Error("Completed drive must be deactivated (isActive = false)");

        // Verify Placed Candidates have status: "selected"
        const finalPoolRes = await (await fetch(`${BASE_URL}/application/drive/${testDriveId}`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        })).json();
        const driveAppsFinal = finalPoolRes.data || [];
        const finalSelected = driveAppsFinal.filter((a) => a.status === "selected");
        console.log(`✔ Confirmed placed candidates in DB: ${finalSelected.length} students selected`);
        if (finalSelected.length !== 3) throw new Error(`Expected 3 selected, got ${finalSelected.length}`);

        // Verify Offer Notifications received by Placed Candidate
        const placedNotifsRes = await fetch(`${BASE_URL}/notifications`, {
            headers: { Authorization: `Bearer ${studentTokens[testUSNs[0]]}` }
        });
        const placedNotifsJson = await placedNotifsRes.json();
        const placedNotifs = placedNotifsJson.data?.notifications || placedNotifsJson.data || [];
        const offerNotif = placedNotifs.find((n) => n.type === "offer" || (n.title && n.title.includes("Congratulations")));
        console.log(`✔ Placed student offer notification verified: "${offerNotif?.title}"`);
        if (!offerNotif) throw new Error("Placed student should have received celebratory offer notification");

        console.log("\n===============================================================================");
        console.log("✔ ALL 9 VERIFICATION PHASES PASSED WITH 100% SUCCESS");
        console.log("===============================================================================");

    } finally {
        // -------------------------------------------------------------------------
        // 9. Teardown: Safely Purge Ephemeral Test Records
        // -------------------------------------------------------------------------
        console.log("\n--- Teardown: Cleaning up ephemeral test records ---");
        try {
            if (process.env.MONGODB_URI) {
                await mongoose.connect(process.env.MONGODB_URI);
            }
            const db = mongoose.connection.db;

            if (testDriveId) {
                await db.collection("placementdrives").deleteOne({ _id: new mongoose.Types.ObjectId(testDriveId) });
                console.log(`✔ Cleaned test drive: ${testDriveId}`);
            }
            if (testCompanyId) {
                await db.collection("companies").deleteOne({ _id: new mongoose.Types.ObjectId(testCompanyId) });
                console.log(`✔ Cleaned test company: ${testCompanyId}`);
            }
            if (testApplicationIds.length > 0) {
                await db.collection("applications").deleteMany({ _id: { $in: testApplicationIds.map((id) => new mongoose.Types.ObjectId(id)) } });
                console.log(`✔ Cleaned ${testApplicationIds.length} test applications`);
            }
            if (testStudentProfileIds.length > 0) {
                await db.collection("studentprofiles").deleteMany({ _id: { $in: testStudentProfileIds.map((id) => new mongoose.Types.ObjectId(id)) } });
                console.log(`✔ Cleaned ${testStudentProfileIds.length} test student profiles`);
            }
            if (testUserIds.length > 0) {
                await db.collection("users").deleteMany({ _id: { $in: testUserIds.map((id) => new mongoose.Types.ObjectId(id)) } });
                await db.collection("notifications").deleteMany({ user: { $in: testUserIds.map((id) => new mongoose.Types.ObjectId(id)) } });
                console.log(`✔ Cleaned ${testUserIds.length} test user accounts and their notifications`);
            }
            await mongoose.disconnect();
            console.log("✔ Teardown complete. Zero permanent or existing records modified.");
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }
    }
}

runVerification().catch((err) => {
    console.error("❌ E2E Verification Failed:", err);
    process.exit(1);
});
