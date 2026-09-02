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

    const studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    }).populate(
        "user",
        "-password -refreshToken"
    );

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
        skills,
        about
    } = req.body;

    // Find the logged-in student's profile
    const studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });

    if (!studentProfile) {
        throw new ApiError(
            404,
            "Student profile not found"
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
        updateData.semester = semester;
    }

    if (graduationYear !== undefined) {
        updateData.graduationYear = graduationYear;
    }

    if (cgpa !== undefined) {
        updateData.cgpa = cgpa;
    }

    if (backlogs !== undefined) {
        updateData.backlogs = backlogs;
    }

    if (skills !== undefined) {
        updateData.skills = skills;
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

    const studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });

    if (!studentProfile) {
        throw new ApiError(
            404,
            "student profile not found"
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
export {
    createStudentProfile,
    getCurrentStudentProfile,
    updateStudentProfile,
    updateStudentResume
};