import dotenv from "dotenv";
import connectDB from "../src/db/index.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { PlacementSession } from "../src/models/placementSession.model.js";

import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function runUpdate() {
    console.log("Connecting to database...");
    await connectDB();

    console.log("\n--- 1. Updating Placement Sessions to 4-Year Batch Formats ---");

    // Session 2027
    const s2027 = await PlacementSession.findOneAndUpdate(
        { sessionYear: 2027 },
        {
            $set: {
                academicYear: "2023-2027",
                name: "Placement Session 2023-2027 (Class of 2027)",
                description: "Official 4-year undergraduate engineering placement session for 2023-2027 cohort (Class of 2027)."
            }
        },
        { new: true }
    );
    console.log("Updated Session 2027:", s2027?.academicYear, "|", s2027?.name);

    // Session 2026
    const s2026 = await PlacementSession.findOneAndUpdate(
        { sessionYear: 2026 },
        {
            $set: {
                academicYear: "2022-2026",
                name: "Placement Session 2022-2026 (Class of 2026)",
                description: "Placement session for 2022-2026 cohort (Class of 2026)."
            }
        },
        { new: true }
    );
    console.log("Updated Session 2026:", s2026?.academicYear, "|", s2026?.name);

    // Session 2028
    const s2028 = await PlacementSession.findOneAndUpdate(
        { sessionYear: 2028 },
        {
            $set: {
                academicYear: "2024-2028",
                name: "Placement Session 2024-2028 (Class of 2028)",
                description: "Upcoming placement session for 2024-2028 cohort (Class of 2028)."
            }
        },
        { new: true }
    );
    console.log("Updated Session 2028:", s2028?.academicYear, "|", s2028?.name);

    console.log("\n--- 2. Updating All 160 Students (Current Sem: 7, Sem 7 In Progress with No Marks) ---");

    const students = await StudentProfile.find({ usn: /^1JS23/ });
    console.log(`Found ${students.length} students with USN starting with 1JS23...`);

    let updatedCount = 0;
    for (const student of students) {
        // Filter semesterResults to only include completed semesters (1 through 6)
        const completedResults = student.semesterResults.filter(r => r.semester <= 6);

        // Recalculate CGPA over the 6 completed semesters
        let newCgpa = null;
        if (completedResults.length > 0) {
            const sum = completedResults.reduce((acc, curr) => acc + curr.sgpa, 0);
            newCgpa = Number((sum / completedResults.length).toFixed(2));
        }

        student.semesterResults = completedResults;
        student.currentSemester = 7;
        student.semester = 7;
        student.cgpa = newCgpa;
        student.verifiedCGPA = newCgpa;

        await student.save();
        updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} students.`);

    // Verify sample student
    const sample = await StudentProfile.findOne({ usn: "1JS23CS001" });
    console.log("\nVerification on Sample 1JS23CS001:");
    console.log("- Current Semester:", sample.currentSemester);
    console.log("- Semester Results count:", sample.semesterResults.length);
    console.log("- Semesters:", sample.semesterResults.map(r => `S${r.semester}: ${r.sgpa}`).join(", "));
    console.log("- Recalculated 6-Sem CGPA:", sample.cgpa);

    process.exit(0);
}

runUpdate().catch(err => {
    console.error("Update failed:", err);
    process.exit(1);
});
