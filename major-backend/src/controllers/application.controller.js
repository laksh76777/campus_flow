import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Application } from "../models/application.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { PlacementDrive, DEFAULT_STUDENT_REQUIREMENTS } from "../models/placementDrive.model.js";
import { ExportLog } from "../models/exportLog.model.js";
import { Notification } from "../models/notification.model.js";
import { sendApplicationStatusEmail } from "../utils/mailService.js";
import { EligibilityService } from "../services/eligibility.service.js";
import { resolveStudentProgram } from "../constants/programCatalog.js";

// Legal status transitions state machine
const LEGAL_TRANSITIONS = {
    applied: ["shortlisted", "rejected", "on_hold", "withdrawn"],
    shortlisted: ["interview", "rejected", "on_hold", "withdrawn"],
    interview: ["interview", "selected", "rejected", "on_hold"],
    on_hold: ["shortlisted", "interview", "selected", "rejected", "withdrawn"],
    selected: ["offer_received", "rejected"],
    offer_received: ["offer_accepted", "offer_declined"],
    offer_accepted: [],
    offer_declined: [],
    rejected: [],
    withdrawn: ["applied"]
};

// Evaluate drive-specific student information requirements
export const evaluateStudentRequirements = (studentProfile, user, requirements) => {
    const list = Array.isArray(requirements) && requirements.length > 0
        ? requirements
        : DEFAULT_STUDENT_REQUIREMENTS;

    const checklist = [];
    const missingFields = [];

    for (const req of list) {
        let value = null;
        let isSatisfied = true;
        let reason = "";

        switch (req.fieldKey) {
            case "fullName":
                value = user?.fullName || studentProfile.fullName || "";
                if (!value.trim()) isSatisfied = false;
                break;
            case "usn":
                value = studentProfile.enrollmentNumber || studentProfile.usn || "";
                if (!value.trim()) isSatisfied = false;
                break;
            case "email":
                value = user?.email || studentProfile.collegeEmail || "";
                if (!value.trim()) isSatisfied = false;
                break;
            case "personalEmail":
                value = studentProfile.personalEmail || "";
                if (req.requiredToApply && !value.trim()) isSatisfied = false;
                break;
            case "phone":
                value = user?.phone || studentProfile.alternatePhone || "";
                if (req.requiredToApply && !value.trim()) isSatisfied = false;
                break;
            case "branch":
                value = studentProfile.branch || studentProfile.department || "";
                if (!value.trim()) isSatisfied = false;
                break;
            case "graduationYear":
                value = studentProfile.graduationYear;
                if (!value) isSatisfied = false;
                break;
            case "placementSession":
                value = studentProfile.placementSession;
                if (!value) isSatisfied = false;
                break;
            case "cgpa":
                value = studentProfile.verifiedCGPA != null ? studentProfile.verifiedCGPA : studentProfile.cgpa;
                if (value === null || value === undefined || isNaN(value)) isSatisfied = false;
                break;
            case "semesterSGPA":
                const sResults = studentProfile.semesterResults || [];
                if (Array.isArray(req.requiredSemesters) && req.requiredSemesters.length > 0) {
                    const recordedSemesters = new Set(sResults.map((s) => s.semester));
                    const missingSems = req.requiredSemesters.filter((s) => !recordedSemesters.has(s));
                    if (missingSems.length > 0) {
                        isSatisfied = false;
                        reason = `Missing SGPA for Semester(s): ${missingSems.join(", ")}`;
                    }
                } else if (req.requiredToApply && sResults.length === 0) {
                    isSatisfied = false;
                    reason = "No semester SGPA records entered";
                }
                value = sResults;
                break;
            case "activeBacklogs":
                value = studentProfile.activeBacklogs != null ? studentProfile.activeBacklogs : studentProfile.backlogs;
                if (value === null || value === undefined) isSatisfied = false;
                break;
            case "historicalBacklogs":
                value = studentProfile.historicalBacklogs != null ? studentProfile.historicalBacklogs : 0;
                break;
            case "tenthPercentage":
                value = studentProfile.tenthDetails?.percentage ?? studentProfile.tenthPercentage;
                if (value === null || value === undefined) isSatisfied = false;
                break;
            case "tenthPassingYear":
                value = studentProfile.tenthDetails?.passingYear;
                if (req.requiredToApply && !value) isSatisfied = false;
                break;
            case "twelfthOrDiploma":
                value = studentProfile.twelfthOrDiplomaDetails?.percentage ?? studentProfile.twelfthPercentage;
                if (value === null || value === undefined) isSatisfied = false;
                break;
            case "educationGaps":
                value = { hasGap: Boolean(studentProfile.hasEducationGap), gaps: studentProfile.educationGaps || [] };
                break;
            case "resume":
                value = studentProfile.resume?.url || studentProfile.resumeUrl;
                if (!value) isSatisfied = false;
                break;
            case "tenthMarksheet":
                value = studentProfile.tenthDetails?.marksheetUrl;
                if (req.requiredToApply && !value) isSatisfied = false;
                break;
            case "twelfthMarksheet":
                value = studentProfile.twelfthOrDiplomaDetails?.marksheetUrl;
                if (req.requiredToApply && !value) isSatisfied = false;
                break;
            case "currentAddress":
                value = studentProfile.currentAddress?.city;
                if (req.requiredToApply && !value) isSatisfied = false;
                break;
            case "permanentAddress":
                value = studentProfile.permanentAddress?.city;
                if (req.requiredToApply && !value) isSatisfied = false;
                break;
            case "familyDetails":
                value = studentProfile.family?.fatherName || studentProfile.family?.motherName;
                if (req.requiredToApply && !value) isSatisfied = false;
                break;
            default:
                break;
        }

        if (req.requiredToApply && !isSatisfied) {
            missingFields.push(req.label || req.fieldKey);
        }

        checklist.push({
            fieldKey: req.fieldKey,
            label: req.label,
            category: req.category,
            requiredToApply: Boolean(req.requiredToApply),
            visibleToTpo: Boolean(req.visibleToTpo),
            shareWithCompany: Boolean(req.shareWithCompany),
            isSatisfied,
            reason: reason || (!isSatisfied ? `Missing ${req.label}` : "")
        });
    }

    return {
        allSatisfied: missingFields.length === 0,
        missingFields,
        checklist
    };
};

