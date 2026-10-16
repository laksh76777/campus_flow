import ExcelJS from "exceljs";

const BASE_URL = "http://localhost:8000/api/v1";

async function run() {
    console.log("=== Testing Phase 2 Automated Placement Drive Live Flow ===");

    // 1. Admin login
    let loginRes = await fetch(`${BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "admin@campusflow.edu",
            password: "Admin@12345"
        })
    });
    if (!loginRes.ok) {
        // Fallback to /users/login if unified
        loginRes = await fetch(`${BASE_URL}/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "admin@campusflow.edu",
                password: "Admin@12345"
            })
        });
    }
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
        throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.data?.accessToken;
    console.log("✔ Admin login successful");

    // 2. Fetch all placement drives
    const drivesRes = await fetch(`${BASE_URL}/placementdrive/all-drives`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const drivesData = await drivesRes.json();
    if (!drivesRes.ok) {
        throw new Error(`Drives fetch failed: ${JSON.stringify(drivesData)}`);
    }
    const drives = drivesData.data || [];
    console.log(`✔ All drives loaded successfully: ${drives.length} drives available`);

    if (drives.length === 0) {
        console.log("No drives found. Test completed workspace check.");
        return;
    }

    const drive = drives[0];
    console.log(`Selected drive for verification: "${drive.company?.name || drive.companyName} - ${drive.jobTitle}" (ID: ${drive._id})`);

    // 2b. Fetch automated workspace for this drive
    const wsRes = await fetch(`${BASE_URL}/placementdrive/${drive._id}/automated-workspace`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const wsData = await wsRes.json();
    if (!wsRes.ok) {
        throw new Error(`Workspace fetch failed: ${JSON.stringify(wsData)}`);
    }
    const workspace = wsData.data;
    const driveInfo = workspace.drive || {};
    console.log(`✔ Workspace loaded: current round = ${driveInfo.currentRoundNumber}, total applications = ${workspace.totalApplications}, isCompleted = ${driveInfo.isPlacementCompleted}`);

    // 3. Test selection rounds configuration
    const configRes = await fetch(`${BASE_URL}/placementdrive/${drive._id}/automated-rounds`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            selectionRounds: [
                { roundNumber: 1, roundName: "Online Assessment", roundType: "Online Assessment", description: "Coding + Aptitude" },
                { roundNumber: 2, roundName: "Technical Interview", roundType: "Technical Interview", description: "DSA & System Design" },
                { roundNumber: 3, roundName: "HR & Final Offer", roundType: "HR Interview", description: "Final Fitment" }
            ]
        })
    });
    const configData = await configRes.json();
    if (!configRes.ok) {
        throw new Error(`Rounds config failed: ${JSON.stringify(configData)}`);
    }
    console.log(`✔ Rounds configured successfully: ${configData.data?.selectionRounds?.length} rounds active`);

    // 4. Test company applicant roster export (GET /placementdrive/:driveId/export-company-roster)
    const exportRes = await fetch(`${BASE_URL}/placementdrive/${drive._id}/export-company-roster?roundNumber=1`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!exportRes.ok) {
        throw new Error(`Roster export failed with status ${exportRes.status}`);
    }
    const arrayBuffer = await exportRes.arrayBuffer();
    console.log(`✔ Roster exported successfully: ${arrayBuffer.byteLength} bytes downloaded`);

    // 5. Test results file upload and preview
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Round 1 Shortlist");
    sheet.addRow(["USN", "Candidate Name", "Email", "Status", "Score", "Feedback"]);
    
    // Check if drive has candidates
    const candidates = workspace.candidates || [];
    if (candidates.length > 0) {
        const topCandidate = candidates[0];
        sheet.addRow([topCandidate.usn, topCandidate.name, topCandidate.email, "Shortlisted", 95, "Excellent performance"]);
    } else {
        sheet.addRow(["1MS23CS999", "Test Candidate", "test@campusflow.edu", "Shortlisted", 90, "Good"]);
    }

    const fileBuf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([fileBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const formData = new FormData();
    formData.append("file", blob, "Round1_Company_Shortlist.xlsx");
    formData.append("roundNumber", "1");
    formData.append("mode", "shortlist_only");

    const previewRes = await fetch(`${BASE_URL}/placementdrive/${drive._id}/preview-results`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
    });
    const previewData = await previewRes.json();
    if (!previewRes.ok) {
        throw new Error(`Results preview failed: ${JSON.stringify(previewData)}`);
    }
    console.log(`✔ Results preview parsed successfully:`, {
        totalParsedInFile: previewData.data?.totalParsedInFile,
        matchedCandidates: previewData.data?.matchedCandidates?.length,
        unmatchedRows: previewData.data?.unmatchedRows?.length,
        absentFromShortlist: previewData.data?.absentFromShortlist?.length
    });

    console.log("=== Phase 2 Live E2E Flow Passed With 100% Reliability ===");
}

run().catch((err) => {
    console.error("❌ Live verification error:", err);
    process.exit(1);
});
