import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { User } from "../models/user.models.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { Notification } from "../models/notification.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { resolveStudentProgram } from "../constants/programCatalog.js";

// @desc    Create student profile
// @route   POST /api/v1/studentprofile/create-student-profile
// @access  Student
const createStudentProfile = asyncHandler(async (req, res) => {
    const {
        enrollmentNumber,
        usn,
        programCode,
        programLevel,
        degreeType,
        course,
        branch,
        department,
        semester,
        currentSemester,
        graduationYear,
        admissionYear,
        placementSession,
        cgpa,
        backlogs,
        skills,
        about,
        gender,
        dob,
        personalEmail,
        collegeEmail,
        alternatePhone,
        family,
        currentAddress,
        permanentAddress,
        sameAsCurrent,
        tenthDetails,
        twelfthOrDiplomaDetails,
        semesterResults,
        backlogDetails
    } = req.body;

    const enrNum = enrollmentNumber?.trim() || usn?.trim();
    let branchName = branch?.trim() || department?.trim();
    const semNum = Number(semester || currentSemester);
    const gradYear = Number(graduationYear);

    if (!enrNum || !semNum || !gradYear || cgpa === undefined) {
        throw new ApiError(
            400,
            "Enrollment number/USN, semester, graduation year and CGPA are required"
        );
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    if (user.role !== "student") {
        throw new ApiError(403, "Only students can create a student profile");
    }

    let profile = await StudentProfile.findOne({ user: req.user._id });
    const programFieldsProvided = [programCode, programLevel, degreeType, course, branch, department]
        .some((value) => value !== undefined);
    const selectedProgram = resolveStudentProgram({ programCode, programLevel, degreeType, course, branch: branchName, department });
    if (programFieldsProvided && !selectedProgram) {
        throw new ApiError(400, "Select an approved academic program; legacy or unknown values require review");
    }
    if (!profile && !selectedProgram) {
        throw new ApiError(400, "A valid approved academic program is required to create a student profile");
    }
    if (selectedProgram && programLevel && programLevel !== selectedProgram.programLevel) {
        throw new ApiError(400, "Program level does not match the selected academic program");
    }
    if (selectedProgram) branchName = selectedProgram.name;

    if (profile) {
        if (enrNum) { profile.enrollmentNumber = enrNum; profile.usn = enrNum; }
        if (selectedProgram) {
            profile.programCode = selectedProgram.code;
            profile.programLevel = selectedProgram.programLevel;
            profile.degreeType = selectedProgram.degreeType;
            profile.course = selectedProgram.degreeType;
            profile.branch = selectedProgram.name;
            profile.department = selectedProgram.name;
            const nextAdmissionYear = Number(admissionYear ?? profile.admissionYear);
            const nextGraduationYear = Number(graduationYear ?? profile.graduationYear);
            if (nextAdmissionYear + selectedProgram.durationYears !== nextGraduationYear) {
                throw new ApiError(400, "Selected program duration does not match the student's admission and graduation years");
            }
        }
        if (semNum) { profile.semester = semNum; profile.currentSemester = semNum; }
        if (gradYear) profile.graduationYear = gradYear;
        if (admissionYear) profile.admissionYear = Number(admissionYear);
        if (placementSession) profile.placementSession = placementSession;
        if (cgpa !== undefined && cgpa !== null) {
            profile.cgpa = Number(cgpa);
            if (req.body.verifiedCGPA !== undefined) profile.verifiedCGPA = Number(req.body.verifiedCGPA);
        }
        if (backlogs !== undefined) {
            profile.backlogs = Number(backlogs);
            profile.activeBacklogs = Number(backlogs);
        }
        if (req.body.activeBacklogs !== undefined) profile.activeBacklogs = Number(req.body.activeBacklogs);
        if (req.body.historicalBacklogs !== undefined) profile.historicalBacklogs = Number(req.body.historicalBacklogs);
        if (req.body.tenthPercentage !== undefined) {
            profile.tenthPercentage = Number(req.body.tenthPercentage);
            if (!profile.tenthDetails) profile.tenthDetails = {};
            profile.tenthDetails.percentage = Number(req.body.tenthPercentage);
        }
        if (tenthDetails) profile.tenthDetails = { ...profile.tenthDetails?.toObject?.(), ...tenthDetails };
        if (req.body.twelfthPercentage !== undefined) {
            profile.twelfthPercentage = Number(req.body.twelfthPercentage);
            if (!profile.twelfthOrDiplomaDetails) profile.twelfthOrDiplomaDetails = {};
            profile.twelfthOrDiplomaDetails.percentage = Number(req.body.twelfthPercentage);
        }
        if (twelfthOrDiplomaDetails) profile.twelfthOrDiplomaDetails = { ...profile.twelfthOrDiplomaDetails?.toObject?.(), ...twelfthOrDiplomaDetails };
        if (req.body.resume?.url) profile.resume = { url: req.body.resume.url, publicId: req.body.resume.publicId || "" };
        else if (req.body.resumeUrl) profile.resume = { url: req.body.resumeUrl, publicId: "" };
        if (about) profile.about = about;

        await profile.save();
        const updated = await StudentProfile.findById(profile._id).populate("user", "-password -refreshToken");
        return res.status(200).json(new ApiResponse(200, updated, "Student profile updated successfully"));
    }

    const existingEnrollment = await StudentProfile.findOne({
        $or: [{ enrollmentNumber: enrNum }, { usn: enrNum }]
    });
    if (existingEnrollment) {
        throw new ApiError(409, "Enrollment number / USN is already registered");
    }

    let uploadedResume = null;
    if (req.file) {
        uploadedResume = await uploadOnCloudinary(req.file.path, {
            folder: "campusflow/resumes",
            resource_type: "image"
        });
        if (!uploadedResume) {
            throw new ApiError(500, "Resume upload failed");
        }
    }

    let parsedSkills = [];
    if (skills) {
        parsedSkills = Array.isArray(skills)
            ? skills
            : skills.split(",").map((s) => s.trim()).filter(Boolean);
    }

    // Auto-resolve placement session if not provided
    let resolvedSessionId = placementSession;
    if (!resolvedSessionId && gradYear) {
        const foundSession = await PlacementSession.findOne({ sessionYear: gradYear });
        if (foundSession) {
            resolvedSessionId = foundSession._id;
        }
    }
    if (!admissionYear || Number(admissionYear) + selectedProgram.durationYears !== gradYear) {
        throw new ApiError(400, "Admission and graduation years must match the selected program duration");
    }
    const assignedSession = resolvedSessionId ? await PlacementSession.findById(resolvedSessionId) : null;
    if (!assignedSession || assignedSession.sessionYear !== gradYear) {
        throw new ApiError(400, "A placement session matching the student's graduation cohort is required");
    }

    profile = new StudentProfile({
        user: req.user._id,
        enrollmentNumber: enrNum,
        usn: enrNum,
        course: selectedProgram.degreeType,
        programCode: selectedProgram.code,
        programLevel: selectedProgram.programLevel,
        degreeType: selectedProgram.degreeType,
        branch: branchName,
        department: branchName,
        semester: semNum,
        currentSemester: semNum,
        admissionYear: admissionYear ? Number(admissionYear) : null,
        graduationYear: gradYear,
        placementSession: resolvedSessionId,
        cgpa: Number(cgpa),
        backlogs: backlogs !== undefined ? Number(backlogs) : 0,
        activeBacklogs: backlogs !== undefined ? Number(backlogs) : 0,
        skills: parsedSkills,
        about: about ? about.trim() : "",
        gender: gender || "Prefer not to say",
        dob: dob ? new Date(dob) : null,
        personalEmail: personalEmail || "",
        collegeEmail: collegeEmail || "",
        alternatePhone: alternatePhone || "",
        family: family || {},
        currentAddress: currentAddress || {},
        permanentAddress: permanentAddress || {},
        sameAsCurrent: Boolean(sameAsCurrent),
        tenthDetails: tenthDetails || {},
        twelfthOrDiplomaDetails: twelfthOrDiplomaDetails || {},
        semesterResults: Array.isArray(semesterResults) ? semesterResults : [],
        backlogDetails: Array.isArray(backlogDetails) ? backlogDetails : [],
        resume: uploadedResume
            ? { url: uploadedResume.secure_url || uploadedResume.url, publicId: uploadedResume.public_id }
            : (req.body.resume?.url
                ? { url: req.body.resume.url, publicId: req.body.resume.publicId || "" }
                : (req.body.resumeUrl ? { url: req.body.resumeUrl, publicId: "" } : { url: "", publicId: "" })),
        verificationStatus: "PENDING"
    });

    await profile.save();

    const created = await StudentProfile.findById(profile._id).populate(
        "user",
        "-password -refreshToken"
    );

    return res.status(201).json(
        new ApiResponse(201, created, "Student profile created successfully")
    );
});

// @desc    Get current student profile
// @route   GET /api/v1/studentprofile/current-student-profile
// @access  Student
const getCurrentStudentProfile = asyncHandler(async (req, res) => {
    let studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    })
        .populate("user", "-password -refreshToken")
        .populate("placementSession", "sessionYear name academicYear isActive");

    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    return res.status(200).json(
        new ApiResponse(200, studentProfile, "Student profile fetched successfully")
    );
});

