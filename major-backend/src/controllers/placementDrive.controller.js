import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { PlacementDrive, DEFAULT_STUDENT_REQUIREMENTS, DEFAULT_SELECTION_ROUNDS } from "../models/placementDrive.model.js";
import { Company } from "../models/company.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Application } from "../models/application.model.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { EligibilityService } from "../services/eligibility.service.js";
import { getCatalogProgram, PROGRAM_CATALOG, resolveProgram } from "../constants/programCatalog.js";
import { studentMatchesDriveProgram } from "../services/programTargeting.service.js";
import { syncDriveReminders } from "../services/reminderScheduler.service.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const normalizeEligiblePrograms = (programCodes, branches) => {
    let rawCodes = programCodes;
    if (typeof rawCodes === "string") {
        try {
            const parsed = JSON.parse(rawCodes);
            if (Array.isArray(parsed)) rawCodes = parsed;
        } catch {
            rawCodes = rawCodes.split(",").map((c) => c.trim()).filter(Boolean);
        }
    }

    let rawBranches = branches;
    if (typeof rawBranches === "string") {
        try {
            const parsed = JSON.parse(rawBranches);
            if (Array.isArray(parsed)) rawBranches = parsed;
        } catch {
            rawBranches = rawBranches.split(",").map((b) => b.trim()).filter(Boolean);
        }
    }

    let programs;
    if (rawCodes !== undefined) {
        if (!Array.isArray(rawCodes) || rawCodes.length === 0) {
            throw new ApiError(400, "Select at least one approved academic program");
        }
        programs = rawCodes.map((code) => getCatalogProgram(code));
        if (programs.some((program) => !program)) {
            throw new ApiError(400, "Drive targeting contains an unknown academic program code");
        }
    } else {
        if (!Array.isArray(rawBranches) || rawBranches.length === 0) {
            throw new ApiError(400, "Select at least one approved academic program");
        }
        if (rawBranches.some((branch) => ["all", "all branches"].includes(String(branch).trim().toLowerCase()))) {
            programs = PROGRAM_CATALOG;
        } else {
            programs = rawBranches.map((branch) => resolveProgram(branch));
            if (programs.some((program) => !program)) {
                throw new ApiError(400, "Drive targeting contains an unknown or unsupported legacy program value");
            }
        }
    }
    const uniquePrograms = [...new Map(programs.map((program) => [program.code, program])).values()];
    return {
        eligibleProgramCodes: uniquePrograms.map((program) => program.code),
        eligibleBranches: uniquePrograms.map((program) => program.name)
    };
};

const processJdPdfUpload = async (req) => {
    let jdAttachment = { url: "", fileName: "" };
    if (req.file) {
        try {
            const uploadRes = await uploadOnCloudinary(req.file.path, {
                folder: "campusflow/job_descriptions",
                resource_type: "image"
            });
            if (uploadRes?.secure_url) {
                jdAttachment = {
                    url: uploadRes.secure_url,
                    fileName: req.file.originalname || "Job_Description.pdf"
                };
            }
        } catch (uploadErr) {
            console.warn("Cloudinary upload failed, using fallback:", uploadErr.message);
            jdAttachment = {
                url: `/uploads/${req.file.filename}`,
                fileName: req.file.originalname || "Job_Description.pdf"
            };
        }
    } else if (req.body.jdPdf) {
        if (typeof req.body.jdPdf === "string") {
            try {
                jdAttachment = JSON.parse(req.body.jdPdf);
            } catch {
                jdAttachment = { url: req.body.jdPdf, fileName: "Job_Description.pdf" };
            }
        } else if (typeof req.body.jdPdf === "object") {
            jdAttachment = {
                url: req.body.jdPdf.url || "",
                fileName: req.body.jdPdf.fileName || "Job_Description.pdf"
            };
        }
    } else if (req.body.jdUrl || req.body.jdPdfUrl) {
        jdAttachment = {
            url: req.body.jdUrl || req.body.jdPdfUrl,
            fileName: req.body.jdFileName || req.body.jdPdfName || "Job_Description.pdf"
        };
    }
    return jdAttachment;
};

