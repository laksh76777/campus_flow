import "dotenv/config";
import mongoose from "mongoose";
import connectDB, { resolveMongoConnection } from "../db/index.js";
import { Application } from "../models/application.model.js";
import { Department } from "../models/department.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { resolveProgram, resolveStudentProgram } from "../constants/programCatalog.js";

const summarizeStudentValues = (records) => records.map(({ _id, count }) => {
    const program = resolveStudentProgram({
        programCode: _id.programCode,
        course: _id.course,
        branch: _id.branch,
        department: _id.department
    });
    return {
        programCode: _id.programCode || null,
        course: _id.course || null,
        branch: _id.branch || null,
        department: _id.department || null,
        count,
        resolution: program ? { status: "unambiguous", programCode: program.code, programName: program.name } : { status: "needs-authorized-review" }
    };
});

const summarizeDepartments = (records) => records.map(({ _id, count }) => {
    const codeProgram = resolveProgram(_id.code);
    const nameProgram = resolveProgram(_id.name, _id.course);
    const program = codeProgram
        ? (nameProgram && nameProgram.code !== codeProgram.code ? null : codeProgram)
        : nameProgram;
    const levelMatches = !program || !_id.programLevel || _id.programLevel === program.programLevel;
    return {
        code: _id.code || null,
        name: _id.name || null,
        course: _id.course || null,
        programLevel: _id.programLevel || null,
        degreeType: _id.degreeType || null,
        isActive: _id.isActive ?? null,
        count,
        resolution: program && levelMatches
            ? { status: "unambiguous", programCode: program.code, programName: program.name }
            : { status: "needs-authorized-review" }
    };
});

const summarizeTargets = (records) => records.map(({ _id, count }) => {
    const value = String(_id ?? "");
    const program = resolveProgram(value);
    return {
        value,
        count,
        resolution: ["all", "all branches"].includes(value.trim().toLowerCase())
            ? { status: "explicit-all" }
            : program
                ? { status: "unambiguous", programCode: program.code, programName: program.name }
                : { status: "needs-authorized-review" }
    };
});

const runReadOnlyReconciliation = async () => {
    const { databaseName } = resolveMongoConnection(process.env.MONGODB_URI);
    await connectDB();
    const [
        students,
        departments,
        driveTargets,
        snapshotPrograms
    ] = await Promise.all([
        StudentProfile.aggregate([
            { $group: { _id: { programCode: "$programCode", course: "$course", branch: "$branch", department: "$department" }, count: { $sum: 1 } } },
            { $sort: { "_id.programCode": 1, "_id.course": 1, "_id.branch": 1 } }
        ]),
        Department.aggregate([
            { $group: { _id: { code: "$code", name: "$name", course: "$course", programLevel: "$programLevel", degreeType: "$degreeType", isActive: "$isActive" }, count: { $sum: 1 } } },
            { $sort: { "_id.code": 1, "_id.name": 1 } }
        ]),
        PlacementDrive.aggregate([
            { $unwind: { path: "$eligibleBranches", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$eligibleBranches", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        Application.aggregate([
            { $group: { _id: { programCode: "$submittedSnapshot.programCode", course: "$submittedSnapshot.course", branch: "$submittedSnapshot.branch", department: "$submittedSnapshot.department" }, count: { $sum: 1 } } },
            { $sort: { "_id.programCode": 1, "_id.course": 1, "_id.branch": 1 } }
        ])
    ]);

    console.log(JSON.stringify({
        mode: "read-only dry run; no database writes are performed",
        databaseName,
        studentProgramValues: summarizeStudentValues(students),
        departmentRecords: summarizeDepartments(departments),
        driveTargetValues: summarizeTargets(driveTargets),
        applicationSnapshotValues: summarizeStudentValues(snapshotPrograms)
    }, null, 2));
};

runReadOnlyReconciliation()
    .catch((error) => {
        console.error("Program catalogue reconciliation inventory failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
