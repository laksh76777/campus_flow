import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { User } from "../models/user.models.js";
import { v2 as cloudinary } from "cloudinary";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
const createStudentProfile = asyncHandler(async (req, res) => {
    const {enrollmentNumber,branch,semester,graduationYear,cgpa,backlogs,skills,about
    } = req.body;
    if (
        !enrollmentNumber || !branch || !semester || !graduationYear || cgpa === undefined
    ) {
        throw new ApiError(
            400,
            "Enrollment number, branch, semester, graduation year and CGPA are required"
        );
    }
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    if (user.role !== "student") {
        throw new ApiError(
            403,
            "Only students can create a student profile"
        );
    }
    const existingProfile = await StudentProfile.findOne({
        user: req.user._id
    });
    if (existingProfile) {
        throw new ApiError(
            409,
            "Student profile already exists"
        );
    }
    const existingEnrollment = await StudentProfile.findOne({
        enrollmentNumber
    });
    if (existingEnrollment) {
        throw new ApiError(
            409,
            "Enrollment number is already registered"
        );
    }
    if (!req.file) {
        throw new ApiError(
            400,
            "Resume is required"
        );
    }
    const uploadedResume = await uploadOnCloudinary(
        req.file.path
    );

    if (!uploadedResume) {
        throw new ApiError(
            500,
            "Resume upload failed"
        );
    }
    let parsedSkills = [];

        if (skills) {
            parsedSkills = skills
                .split(",")
                .map((skill) => skill.trim())
                .filter(Boolean);
        }
    const studentProfile = await StudentProfile.create({
        user: req.user._id,
        enrollmentNumber,
        branch,
        semester,
        graduationYear,
        cgpa,
        backlogs: backlogs || 0,
        skills: parsedSkills,
        about: about || "",
        resume: {
            url: uploadedResume.url,
            publicId: uploadedResume.public_id
        }
    });
    return res.status(201).json(
        new ApiResponse(
            201,
            studentProfile,
            "Student profile created successfully"
        )
    );
});

const getCurrentStudentProfile = asyncHandler(async (req, res) => {
    let studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    }).populate(
        "user",
        "-password -refreshToken"
    );

    if (!studentProfile && req.user?.role === "student") {
        const generatedEnrollment = `ENR-${req.user._id.toString().slice(-6).toUpperCase()}`;
        const newProfile = await StudentProfile.create({
            user: req.user._id,
            enrollmentNumber: generatedEnrollment,
            branch: "CSE",
            semester: 6,
            graduationYear: 2027,
            cgpa: 8.0,
            backlogs: 0,
            skills: ["JavaScript", "Python", "React"],
            about: "",
            tenthPercentage: null,
            twelfthPercentage: null,
            certificates: []
        });

        studentProfile = await StudentProfile.findById(newProfile._id).populate(
            "user",
            "-password -refreshToken"
        );
    }

    if (!studentProfile) {
        throw new ApiError(
            404,
            "Student profile not found"
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            studentProfile,
            "Student profile fetched successfully"
        )
    );
});