const createPlacementDrive = asyncHandler(async (req, res) => {
    const {
        company,jobTitle,jobDescription,jobType,package: salaryPackage,location,eligibleBranches,eligibleProgramCodes,minimumCGPA,maximumBacklogs,graduationYear,placementSession,applicationStartDate,applicationDeadline,driveDate,venue,applicationLink,
        minimumTenthPercentage,minimumTwelfthPercentage,maximumHistoricalBacklogs,
        internshipType, stipend, internshipDuration
    } = req.body;
    if ( !company || !jobTitle || !jobType || salaryPackage === undefined || (!eligibleBranches && !eligibleProgramCodes) || minimumCGPA === undefined || graduationYear === undefined || !placementSession || !applicationStartDate || !applicationDeadline || !driveDate ) {
        throw new ApiError(
            400,
            "Please provide all required placement drive details"
        );
    }
    const programTargeting = normalizeEligiblePrograms(eligibleProgramCodes, eligibleBranches);
    const session = await PlacementSession.findById(placementSession);
    if (!session || session.sessionYear !== Number(graduationYear) || session.isClosed || session.isArchived) {
        throw new ApiError(400, "Select an open placement session matching the drive's graduation year");
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

    const jdAttachment = await processJdPdfUpload(req);

    const normalizedJobType = (jobType || "").toLowerCase().trim();
    const resolvedInternshipType = internshipType && ["paid", "unpaid", "not_applicable"].includes(internshipType)
        ? internshipType
        : (normalizedJobType.includes("internship") ? "paid" : "not_applicable");

    const placementDrive = await PlacementDrive.create({
        company,
        jobTitle: jobTitle.trim(),
        jobDescription: jobDescription || "",
        jobType: normalizedJobType,
        internshipType: resolvedInternshipType,
        stipend: stipend ? String(stipend).trim() : "",
        internshipDuration: internshipDuration ? String(internshipDuration).trim() : "",
        jdPdf: jdAttachment,
        package: salaryPackage,
        location: location || "",
        ...programTargeting,
        minimumCGPA,
        maximumBacklogs:
            maximumBacklogs !== undefined
                ? maximumBacklogs
                : 0,
        graduationYear,
        placementSession: session._id,
        minimumTenthPercentage: minimumTenthPercentage !== undefined ? Number(minimumTenthPercentage) : 0,
        minimumTwelfthPercentage: minimumTwelfthPercentage !== undefined ? Number(minimumTwelfthPercentage) : 0,
        maximumHistoricalBacklogs: maximumHistoricalBacklogs !== undefined && maximumHistoricalBacklogs !== null ? Number(maximumHistoricalBacklogs) : null,
        applicationStartDate: startDate,
        applicationDeadline: deadline,
        driveDate: placementDate,
        venue: venue || "",
        applicationLink: applicationLink || "",
        createdBy: req.user._id,
        requirementsVersion: 1,
        studentRequirements: (() => {
            let reqs = req.body.studentRequirements;
            if (typeof reqs === "string") {
                try { reqs = JSON.parse(reqs); } catch { reqs = null; }
            }
            return Array.isArray(reqs) && reqs.length > 0 ? reqs : DEFAULT_STUDENT_REQUIREMENTS;
        })(),
        reminderSettings: (() => {
            let settings = req.body.reminderSettings;
            if (typeof settings === "string") {
                try { settings = JSON.parse(settings); } catch { settings = {}; }
            }
            return {
                remindersEnabled: settings?.remindersEnabled !== undefined
                    ? Boolean(settings.remindersEnabled)
                    : true,
                reminderOffsetsHours: Array.isArray(settings?.reminderOffsetsHours) && settings.reminderOffsetsHours.length > 0
                    ? settings.reminderOffsetsHours.map(Number).filter((n) => !isNaN(n) && n > 0)
                    : [6],
                channels: Array.isArray(settings?.channels) && settings.channels.length > 0
                    ? settings.channels
                    : ["in_app", "email"]
            };
        })(),
        selectionRounds: (() => {
            let rounds = req.body.selectionRounds;
            if (typeof rounds === "string") {
                try { rounds = JSON.parse(rounds); } catch { rounds = null; }
            }
            if (Array.isArray(rounds) && rounds.length > 0) {
                return rounds.map((r, idx) => ({
                    roundNumber: Number(r.roundNumber || idx + 1),
                    name: String(r.name || `Round ${idx + 1}`).trim(),
                    description: r.description ? String(r.description).trim() : "",
                    status: idx === 0 ? "in_progress" : "pending",
                }));
            }
            return DEFAULT_SELECTION_ROUNDS.map((r, idx) => ({
                ...r,
                status: idx === 0 ? "in_progress" : "pending"
            }));
        })(),
        currentRoundNumber: 1
    });

    // Schedule deadline reminders persistently
    await syncDriveReminders(placementDrive._id);

    return res.status(201).json(
        new ApiResponse(
            201,
            placementDrive,
            "Placement drive created successfully"
        )
    );
});

const getAllPlacementDrives = asyncHandler(async (req, res) => {
    const filter = req.user?.role === "admin" ? {} : { isActive: true };
    if (req.query.session) {
        filter.placementSession = req.query.session;
    }
    const placementDrives = await PlacementDrive.find(filter)
        .populate(
            "company",
            "companyName companyDescription companyWebsite companyLogo industry location"
        )
        .populate("placementSession", "sessionName academicYear graduatingYear isActive")
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

    let responseData = placementDrive.toObject ? placementDrive.toObject() : placementDrive;
    if (req.user?.role === "student") {
        const studentProfile = await StudentProfile.findOne({ user: req.user._id });
        if (studentProfile) {
            const evaluation = EligibilityService.evaluate(studentProfile, placementDrive);
            responseData.isEligible = Boolean(evaluation.isEligible);
            responseData.eligibilityStatus = evaluation.status;
            responseData.eligibilityReasons = evaluation.reasons || [];
            responseData.eligibilitySummary = evaluation.summary || "";
            responseData.criteriaBreakdown = evaluation.criteriaBreakdown || [];
        }
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            responseData,
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
        company,jobTitle,jobDescription, jobType,package: salaryPackage,location, eligibleBranches, eligibleProgramCodes, minimumCGPA, maximumBacklogs, graduationYear, applicationStartDate, applicationDeadline,driveDate, venue,applicationLink,
        placementSession, minimumTenthPercentage, minimumTwelfthPercentage, maximumHistoricalBacklogs
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
        placementDrive.jobType = jobType.toLowerCase().trim();
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
    if (eligibleBranches !== undefined || eligibleProgramCodes !== undefined) {
        const programTargeting = normalizeEligiblePrograms(eligibleProgramCodes, eligibleBranches);
        placementDrive.eligibleProgramCodes = programTargeting.eligibleProgramCodes;
        placementDrive.eligibleBranches = programTargeting.eligibleBranches;
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
    if (graduationYear !== undefined || placementSession !== undefined) {
        const nextGraduationYear = Number(graduationYear ?? placementDrive.graduationYear);
        const nextSessionId = placementSession ?? placementDrive.placementSession;
        const session = nextSessionId ? await PlacementSession.findById(nextSessionId) : null;
        if (!session || session.sessionYear !== nextGraduationYear) {
            throw new ApiError(400, "Placement session must match the drive's graduation year");
        }
        placementDrive.graduationYear = nextGraduationYear;
        placementDrive.placementSession = session._id;
    }
    if (minimumTenthPercentage !== undefined) {
        placementDrive.minimumTenthPercentage = Number(minimumTenthPercentage);
    }
    if (minimumTwelfthPercentage !== undefined) {
        placementDrive.minimumTwelfthPercentage = Number(minimumTwelfthPercentage);
    }
    if (maximumHistoricalBacklogs !== undefined) {
        placementDrive.maximumHistoricalBacklogs = maximumHistoricalBacklogs !== null ? Number(maximumHistoricalBacklogs) : null;
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
    if (req.body.studentRequirements !== undefined && Array.isArray(req.body.studentRequirements)) {
        placementDrive.studentRequirements = req.body.studentRequirements;
        placementDrive.requirementsVersion = (placementDrive.requirementsVersion || 1) + 1;
    }
    if (req.body.reminderSettings !== undefined) {
        placementDrive.reminderSettings = {
            remindersEnabled: req.body.reminderSettings.remindersEnabled !== undefined
                ? Boolean(req.body.reminderSettings.remindersEnabled)
                : placementDrive.reminderSettings?.remindersEnabled ?? true,
            reminderOffsetsHours: Array.isArray(req.body.reminderSettings.reminderOffsetsHours) && req.body.reminderSettings.reminderOffsetsHours.length > 0
                ? req.body.reminderSettings.reminderOffsetsHours.map(Number).filter((n) => !isNaN(n) && n > 0)
                : placementDrive.reminderSettings?.reminderOffsetsHours || [6],
            channels: Array.isArray(req.body.reminderSettings.channels) && req.body.reminderSettings.channels.length > 0
                ? req.body.reminderSettings.channels
                : placementDrive.reminderSettings?.channels || ["in_app", "email"]
        };
    }

    if (req.body.internshipType !== undefined) {
        placementDrive.internshipType = req.body.internshipType;
    }
    if (req.body.stipend !== undefined) {
        placementDrive.stipend = String(req.body.stipend).trim();
    }
    if (req.body.internshipDuration !== undefined) {
        placementDrive.internshipDuration = String(req.body.internshipDuration).trim();
    }
    if (req.file || req.body.jdPdf !== undefined || req.body.jdUrl !== undefined) {
        const jdAttachment = await processJdPdfUpload(req);
        if (jdAttachment.url) {
            placementDrive.jdPdf = jdAttachment;
        }
    }

    await placementDrive.save();

    // Sync reminders on deadline/settings update
    await syncDriveReminders(placementDrive._id);

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
    await syncDriveReminders(placementDrive._id);

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
    await syncDriveReminders(placementDrive._id);

    return res.status(200).json(
        new ApiResponse(
            200,
            placementDrive,
            "Placement drive reactivated successfully"
        )
    );
});

// @desc    Permanently delete a placement drive and clean associated applications
// @route   DELETE /api/v1/placementdrive/:driveId
// @access  Admin
const deletePlacementDrive = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(400, "Placement drive ID is required");
    }

    const placementDrive = await PlacementDrive.findById(driveId);
    if (!placementDrive) {
        throw new ApiError(404, "Placement drive not found");
    }

    // Find all applications associated with this drive
    const applications = await Application.find({ placementDrive: driveId });
    const appIds = applications.map((a) => a._id);

    // If any student was marked as placed through this drive's accepted offer, revert their profile
    const studentIds = applications.map((a) => a.student).filter(Boolean);
    if (studentIds.length > 0) {
        const company = await Company.findById(placementDrive.company);
        const compName = company?.companyName || "";

        await StudentProfile.updateMany(
            {
                _id: { $in: studentIds },
                $or: [
                    { placedCompany: compName },
                    { placedJobTitle: placementDrive.jobTitle }
                ]
            },
            {
                $set: {
                    isPlaced: false,
                    placedCompany: "",
                    placedPackage: null,
                    placedAt: null,
                    placedJobTitle: ""
                }
            }
        );
    }

    // Delete all associated applications
    if (appIds.length > 0) {
        await Application.deleteMany({ _id: { $in: appIds } });
    }

    // Delete the placement drive
    await PlacementDrive.findByIdAndDelete(driveId);

    return res.status(200).json(
        new ApiResponse(
            200,
            { driveId, deletedApplicationsCount: appIds.length },
            "Placement drive and all related applications deleted successfully"
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
        cgpa: {
            $gte: placementDrive.minimumCGPA
        },
        backlogs: {
            $lte: placementDrive.maximumBacklogs
        },
        graduationYear: placementDrive.graduationYear
    });
    const matchedStudents = eligibleStudents.filter((student) => studentMatchesDriveProgram(student, placementDrive));
    const populatedStudents = await StudentProfile.populate(matchedStudents, {
        path: "user",
        select: "fullName email phone avatar"
    });
    return res.status(200).json(
        new ApiResponse(200, populatedStudents, "Eligible students fetched successfully")
    );
});

const getMyEligibleDrives = asyncHandler(async (req, res) => {
    // 1. Only students can access this
    if (req.user?.role !== "student") {
        throw new ApiError(
            403,
            "Only students can access placement drives"
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

    // 3. Fetch all active drives so all drives are visible to every student
    const candidateDrives = await PlacementDrive.find({
        isActive: true
    }).populate({
        path: "company",
        select: "companyName companyDescription companyWebsite companyLogo industry location"
    });

    // 4. Deterministically evaluate student eligibility for EACH drive
    const drivesWithEligibility = candidateDrives.map((drive) => {
        const driveObj = drive.toObject();
        const evaluation = EligibilityService.evaluate(studentProfile, drive);
        driveObj.isEligible = Boolean(evaluation.isEligible);
        driveObj.eligibilityStatus = evaluation.status;
        driveObj.eligibilityReasons = evaluation.reasons || [];
        driveObj.eligibilitySummary = evaluation.summary || "";
        driveObj.criteriaBreakdown = evaluation.criteriaBreakdown || [];
        return driveObj;
    });

    // Sort: Eligible drives first, then by nearest application deadline
    drivesWithEligibility.sort((a, b) => {
        if (a.isEligible !== b.isEligible) {
            return a.isEligible ? -1 : 1;
        }
        return new Date(a.applicationDeadline) - new Date(b.applicationDeadline);
    });

    // 5. Return all drives with eligibility evaluation and detailed reasons
    return res.status(200).json(
        new ApiResponse(
            200,
            drivesWithEligibility,
            "Placement drives fetched successfully with eligibility evaluation"
        )
    );
});

// @desc    Check student eligibility breakdown for a specific placement drive
// @route   GET /api/v1/placementdrive/:placementDriveId/eligibility-check
// @access  Student
const checkDriveEligibility = asyncHandler(async (req, res) => {
    const { placementDriveId } = req.params;

    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found. Please create your academic profile first.");
    }

    const drive = await PlacementDrive.findById(placementDriveId).populate("company");
    if (!drive) {
        throw new ApiError(404, "Placement drive not found");
    }

    // Evaluate against Centralized Eligibility Engine
    const evaluation = EligibilityService.evaluate(studentProfile, drive);

    // Check if already applied or withdrawn
    const existingApplication = await Application.findOne({
        student: studentProfile._id,
        placementDrive: drive._id
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                ...evaluation,
                hasApplied: Boolean(existingApplication),
                applicationStatus: existingApplication?.status || null,
                applicationId: existingApplication?._id || null,
                appliedAt: existingApplication?.appliedAt || null
            },
            "Eligibility evaluated successfully"
        )
    );
});

// @desc    Admin preview of cohort eligibility for a placement drive
// @route   GET /api/v1/placementdrive/:placementDriveId/eligibility-preview
// @access  Admin
const getDriveEligibilityPreview = asyncHandler(async (req, res) => {
    const { placementDriveId } = req.params;

    const drive = await PlacementDrive.findById(placementDriveId).populate("company");
    if (!drive) {
        throw new ApiError(404, "Placement drive not found");
    }

    // Filter students by drive's cohort
    const students = await StudentProfile.find({
        $or: [
            { placementSession: drive.placementSession },
            { graduationYear: drive.graduationYear }
        ]
    }).populate("user", "fullName email");

    let eligibleCount = 0;
    let ineligibleCount = 0;
    let missingDataCount = 0;
    const failureReasonTally = {};

    const studentBreakdown = students.map((st) => {
        const evalResult = EligibilityService.evaluate(st, drive);
        if (evalResult.status === "ELIGIBLE") eligibleCount++;
        else if (evalResult.status === "MISSING_DATA") missingDataCount++;
        else {
            ineligibleCount++;
            evalResult.reasons.forEach((r) => {
                failureReasonTally[r] = (failureReasonTally[r] || 0) + 1;
            });
        }

        return {
            studentId: st._id,
            fullName: st.user?.fullName || "Candidate",
            enrollmentNumber: st.enrollmentNumber,
            branch: st.branch,
            cgpa: st.verifiedCGPA != null ? st.verifiedCGPA : st.cgpa,
            status: evalResult.status,
            reasons: evalResult.reasons
        };
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalCohortStudents: students.length,
                eligibleCount,
                ineligibleCount,
                missingDataCount,
                failureReasonTally,
                studentBreakdown
            },
            "Drive eligibility cohort preview generated"
        )
    );
});

// @desc    Get default student requirements catalogue
// @route   GET /api/v1/placement-drives/field-catalogue
// @access  Authenticated Users
const getFieldCatalogue = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(
            200,
            DEFAULT_STUDENT_REQUIREMENTS,
            "Default student requirements catalogue retrieved successfully"
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
    deletePlacementDrive,
    getEligibleStudents,
    getMyEligibleDrives,
    checkDriveEligibility,
    getDriveEligibilityPreview,
    getFieldCatalogue
};