// Construct immutable submittedSnapshot from student profile at time of application
export const buildSubmissionSnapshot = (studentProfile, user, placementDrive) => {
    return {
        studentProfileId: studentProfile._id,
        fullName: user?.fullName || studentProfile.fullName || "",
        usn: studentProfile.enrollmentNumber || studentProfile.usn || "",
        email: user?.email || studentProfile.collegeEmail || "",
        personalEmail: studentProfile.personalEmail || "",
        phone: user?.phone || studentProfile.alternatePhone || "",
        department: studentProfile.department || studentProfile.branch || "",
        branch: studentProfile.branch || studentProfile.department || "",
        course: studentProfile.course || "",
        programCode: studentProfile.programCode || "",
        programLevel: studentProfile.programLevel || "",
        degreeType: studentProfile.degreeType || "",
        admissionYear: studentProfile.admissionYear,
        graduationYear: studentProfile.graduationYear,
        currentSemester: studentProfile.currentSemester || studentProfile.semester,
        cgpa: studentProfile.verifiedCGPA != null ? studentProfile.verifiedCGPA : studentProfile.cgpa,
        semesterResults: studentProfile.semesterResults?.map((s) => ({
            semester: s.semester,
            sgpa: s.sgpa,
            credits: s.credits
        })) || [],
        activeBacklogs: studentProfile.activeBacklogs != null ? studentProfile.activeBacklogs : (studentProfile.backlogs || 0),
        historicalBacklogs: studentProfile.historicalBacklogs || 0,
        backlogDetails: studentProfile.backlogDetails || [],
        tenthDetails: studentProfile.tenthDetails || {},
        twelfthOrDiplomaDetails: studentProfile.twelfthOrDiplomaDetails || {},
        educationGaps: studentProfile.educationGaps || [],
        hasEducationGap: Boolean(studentProfile.hasEducationGap),
        resume: studentProfile.resume || {},
        family: studentProfile.family || {},
        permanentAddress: studentProfile.permanentAddress || {},
        currentAddress: studentProfile.currentAddress || {},
        requirementsVersion: placementDrive.requirementsVersion || 1,
        submittedAt: new Date()
    };
};