const updateStudentProfile = asyncHandler(async (req, res) => {

    const {
        enrollmentNumber,
        branch,
        semester,
        graduationYear,
        cgpa,
        backlogs,
        tenthPercentage,
        twelfthPercentage,
        certificates,
        skills,
        about
    } = req.body;

    // Find the logged-in student's profile
    let studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });

    if (!studentProfile) {
        // Auto-initialize profile if it does not exist yet
        const generatedEnrollment = enrollmentNumber || `ENR-${req.user?._id.toString().slice(-6).toUpperCase()}`;
        const newProfile = await StudentProfile.create({
            user: req.user?._id,
            enrollmentNumber: generatedEnrollment,
            branch: branch || "CSE",
            semester: semester ? Number(semester) : 6,
            graduationYear: graduationYear ? Number(graduationYear) : 2027,
            cgpa: cgpa !== undefined ? Number(cgpa) : 8.0,
            backlogs: backlogs !== undefined ? Number(backlogs) : 0,
            tenthPercentage: tenthPercentage !== undefined && tenthPercentage !== null && tenthPercentage !== "" ? Number(tenthPercentage) : null,
            twelfthPercentage: twelfthPercentage !== undefined && twelfthPercentage !== null && twelfthPercentage !== "" ? Number(twelfthPercentage) : null,
            certificates: Array.isArray(certificates) ? certificates : [],
            skills: Array.isArray(skills)
                ? skills
                : typeof skills === "string"
                ? skills.split(",").map((s) => s.trim()).filter(Boolean)
                : [],
            about: about || "",
            resume: { url: "", publicId: "" }
        });

        const populatedNew = await StudentProfile.findById(newProfile._id).populate(
            "user",
            "-password -refreshToken"
        );

        return res.status(200).json(
            new ApiResponse(
                200,
                populatedNew,
                "Student profile created and saved successfully"
            )
        );
    }

    // Check enrollment number if it is being changed
    if (
        enrollmentNumber &&
        enrollmentNumber !== studentProfile.enrollmentNumber
    ) {
        const existingEnrollment = await StudentProfile.findOne({
            enrollmentNumber
        });

        if (existingEnrollment) {
            throw new ApiError(
                409,
                "Enrollment number is already registered"
            );
        }
    }

    // Build update object
    const updateData = {};

    if (enrollmentNumber !== undefined) {
        updateData.enrollmentNumber = enrollmentNumber;
    }

    if (branch !== undefined) {
        updateData.branch = branch;
    }

    if (semester !== undefined) {
        updateData.semester = Number(semester);
    }

    if (graduationYear !== undefined) {
        updateData.graduationYear = Number(graduationYear);
    }

    if (cgpa !== undefined) {
        updateData.cgpa = Number(cgpa);
    }

    if (backlogs !== undefined) {
        updateData.backlogs = Number(backlogs);
    }

    if (tenthPercentage !== undefined) {
        updateData.tenthPercentage = tenthPercentage === "" || tenthPercentage === null ? null : Number(tenthPercentage);
    }

    if (twelfthPercentage !== undefined) {
        updateData.twelfthPercentage = twelfthPercentage === "" || twelfthPercentage === null ? null : Number(twelfthPercentage);
    }

    if (certificates !== undefined) {
        updateData.certificates = Array.isArray(certificates) ? certificates : [];
    }

    if (skills !== undefined) {
        updateData.skills = Array.isArray(skills)
            ? skills
            : typeof skills === "string"
            ? skills.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
    }

    if (about !== undefined) {
        updateData.about = about;
    }

    // Make sure something was actually sent
    if (Object.keys(updateData).length === 0) {
        throw new ApiError(
            400,
            "No fields provided for update"
        );
    }

    const updatedProfile = await StudentProfile.findOneAndUpdate(
        {
            user: req.user?._id
        },
        {
            $set: updateData
        },
        {
            new: true,
            runValidators: true
        }
    ).populate(
        "user",
        "-password -refreshToken"
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            updatedProfile,
            "Student profile updated successfully"
        )
    );
});

const updateStudentResume = asyncHandler(async (req, res) => {

    const resumeLocalPath = req.file?.path;

    if (!resumeLocalPath) {
        throw new ApiError(400, "resume file is missing");
    }

    const resume = await uploadOnCloudinary(resumeLocalPath);

    if (!resume || !resume.url) {
        throw new ApiError(
            400,
            "error while uploading new resume"
        );
    }

    let studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });

    if (!studentProfile) {
        studentProfile = await StudentProfile.create({
            user: req.user?._id,
            enrollmentNumber: `ENR-${req.user?._id.toString().slice(-6).toUpperCase()}`,
            branch: "Computer Science",
            semester: 6,
            graduationYear: 2026,
            cgpa: 8.5,
            backlogs: 0,
            skills: [],
            about: "",
            resume: {
                url: resume.url,
                publicId: resume.public_id
            }
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                studentProfile,
                "Resume uploaded successfully and profile initialized"
            )
        );
    }

    // Delete old resume from Cloudinary
    if (studentProfile.resume?.publicId) {
        await cloudinary.uploader.destroy(
            studentProfile.resume.publicId,
            {
                resource_type: "image"
            }
        );
    }

    studentProfile.resume = {
        url: resume.url,
        publicId: resume.public_id
    };

    await studentProfile.save();

    return res.status(200)
        .json(
            new ApiResponse(
                200,
                studentProfile,
                "resume updated successfully"
            )
        );
});

const getAllStudentProfiles = asyncHandler(async (req, res) => {
    const students = await StudentProfile.find()
        .populate("user", "fullName email role")
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(
            200,
            students,
            "Student profiles fetched successfully"
        )
    );
});

export {
    createStudentProfile,
    getCurrentStudentProfile,
    updateStudentProfile,
    updateStudentResume,
    getAllStudentProfiles
};