import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Application } from "../models/application.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
const applyForPlacement = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(
            400,
            "Placement drive ID is required"
        );
    }
    if (req.user?.role !== "student") {
        throw new ApiError(
            403,
            "Only students can apply for placement drives"
        );
    }
    const studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });
    if (!studentProfile) {
        throw new ApiError(
            404,
            "Student profile not found"
        );
    }
    const placementDrive = await PlacementDrive.findOne({
        _id: driveId,
        isActive: true
    });
    if (!placementDrive) {
        throw new ApiError(
            404,
            "Active placement drive not found"
        );
    }
    const currentDate = new Date();

    if (currentDate < placementDrive.applicationStartDate) {
        throw new ApiError(
            400,
            "Application period has not started yet"
        );
    }
    if (currentDate > placementDrive.applicationDeadline) {
        throw new ApiError(
            400,
            "Application deadline has passed"
        );
    }
    if (
        !placementDrive.eligibleBranches.includes(
            studentProfile.branch
        )
    ) {
        throw new ApiError(
            403,
            "Your branch is not eligible for this placement drive"
        );
    }
    if (
        studentProfile.cgpa <
        placementDrive.minimumCGPA
    ) {
        throw new ApiError(
            403,
            `Minimum CGPA required is ${placementDrive.minimumCGPA}`
        );
    }
    if (
        studentProfile.backlogs >
        placementDrive.maximumBacklogs
    ) {
        throw new ApiError(
            403,
            `Maximum ${placementDrive.maximumBacklogs} backlogs allowed`
        );
    }
    if (
        studentProfile.graduationYear !==
        placementDrive.graduationYear
    ) {
        throw new ApiError(
            403,
            "Your graduation year is not eligible for this placement drive"
        );
    }
    const existingApplication = await Application.findOne({
        student: studentProfile._id,
        placementDrive: placementDrive._id
    });
    if (existingApplication) {
        throw new ApiError(
            409,
            "You have already applied for this placement drive"
        );
    }
    const application = await Application.create({
        student: studentProfile._id,
        placementDrive: placementDrive._id
    });
    return res.status(201).json(
        new ApiResponse(
            201,
            application,
            "Application submitted successfully"
        )
    );
});

const getMyApplications = asyncHandler(async (req, res) => {
    if (req.user?.role !== "student") {
        throw new ApiError(
            403,
            "Only students can access their applications"
        );
    }
    const studentProfile = await StudentProfile.findOne({
        user: req.user._id
    });

    if (!studentProfile) {
        throw new ApiError(
            404,
            "Student profile not found"
        );
    }
     const applications = await Application.find({
        student: studentProfile._id
    })
        .populate({
            path: "placementDrive",
            populate: {
                path: "company"
            }
        })
        .sort({
            appliedAt: -1
        });
    return res.status(200).json(
        new ApiResponse(
            200,
            applications,
            "Applications fetched successfully"
        )
    );
});

const withdrawApplication = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    if (req.user?.role !== "student") {
        throw new ApiError(
            403,
            "Only students can withdraw applications"
        );
    }
    const studentProfile = await StudentProfile.findOne({
        user: req.user._id
    });

    if (!studentProfile) {
        throw new ApiError(
            404,
            "Student profile not found"
        );
    }
    const application = await Application.findById(applicationId);

    if (!application) {
        throw new ApiError(
            404,
            "Application not found"
        );
    }
    if (
        application.student.toString() !==
        studentProfile._id.toString()
    ) {
        throw new ApiError(
            403,
            "You are not allowed to withdraw this application"
        );
    }
    if (application.status === "withdrawn") {
        throw new ApiError(
            400,
            "Application is already withdrawn"
        );
    }
    if (
        application.status === "selected" ||
        application.status === "rejected"
    ) {
        throw new ApiError(
            400,
            `Cannot withdraw an application with status "${application.status}"`
        );
    }
    application.status = "withdrawn";
    application.statusUpdatedAt = new Date();

    await application.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            application,
            "Application withdrawn successfully"
        )
    );
});

const getApplicationsByDrive = asyncHandler(async (req, res) => {
    const { placementDriveId } = req.params;
    const applications = await Application.find({
        placementDrive: placementDriveId
    })
        .populate(
            "student",
            "enrollmentNumber branch semester graduationYear cgpa backlogs skills"
        )
        .populate(
            "placementDrive",
            "jobTitle package location driveDate"
        )
        .sort({ appliedAt: -1 });
    return res.status(200).json(
        new ApiResponse(
            200,
            applications,
            "Applications fetched successfully"
        )
    );
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const { status, remarks } = req.body;
    if (!status) {
        throw new ApiError(
            400,
            "Application status is required"
        );
    }
    const allowedStatus = [
        "applied",
        "shortlisted",
        "rejected",
        "selected"
    ];
    if (!allowedStatus.includes(status)) {
        throw new ApiError(
            400,
            "Invalid application status"
        );
    }
    const application = await Application.findById(applicationId);
    if (!application) {
        throw new ApiError(
            404,
            "Application not found"
        );
    }
    application.status = status;

    if (remarks !== undefined) {
        application.remarks = remarks;
    }
    application.statusUpdatedAt = new Date();
    await application.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            application,
            "Application status updated successfully"
        )
    );
});

const getApplicationById = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const application = await Application.findById(applicationId)
        .populate({
            path: "student",
            populate: {
                path: "user",
                select: "fullName email phone avatar"
            }
        })
        .populate({
            path: "placementDrive",
            populate: {
                path: "company"
            }
        });

    if (!application) {
        throw new ApiError(
            404,
            "Application not found"
        );
    }
    return res.status(200).json(
        new ApiResponse(
            200,
            application,
            "Application fetched successfully"
        )
    );
});
export {
    applyForPlacement,
    getMyApplications,
    withdrawApplication,
    getApplicationsByDrive,
    updateApplicationStatus,
    getApplicationById
};