import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Application } from "../models/application.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { Notification } from "../models/notification.model.js";
import { sendApplicationStatusEmail } from "../utils/mailService.js";
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
        if (existingApplication.status === "withdrawn") {
            existingApplication.status = "applied";
            existingApplication.appliedAt = new Date();
            existingApplication.statusUpdatedAt = new Date();
            await existingApplication.save();

            return res.status(200).json(
                new ApiResponse(
                    200,
                    existingApplication,
                    "Application re-submitted successfully"
                )
            );
        }
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
    const { status, remarks, interviewDate, interviewRound, interviewLocation, offeredPackage } = req.body;
    if (!status) {
        throw new ApiError(
            400,
            "Application status is required"
        );
    }
    const allowedStatus = [
        "applied",
        "shortlisted",
        "interview",
        "selected",
        "rejected",
        "withdrawn"
    ];
    if (!allowedStatus.includes(status)) {
        throw new ApiError(
            400,
            "Invalid application status"
        );
    }
    const application = await Application.findById(applicationId).populate("placementDrive");
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

    if (status === "interview") {
        if (interviewDate) application.interviewDate = new Date(interviewDate);
        if (interviewRound) application.interviewRound = interviewRound.trim();
        if (interviewLocation) application.interviewLocation = interviewLocation.trim();
    }

    if (status === "selected") {
        if (offeredPackage !== undefined && offeredPackage !== null) {
            application.offeredPackage = Number(offeredPackage);
        } else if (application.placementDrive && application.placementDrive.package) {
            // Default to placement drive package if not overridden
            application.offeredPackage = application.placementDrive.package;
        }
    }

    application.statusUpdatedAt = new Date();
    await application.save();

    // Return populated application
    const updatedApplication = await Application.findById(application._id)
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

    // Notify student via In-App Notification and Email
    const studentUser = updatedApplication?.student?.user;
    const companyName = updatedApplication?.placementDrive?.company?.name || "Campus Drive";
    const jobTitle = updatedApplication?.placementDrive?.jobTitle || "";

    if (studentUser?._id) {
        let notifTitle = `Application Status Updated: ${companyName}`;
        let notifType = "status_update";

        if (status === "selected") {
            notifTitle = `🎉 Selected for ${companyName}!`;
            notifType = "selection";
        } else if (status === "interview") {
            notifTitle = `📅 Interview Scheduled - ${companyName}`;
            notifType = "interview";
        } else if (status === "shortlisted") {
            notifTitle = `✨ Shortlisted for ${companyName}`;
            notifType = "status_update";
        } else if (status === "rejected") {
            notifTitle = `Application Update: ${companyName}`;
            notifType = "rejection";
        }

        const notifMessage = remarks
            ? remarks
            : `Your application status for ${companyName} (${jobTitle || "Campus Drive"}) is now ${status.toUpperCase()}.`;

        try {
            await Notification.create({
                user: studentUser._id,
                title: notifTitle,
                message: notifMessage,
                type: notifType,
                status,
                companyName,
                jobTitle,
                remarks: remarks || "",
                interviewDate: application.interviewDate,
                interviewRound: application.interviewRound,
                interviewLocation: application.interviewLocation,
                offeredPackage: application.offeredPackage,
                application: application._id,
            });
        } catch (notifErr) {
            console.error("Failed to create in-app notification:", notifErr.message);
        }

        // Send Email Alert
        if (studentUser?.email) {
            sendApplicationStatusEmail({
                studentEmail: studentUser.email,
                studentName: studentUser.fullName,
                companyName,
                jobTitle,
                status,
                remarks: remarks || "",
                interviewDate: application.interviewDate,
                interviewRound: application.interviewRound,
                interviewLocation: application.interviewLocation,
                offeredPackage: application.offeredPackage,
            }).catch((emailErr) => {
                console.error("Failed to send status email:", emailErr.message);
            });
        }
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            updatedApplication,
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

const getAllApplications = asyncHandler(async (req, res) => {
    const applications = await Application.find()
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
        })
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(
            200,
            applications,
            "All applications fetched successfully"
        )
    );
});

export {
    applyForPlacement,
    getMyApplications,
    withdrawApplication,
    getApplicationsByDrive,
    updateApplicationStatus,
    getApplicationById,
    getAllApplications
};