// @desc    Apply for placement drive
// @route   POST /api/v1/application/:driveId/apply
// @access  Student
const applyForPlacement = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    if (!driveId) {
        throw new ApiError(400, "Placement drive ID is required");
    }
    if (req.user?.role !== "student") {
        throw new ApiError(403, "Only students can apply for placement drives");
    }

    const studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });
    if (!studentProfile) {
        throw new ApiError(404, "Student academic profile not found. Please complete profile first.");
    }

    const placementDrive = await PlacementDrive.findOne({
        _id: driveId,
        isActive: true
    });
    if (!placementDrive) {
        throw new ApiError(404, "Active placement drive not found or application deadline closed");
    }

    // 1. Strict Centralized Eligibility Revalidation Immediately Before Submission
    const evalResult = EligibilityService.evaluate(studentProfile, placementDrive);
    if (!evalResult.isEligible) {
        const detailMessage = evalResult.reasons?.length
            ? `Not eligible: ${evalResult.reasons.join("; ")}. Please update your academic profile settings to meet the eligibility criteria.`
            : (evalResult.summary || "Ineligible for this placement drive");
        throw new ApiError(
            403,
            detailMessage,
            evalResult.reasons
        );
    }

    // 2. Drive-Specific Student Requirements Validation
    const reqResult = evaluateStudentRequirements(studentProfile, req.user, placementDrive.studentRequirements);
    if (!reqResult.allSatisfied) {
        throw new ApiError(
            403,
            `Cannot apply: This placement drive requires mandatory student details that are currently missing from your profile: ${reqResult.missingFields.join(", ")}`
        );
    }

    const submittedSnapshot = buildSubmissionSnapshot(studentProfile, req.user, placementDrive);

    // 3. Database Uniqueness Check
    const existingApplication = await Application.findOne({
        student: studentProfile._id,
        placementDrive: placementDrive._id
    });

    if (existingApplication) {
        if (existingApplication.status === "withdrawn") {
            const previousStatus = existingApplication.status;
            existingApplication.status = "applied";
            existingApplication.appliedAt = new Date();
            existingApplication.statusUpdatedAt = new Date();
            existingApplication.submittedSnapshot = submittedSnapshot;
            if (!existingApplication.statusHistory) existingApplication.statusHistory = [];
            existingApplication.statusHistory.push({
                fromStatus: previousStatus,
                toStatus: "applied",
                remarks: "Student re-applied after withdrawal with refreshed application snapshot",
                updatedBy: req.user._id,
                updatedAt: new Date()
            });

            // Update eligibility snapshot
            existingApplication.eligibilitySnapshot = {
                status: evalResult.status,
                cgpa: studentProfile.verifiedCGPA != null ? studentProfile.verifiedCGPA : studentProfile.cgpa,
                activeBacklogs: studentProfile.activeBacklogs != null ? studentProfile.activeBacklogs : studentProfile.backlogs,
                historicalBacklogs: studentProfile.historicalBacklogs || 0,
                branch: studentProfile.branch || studentProfile.department,
                programCode: resolveStudentProgram(studentProfile)?.code || "",
                tenthPercentage: studentProfile.tenthPercentage,
                twelfthPercentage: studentProfile.twelfthPercentage,
                criteriaBreakdown: evalResult.criteriaBreakdown,
                ruleVersion: 2,
                evaluatedAt: new Date()
            };

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
            "You have already applied for this placement drive. Duplicate applications are blocked."
        );
    }

    // 4. Create Application with Preserved Rule Version Snapshot and Submitted Student Data Snapshot
    const application = await Application.create({
        student: studentProfile._id,
        placementDrive: placementDrive._id,
        submittedSnapshot,
        eligibilitySnapshot: {
            status: evalResult.status,
            cgpa: studentProfile.verifiedCGPA != null ? studentProfile.verifiedCGPA : studentProfile.cgpa,
            activeBacklogs: studentProfile.activeBacklogs != null ? studentProfile.activeBacklogs : studentProfile.backlogs,
            historicalBacklogs: studentProfile.historicalBacklogs || 0,
            branch: studentProfile.branch || studentProfile.department,
            programCode: resolveStudentProgram(studentProfile)?.code || "",
            tenthPercentage: studentProfile.tenthPercentage,
            twelfthPercentage: studentProfile.twelfthPercentage,
            criteriaBreakdown: evalResult.criteriaBreakdown,
            ruleVersion: 2,
            evaluatedAt: new Date()
        },
        statusHistory: [
            {
                fromStatus: "none",
                toStatus: "applied",
                remarks: "Application verified by Centralized Eligibility Engine & Student Requirements, snapshot preserved",
                updatedBy: req.user._id,
                updatedAt: new Date()
            }
        ]
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            application,
            "Application submitted successfully"
        )
    );
});

