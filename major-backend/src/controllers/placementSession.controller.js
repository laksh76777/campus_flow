import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";

// @desc    Create new placement session
// @route   POST /api/v1/sessions
// @access  Admin
const createPlacementSession = asyncHandler(async (req, res) => {
    const {
        sessionYear,
        name,
        academicYear,
        description,
        startDate,
        endDate,
        admissionYearMapping,
        targetPlacementPercentage,
        isActive
    } = req.body;

    let yearNum = Number(sessionYear);
    let resolvedAcademicYear = academicYear?.trim() || "";

    // If sessionYear was given as a string range like "2024-2028" or "2023-2027"
    if (isNaN(yearNum) && typeof sessionYear === "string") {
        const parts = sessionYear.match(/\b(20\d\d)\b/g);
        if (parts && parts.length >= 2) {
            yearNum = Number(parts[1]); // graduation year
            if (!resolvedAcademicYear) {
                resolvedAcademicYear = `${parts[0]}-${parts[1]}`;
            }
        } else if (parts && parts.length === 1) {
            yearNum = Number(parts[0]);
        }
    }

    // If academicYear contains range like "2024-2028"
    if (resolvedAcademicYear) {
        const parts = resolvedAcademicYear.match(/\b(20\d\d)\b/g);
        if (parts && parts.length >= 2) {
            const startYear = Number(parts[0]);
            const endYear = Number(parts[1]);
            if (yearNum === startYear && endYear > startYear) {
                yearNum = endYear;
            }
        }
    }

    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2200) {
        throw new ApiError(400, "A valid placement session graduation year is required");
    }
    const existing = await PlacementSession.findOne({ sessionYear: yearNum });
    if (existing) {
        throw new ApiError(409, `Placement session for year ${yearNum} already exists`);
    }

    if (!resolvedAcademicYear) {
        resolvedAcademicYear = `${yearNum - 4}-${yearNum}`;
    }

    const sessionName = name?.trim() || `Session ${resolvedAcademicYear} (Class of ${yearNum})`;

    // If marked active, deactivate others
    if (isActive) {
        await PlacementSession.updateMany({}, { isActive: false });
    }

    // Cohort mappings use degree type; the session remains distinct from a student's program.
    const defaultMappings = admissionYearMapping?.length
        ? admissionYearMapping
        : [
              { course: "B.E.", courseDurationYears: 4, admissionYear: yearNum - 4 },
              { course: "B.Tech", courseDurationYears: 4, admissionYear: yearNum - 4 },
              { course: "MBA", courseDurationYears: 2, admissionYear: yearNum - 2 },
              { course: "MCA", courseDurationYears: 2, admissionYear: yearNum - 2 },
              { course: "M.Tech", courseDurationYears: 2, admissionYear: yearNum - 2 }
          ];

    const session = await PlacementSession.create({
        sessionYear: yearNum,
        name: sessionName,
        academicYear: resolvedAcademicYear,
        description: description || "",
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        admissionYearMapping: defaultMappings,
        targetPlacementPercentage: targetPlacementPercentage || 90,
        isActive: Boolean(isActive),
        createdBy: req.user._id
    });

    return res.status(201).json(
        new ApiResponse(201, session, "Placement session created successfully")
    );
});

// @desc    Get all placement sessions
// @route   GET /api/v1/sessions
// @access  Admin & Authenticated Users
const getAllPlacementSessions = asyncHandler(async (req, res) => {
    const { includeArchived = "false" } = req.query;

    const filter = {};
    if (includeArchived !== "true") {
        filter.isArchived = false;
    }

    const sessions = await PlacementSession.find(filter)
        .sort({ sessionYear: -1 })
        .populate("createdBy", "fullName email");

    // Augment with drive and student count aggregates
    const enhancedSessions = await Promise.all(
        sessions.map(async (sess) => {
            const [studentCount, driveCount] = await Promise.all([
                StudentProfile.countDocuments({
                    $or: [
                        { placementSession: sess._id },
                        { graduationYear: sess.sessionYear }
                    ]
                }),
                PlacementDrive.countDocuments({
                    $or: [
                        { placementSession: sess._id },
                        { graduationYear: sess.sessionYear }
                    ]
                })
            ]);

            return {
                ...sess.toObject(),
                studentCount,
                driveCount
            };
        })
    );

    return res.status(200).json(
        new ApiResponse(200, enhancedSessions, "Placement sessions retrieved successfully")
    );
});

// @desc    Get active placement session
// @route   GET /api/v1/sessions/active
// @access  Authenticated Users
const getActivePlacementSession = asyncHandler(async (req, res) => {
    let session = await PlacementSession.findOne({ isActive: true, isArchived: false });

    // Fallback to latest unarchived session
    if (!session) {
        session = await PlacementSession.findOne({ isArchived: false }).sort({ sessionYear: -1 });
    }

    return res.status(200).json(
        new ApiResponse(200, session, "Active placement session retrieved")
    );
});

