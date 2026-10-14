import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { User } from "../models/user.models.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { v2 as cloudinary } from "cloudinary";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// @desc    Create student profile
// @route   POST /api/v1/studentprofile/create-student-profile
// @access  Student
const createStudentProfile = asyncHandler(async (req, res) => {
    const {
        enrollmentNumber,
        usn,
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
    const branchName = branch?.trim() || department?.trim();
    const semNum = Number(semester || currentSemester);
    const gradYear = Number(graduationYear);

    if (!enrNum || !branchName || !semNum || !gradYear || cgpa === undefined) {
        throw new ApiError(
            400,
            "Enrollment number/USN, branch/department, semester, graduation year and CGPA are required"
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
    if (profile) {
        if (enrNum) { profile.enrollmentNumber = enrNum; profile.usn = enrNum; }
        if (branchName) { profile.branch = branchName; profile.department = branchName; }
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
        uploadedResume = await uploadOnCloudinary(req.file.path);
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

    profile = new StudentProfile({
        user: req.user._id,
        enrollmentNumber: enrNum,
        usn: enrNum,
        course: course || "B.Tech",
        branch: branchName,
        department: branchName,
        semester: semNum,
        currentSemester: semNum,
        admissionYear: admissionYear ? Number(admissionYear) : gradYear - 4,
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

    if (!studentProfile && req.user?.role === "student") {
        const generatedEnrollment = `ENR-${req.user._id.toString().slice(-6).toUpperCase()}`;
        const activeSession = await PlacementSession.findOne({ isActive: true });

        const newProfile = new StudentProfile({
            user: req.user._id,
            enrollmentNumber: generatedEnrollment,
            usn: generatedEnrollment,
            course: "B.Tech",
            branch: "CSE",
            department: "CSE",
            semester: 6,
            currentSemester: 6,
            graduationYear: activeSession?.sessionYear || 2026,
            admissionYear: (activeSession?.sessionYear || 2026) - 4,
            placementSession: activeSession?._id,
            cgpa: 8.0,
            backlogs: 0,
            skills: ["JavaScript", "React", "Python"],
            about: "",
            tenthPercentage: null,
            twelfthPercentage: null,
            certificates: [],
            verificationStatus: "PENDING"
        });

        await newProfile.save();

        studentProfile = await StudentProfile.findById(newProfile._id)
            .populate("user", "-password -refreshToken")
            .populate("placementSession", "sessionYear name academicYear isActive");
    }

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

    if (course !== undefined) studentProfile.course = course;
    if (branch !== undefined) {
        studentProfile.branch = branch;
        studentProfile.department = branch;
    }
    if (department !== undefined) {
        studentProfile.department = department;
        studentProfile.branch = department;
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
    if (alternatePhone !== undefined) studentProfile.alternatePhone = alternatePhone;
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

    const resume = await uploadOnCloudinary(resumeLocalPath);

    if (!resume || !resume.url) {
        throw new ApiError(400, "Error while uploading new resume");
    }

    let studentProfile = await StudentProfile.findOne({
        user: req.user?._id
    });

    if (!studentProfile) {
        studentProfile = new StudentProfile({
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
        await studentProfile.save();

        return res.status(200).json(
            new ApiResponse(
                200,
                studentProfile,
                "Resume uploaded successfully and profile initialized"
            )
        );
    }

    // Delete old resume from Cloudinary if existed
    if (studentProfile.resume?.publicId) {
        await cloudinary.uploader.destroy(studentProfile.resume.publicId, {
            resource_type: "image"
        });
    }

    studentProfile.resume = {
        url: resume.url,
        publicId: resume.public_id
    };

    await studentProfile.save();

    return res.status(200).json(
        new ApiResponse(200, studentProfile, "Resume updated successfully")
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

export {
    createStudentProfile,
    getCurrentStudentProfile,
    updateStudentProfile,
    updateStudentResume,
    getAllStudentProfiles,
    getStudentProfileById,
    addSemesterResult,
    addBacklogRecord,
    verifyStudentProfile,
    safeMigrateExistingProfiles
};