import assert from "node:assert/strict";
import dotenv from "dotenv";
import connectDB from "./src/db/index.js";
import { User } from "./src/models/user.models.js";
import { StudentProfile } from "./src/models/studentProfile.model.js";
import { PlacementSession } from "./src/models/placementSession.model.js";
import { app } from "./src/app.js";

dotenv.config({ path: "./.env" });

async function verifyAll() {
    console.log("\n=================================================");
    console.log("CampusFlow V2 — Bulk Registration Verification");
    console.log("=================================================\n");

    await connectDB();

    // 1. Total counts in database
    const totalUsers = await User.countDocuments();
    const totalProfiles = await StudentProfile.countDocuments();
    const studentUsers = await User.countDocuments({ role: "student" });
    const adminUsers = await User.countDocuments({ role: "admin" });

    console.log(`[1] Total Users in DB: ${totalUsers} (Students: ${studentUsers}, Admins: ${adminUsers})`);
    console.log(`[1] Total StudentProfiles in DB: ${totalProfiles}`);

    assert.equal(totalUsers, 162, "Expected 162 total users (2 pre-existing + 160 newly registered)");
    assert.equal(totalProfiles, 161, "Expected 161 student profiles (1 pre-existing + 160 newly registered)");
    assert.equal(studentUsers, 161, "Expected 161 student role users");
    assert.equal(adminUsers, 1, "Expected 1 admin role user");

    // 2. Verify all 160 new profiles are linked to session 2027 and have valid accounts
    const session2027 = await PlacementSession.findOne({ sessionYear: 2027 });
    const profiles2027 = await StudentProfile.find({ placementSession: session2027._id }).populate("user");
    console.log(`[2] Profiles linked to Class of 2027 session: ${profiles2027.length}`);
    assert.equal(profiles2027.length, 161, "Expected 161 profiles (1 pre-existing + 160 imported) linked to Class of 2027 session");

    const importedProfiles = profiles2027.filter((p) => p.usn.startsWith("1JS23"));
    assert.equal(importedProfiles.length, 160, "Expected exactly 160 imported profiles with 1JS23 prefix");

    for (const prof of importedProfiles) {
        assert.ok(prof.user, `Profile ${prof.usn} must have linked user`);
        assert.equal(prof.user.role, "student", `User for ${prof.usn} must have student role`);
        assert.ok(prof.user.email, `User for ${prof.usn} must have email`);
        assert.equal(prof.semesterResults.length, 7, `Profile ${prof.usn} must have 7 semester results`);
        assert.ok(prof.cgpa > 0, `Profile ${prof.usn} must have valid CGPA`);
        assert.equal(prof.isPlaced, false, `Profile ${prof.usn} must be marked isPlaced = false`);
        assert.equal(prof.verificationStatus, "PENDING", `Profile ${prof.usn} must be PENDING verification`);
    }
    console.log("✓ All 160 profiles have verified links, 7 semesters of SGPAs, CGPA, and synthetic guards.");

    // 3. Test HTTP login via Express app for multiple departments
    const server = app.listen(0);
    const port = server.address().port;
    const API_BASE = `http://localhost:${port}/api/v1`;

    const sampleLogins = [
        { dept: "CSE", email: "vivekkrishnamurthy001@jssateb.ac.in", usn: "1JS23CS001" },
        { dept: "CSE-AIML", email: "arjunbhatt040@jssateb.ac.in", usn: "1JS23AM020" },
        { dept: "ISE", email: "zoyasaxena060@jssateb.ac.in", usn: "1JS23IS020" },
        { dept: "ECE", email: "sowmyasrinivasan080@jssateb.ac.in", usn: "1JS23EC020" },
        { dept: "EIE", email: "pranavbhatt100@jssateb.ac.in", usn: "1JS23EI020" },
        { dept: "RA", email: "aniketreddy120@jssateb.ac.in", usn: "1JS23RA020" },
        { dept: "CIVIL", email: "arjunkamath140@jssateb.ac.in", usn: "1JS23CV020" },
        { dept: "MECH", email: "aniketali160@jssateb.ac.in", usn: "1JS23ME020" }
    ];

    console.log("\n[3] Testing authentication endpoints across all 8 academic departments:");
    for (const sample of sampleLogins) {
        // Test login by Email
        const res = await fetch(`${API_BASE}/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: sample.email,
                password: "123456789"
            })
        });

        assert.equal(res.status, 200, `Login failed for ${sample.email} (Status: ${res.status})`);
        const json = await res.json();
        assert.equal(json.success, true);
        assert.ok(json.data.accessToken, "Login must return access token");
        assert.equal(json.data.user.email, sample.email);
        assert.equal(json.data.user.role, "student");

        // Test fetching their student profile using the access token
        const profileRes = await fetch(`${API_BASE}/studentprofile/current-student-profile`, {
            headers: { Authorization: `Bearer ${json.data.accessToken}` }
        });
        assert.equal(profileRes.status, 200, `Profile fetch failed for ${sample.email}`);
        const profileJson = await profileRes.json();
        assert.equal(profileJson.data.usn, sample.usn);
        assert.equal(profileJson.data.department, profileJson.data.branch);
        console.log(`✓ [${sample.dept}] Login & Profile verified: ${sample.email} (${sample.usn})`);
    }

    // 4. Test USN login
    console.log("\n[4] Testing login by USN (rollNumber):");
    const usnRes = await fetch(`${API_BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            rollNumber: "1JS23CS001",
            password: "123456789"
        })
    });
    assert.equal(usnRes.status, 200, "Login by USN failed");
    const usnJson = await usnRes.json();
    assert.equal(usnJson.data.user.email, "vivekkrishnamurthy001@jssateb.ac.in");
    console.log("✓ Login by USN successfully authenticated 1JS23CS001.");

    // 5. Test invalid password rejection
    console.log("\n[5] Testing invalid password rejection:");
    const failRes = await fetch(`${API_BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "vivekkrishnamurthy001@jssateb.ac.in",
            password: "WrongPassword999!"
        })
    });
    assert.equal(failRes.status, 401, "Expected HTTP 401 for bad password");
    console.log("✓ Bad password correctly rejected with HTTP 401.");

    // Close server
    await new Promise((resolve) => server.close(resolve));
    console.log("\n=================================================");
    console.log("All 5 verification checkpoints passed with 100% success!");
    console.log("=================================================\n");
    process.exit(0);
}

verifyAll().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
});