// @desc    Update student profile
// @route   PATCH /api/v1/studentprofile/update-profile
// @access  Student & Admin
const updateStudentProfile = asyncHandler(async (req, res) => {
    const targetUserId = req.user.role === "admin" && req.body.userId ? req.body.userId : req.user._id;

    let studentProfile = await StudentProfile.findOne({ user: targetUserId });

    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    const {
        enrollmentNumber,
        usn,
        programCode,
        programLevel,
        degreeType,
        course,
        branch,
        department,
        semester,
        currentSemester,
        graduationYear,
        admissionYear,
        placementSession,
        cgpa,
        backlogs,
        tenthPercentage,
        twelfthPercentage,
        tenthDetails,
        twelfthOrDiplomaDetails,
        semesterResults,
        backlogDetails,
        certificates,
        skills,
        about,
        gender,
        dob,
        personalEmail,
        collegeEmail,
        alternatePhone,
        aadharNumber,
        family,
        currentAddress,
        permanentAddress,
        sameAsCurrent,
        section
    } = req.body;

    const programFieldsProvided = [programCode, programLevel, degreeType, course, branch, department]
        .some((value) => value !== undefined);
    const selectedProgram = resolveStudentProgram({ programCode, degreeType, course, branch, department });
    if (programFieldsProvided && !selectedProgram) {
        throw new ApiError(400, "Select an approved academic program; legacy or unknown values require review");
    }
    if (selectedProgram && programLevel && programLevel !== selectedProgram.programLevel) {
        throw new ApiError(400, "Program level does not match the selected academic program");
    }
    if (selectedProgram) {
        const nextAdmissionYear = Number(admissionYear ?? studentProfile.admissionYear);
        const nextGraduationYear = Number(graduationYear ?? studentProfile.graduationYear);
        if (nextAdmissionYear + selectedProgram.durationYears !== nextGraduationYear) {
            throw new ApiError(400, "Selected program duration does not match the student's admission and graduation years");
        }
    }

    const enrNum = enrollmentNumber?.trim() || usn?.trim();
    if (enrNum && enrNum !== studentProfile.enrollmentNumber) {
        const existingEnrollment = await StudentProfile.findOne({
            enrollmentNumber: enrNum,
            _id: { $ne: studentProfile._id }
        });
        if (existingEnrollment) {
            throw new ApiError(409, "Enrollment number / USN is already registered to another student");
        }
        studentProfile.enrollmentNumber = enrNum;
        studentProfile.usn = enrNum;
    }

    if (selectedProgram) {
        studentProfile.programCode = selectedProgram.code;
        studentProfile.programLevel = selectedProgram.programLevel;
        studentProfile.degreeType = selectedProgram.degreeType;
        studentProfile.course = selectedProgram.degreeType;
        studentProfile.branch = selectedProgram.name;
        studentProfile.department = selectedProgram.name;
    }
    if (semester !== undefined) {
        studentProfile.semester = Number(semester);
        studentProfile.currentSemester = Number(semester);
    }
    if (currentSemester !== undefined) {
        studentProfile.currentSemester = Number(currentSemester);
        studentProfile.semester = Number(currentSemester);
    }
    if (graduationYear !== undefined) studentProfile.graduationYear = Number(graduationYear);
    if (admissionYear !== undefined) studentProfile.admissionYear = Number(admissionYear);
    if (placementSession !== undefined && req.user.role === "admin") {
        const session = await PlacementSession.findById(placementSession);
        if (!session || session.sessionYear !== Number(graduationYear ?? studentProfile.graduationYear)) {
            throw new ApiError(400, "Placement session must match the student's graduation cohort");
        }
        studentProfile.placementSession = placementSession;
    }
    if (section !== undefined) studentProfile.section = section;

    if (cgpa !== undefined) studentProfile.cgpa = Number(cgpa);
    if (backlogs !== undefined) {
        studentProfile.backlogs = Number(backlogs);
        studentProfile.activeBacklogs = Number(backlogs);
    }

    if (gender !== undefined) studentProfile.gender = gender;
    if (dob !== undefined) studentProfile.dob = dob ? new Date(dob) : null;
    if (personalEmail !== undefined) studentProfile.personalEmail = personalEmail;
    if (collegeEmail !== undefined) studentProfile.collegeEmail = collegeEmail;
    const phoneToSet = req.body.phone || alternatePhone;
    if (phoneToSet !== undefined) {
        studentProfile.alternatePhone = String(phoneToSet).trim();
        studentProfile.phone = String(phoneToSet).trim();
        await User.findByIdAndUpdate(targetUserId, { $set: { phone: String(phoneToSet).trim() } });
    }
    if (aadharNumber !== undefined) studentProfile.aadharNumber = aadharNumber;

    if (family !== undefined) {
        studentProfile.family = { ...studentProfile.family?.toObject?.(), ...family };
    }
    if (currentAddress !== undefined) {
        studentProfile.currentAddress = { ...studentProfile.currentAddress?.toObject?.(), ...currentAddress };
    }
    if (permanentAddress !== undefined) {
        studentProfile.permanentAddress = { ...studentProfile.permanentAddress?.toObject?.(), ...permanentAddress };
    }
    if (sameAsCurrent !== undefined) studentProfile.sameAsCurrent = Boolean(sameAsCurrent);

    if (tenthDetails !== undefined) {
        studentProfile.tenthDetails = { ...studentProfile.tenthDetails?.toObject?.(), ...tenthDetails };
    }
    if (tenthPercentage !== undefined) {
        const p = tenthPercentage === "" || tenthPercentage === null ? null : Number(tenthPercentage);
        studentProfile.tenthPercentage = p;
        if (!studentProfile.tenthDetails) studentProfile.tenthDetails = {};
        studentProfile.tenthDetails.percentage = p;
    }

    if (twelfthOrDiplomaDetails !== undefined) {
        studentProfile.twelfthOrDiplomaDetails = {
            ...studentProfile.twelfthOrDiplomaDetails?.toObject?.(),
            ...twelfthOrDiplomaDetails
        };
    }
    if (twelfthPercentage !== undefined) {
        const p = twelfthPercentage === "" || twelfthPercentage === null ? null : Number(twelfthPercentage);
        studentProfile.twelfthPercentage = p;
        if (!studentProfile.twelfthOrDiplomaDetails) studentProfile.twelfthOrDiplomaDetails = {};
        studentProfile.twelfthOrDiplomaDetails.percentage = p;
    }

    if (semesterResults !== undefined && Array.isArray(semesterResults)) {
        studentProfile.semesterResults = semesterResults;
    }

    if (backlogDetails !== undefined && Array.isArray(backlogDetails)) {
        studentProfile.backlogDetails = backlogDetails;
    }

    if (req.body.hasEducationGap !== undefined) {
        studentProfile.hasEducationGap = Boolean(req.body.hasEducationGap);
    }
    if (req.body.educationGaps !== undefined && Array.isArray(req.body.educationGaps)) {
        studentProfile.educationGaps = req.body.educationGaps;
        if (req.body.educationGaps.length > 0) {
            studentProfile.hasEducationGap = true;
        }
    }

    if (certificates !== undefined) {
        studentProfile.certificates = Array.isArray(certificates) ? certificates : [];
    }

    if (skills !== undefined) {
        studentProfile.skills = Array.isArray(skills)
            ? skills
            : typeof skills === "string"
            ? skills.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
    }

    if (about !== undefined) studentProfile.about = about;

    if (req.body.resume !== undefined) {
        studentProfile.resume = {
            url: req.body.resume?.url || (typeof req.body.resume === "string" ? req.body.resume : ""),
            publicId: req.body.resume?.publicId || ""
        };
    } else if (req.body.resumeUrl !== undefined) {
        studentProfile.resume = {
            url: req.body.resumeUrl,
            publicId: ""
        };
    }

    // Student modifying verified records triggers REVERIFICATION_REQUESTED
    if (req.user.role === "student" && studentProfile.verificationStatus === "VERIFIED") {
        studentProfile.verificationStatus = "REVERIFICATION_REQUESTED";
    }

    // Save with Mongoose triggers the pre-save hook to re-evaluate CGPA and completeness
    await studentProfile.save();

    const updated = await StudentProfile.findById(studentProfile._id)
        .populate("user", "-password -refreshToken")
        .populate("placementSession", "sessionYear name academicYear isActive");

    return res.status(200).json(
        new ApiResponse(200, updated, "Student profile updated and synchronized successfully")
    );
});

