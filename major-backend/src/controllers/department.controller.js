import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Department } from "../models/department.model.js";

const DEFAULT_DEPARTMENTS = [
    { name: "Computer Science and Engineering (CSE)", code: "CSE", course: "B.Tech" },
    { name: "Information Science and Engineering (ISE)", code: "ISE", course: "B.Tech" },
    { name: "Electronics and Communication Engineering (ECE)", code: "ECE", course: "B.Tech" },
    { name: "Electrical and Electronics Engineering (EEE)", code: "EEE", course: "B.Tech" },
    { name: "Mechanical Engineering (ME)", code: "ME", course: "B.Tech" },
    { name: "Civil Engineering (CE)", code: "CE", course: "B.Tech" },
    { name: "Artificial Intelligence and Machine Learning (AIML)", code: "AIML", course: "B.Tech" }
];

// @desc    Get all active departments (auto-seeds defaults if empty)
// @route   GET /api/v1/departments
// @access  Public / Authenticated
export const getDepartments = asyncHandler(async (req, res) => {
    let count = await Department.countDocuments();
    if (count === 0) {
        try {
            await Department.insertMany(DEFAULT_DEPARTMENTS);
        } catch (e) {
            console.warn("Auto-seed departments notice:", e.message);
        }
    }

    const filter = req.user?.role === "admin" && req.query.all === "true" ? {} : { isActive: true };
    if (req.query.course) {
        filter.course = req.query.course;
    }

    const departments = await Department.find(filter).sort({ name: 1 });

    return res.status(200).json(
        new ApiResponse(200, departments, "Departments retrieved successfully")
    );
});

// @desc    Create new department
// @route   POST /api/v1/departments
// @access  Admin
export const createDepartment = asyncHandler(async (req, res) => {
    const { name, code, course, college, description } = req.body;

    if (!name || !code) {
        throw new ApiError(400, "Department name and code are required");
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    const existing = await Department.findOne({
        $or: [{ code: cleanCode }, { name: cleanName }]
    });

    if (existing) {
        throw new ApiError(409, `Department with code '${cleanCode}' or name already exists`);
    }

    const department = await Department.create({
        name: cleanName,
        code: cleanCode,
        course: course?.trim() || "B.Tech",
        college: college?.trim() || "Engineering & Technology",
        description: description?.trim() || "",
        isActive: true,
        createdBy: req.user?._id
    });

    return res.status(201).json(
        new ApiResponse(201, department, "Department created successfully")
    );
});

// @desc    Update department
// @route   PATCH /api/v1/departments/:id
// @access  Admin
export const updateDepartment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, code, course, college, description, isActive } = req.body;

    const department = await Department.findById(id);
    if (!department) {
        throw new ApiError(404, "Department not found");
    }

    if (name) department.name = name.trim();
    if (code) department.code = code.trim().toUpperCase();
    if (course !== undefined) department.course = course.trim();
    if (college !== undefined) department.college = college.trim();
    if (description !== undefined) department.description = description.trim();
    if (isActive !== undefined) department.isActive = Boolean(isActive);

    await department.save();

    return res.status(200).json(
        new ApiResponse(200, department, "Department updated successfully")
    );
});

// @desc    Toggle department active status
// @route   PATCH /api/v1/departments/:id/toggle-status
// @access  Admin
export const toggleDepartmentStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const department = await Department.findById(id);
    if (!department) {
        throw new ApiError(404, "Department not found");
    }

    department.isActive = !department.isActive;
    await department.save();

    return res.status(200).json(
        new ApiResponse(200, department, `Department marked ${department.isActive ? "active" : "inactive"}`)
    );
});

// @desc    Seed standard departments
// @route   POST /api/v1/departments/seed-defaults
// @access  Admin
export const seedDepartments = asyncHandler(async (req, res) => {
    for (const d of DEFAULT_DEPARTMENTS) {
        await Department.findOneAndUpdate(
            { code: d.code },
            { $setOnInsert: d },
            { upsert: true }
        );
    }

    const all = await Department.find({}).sort({ name: 1 });
    return res.status(200).json(
        new ApiResponse(200, all, "Standard college departments initialized")
    );
});
