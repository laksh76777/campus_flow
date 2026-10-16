import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { PROGRAM_CATALOG, normalizeDegreeType } from "../constants/programCatalog.js";

const getDepartments = asyncHandler(async (req, res) => {
    let programs = PROGRAM_CATALOG;
    if (req.query.course) {
        const course = normalizeDegreeType(req.query.course);
        programs = programs.filter((program) => program.degreeType === course);
    }
    if (req.query.programLevel) {
        programs = programs.filter((program) => program.programLevel === req.query.programLevel);
    }

    const response = programs.map((program) => ({
        _id: program.code,
        ...program,
        course: program.degreeType,
        isActive: true
    }));
    return res.status(200).json(new ApiResponse(200, response, "Approved academic programs retrieved successfully"));
});

const immutableCatalogError = () => {
    throw new ApiError(405, "The approved academic program catalogue is centrally managed and cannot be changed through this endpoint");
};

const createDepartment = asyncHandler(async () => immutableCatalogError());
const updateDepartment = asyncHandler(async () => immutableCatalogError());
const toggleDepartmentStatus = asyncHandler(async () => immutableCatalogError());

const seedDepartments = asyncHandler(async (req, res) => {
    return getDepartments(req, res);
});

export {
    getDepartments,
    createDepartment,
    updateDepartment,
    toggleDepartmentStatus,
    seedDepartments
};