// @desc    Add individual semester result with SGPA and credits
// @route   POST /api/v1/studentprofile/semester-result
// @access  Student & Admin
const addSemesterResult = asyncHandler(async (req, res) => {
    const { semester, sgpa, credits = 20, passedCredits = 20, marksheetUrl = "" } = req.body;

    if (!semester || sgpa === undefined) {
        throw new ApiError(400, "Semester number and SGPA are required");
    }

    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    const existingIdx = studentProfile.semesterResults.findIndex(
        (s) => s.semester === Number(semester)
    );

    if (existingIdx >= 0) {
        studentProfile.semesterResults[existingIdx].sgpa = Number(sgpa);
        studentProfile.semesterResults[existingIdx].credits = Number(credits);
        studentProfile.semesterResults[existingIdx].passedCredits = Number(passedCredits);
        if (marksheetUrl) studentProfile.semesterResults[existingIdx].marksheetUrl = marksheetUrl;
    } else {
        studentProfile.semesterResults.push({
            semester: Number(semester),
            sgpa: Number(sgpa),
            credits: Number(credits),
            passedCredits: Number(passedCredits),
            marksheetUrl
        });
    }

    studentProfile.semesterResults.sort((a, b) => a.semester - b.semester);

    await studentProfile.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            { semesterResults: studentProfile.semesterResults, cgpa: studentProfile.cgpa },
            `Semester ${semester} result recorded and institutional CGPA updated to ${studentProfile.cgpa}`
        )
    );
});