// @desc    Get placement session by ID
// @route   GET /api/v1/sessions/:sessionId
// @access  Admin & Authenticated Users
const getPlacementSessionById = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const session = await PlacementSession.findById(sessionId).populate(
        "createdBy",
        "fullName email"
    );

    if (!session) {
        throw new ApiError(404, "Placement session not found");
    }

    const [studentCount, driveCount, placedCount] = await Promise.all([
        StudentProfile.countDocuments({
            $or: [{ placementSession: session._id }, { graduationYear: session.sessionYear }]
        }),
        PlacementDrive.countDocuments({
            $or: [{ placementSession: session._id }, { graduationYear: session.sessionYear }]
        }),
        StudentProfile.countDocuments({
            $or: [{ placementSession: session._id }, { graduationYear: session.sessionYear }],
            isPlaced: true
        })
    ]);

    const placementRate = studentCount > 0 ? Math.round((placedCount / studentCount) * 100) : 0;

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                ...session.toObject(),
                studentCount,
                driveCount,
                placedCount,
                placementRate
            },
            "Placement session details retrieved"
        )
    );
});

// @desc    Update placement session
// @route   PATCH /api/v1/sessions/:sessionId
// @access  Admin
const updatePlacementSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const {
        name,
        academicYear,
        description,
        startDate,
        endDate,
        admissionYearMapping,
        targetPlacementPercentage,
        isActive,
        isArchived
    } = req.body;

    const session = await PlacementSession.findById(sessionId);
    if (!session) {
        throw new ApiError(404, "Placement session not found");
    }

    if (name) session.name = name.trim();
    if (academicYear) session.academicYear = academicYear.trim();
    if (description !== undefined) session.description = description.trim();
    if (startDate) session.startDate = new Date(startDate);
    if (endDate !== undefined) session.endDate = endDate ? new Date(endDate) : null;
    if (admissionYearMapping) session.admissionYearMapping = admissionYearMapping;
    if (targetPlacementPercentage !== undefined)
        session.targetPlacementPercentage = Number(targetPlacementPercentage);

    if (isActive !== undefined) {
        if (isActive) {
            await PlacementSession.updateMany({ _id: { $ne: session._id } }, { isActive: false });
            session.isActive = true;
        } else {
            session.isActive = false;
        }
    }

    if (isArchived !== undefined) {
        session.isArchived = Boolean(isArchived);
        if (session.isArchived) {
            session.isActive = false;
            session.status = "ARCHIVED";
        }
    }

    await session.save();

    return res.status(200).json(
        new ApiResponse(200, session, "Placement session updated successfully")
    );
});

// @desc    Set session as active
// @route   PATCH /api/v1/sessions/:sessionId/activate
// @access  Admin
const setActivePlacementSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const session = await PlacementSession.findById(sessionId);
    if (!session) {
        throw new ApiError(404, "Placement session not found");
    }

    // Set all other sessions inactive
    await PlacementSession.updateMany({}, { isActive: false });

    session.isActive = true;
    session.isArchived = false;
    session.isClosed = false;
    session.status = "ACTIVE";
    await session.save();

    return res.status(200).json(
        new ApiResponse(200, session, `Placement session for ${session.sessionYear} is now active`)
    );
});

// @desc    Close placement session (concludes placement drives and offers)
// @route   PATCH /api/v1/sessions/:sessionId/close
// @access  Admin
const closePlacementSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const session = await PlacementSession.findById(sessionId);
    if (!session) {
        throw new ApiError(404, "Placement session not found");
    }

    session.isActive = false;
    session.isClosed = true;
    session.status = "CLOSED";
    session.endDate = new Date();
    await session.save();

    return res.status(200).json(
        new ApiResponse(200, session, `Placement session for ${session.sessionYear} has been closed`)
    );
});

// @desc    Archive placement session (read-only historical audit)
// @route   PATCH /api/v1/sessions/:sessionId/archive
// @access  Admin
const archivePlacementSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const session = await PlacementSession.findById(sessionId);
    if (!session) {
        throw new ApiError(404, "Placement session not found");
    }

    session.isActive = false;
    session.isArchived = true;
    session.status = "ARCHIVED";
    await session.save();

    return res.status(200).json(
        new ApiResponse(200, session, `Placement session for ${session.sessionYear} has been archived`)
    );
});