// @desc    Get student's own applications
// @route   GET /api/v1/application/my-applications
// @access  Student
const getMyApplications = asyncHandler(async (req, res) => {
    if (req.user?.role !== "student") {
        throw new ApiError(403, "Only students can access their applications");
    }

    const studentProfile = await StudentProfile.findOne({
        user: req.user._id
    });
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
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
        .sort({ appliedAt: -1 });

    return res.status(200).json(
        new ApiResponse(
            200,
            applications,
            "Applications fetched successfully"
        )
    );
});

// @desc    Withdraw application
// @route   PATCH /api/v1/application/:applicationId/withdraw
// @access  Student
const withdrawApplication = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    if (req.user?.role !== "student") {
        throw new ApiError(403, "Only students can withdraw applications");
    }

    const studentProfile = await StudentProfile.findOne({
        user: req.user._id
    });
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    const application = await Application.findById(applicationId);
    if (!application) {
        throw new ApiError(404, "Application not found");
    }

    if (application.student.toString() !== studentProfile._id.toString()) {
        throw new ApiError(403, "You are not allowed to withdraw this application");
    }

    if (application.status === "withdrawn") {
        throw new ApiError(400, "Application is already withdrawn");
    }

    // Permit withdrawal only during early stages
    const permitWithdrawStatuses = ["applied", "shortlisted", "on_hold"];
    if (!permitWithdrawStatuses.includes(application.status)) {
        throw new ApiError(
            400,
            `Cannot withdraw application after reaching "${application.status}" stage`
        );
    }

    const prevStatus = application.status;
    application.status = "withdrawn";
    application.statusUpdatedAt = new Date();

    if (!application.statusHistory) application.statusHistory = [];
    application.statusHistory.push({
        fromStatus: prevStatus,
        toStatus: "withdrawn",
        remarks: "Withdrawn voluntarily by candidate",
        updatedBy: req.user._id,
        updatedAt: new Date()
    });

    await application.save();

    return res.status(200).json(
        new ApiResponse(200, application, "Application withdrawn successfully")
    );
});

// @desc    Get all applications for a drive
// @route   GET /api/v1/application/drive/:placementDriveId
// @access  Admin
const getApplicationsByDrive = asyncHandler(async (req, res) => {
    const { placementDriveId } = req.params;

    const applications = await Application.find({
        placementDrive: placementDriveId
    })
        .populate({
            path: "student",
            populate: {
                path: "user",
                select: "fullName email phone avatar"
            }
        })
        .populate("placementDrive", "jobTitle package location driveDate")
        .sort({ appliedAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, applications, "Applications fetched successfully")
    );
});