// @desc    Add or update backlog record (Active vs Cleared)
// @route   POST /api/v1/studentprofile/backlog-record
// @access  Student & Admin
const addBacklogRecord = asyncHandler(async (req, res) => {
    const { subjectCode, subjectName, semester, status = "ACTIVE", clearedDate, attempts = 1 } = req.body;

    if (!subjectName || !semester) {
        throw new ApiError(400, "Subject name and semester are required");
    }

    const studentProfile = await StudentProfile.findOne({ user: req.user._id });
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    studentProfile.backlogDetails.push({
        subjectCode: subjectCode || "",
        subjectName,
        semester: Number(semester),
        status,
        clearedDate: status === "CLEARED" && clearedDate ? new Date(clearedDate) : null,
        attempts: Number(attempts)
    });

    await studentProfile.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                activeBacklogs: studentProfile.activeBacklogs,
                historicalBacklogs: studentProfile.historicalBacklogs,
                clearedBacklogsCount: studentProfile.clearedBacklogsCount,
                backlogDetails: studentProfile.backlogDetails
            },
            "Backlog record saved successfully"
        )
    );
});

// @desc    Delete backlog record
// @route   DELETE /api/v1/studentprofile/backlog-record/:backlogId
// @access  Student & Admin
const deleteBacklogRecord = asyncHandler(async (req, res) => {
    const { backlogId } = req.params;
    let filter = { user: req.user._id };
    if (req.user.role === "admin" && (req.query.studentProfileId || req.body?.studentProfileId)) {
        filter = { _id: req.query.studentProfileId || req.body?.studentProfileId };
    }

    const studentProfile = await StudentProfile.findOne(filter);
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    if (studentProfile.isProfileLocked && req.user.role !== "admin") {
        throw new ApiError(403, "Profile is locked. Request TPO Modification or have TPO request re-verification to delete records.");
    }

    const initialLength = studentProfile.backlogDetails.length;
    studentProfile.backlogDetails = studentProfile.backlogDetails.filter(
        (b) => String(b._id) !== String(backlogId)
    );

    if (studentProfile.backlogDetails.length === initialLength) {
        throw new ApiError(404, "Backlog record not found");
    }

    await studentProfile.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                activeBacklogs: studentProfile.activeBacklogs,
                historicalBacklogs: studentProfile.historicalBacklogs,
                clearedBacklogsCount: studentProfile.clearedBacklogsCount,
                backlogs: studentProfile.backlogs,
                backlogDetails: studentProfile.backlogDetails
            },
            "Backlog record deleted successfully"
        )
    );
});