// @desc    Preview migration / backfill mappings for existing unlinked students & drives
// @route   GET /api/v1/sessions/backfill/preview
// @access  Admin
const previewSessionBackfill = asyncHandler(async (req, res) => {
    const sessions = await PlacementSession.find().sort({ sessionYear: 1 });
    const sessionMapByYear = new Map();
    sessions.forEach((s) => sessionMapByYear.set(s.sessionYear, s));

    // Find students without placementSession
    const unlinkedStudents = await StudentProfile.find({
        $or: [{ placementSession: { $exists: false } }, { placementSession: null }]
    }).populate("user", "fullName email");

    // Find drives without placementSession
    const unlinkedDrives = await PlacementDrive.find({
        $or: [{ placementSession: { $exists: false } }, { placementSession: null }]
    }).populate("company", "name");

    const studentPlanned = [];
    const studentAmbiguous = [];

    for (const st of unlinkedStudents) {
        const targetSession = sessionMapByYear.get(st.graduationYear);
        if (targetSession) {
            studentPlanned.push({
                studentId: st._id,
                name: st.user?.fullName || "Student",
                email: st.user?.email || "",
                enrollmentNumber: st.enrollmentNumber,
                branch: st.branch,
                graduationYear: st.graduationYear,
                mappedSessionId: targetSession._id,
                mappedSessionYear: targetSession.sessionYear,
                reason: `Graduation year ${st.graduationYear} matches Session ${targetSession.sessionYear}`
            });
        } else {
            studentAmbiguous.push({
                studentId: st._id,
                name: st.user?.fullName || "Student",
                enrollmentNumber: st.enrollmentNumber,
                graduationYear: st.graduationYear,
                reason: `No placement session found for graduation year ${st.graduationYear}`
            });
        }
    }

    const drivePlanned = [];
    const driveAmbiguous = [];

    for (const dr of unlinkedDrives) {
        const targetSession = sessionMapByYear.get(dr.graduationYear);
        if (targetSession) {
            drivePlanned.push({
                driveId: dr._id,
                jobTitle: dr.jobTitle,
                company: dr.company?.name || "Company",
                graduationYear: dr.graduationYear,
                mappedSessionId: targetSession._id,
                mappedSessionYear: targetSession.sessionYear,
                reason: `Drive graduation year ${dr.graduationYear} matches Session ${targetSession.sessionYear}`
            });
        } else {
            driveAmbiguous.push({
                driveId: dr._id,
                jobTitle: dr.jobTitle,
                company: dr.company?.name || "Company",
                graduationYear: dr.graduationYear,
                reason: `No placement session found for graduation year ${dr.graduationYear}`
            });
        }
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalUnlinkedStudents: unlinkedStudents.length,
                totalUnlinkedDrives: unlinkedDrives.length,
                studentPlannedCount: studentPlanned.length,
                studentAmbiguousCount: studentAmbiguous.length,
                drivePlannedCount: drivePlanned.length,
                driveAmbiguousCount: driveAmbiguous.length,
                studentPlanned,
                studentAmbiguous,
                drivePlanned,
                driveAmbiguous
            },
            "Session backfill preview generated"
        )
    );
});

// @desc    Execute migration / backfill for confirmed mappings
// @route   POST /api/v1/sessions/backfill/execute
// @access  Admin
const executeSessionBackfill = asyncHandler(async (req, res) => {
    const { confirmedMappings } = req.body;
    // confirmedMappings: { studentMappings?: [{ studentId, sessionId }], driveMappings?: [{ driveId, sessionId }] }

    let studentUpdated = 0;
    let driveUpdated = 0;

    if (confirmedMappings?.studentMappings?.length) {
        for (const m of confirmedMappings.studentMappings) {
            await StudentProfile.findByIdAndUpdate(m.studentId, {
                placementSession: m.sessionId
            });
            studentUpdated++;
        }
    }

    if (confirmedMappings?.driveMappings?.length) {
        for (const m of confirmedMappings.driveMappings) {
            await PlacementDrive.findByIdAndUpdate(m.driveId, {
                placementSession: m.sessionId
            });
            driveUpdated++;
        }
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { studentUpdated, driveUpdated },
            `Backfill completed: ${studentUpdated} students and ${driveUpdated} drives mapped`
        )
    );
});

// @desc    Transfer student(s) to a different placement session
// @route   POST /api/v1/sessions/transfer-students
// @access  Admin
const transferStudentsSession = asyncHandler(async (req, res) => {
    const { studentIds, targetSessionId, updateGraduationYear = true } = req.body;

    if (!studentIds?.length || !targetSessionId) {
        throw new ApiError(400, "Student IDs and target session ID are required");
    }

    const targetSession = await PlacementSession.findById(targetSessionId);
    if (!targetSession) {
        throw new ApiError(404, "Target placement session not found");
    }

    const updateFields = { placementSession: targetSession._id };
    if (updateGraduationYear) {
        updateFields.graduationYear = targetSession.sessionYear;
    }

    const result = await StudentProfile.updateMany(
        { _id: { $in: studentIds } },
        { $set: updateFields }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { modifiedCount: result.modifiedCount, targetSessionYear: targetSession.sessionYear },
            `Transferred ${result.modifiedCount} student(s) to session ${targetSession.sessionYear}`
        )
    );
});

export {
    createPlacementSession,
    getAllPlacementSessions,
    getActivePlacementSession,
    getPlacementSessionById,
    updatePlacementSession,
    setActivePlacementSession,
    closePlacementSession,
    archivePlacementSession,
    previewSessionBackfill,
    executeSessionBackfill,
    transferStudentsSession
};