// @desc    Update application status with state transition enforcement & interview round tracking
// @route   PATCH /api/v1/application/:applicationId/status
// @access  Admin
const updateApplicationStatus = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const {
        status,
        remarks,
        interviewDate,
        interviewRound,
        interviewLocation,
        offeredPackage,
        designation,
        joiningDate,
        offerLetterUrl,
        decisionDeadline,
        isOverride
    } = req.body;

    if (!status) {
        throw new ApiError(400, "Application status is required");
    }

    const application = await Application.findById(applicationId).populate("placementDrive");
    if (!application) {
        throw new ApiError(404, "Application not found");
    }

    const previousStatus = application.status;

    // Validate legal state transition unless authorized override flag is passed
    if (previousStatus !== status) {
        const allowedNext = LEGAL_TRANSITIONS[previousStatus] || [];
        if (!allowedNext.includes(status) && !isOverride) {
            throw new ApiError(
                400,
                `Invalid status transition from "${previousStatus}" to "${status}". State machine enforces verified recruitment progression.`
            );
        }
    }

    application.status = status;

    // Append to status history audit
    if (!application.statusHistory) application.statusHistory = [];
    application.statusHistory.push({
        fromStatus: previousStatus,
        toStatus: status,
        remarks: remarks || "",
        updatedBy: req.user._id,
        updatedAt: new Date()
    });

    if (remarks !== undefined) application.remarks = remarks;

    // Handle Interview Stage tracking
    if (status === "interview") {
        if (interviewDate) application.interviewDate = new Date(interviewDate);
        if (interviewRound) application.interviewRound = interviewRound.trim();
        if (interviewLocation) application.interviewLocation = interviewLocation.trim();

        if (!application.interviewRounds) application.interviewRounds = [];
        application.interviewRounds.push({
            roundNumber: application.interviewRounds.length + 1,
            roundName: interviewRound || `Technical / HR Round ${application.interviewRounds.length + 1}`,
            scheduledAt: interviewDate ? new Date(interviewDate) : new Date(),
            location: interviewLocation || "Virtual / Campus Venue",
            feedback: remarks || ""
        });
    }

    // Handle Selection & Offer Details
    if (status === "selected" || status === "offer_received" || status === "offer_accepted") {
        const pkg = offeredPackage !== undefined && offeredPackage !== null
            ? Number(offeredPackage)
            : application.placementDrive?.package || null;

        application.offeredPackage = pkg;

        if (status === "offer_received") {
            application.offerDetails = {
                offeredPackage: pkg,
                designation: designation || application.placementDrive?.jobTitle || "Graduate Trainee",
                joiningDate: joiningDate ? new Date(joiningDate) : null,
                offerLetterUrl: offerLetterUrl || "",
                decisionDeadline: decisionDeadline ? new Date(decisionDeadline) : null,
                studentDecision: "pending",
                decisionAt: null
            };
        }
    }

    application.statusUpdatedAt = new Date();
    await application.save();

    // Populate for response & notifications
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

    // Mark student profile as placed upon confirmed selection or offer acceptance
    if (status === "selected" || status === "offer_accepted") {
        try {
            const compName = updatedApplication?.placementDrive?.company?.companyName || updatedApplication?.placementDrive?.company?.name || "";
            await StudentProfile.findByIdAndUpdate(application.student, {
                $set: {
                    isPlaced: true,
                    placedCompany: compName,
                    placedPackage: application.offeredPackage || application.placementDrive?.package || null,
                    placedAt: new Date(),
                    placedJobTitle: updatedApplication?.placementDrive?.jobTitle || ""
                }
            });
        } catch (profileErr) {
            console.error("Failed to mark student as placed:", profileErr.message);
        }
    }

    // Send in-app notification & email
    const studentUser = updatedApplication?.student?.user;
    const companyName = updatedApplication?.placementDrive?.company?.companyName || updatedApplication?.placementDrive?.company?.name || "Campus Drive";
    const jobTitle = updatedApplication?.placementDrive?.jobTitle || "";

    if (studentUser?._id) {
        let notifTitle = `Application Status Updated: ${companyName}`;
        let notifType = "status_update";

        if (status === "selected") {
            notifTitle = `🎉 Congratulations! Selected for ${companyName}`;
            notifType = "selection";
        } else if (status === "offer_received") {
            notifTitle = `💼 Official Offer Received from ${companyName}`;
            notifType = "offer";
        } else if (status === "interview") {
            notifTitle = `📅 Interview Scheduled - ${companyName}`;
            notifType = "interview";
        }

        try {
            await Notification.create({
                user: studentUser._id,
                title: notifTitle,
                message: remarks || `Your application status for ${jobTitle} at ${companyName} is now "${status}".`,
                type: notifType,
                companyName,
                jobTitle,
                remarks: remarks || "",
                interviewDate: application.interviewDate,
                interviewRound: application.interviewRound,
                interviewLocation: application.interviewLocation,
                offeredPackage: application.offeredPackage,
                application: application._id
            });
        } catch (notifErr) {
            console.error("Failed to create in-app notification:", notifErr.message);
        }

        if (studentUser.email) {
            try {
                await sendApplicationStatusEmail({
                    studentEmail: studentUser.email,
                    to: studentUser.email,
                    studentName: studentUser.fullName,
                    companyName,
                    jobTitle,
                    status,
                    remarks,
                    interviewDate: application.interviewDate,
                    interviewRound: application.interviewRound,
                    interviewLocation: application.interviewLocation,
                    offeredPackage: application.offeredPackage
                });
            } catch (mailErr) {
                console.error("Failed to dispatch status email:", mailErr.message);
            }
        }
    }

    return res.status(200).json(
        new ApiResponse(200, updatedApplication, `Application status advanced to "${status}"`)
    );
});