// @desc    Admin verification of student academic profile
// @route   PATCH /api/v1/studentprofile/:studentId/verify
// @access  Admin
const verifyStudentProfile = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { verificationStatus, verificationRemarks, verifiedCGPA } = req.body;

    const allowed = ["PENDING", "VERIFIED", "REJECTED", "REVERIFICATION_REQUESTED"];
    if (!allowed.includes(verificationStatus)) {
        throw new ApiError(400, `Invalid verification status. Must be one of: ${allowed.join(", ")}`);
    }

    const studentProfile = await StudentProfile.findById(studentId);
    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    studentProfile.verificationStatus = verificationStatus;
    studentProfile.verifiedBy = req.user._id;
    studentProfile.verifiedAt = new Date();
    if (verificationRemarks !== undefined) studentProfile.verificationRemarks = verificationRemarks;
    if (verifiedCGPA !== undefined) studentProfile.verifiedCGPA = Number(verifiedCGPA);

    // If Admin requests re-verification: UNLOCK ALL fields so student can update everything
    if (verificationStatus === "REVERIFICATION_REQUESTED") {
        studentProfile.isProfileLocked = false;
    } else if (verificationStatus === "VERIFIED") {
        studentProfile.isProfileLocked = true;
    }

    await studentProfile.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            studentProfile,
            `Student profile verification set to ${verificationStatus}`
        )
    );
});

// @desc    Safe migration and completeness recalculation for existing student profiles
// @route   POST /api/v1/studentprofile/migrate-profiles
// @access  Admin
const safeMigrateExistingProfiles = asyncHandler(async (req, res) => {
    const profiles = await StudentProfile.find();
    let migratedCount = 0;
    const sessions = await PlacementSession.find();
    const sessionMap = new Map();
    sessions.forEach((s) => sessionMap.set(s.sessionYear, s._id));

    for (const p of profiles) {
        let changed = false;

        // Map session if unlinked
        if (!p.placementSession && p.graduationYear && sessionMap.has(p.graduationYear)) {
            p.placementSession = sessionMap.get(p.graduationYear);
            changed = true;
        }

        // Initialize structured defaults if empty
        if (!p.currentAddress) {
            p.currentAddress = { street: "", city: "", state: "", pincode: "", country: "India" };
            changed = true;
        }
        if (!p.permanentAddress) {
            p.permanentAddress = { street: "", city: "", state: "", pincode: "", country: "India" };
            changed = true;
        }
        if (!p.tenthDetails) {
            p.tenthDetails = { percentage: p.tenthPercentage || null };
            changed = true;
        }
        if (!p.twelfthOrDiplomaDetails) {
            p.twelfthOrDiplomaDetails = { percentage: p.twelfthPercentage || null };
            changed = true;
        }

        // Trigger pre-save recalculation
        await p.save();
        migratedCount++;
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { totalProfiles: profiles.length, migratedCount },
            `Successfully audited and migrated ${migratedCount} student profile(s)`
        )
    );
});

