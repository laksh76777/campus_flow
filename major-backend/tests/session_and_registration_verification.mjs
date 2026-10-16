import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../src/models/user.models.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { PlacementSession } from "../src/models/placementSession.model.js";
import { resolveMongoConnection } from "../src/db/index.js";

dotenv.config({ path: "./.env" });

const runVerification = async () => {
    console.log("================================================================================");
    console.log("   CAMPUSFLOW: SESSION MANAGEMENT, ADMISSION YEAR & REGISTRATION TEST           ");
    console.log("================================================================================");

    const baseUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
    const { connectionUri } = resolveMongoConnection(baseUri);
    const isolatedDb = `Place-on_e2e_sessions_${Date.now()}`;
    const parsed = new URL(connectionUri);
    parsed.pathname = `/${isolatedDb}`;
    await mongoose.connect(parsed.toString());
    console.log(`Connected to isolated test database: ${parsed.host}/${isolatedDb}\n`);

    const stats = { passed: 0, failed: 0 };
    const assert = (condition, message) => {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            stats.passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            stats.failed++;
        }
    };

    try {
        // 1. Create Placement Session for 2023-2027 (Class of 2027)
        const session2027 = await PlacementSession.create({
            sessionYear: 2027,
            name: "Session 2023-2027 (Class of 2027)",
            academicYear: "2023-2027",
            admissionYearMapping: [
                { course: "B.E.", courseDurationYears: 4, admissionYear: 2023 },
                { course: "B.Tech", courseDurationYears: 4, admissionYear: 2023 },
                { course: "MBA", courseDurationYears: 2, admissionYear: 2025 }
            ],
            isActive: true
        });
        assert(session2027._id != null, "Created 2023-2027 Placement Session");
        assert(session2027.admissionYearMapping.length === 3, "2023-2027 mappings contain B.E., B.Tech, and MBA");

        // 2. Create Placement Session for 2024-2028 (Class of 2028)
        const session2028 = await PlacementSession.create({
            sessionYear: 2028,
            name: "Session 2024-2028 (Class of 2028)",
            academicYear: "2024-2028",
            admissionYearMapping: [
                { course: "B.E.", courseDurationYears: 4, admissionYear: 2024 },
                { course: "B.Tech", courseDurationYears: 4, admissionYear: 2024 },
                { course: "MBA", courseDurationYears: 2, admissionYear: 2026 }
            ],
            isActive: false
        });
        assert(session2028._id != null, "Created 2024-2028 Placement Session");

        // 3. Register Student for 2024 admission (Class of 2028)
        const studentUser2028 = await User.create({
            fullName: "Rohan Gupta",
            email: "rohan.2024@campusflow.edu",
            password: "HashedPassword@123",
            role: "student"
        });

        const studentProfile2028 = await StudentProfile.create({
            user: studentUser2028._id,
            enrollmentNumber: "1MS24CS099",
            usn: "1MS24CS099",
            department: "Computer Science and Engineering",
            branch: "Computer Science and Engineering",
            programCode: "CSE_BE",
            degreeType: "B.E.",
            courseDurationYears: 4,
            admissionYear: 2024,
            graduationYear: 2028,
            semester: 4,
            placementSession: session2028._id,
            cgpa: 8.8,
            backlogs: 0
        });
        assert(studentProfile2028.placementSession.toString() === session2028._id.toString(), "Student with admission year 2024 successfully linked to 2024-2028 session");

        // 4. Register Student for 2023 admission (Class of 2027)
        const studentUser2027 = await User.create({
            fullName: "Ananya Sen",
            email: "ananya.2023@campusflow.edu",
            password: "HashedPassword@123",
            role: "student"
        });

        const studentProfile2027 = await StudentProfile.create({
            user: studentUser2027._id,
            enrollmentNumber: "1MS23ME045",
            usn: "1MS23ME045",
            department: "Mechanical Engineering",
            branch: "Mechanical Engineering",
            programCode: "ME_BE",
            degreeType: "B.E.",
            courseDurationYears: 4,
            admissionYear: 2023,
            graduationYear: 2027,
            semester: 6,
            placementSession: session2027._id,
            cgpa: 8.2,
            backlogs: 0
        });
        assert(studentProfile2027.placementSession.toString() === session2027._id.toString(), "Student with admission year 2023 successfully linked to 2023-2027 session");

        // 5. Query hierarchical structure: Session -> Department -> Students
        const allSessions = await PlacementSession.find().sort({ sessionYear: 1 });
        assert(allSessions.length === 2, "Found both 2023-2027 and 2024-2028 sessions in DB");

        for (const sess of allSessions) {
            const studentsInSession = await StudentProfile.find({ placementSession: sess._id }).populate("user", "fullName email");
            assert(studentsInSession.length === 1, `Session '${sess.name}' contains exactly 1 student`);
            console.log(`    -> Session: ${sess.name} | Dept: ${studentsInSession[0].department} | Student: ${studentsInSession[0].user.fullName}`);
        }

    } finally {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        console.log("\nIsolated test database cleaned up.");
    }

    console.log(`\n================================================================================`);
    console.log(`   TEST RESULTS: ${stats.passed} Passed, ${stats.failed} Failed`);
    console.log(`================================================================================`);
    if (stats.failed > 0) process.exit(1);
};

runVerification().catch((err) => {
    console.error("Verification error:", err);
    process.exit(1);
});