// @desc    Student responds to offer (accept or decline)
// @route   PATCH /api/v1/application/:applicationId/respond-offer
// @access  Student
const respondToOffer = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const { decision, remarks } = req.body; // decision: "accept" or "decline"

    if (!["accept", "decline"].includes(decision)) {
        throw new ApiError(400, "Decision must be either 'accept' or 'decline'");
    }

    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    const application = await Application.findById(applicationId).populate({
        path: "placementDrive",
        populate: { path: "company" }
    });

    if (!application) {
        throw new ApiError(404, "Application not found");
    }

    if (application.student.toString() !== studentProfile._id.toString()) {
        throw new ApiError(403, "You are not authorized to respond to this offer");
    }

    if (application.status !== "offer_received") {
        throw new ApiError(400, `Cannot respond to offer when status is "${application.status}"`);
    }

    const newStatus = decision === "accept" ? "offer_accepted" : "offer_declined";
    application.status = newStatus;
    application.offerDetails.studentDecision = decision === "accept" ? "accepted" : "declined";
    application.offerDetails.decisionAt = new Date();

    if (!application.statusHistory) application.statusHistory = [];
    application.statusHistory.push({
        fromStatus: "offer_received",
        toStatus: newStatus,
        remarks: remarks || `Candidate decision: ${decision.toUpperCase()}`,
        updatedBy: req.user._id,
        updatedAt: new Date()
    });

    await application.save();

    if (decision === "accept") {
        studentProfile.isPlaced = true;
        studentProfile.placedCompany = application.placementDrive?.company?.companyName || application.placementDrive?.company?.name || "";
        studentProfile.placedPackage = application.offeredPackage || application.placementDrive?.package || null;
        studentProfile.placedAt = new Date();
        studentProfile.placedJobTitle = application.placementDrive?.jobTitle || "";
        await studentProfile.save();
    }

    return res.status(200).json(
        new ApiResponse(200, application, `Offer successfully ${decision}ed!`)
    );
});

// @desc    Admin reasoned override of application eligibility or status
// @route   POST /api/v1/application/:applicationId/admin-override
// @access  Admin
const adminOverrideApplication = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const { targetStatus, overrideReason } = req.body;

    if (!overrideReason || overrideReason.trim().length < 10) {
        throw new ApiError(400, "A detailed override reason (at least 10 characters) is mandatory for TPO audit compliance.");
    }

    const application = await Application.findById(applicationId);
    if (!application) {
        throw new ApiError(404, "Application not found");
    }

    const prevStatus = application.status;
    application.isOverridden = true;
    application.overrideReason = overrideReason.trim();
    application.overriddenBy = req.user._id;
    application.overriddenAt = new Date();

    if (targetStatus) {
        application.status = targetStatus;
    }

    if (!application.statusHistory) application.statusHistory = [];
    application.statusHistory.push({
        fromStatus: prevStatus,
        toStatus: targetStatus || prevStatus,
        remarks: `[TPO OVERRIDE]: ${overrideReason.trim()}`,
        updatedBy: req.user._id,
        updatedAt: new Date()
    });

    await application.save();

    return res.status(200).json(
        new ApiResponse(200, application, "Authorized TPO override successfully recorded in audit log")
    );
});