// @desc    Update student resume
// @route   PATCH /api/v1/studentprofile/update-resume
// @access  Student
const updateStudentResume = asyncHandler(async (req, res) => {
    const resumeLocalPath = req.file?.path;

    if (!resumeLocalPath) {
        throw new ApiError(400, "Resume file is missing");
    }

    const resume = await uploadOnCloudinary(resumeLocalPath, {
        folder: "campusflow/resumes",
        resource_type: "image"
    });

    if (!resume || (!resume.secure_url && !resume.url)) {
        throw new ApiError(400, "Error while uploading new resume to Cloudinary");
    }

    let studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });

    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found. Complete an approved academic profile before uploading a resume.");
    }

    // Safely delete old resume from Cloudinary if existed
    if (studentProfile.resume?.publicId) {
        await deleteFromCloudinary(studentProfile.resume.publicId, "image");
    }

    studentProfile.resume = {
        url: resume.secure_url || resume.url,
        publicId: resume.public_id
    };

    await studentProfile.save();

    return res.status(200).json(
        new ApiResponse(200, studentProfile, "Resume updated successfully")
    );
});

// @desc    Delete student resume
// @route   DELETE /api/v1/studentprofile/delete-resume
// @access  Student
const deleteStudentResume = asyncHandler(async (req, res) => {
    let studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });

    if (!studentProfile) {
        throw new ApiError(404, "Student profile not found");
    }

    if (studentProfile.resume?.publicId) {
        await deleteFromCloudinary(studentProfile.resume.publicId, "image");
    }

    studentProfile.resume = {
        url: "",
        publicId: ""
    };

    await studentProfile.save();

    return res.status(200).json(
        new ApiResponse(200, studentProfile, "Resume removed successfully")
    );
});

// @desc    Get all student profiles with session & verification filters
// @route   GET /api/v1/studentprofile/all-students
// @access  Admin
const getAllStudentProfiles = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 50,
        search = "",
        branch = "",
        isPlaced = "",
        graduationYear = "",
        placementSession = "",
        verificationStatus = ""
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (branch) filter.branch = branch;
    if (isPlaced !== "") filter.isPlaced = isPlaced === "true";
    if (graduationYear) filter.graduationYear = parseInt(graduationYear);
    if (verificationStatus) filter.verificationStatus = verificationStatus;

    if (placementSession && placementSession !== "all") {
        filter.$or = [
            { placementSession: placementSession },
            { graduationYear: isNaN(placementSession) ? -1 : Number(placementSession) }
        ];
    }

    let students;
    let total;

    if (search) {
        const pipeline = [
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $match: {
                    ...filter,
                    $or: [
                        { "user.fullName": { $regex: search, $options: "i" } },
                        { "user.email": { $regex: search, $options: "i" } },
                        { enrollmentNumber: { $regex: search, $options: "i" } },
                        { usn: { $regex: search, $options: "i" } }
                    ]
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limitNum },
            {
                $project: {
                    "user.password": 0,
                    "user.refreshToken": 0
                }
            }
        ];

        const countPipeline = [
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $match: {
                    ...filter,
                    $or: [
                        { "user.fullName": { $regex: search, $options: "i" } },
                        { "user.email": { $regex: search, $options: "i" } },
                        { enrollmentNumber: { $regex: search, $options: "i" } },
                        { usn: { $regex: search, $options: "i" } }
                    ]
                }
            },
            { $count: "total" }
        ];

        [students, [{ total: total } = { total: 0 }]] = await Promise.all([
            StudentProfile.aggregate(pipeline),
            StudentProfile.aggregate(countPipeline)
        ]);
    } else {
        [students, total] = await Promise.all([
            StudentProfile.find(filter)
                .populate("user", "fullName email phone avatar role")
                .populate("placementSession", "sessionYear name academicYear isActive")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            StudentProfile.countDocuments(filter)
        ]);
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                students,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    pages: Math.ceil(total / limitNum)
                }
            },
            "Student profiles fetched successfully"
        )
    );
});

// @desc    Get student profile by ID
// @route   GET /api/v1/studentprofile/:studentId
// @access  Admin & Authenticated Users
const getStudentProfileById = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const student = await StudentProfile.findById(studentId)
        .populate("user", "-password -refreshToken")
        .populate("placementSession", "sessionYear name academicYear isActive")
        .populate("verifiedBy", "fullName email");

    if (!student) {
        throw new ApiError(404, "Student profile not found");
    }

    return res.status(200).json(
        new ApiResponse(200, student, "Student profile fetched successfully")
    );
});

