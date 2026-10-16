export const PROGRAM_CATALOG = Object.freeze([
    { code: "CSE", name: "Computer Science & Engineering (CSE)", programLevel: "Undergraduate", degreeType: "B.E.", durationYears: 4 },
    { code: "CSE-AIML", name: "Computer Science & Engineering - Artificial Intelligence & Machine Learning (CSE - AI & ML)", programLevel: "Undergraduate", degreeType: "B.E.", durationYears: 4 },
    { code: "ISE", name: "Information Science & Engineering (ISE)", programLevel: "Undergraduate", degreeType: "B.E.", durationYears: 4 },
    { code: "ECE", name: "Electronics & Communication Engineering (ECE)", programLevel: "Undergraduate", degreeType: "B.E.", durationYears: 4 },
    { code: "EIE", name: "Electronics & Instrumentation Engineering (EIE)", programLevel: "Undergraduate", degreeType: "B.E.", durationYears: 4 },
    { code: "RA", name: "Robotics & Automation (RA)", programLevel: "Undergraduate", degreeType: "B.E.", durationYears: 4 },
    { code: "CIVIL", name: "Civil Engineering", programLevel: "Undergraduate", degreeType: "B.E.", durationYears: 4 },
    { code: "MECH", name: "Mechanical Engineering", programLevel: "Undergraduate", degreeType: "B.E.", durationYears: 4 },
    { code: "MBA", name: "Master of Business Administration (MBA)", programLevel: "Postgraduate", degreeType: "MBA", durationYears: 2 },
    { code: "MCA", name: "Master of Computer Applications (MCA)", programLevel: "Postgraduate", degreeType: "MCA", durationYears: 2 },
    { code: "MTECH-DS", name: "M.Tech in Data Science", programLevel: "Postgraduate", degreeType: "M.Tech", durationYears: 2 },
    { code: "MTECH-VLSI", name: "M.Tech in VLSI Design & Embedded Systems", programLevel: "Postgraduate", degreeType: "M.Tech", durationYears: 2 },
    { code: "MTECH-THERMAL", name: "M.Tech in Thermal Engineering", programLevel: "Postgraduate", degreeType: "M.Tech", durationYears: 2 }
]);

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const byCode = new Map(PROGRAM_CATALOG.map((program) => [normalize(program.code), program]));
const aliases = new Map();

const addAliases = (program, values) => {
    for (const value of [program.code, program.name, ...values]) {
        aliases.set(normalize(value), program);
    }
};

addAliases(PROGRAM_CATALOG[0], [
    "Computer Science and Engineering (CSE)",
    "Computer Science and Engineering",
    "Computer Science & Engineering"
]);
addAliases(PROGRAM_CATALOG[1], [
    "CSE - AI & ML",
    "CSE AI and ML",
    "Computer Science and Engineering - Artificial Intelligence and Machine Learning"
]);
addAliases(PROGRAM_CATALOG[2], ["Information Science and Engineering (ISE)", "Information Science and Engineering"]);
addAliases(PROGRAM_CATALOG[3], ["Electronics and Communication Engineering (ECE)", "Electronics and Communication Engineering"]);
addAliases(PROGRAM_CATALOG[4], ["Electronics and Instrumentation Engineering (EIE)", "Electronics and Instrumentation Engineering"]);
addAliases(PROGRAM_CATALOG[5], ["Robotics and Automation (RA)", "Robotics and Automation"]);
addAliases(PROGRAM_CATALOG[6], ["Civil Engineering (CE)"]);
addAliases(PROGRAM_CATALOG[7], ["Mechanical Engineering (ME)", "Mechanical Engineering"]);
addAliases(PROGRAM_CATALOG[8], ["Master of Business Administration", "Business Administration"]);
addAliases(PROGRAM_CATALOG[9], ["Master of Computer Applications", "Computer Applications"]);
addAliases(PROGRAM_CATALOG[10], ["MTech Data Science", "Data Science"]);
addAliases(PROGRAM_CATALOG[11], ["MTech VLSI Design and Embedded Systems", "VLSI Design and Embedded Systems"]);
addAliases(PROGRAM_CATALOG[12], ["MTech Thermal Engineering", "Thermal Engineering"]);

export const normalizeDegreeType = (value) => {
    const normalized = normalize(value);
    if (normalized === "btech" || normalized === "be" || normalized === "bachelorofengineering") return "B.E.";
    if (normalized === "mtech" || normalized === "masteroftechnology") return "M.Tech";
    if (normalized === "mba" || normalized === "masterofbusinessadministration") return "MBA";
    if (normalized === "mca" || normalized === "masterofcomputerapplications") return "MCA";
    return value == null || value === "" ? null : String(value).trim();
};

export const resolveProgram = (value, degreeType) => {
    const program = byCode.get(normalize(value)) || aliases.get(normalize(value));
    if (!program) return null;
    const normalizedDegree = normalizeDegreeType(degreeType);
    return normalizedDegree && normalizedDegree !== program.degreeType ? null : program;
};

export const resolveStudentProgram = ({ programCode, program, branch, department, course, degreeType } = {}) => {
    const selected = programCode !== undefined ? programCode : program;
    const hasStableSelection = programCode !== undefined || program !== undefined;
    const resolved = hasStableSelection
        ? (selected ? resolveProgram(selected) : null)
        : resolveProgram(branch || department, course || degreeType);
    if (!resolved) return null;
    for (const value of [course, degreeType]) {
        const normalizedDegree = normalizeDegreeType(value);
        if (normalizedDegree && normalizedDegree !== resolved.degreeType) return null;
    }
    if (hasStableSelection) {
        for (const value of [branch, department]) {
            if (value == null || String(value).trim() === "") continue;
            if (resolveProgram(value, resolved.degreeType)?.code !== resolved.code) return null;
        }
    }
    return resolved;
};

export const getCatalogProgram = (code) => byCode.get(normalize(code)) || null;