// @desc    Get all applications across drives (with pagination & filter)
// @route   GET /api/v1/application/all-applications
// @access  Admin
const getAllApplications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 100, status, placementDriveId } = req.query;
    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (placementDriveId && placementDriveId !== "all") filter.placementDrive = placementDriveId;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [applications, total] = await Promise.all([
        Application.find(filter)
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
                    path: "company",
                    select: "companyName name logo industry"
                }
            })
            .sort({ appliedAt: -1 })
            .skip(skip)
            .limit(limitNum),
        Application.countDocuments(filter)
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                applications,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    pages: Math.ceil(total / limitNum)
                }
            },
            "All applications retrieved successfully"
        )
    );
});

// @desc    Get application by ID
// @route   GET /api/v1/application/:applicationId
// @access  Admin & Authenticated Users
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
        throw new ApiError(404, "Application not found");
    }

    return res.status(200).json(
        new ApiResponse(200, application, "Application details retrieved")
    );
});

// @desc    Pre-check application checklist and requirements for a drive
// @route   GET /api/v1/application/:driveId/precheck
// @access  Student
const checkPreApplicationRequirements = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    const studentProfile = await StudentProfile.findOne({ user: req.user._id }).populate("user", "fullName email phone");
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found. Please complete basic profile first.");
    }
    const placementDrive = await PlacementDrive.findById(driveId).populate("company", "companyName");
    if (!placementDrive) {
        throw new ApiError(404, "Placement drive not found");
    }

    const evalResult = EligibilityService.evaluate(studentProfile, placementDrive);
    const reqResult = evaluateStudentRequirements(studentProfile, req.user, placementDrive.studentRequirements);

    const existingApplication = await Application.findOne({
        student: studentProfile._id,
        placementDrive: placementDrive._id
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                canApply: evalResult.isEligible && reqResult.allSatisfied && (!existingApplication || existingApplication.status === "withdrawn"),
                eligibility: evalResult,
                requirementsChecklist: reqResult.checklist,
                missingRequiredFields: reqResult.missingFields,
                hasExistingApplication: Boolean(existingApplication),
                existingApplicationStatus: existingApplication?.status || null
            },
            "Application readiness pre-check evaluated"
        )
    );
});