// @desc    Lock student profile after student verifies details
// @route   POST /api/v1/studentprofile/lock-profile
// @access  Student / Admin
const lockStudentProfile = asyncHandler(async (req, res) => {
    const targetUserId = req.user.role === "admin" && req.body.userId ? req.body.userId : req.user._id;
    const profile = await StudentProfile.findOne({ user: targetUserId });

    if (!profile) {
        throw new ApiError(404, "Student profile not found");
    }

    profile.isProfileLocked = true;
    profile.profileLockedAt = new Date();
    await profile.save();

    return res.status(200).json(
        new ApiResponse(200, profile, "Profile successfully confirmed and locked")
    );
});

// @desc    Unlock student profile
// @route   POST /api/v1/studentprofile/:studentId/unlock-profile
// @access  Admin
const unlockStudentProfile = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const profile = await StudentProfile.findById(studentId);

    if (!profile) {
        throw new ApiError(404, "Student profile not found");
    }

    profile.isProfileLocked = false;
    await profile.save();

    return res.status(200).json(
        new ApiResponse(200, profile, "Student profile has been unlocked for editing")
    );
});

// @desc    Submit profile modification request
// @route   POST /api/v1/studentprofile/request-modification
// @access  Student
const submitModificationRequest = asyncHandler(async (req, res) => {
    const { changes, reason } = req.body;

    if (!Array.isArray(changes) || changes.length === 0) {
        throw new ApiError(400, "At least one modification field change is required");
    }

    const profile = await StudentProfile.findOne({ user: req.user._id }).populate("user", "fullName email");
    if (!profile) {
        throw new ApiError(404, "Student profile not found");
    }

    // Check if there is already an active pending request
    const existingPending = profile.modificationRequests?.find((r) => r.status === "PENDING");
    if (existingPending) {
        throw new ApiError(400, "You already have a pending modification request awaiting TPO review");
    }

    const newRequest = {
        requestedAt: new Date(),
        status: "PENDING",
        reason: reason?.trim() || "Profile detail update",
        changes: changes.map((c) => ({
            field: c.field,
            fieldLabel: c.fieldLabel || c.field,
            beforeValue: c.beforeValue !== undefined ? c.beforeValue : null,
            afterValue: c.afterValue !== undefined ? c.afterValue : null
        }))
    };

    if (!profile.modificationRequests) {
        profile.modificationRequests = [];
    }
    profile.modificationRequests.unshift(newRequest);
    await profile.save();

    // Create In-App Notification for all Admin/TPO users
    try {
        const admins = await User.find({ role: "admin" }).select("_id");
        const changeNames = changes.map((c) => c.fieldLabel || c.field).join(", ");
        const studentName = profile.user?.fullName || profile.enrollmentNumber || "Student";
        const notifications = admins.map((admin) => ({
            user: admin._id,
            title: "Profile Modification Request",
            message: `${studentName} requested permission to modify: ${changeNames}. Reason: ${reason || "Not specified"}.`,
            type: "urgent",
            isRead: false
        }));
        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }
    } catch (notifErr) {
        console.warn("Could not dispatch admin notifications for profile request:", notifErr.message);
    }

    return res.status(200).json(
        new ApiResponse(200, profile, "Modification request submitted to TPO successfully")
    );
});

// @desc    Get all pending modification requests across all students
// @route   GET /api/v1/studentprofile/modification-requests
// @access  Admin
const getModificationRequests = asyncHandler(async (req, res) => {
    const studentsWithRequests = await StudentProfile.find({
        "modificationRequests.0": { $exists: true }
    })
        .populate("user", "fullName email phone")
        .select("enrollmentNumber usn branch department currentSemester graduationYear modificationRequests isProfileLocked");

    const allRequests = [];
    studentsWithRequests.forEach((student) => {
        (student.modificationRequests || []).forEach((reqItem) => {
            allRequests.push({
                requestId: reqItem._id,
                studentId: student._id,
                studentName: student.user?.fullName || student.enrollmentNumber,
                studentEmail: student.user?.email || "",
                usn: student.enrollmentNumber || student.usn || "",
                branch: student.branch || student.department || "",
                requestedAt: reqItem.requestedAt,
                status: reqItem.status,
                reason: reqItem.reason,
                changes: reqItem.changes,
                reviewedAt: reqItem.reviewedAt,
                reviewedBy: reqItem.reviewedBy,
                reviewRemarks: reqItem.reviewRemarks
            });
        });
    });

    // Sort newest requested first
    allRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    return res.status(200).json(
        new ApiResponse(200, allRequests, "Modification requests retrieved successfully")
    );
});

