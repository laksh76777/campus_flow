import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { Company } from "../models/company.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";

const createPlacementDrive = asyncHandler(async (req, res) => {
    const {
        company,jobTitle,jobDescription,jobType,package: salaryPackage,location,eligibleBranches,minimumCGPA,maximumBacklogs,graduationYear,applicationStartDate,applicationDeadline,driveDate,venue,applicationLink
    } = req.body;
    if ( !company || !jobTitle || !jobType || salaryPackage === undefined || !eligibleBranches || minimumCGPA === undefined || graduationYear === undefined || !applicationStartDate || !applicationDeadline || !driveDate ) {
        throw new ApiError(
            400,
            "Please provide all required placement drive details"
        );
    }
    const existingCompany = await Company.findOne({
        _id: company,
        isActive: true
    });
    if (!existingCompany) {
        throw new ApiError(
            404,
            "Active company not found"
        );
    }
    const startDate = new Date(applicationStartDate);
    const deadline = new Date(applicationDeadline);
    const placementDate = new Date(driveDate);
    if (
        isNaN(startDate.getTime()) ||
        isNaN(deadline.getTime()) ||
        isNaN(placementDate.getTime())
    ) {
        throw new ApiError(
            400,
            "Invalid date provided"
        );
    }
    if (deadline <= startDate) {
        throw new ApiError(
            400,
            "Application deadline must be after application start date"
        );
    }
    if (placementDate < deadline) {
        throw new ApiError(
            400,
            "Drive date must be after application deadline"
        );
    }
    if (minimumCGPA < 0 || minimumCGPA > 10) {
        throw new ApiError(
            400,
            "Minimum CGPA must be between 0 and 10"
        );
    }
    if (
        maximumBacklogs !== undefined &&
        maximumBacklogs < 0
    ) {
        throw new ApiError(
            400,
            "Maximum backlogs cannot be negative"
        );
    }

    const placementDrive = await PlacementDrive.create({
        company,
        jobTitle: jobTitle.trim(),
        jobDescription: jobDescription || "",
        jobType,
        package: salaryPackage,
        location: location || "",
        eligibleBranches,
        minimumCGPA,
        maximumBacklogs:
            maximumBacklogs !== undefined
                ? maximumBacklogs
                : 0,
        graduationYear,
        applicationStartDate: startDate,
        applicationDeadline: deadline,
        driveDate: placementDate,
        venue: venue || "",
        applicationLink: applicationLink || "",
        createdBy: req.user._id
    });
    return res.status(201).json(
        new ApiResponse(
            201,
            placementDrive,
            "Placement drive created successfully"
        )
    );
});

const getAllPlacementDrives = asyncHandler(async (req, res) => {
    const placementDrives = await PlacementDrive.find({
        isActive: true
    })
        .populate(
            "company",
            "companyName companyDescription companyWebsite companyLogo industry location"
        )
        .sort({
            applicationDeadline: 1
        });
    return res.status(200).json(
        new ApiResponse(
            200,
            placementDrives,
            "Placement drives fetched successfully"
        )
    );
});

const getPlacementDriveById = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(
            400,
            "Placement drive ID is required"
        );
    }
    const placementDrive = await PlacementDrive.findOne({
        _id: driveId,
        isActive: true
    })
        .populate(
            "company",
            "companyName companyDescription companyWebsite companyLogo industry location contactEmail contactPhone"
        );
    if (!placementDrive) {
        throw new ApiError(
            404,
            "Placement drive not found"
        );
    }
    return res.status(200).json(
        new ApiResponse(
            200,
            placementDrive,
            "Placement drive fetched successfully"
        )
    );
});

