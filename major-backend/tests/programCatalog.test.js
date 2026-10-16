import test from "node:test";
import assert from "node:assert/strict";
import {
    getCatalogProgram,
    normalizeDegreeType,
    PROGRAM_CATALOG,
    resolveProgram,
    resolveStudentProgram
} from "../src/constants/programCatalog.js";
import { studentMatchesDriveProgram } from "../src/services/programTargeting.service.js";
import { generateImportTemplate } from "../src/services/excelImportExport.service.js";

test("catalogue contains only the thirteen approved programs and exact names", () => {
    assert.equal(PROGRAM_CATALOG.length, 13);
    assert.deepEqual(PROGRAM_CATALOG.map(({ name }) => name), [
        "Computer Science & Engineering (CSE)",
        "Computer Science & Engineering - Artificial Intelligence & Machine Learning (CSE - AI & ML)",
        "Information Science & Engineering (ISE)",
        "Electronics & Communication Engineering (ECE)",
        "Electronics & Instrumentation Engineering (EIE)",
        "Robotics & Automation (RA)",
        "Civil Engineering",
        "Mechanical Engineering",
        "Master of Business Administration (MBA)",
        "Master of Computer Applications (MCA)",
        "M.Tech in Data Science",
        "M.Tech in VLSI Design & Embedded Systems",
        "M.Tech in Thermal Engineering"
    ]);
    assert.equal(PROGRAM_CATALOG.filter((program) => program.programLevel === "Undergraduate").length, 8);
    assert.equal(PROGRAM_CATALOG.filter((program) => program.programLevel === "Postgraduate").length, 5);
});

test("stable identifiers resolve and reject invalid or inconsistent selections", () => {
    assert.equal(getCatalogProgram("cse-aiml").name, PROGRAM_CATALOG[1].name);
    assert.equal(resolveProgram("Computer Science and Engineering").code, "CSE");
    assert.equal(resolveStudentProgram({ branch: "Computer Science and Engineering", course: "B.Tech" }).code, "CSE");
    assert.equal(resolveStudentProgram({ programCode: "UNKNOWN", branch: "CSE", course: "B.E." }), null);
    assert.equal(resolveStudentProgram({ programCode: "CSE", course: "MCA" }), null);
    assert.equal(resolveStudentProgram({ programCode: "CSE", branch: "Information Science & Engineering (ISE)", course: "B.E." }), null);
    assert.equal(resolveStudentProgram({ programCode: "CSE", branch: "Unsupported Legacy Program", course: "B.E." }), null);
    assert.equal(resolveStudentProgram({ programCode: "", branch: "CSE" }), null);
    assert.equal(resolveProgram("Electrical and Electronics Engineering"), null);
    assert.equal(resolveProgram("M.Tech"), null);
    assert.equal(normalizeDegreeType("B.Tech"), "B.E.");
});

test("drive targeting matches exact catalogue programs without substring matches", () => {
    const cseStudent = { programCode: "CSE", course: "B.E.", branch: PROGRAM_CATALOG[0].name };
    const aiStudent = { programCode: "CSE-AIML", course: "B.E.", branch: PROGRAM_CATALOG[1].name };
    const cseOnlyDrive = { eligibleProgramCodes: ["CSE"], eligibleBranches: [PROGRAM_CATALOG[0].name] };
    const allProgramsDrive = {
        eligibleProgramCodes: PROGRAM_CATALOG.map((program) => program.code),
        eligibleBranches: PROGRAM_CATALOG.map((program) => program.name)
    };
    const unrecognizedLegacyDrive = { eligibleBranches: ["IT"] };

    assert.equal(studentMatchesDriveProgram(cseStudent, cseOnlyDrive), true);
    assert.equal(studentMatchesDriveProgram(aiStudent, cseOnlyDrive), false);
    assert.equal(studentMatchesDriveProgram(aiStudent, allProgramsDrive), true);
    assert.equal(studentMatchesDriveProgram(cseStudent, unrecognizedLegacyDrive), false);
});

test("Excel templates do not supply fabricated students, companies, or session years", async () => {
    const studentTemplate = await generateImportTemplate("student_records");
    const academicTemplate = await generateImportTemplate("academic_history");
    const placementTemplate = await generateImportTemplate("historical_placements");

    assert.equal(studentTemplate.getWorksheet("Student Records").rowCount, 1);
    assert.equal(academicTemplate.getWorksheet("Academic History").rowCount, 1);
    assert.equal(placementTemplate.getWorksheet("Historical Placements").rowCount, 1);

    const placementInstructions = placementTemplate.getWorksheet("Instructions & Guide");
    const text = placementInstructions.getSheetValues().flat().join(" ");
    assert.match(text, /existing configured placement session/i);
    assert.match(text, /actual historical date/i);
    assert.doesNotMatch(text, /2027|Infosys|Google|Microsoft/i);
});