// @desc    Review and approve/reject profile modification request
// @route   POST /api/v1/studentprofile/modification-requests/:requestId/review
// @access  Admin
const reviewModificationRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { action, reviewRemarks = "" } = req.body;

    if (!["APPROVE", "REJECT"].includes(action)) {
        throw new ApiError(400, "Action must be either APPROVE or REJECT");
    }

    // Find student profile containing this requestId
    const profile = await StudentProfile.findOne({
        "modificationRequests._id": requestId
    }).populate("user", "fullName email");

    if (!profile) {
        throw new ApiError(404, "Modification request not found");
    }

    const requestItem = profile.modificationRequests.id(requestId);
    if (!requestItem) {
        throw new ApiError(404, "Modification request item not found");
    }

    if (requestItem.status !== "PENDING") {
        throw new ApiError(400, `Request has already been ${requestItem.status.toLowerCase()}`);
    }

    requestItem.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
    requestItem.reviewedBy = req.user._id;
    requestItem.reviewedAt = new Date();
    requestItem.reviewRemarks = reviewRemarks.trim();

    // If APPROVED, automatically apply the requested changes to the student's profile!
    if (action === "APPROVE") {
        for (const change of requestItem.changes) {
            const field = change.field;
            const afterVal = change.afterValue;

            if (field === "backlogs" || field === "activeBacklogs") {
                const newBacklogCount = Number(afterVal) || 0;
                profile.backlogs = newBacklogCount;
                profile.activeBacklogs = newBacklogCount;
                if (newBacklogCount === 0) {
                    profile.backlogDetails = [];
                    profile.clearedBacklogsCount = 0;
                    profile.historicalBacklogs = 0;
                } else if (Array.isArray(profile.backlogDetails)) {
                    const activeItems = profile.backlogDetails.filter(b => b.status === "ACTIVE");
                    if (activeItems.length > newBacklogCount) {
                        const toClear = activeItems.slice(newBacklogCount);
                        toClear.forEach(b => {
                            b.status = "CLEARED";
                            b.clearedDate = new Date();
                        });
                    }
                }
            } else if (field === "clearedBacklogsCount") {
                profile.clearedBacklogsCount = Number(afterVal) || 0;
            } else if (field === "cgpa") {
                profile.cgpa = Number(afterVal);
            } else if (field === "tenthPercentage") {
                profile.tenthPercentage = Number(afterVal);
                if (profile.tenthDetails) profile.tenthDetails.percentage = Number(afterVal);
            } else if (field === "twelfthPercentage") {
                profile.twelfthPercentage = Number(afterVal);
                if (profile.twelfthOrDiplomaDetails) profile.twelfthOrDiplomaDetails.percentage = Number(afterVal);
            } else if (field === "alternatePhone" || field === "phone") {
                profile.alternatePhone = String(afterVal);
            } else if (field === "personalEmail") {
                profile.personalEmail = String(afterVal);
            } else if (field === "semester" || field === "currentSemester") {
                profile.semester = Number(afterVal);
                profile.currentSemester = Number(afterVal);
            } else if (field === "admissionYear") {
                profile.admissionYear = Number(afterVal);
            } else if (field === "graduationYear") {
                profile.graduationYear = Number(afterVal);
            } else if (field === "branch" || field === "department") {
                profile.branch = String(afterVal);
                profile.department = String(afterVal);
            } else if (field === "skills") {
                profile.skills = Array.isArray(afterVal) ? afterVal : String(afterVal).split(",").map(s => s.trim()).filter(Boolean);
            } else if (field === "about") {
                profile.about = String(afterVal);
            } else if (field === "fatherName") {
                if (!profile.family) profile.family = {};
                profile.family.fatherName = String(afterVal);
            } else if (field === "motherName") {
                if (!profile.family) profile.family = {};
                profile.family.motherName = String(afterVal);
            } else if (field === "parentPhone") {
                if (!profile.family) profile.family = {};
                profile.family.parentPhone = String(afterVal);
            } else if (field in profile) {
                profile[field] = afterVal;
            }

            // Also synchronize full name / email on user if requested
            if (field === "fullName" || field === "name") {
                await User.findByIdAndUpdate(profile.user._id, { $set: { fullName: String(afterVal) } });
            }
        }
    }

    await profile.save();

    // Dispatch in-app notification to the student
    try {
        const changeNames = requestItem.changes.map((c) => c.fieldLabel || c.field).join(", ");
        await Notification.create({
            user: profile.user._id,
            title: action === "APPROVE" ? "Profile Modification Approved" : "Profile Modification Request Rejected",
            message:
                action === "APPROVE"
                    ? `Your requested update for [${changeNames}] was approved and applied to your profile records.`
                    : `Your requested update for [${changeNames}] was not approved. Remarks: ${reviewRemarks || "Contact TPO placement cell."}`,
            type: action === "APPROVE" ? "offer" : "status_update",
            isRead: false
        });
    } catch (e) {
        console.warn("Failed to notify student of review outcome:", e.message);
    }

    return res.status(200).json(
        new ApiResponse(200, profile, `Modification request successfully ${action.toLowerCase()}d`)
    );
});

export {
    createStudentProfile,
    getCurrentStudentProfile,
    updateStudentProfile,
    updateStudentResume,
    deleteStudentResume,
    getAllStudentProfiles,
    getStudentProfileById,
    addSemesterResult,
    addBacklogRecord,
    deleteBacklogRecord,
    verifyStudentProfile,
    safeMigrateExistingProfiles,
    lockStudentProfile,
    unlockStudentProfile,
    submitModificationRequest,
    getModificationRequests,
    reviewModificationRequest
};