const updatePlacementDrive = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(
            400,
            "Placement drive ID is required"
        );
    }
    const placementDrive = await PlacementDrive.findOne({
        _id: driveId,
        isActive: true
    });
    if (!placementDrive) {
        throw new ApiError(
            404,
            "Placement drive not found"
        );
    }
    const {
        company,jobTitle,jobDescription, jobType,package: salaryPackage,location, eligibleBranches, minimumCGPA, maximumBacklogs, graduationYear, applicationStartDate, applicationDeadline,driveDate, venue,applicationLink
    } = req.body;
    if (company !== undefined) {
        const existingCompany = await Company.findOne({
            _id: company,
            isActive: true
        });
        if (!existingCompany) {
            throw new ApiError(
                404,
                "Active company not found"
            );
        }
        placementDrive.company = company;
    }
    if (jobTitle !== undefined) {
        placementDrive.jobTitle = jobTitle.trim();
    }
    if (jobDescription !== undefined) {
        placementDrive.jobDescription = jobDescription;
    }
    if (jobType !== undefined) {
        placementDrive.jobType = jobType;
    }
    if (salaryPackage !== undefined) {
        if (salaryPackage < 0) {
            throw new ApiError(
                400,
                "Package cannot be negative"
            );
        }
        placementDrive.package = salaryPackage;
    }
    if (location !== undefined) {
        placementDrive.location = location;
    }
    if (eligibleBranches !== undefined) {

        if (
            !Array.isArray(eligibleBranches) ||
            eligibleBranches.length === 0
        ) {
            throw new ApiError(
                400,
                "Eligible branches must be a non-empty array"
            );
        }
        placementDrive.eligibleBranches = eligibleBranches;
    }
    if (minimumCGPA !== undefined) {
        if (
            minimumCGPA < 0 ||
            minimumCGPA > 10
        ) {
            throw new ApiError(
                400,
                "Minimum CGPA must be between 0 and 10"
            );
        }
        placementDrive.minimumCGPA = minimumCGPA;
    }
    if (maximumBacklogs !== undefined) {

        if (maximumBacklogs < 0) {
            throw new ApiError(
                400,
                "Maximum backlogs cannot be negative"
            );
        }
        placementDrive.maximumBacklogs = maximumBacklogs;
    }
    if (graduationYear !== undefined) {
        placementDrive.graduationYear = graduationYear;
    }
    if (venue !== undefined) {
        placementDrive.venue = venue;
    }
    if (applicationLink !== undefined) {
        placementDrive.applicationLink = applicationLink;
    }
    if (applicationStartDate !== undefined) {
        const startDate = new Date(applicationStartDate);
        if (isNaN(startDate.getTime())) {
            throw new ApiError(
                400,
                "Invalid application start date"
            );
        }
        placementDrive.applicationStartDate = startDate;
    }
    if (applicationDeadline !== undefined) {
        const deadline = new Date(applicationDeadline);
        if (isNaN(deadline.getTime())) {
            throw new ApiError(
                400,
                "Invalid application deadline"
            );
        }
        placementDrive.applicationDeadline = deadline;
    }
    if (driveDate !== undefined) {
        const newDriveDate = new Date(driveDate);
        if (isNaN(newDriveDate.getTime())) {
            throw new ApiError(
                400,
                "Invalid drive date"
            );
        }
        placementDrive.driveDate = newDriveDate;
    }
    if (
        placementDrive.applicationDeadline <=
        placementDrive.applicationStartDate
    ) {
        throw new ApiError(
            400,
            "Application deadline must be after application start date"
        );
    }
    if (
        placementDrive.driveDate <
        placementDrive.applicationDeadline
    ) {
        throw new ApiError(
            400,
            "Drive date must be after application deadline"
        );
    }
    await placementDrive.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            placementDrive,
            "Placement drive updated successfully"
        )
    );
});

const deactivatePlacementDrive = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(
            400,
            "Placement drive ID is required"
        );
    }
    const placementDrive = await PlacementDrive.findById(driveId);
    if (!placementDrive) {
        throw new ApiError(
            404,
            "Placement drive not found"
        );
    }
    if (!placementDrive.isActive) {
        throw new ApiError(
            400,
            "Placement drive is already inactive"
        );
    }
    placementDrive.isActive = false;
    await placementDrive.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            placementDrive,
            "Placement drive deactivated successfully"
        )
    );
});

const reactivatePlacementDrive = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(
            400,
            "Placement drive ID is required"
        );
    }
    const placementDrive = await PlacementDrive.findById(driveId);
    if (!placementDrive) {
        throw new ApiError(
            404,
            "Placement drive not found"
        );
    }
    if (placementDrive.isActive) {
        throw new ApiError(
            400,
            "Placement drive is already active"
        );
    }
    placementDrive.isActive = true;
    await placementDrive.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            placementDrive,
            "Placement drive reactivated successfully"
        )
    );
});

const getEligibleStudents = asyncHandler(async (req, res) => {
    const { placementDriveId } = req.params;
    const placementDrive = await PlacementDrive.findById(
        placementDriveId
    );
    if (!placementDrive) {
        throw new ApiError(
            404,
            "Placement drive not found"
        );
    }
    const eligibleStudents = await StudentProfile.find({
        branch: {
            $in: placementDrive.eligibleBranches
        },
        cgpa: {
            $gte: placementDrive.minimumCGPA
        },
        backlogs: {
            $lte: placementDrive.maximumBacklogs
        },
        graduationYear: placementDrive.graduationYear
    })
        .populate(
            "user",
            "fullName email phone avatar"
        );
    return res.status(200).json(
        new ApiResponse(
            200,
            eligibleStudents,
            "Eligible students fetched successfully"
        )
    );
});

const getMyEligibleDrives = asyncHandler(async (req, res) => {
    // 1. Only students can access this
    if (req.user?.role !== "student") {
        throw new ApiError(
            403,
            "Only students can access eligible placement drives"
        );
    }
    // 2. Find student profile
    const studentProfile = await StudentProfile.findOne({
        user: req.user._id
    });

    if (!studentProfile) {
        throw new ApiError(
            404,
            "Student profile not found"
        );
    }
    // 3. Get current date
    const currentDate = new Date();
    // 4. Find all drives for which student is eligible
    const eligibleDrives = await PlacementDrive.find({

        isActive: true,
        eligibleBranches: {
            $in: [studentProfile.branch]
        },
        minimumCGPA: {
            $lte: studentProfile.cgpa
        },
        maximumBacklogs: {
            $gte: studentProfile.backlogs
        },
        graduationYear: studentProfile.graduationYear,

        applicationStartDate: {
            $lte: currentDate
        },
        applicationDeadline: {
            $gte: currentDate
        }
    })
        .populate(
            "company",
            "companyName companyDescription companyWebsite companyLogo industry location"
        )
        .sort({
            applicationDeadline: 1
        });
    // 5. Return eligible drives
    return res.status(200).json(
        new ApiResponse(
            200,
            eligibleDrives,
            "Eligible placement drives fetched successfully"
        )
    );
});
export {
    createPlacementDrive,
    getAllPlacementDrives,
    getPlacementDriveById,  
    updatePlacementDrive,
    deactivatePlacementDrive,
    reactivatePlacementDrive,
    getEligibleStudents,
    getMyEligibleDrives
};