// @desc    Export placement drive applicants formatted for company or TPO
// @route   POST /api/v1/application/:driveId/export
// @access  Admin / TPO
const exportDriveApplicants = asyncHandler(async (req, res) => {
    const { driveId } = req.params;
    const { status = "all", format = "csv", includeSensitiveFamily = false, selectedFields } = req.body || {};

    const placementDrive = await PlacementDrive.findById(driveId).populate("company", "companyName industry");
    if (!placementDrive) {
        throw new ApiError(404, "Placement drive not found");
    }

    const filter = { placementDrive: placementDrive._id };
    if (status && status !== "all") {
        filter.status = status;
    }

    const applications = await Application.find(filter)
        .populate({
            path: "student",
            populate: { path: "user", select: "fullName email phone" }
        })
        .sort({ appliedAt: -1 });

    // Determine fields to export based on drive's shareWithCompany configuration
    const driveRequirements = Array.isArray(placementDrive.studentRequirements) && placementDrive.studentRequirements.length > 0
        ? placementDrive.studentRequirements
        : DEFAULT_STUDENT_REQUIREMENTS;

    // Filter permitted fields for company export
    let permittedFields = driveRequirements.filter((r) => r.shareWithCompany === true);
    if (!includeSensitiveFamily) {
        permittedFields = permittedFields.filter((r) => r.category !== "family_address");
    }

    if (Array.isArray(selectedFields) && selectedFields.length > 0) {
        const allowedSet = new Set(permittedFields.map((p) => p.fieldKey));
        // If TPO explicitly selects family details, verify permission
        if (includeSensitiveFamily) {
            allowedSet.add("familyDetails");
            allowedSet.add("permanentAddress");
            allowedSet.add("currentAddress");
        }
        permittedFields = driveRequirements.filter((r) => allowedSet.has(r.fieldKey) && selectedFields.includes(r.fieldKey));
    }

    // Always include standard identification columns
    const columns = [
        { key: "sno", label: "S.No" },
        { key: "fullName", label: "Candidate Name" },
        { key: "usn", label: "USN / Enrollment ID" },
        { key: "email", label: "Email Address" },
        { key: "phone", label: "Contact Number" },
        { key: "branch", label: "Academic Program" },
        { key: "programCode", label: "Program Code" },
        { key: "graduationYear", label: "Batch Year" },
        { key: "cgpa", label: "Overall CGPA" },
        { key: "activeBacklogs", label: "Active Backlogs" },
        { key: "tenthPercentage", label: "Class 10 (%)" },
        { key: "twelfthOrDiploma", label: "Class 12 / Diploma (%)" },
        { key: "applicationStatus", label: "Application Status" },
        { key: "appliedDate", label: "Applied Date" },
        { key: "resumeLink", label: "Resume URL" }
    ];

    if (includeSensitiveFamily) {
        columns.push(
            { key: "fatherName", label: "Father Name" },
            { key: "motherName", label: "Mother Name" },
            { key: "guardianPhone", label: "Guardian Contact" }
        );
    }

    // Audit log this export
    await ExportLog.create({
        placementDrive: placementDrive._id,
        exportedBy: req.user._id,
        exportFormat: format,
        exportedFields: columns.map((c) => c.key),
        applicantCount: applications.length,
        statusFilter: status,
        ipAddress: req.ip || "",
        userAgent: req.headers["user-agent"] || ""
    });

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = applications.map((app, index) => {
        // Prefer immutable snapshot first, fallback to populated student
        const snap = app.submittedSnapshot || {};
        const student = app.student || {};
        const user = student.user || {};

        const fullName = snap.fullName || user.fullName || student.fullName || "";
        const usn = snap.usn || student.enrollmentNumber || student.usn || "";
        const email = snap.email || user.email || student.collegeEmail || "";
        const phone = snap.phone || user.phone || student.alternatePhone || "";
        const program = resolveStudentProgram({
            programCode: snap.programCode || student.programCode,
            course: snap.course || student.course,
            branch: snap.branch || snap.department || student.branch || student.department
        });
        const branch = program?.name || snap.branch || snap.department || student.branch || student.department || "";
        const programCode = program?.code || snap.programCode || student.programCode || "";
        const gradYear = snap.graduationYear || student.graduationYear || "";
        const cgpa = snap.cgpa ?? student.verifiedCGPA ?? student.cgpa ?? "";
        const activeBacklogs = snap.activeBacklogs ?? student.activeBacklogs ?? student.backlogs ?? 0;
        const tenth = snap.tenthDetails?.percentage ?? student.tenthDetails?.percentage ?? student.tenthPercentage ?? "";
        const twelfth = snap.twelfthOrDiplomaDetails?.percentage ?? student.twelfthOrDiplomaDetails?.percentage ?? student.twelfthPercentage ?? "";
        const resumeUrl = snap.resume?.url || student.resume?.url || student.resumeUrl || "";
        const appliedDate = app.appliedAt ? new Date(app.appliedAt).toISOString().slice(0, 10) : "";

        const row = [
            index + 1,
            escapeCsv(fullName),
            escapeCsv(usn),
            escapeCsv(email),
            escapeCsv(phone),
            escapeCsv(branch),
            escapeCsv(programCode),
            escapeCsv(gradYear),
            escapeCsv(cgpa),
            escapeCsv(activeBacklogs),
            escapeCsv(tenth),
            escapeCsv(twelfth),
            escapeCsv(app.status),
            escapeCsv(appliedDate),
            escapeCsv(resumeUrl)
        ];

        if (includeSensitiveFamily) {
            const family = snap.family || student.family || {};
            row.push(
                escapeCsv(family.fatherName || ""),
                escapeCsv(family.motherName || ""),
                escapeCsv(family.guardianPhone || family.fatherPhone || "")
            );
        }

        return row.join(",");
    });

    const csvContent = "\uFEFF" + [columns.map((c) => escapeCsv(c.label)).join(","), ...rows].join("\r\n");

    const compName = (placementDrive.company?.companyName || placementDrive.jobTitle || "Drive").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${compName}_${status.toUpperCase()}_Candidates_${dateStr}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(Buffer.from(csvContent, "utf-8"));
});

export {
    applyForPlacement,
    getMyApplications,
    withdrawApplication,
    getApplicationsByDrive,
    updateApplicationStatus,
    respondToOffer,
    adminOverrideApplication,
    getAllApplications,
    getApplicationById,
    checkPreApplicationRequirements,
    exportDriveApplicants
};