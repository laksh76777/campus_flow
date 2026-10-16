import { getCatalogProgram, PROGRAM_CATALOG, resolveProgram, resolveStudentProgram } from "../constants/programCatalog.js";

export const getDriveProgramCodes = (drive) => {
    if (Array.isArray(drive?.eligibleProgramCodes)) {
        return [...new Set(drive.eligibleProgramCodes.map((code) => getCatalogProgram(code)?.code).filter(Boolean))];
    }

    const branches = Array.isArray(drive?.eligibleBranches) ? drive.eligibleBranches : [];
    if (branches.some((branch) => ["all", "all branches"].includes(String(branch).trim().toLowerCase()))) {
        return PROGRAM_CATALOG.map((program) => program.code);
    }
    return [...new Set(branches.map((branch) => resolveProgram(branch)?.code).filter(Boolean))];
};

export const studentMatchesDriveProgram = (student, drive) => {
    const program = resolveStudentProgram({
        programCode: student?.programCode,
        course: student?.course,
        branch: student?.branch,
        department: student?.department
    });
    return Boolean(program && getDriveProgramCodes(drive).includes(program.code));
};
