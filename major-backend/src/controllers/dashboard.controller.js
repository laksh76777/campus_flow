import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Company } from "../models/company.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Application } from "../models/application.model.js";
import { resolveStudentProgram } from "../constants/programCatalog.js";
import { studentMatchesDriveProgram } from "../services/programTargeting.service.js";

/**
 * Enhanced Admin Dashboard Analytics
 * Calculates aggregate stats, branch placement distribution, salary brackets,
 * recruitment funnel, and corporate recruiter rankings.
 */
const getDashboardStats = asyncHandler(async (req, res) => {
    const { sessionId, placementSession } = req.query;
    const targetSessionId = sessionId || placementSession;

    const studentFilter = targetSessionId ? { placementSession: targetSessionId } : {};
    const driveFilter = targetSessionId ? { placementSession: targetSessionId } : {};

    let appFilter = {};
    if (targetSessionId) {
        const sessionDrives = await PlacementDrive.find(driveFilter).select("_id");
        const driveIds = sessionDrives.map((d) => d._id);
        appFilter = { placementDrive: { $in: driveIds } };
    }

    const [
        totalCompanies,
        activeCompanies,
        totalPlacementDrives,
        activePlacementDrives,
        totalStudents,
        totalApplications,
        appliedApplications,
        shortlistedApplications,
        interviewApplications,
        rejectedApplications,
        selectedApplications,
        withdrawnApplications,
        allProfiles,
        selectedApps,
        allDrives
    ] = await Promise.all([
        Company.countDocuments(),
        Company.countDocuments({ isActive: true }),
        PlacementDrive.countDocuments(driveFilter),
        PlacementDrive.countDocuments({ ...driveFilter, isActive: true }),
        StudentProfile.countDocuments(studentFilter),
        Application.countDocuments(appFilter),
        Application.countDocuments({ ...appFilter, status: "applied" }),
        Application.countDocuments({ ...appFilter, status: "shortlisted" }),
        Application.countDocuments({ ...appFilter, status: "interview" }),
        Application.countDocuments({ ...appFilter, status: "rejected" }),
        Application.countDocuments({ ...appFilter, status: "selected" }),
        Application.countDocuments({ ...appFilter, status: "withdrawn" }),

        // Profiles with branch info
        StudentProfile.find(studentFilter).select("programCode programLevel degreeType course branch department cgpa"),

        // Selected applications with populated placement drive and company for salary/company analytics
        Application.find({ ...appFilter, status: "selected" })
            .populate({
                path: "placementDrive",
                populate: {
                    path: "company",
                    select: "companyName industry"
                },
                select: "jobTitle package"
            })
            .populate("student", "programCode programLevel degreeType course branch department"),

        // All placement drives with company info
        PlacementDrive.find(driveFilter)
            .populate("company", "companyName")
            .select("jobTitle package numberOfOpenings isActive createdAt")
    ]);

    // 1. Branch-Wise Placement Analysis
    const branchMap = {};
    allProfiles.forEach((profile) => {
        const program = resolveStudentProgram(profile);
        const raw = profile.branch || profile.department || "Unassigned";
        const key = program?.code || `LEGACY:${raw}`;
        if (!branchMap[key]) {
            branchMap[key] = {
                programCode: program?.code || null,
                branch: program?.name || raw,
                registered: 0,
                placed: 0,
                placedStudentIds: new Set()
            };
        }
        branchMap[key].registered += 1;
    });

    const placedStudentIds = new Set();
    selectedApps.forEach((app) => {
        if (app.student && app.student._id) {
            const studentId = app.student._id.toString();
            placedStudentIds.add(studentId);
            const program = resolveStudentProgram(app.student);
            const raw = app.student.branch || app.student.department || "Unassigned";
            const key = program?.code || `LEGACY:${raw}`;
            if (branchMap[key]) {
                if (!branchMap[key].placedStudentIds.has(studentId)) {
                    branchMap[key].placedStudentIds.add(studentId);
                    branchMap[key].placed += 1;
                }
            }
        }
    });

    const branchStats = Object.values(branchMap).map((item) => ({
        programCode: item.programCode,
        branch: item.branch,
        registered: item.registered,
        placed: item.placed,
        placementRate: item.registered > 0 ? Math.round((item.placed / item.registered) * 100) : 0
    })).sort((a, b) => b.registered - a.registered);

    // 2. Salary / CTC Analytics
    const packages = [];
    selectedApps.forEach((app) => {
        const pkg = app.offeredPackage || app.placementDrive?.package;
        if (pkg && typeof pkg === "number" && pkg > 0) {
            packages.push(pkg);
        }
    });

    const highestCTC = packages.length > 0 ? Math.max(...packages) : 0;
    const averageCTC = packages.length > 0
        ? Number((packages.reduce((acc, val) => acc + val, 0) / packages.length).toFixed(2))
        : 0;

    // CTC Brackets distribution: <5 LPA, 5-10 LPA, 10-20 LPA, >20 LPA
    const salaryDistribution = [
        { tier: "< 5 LPA", count: 0, min: 0, max: 5 },
        { tier: "5 - 10 LPA", count: 0, min: 5, max: 10 },
        { tier: "10 - 20 LPA", count: 0, min: 10, max: 20 },
        { tier: "> 20 LPA", count: 0, min: 20, max: Infinity }
    ];

    packages.forEach((pkg) => {
        if (pkg < 5) salaryDistribution[0].count += 1;
        else if (pkg >= 5 && pkg < 10) salaryDistribution[1].count += 1;
        else if (pkg >= 10 && pkg < 20) salaryDistribution[2].count += 1;
        else salaryDistribution[3].count += 1;
    });

    // 3. Top Recruiting Corporate Partners
    const companyOfferMap = {};
    selectedApps.forEach((app) => {
        const compName = app.placementDrive?.company?.companyName || "Partner Recruiter";
        const pkg = app.offeredPackage || app.placementDrive?.package || 0;
        if (!companyOfferMap[compName]) {
            companyOfferMap[compName] = { companyName: compName, offers: 0, maxPackage: 0, totalPackage: 0 };
        }
        companyOfferMap[compName].offers += 1;
        companyOfferMap[compName].totalPackage += pkg;
        if (pkg > companyOfferMap[compName].maxPackage) {
            companyOfferMap[compName].maxPackage = pkg;
        }
    });

    const topRecruiters = Object.values(companyOfferMap)
        .map((c) => ({
            companyName: c.companyName,
            offers: c.offers,
            maxPackage: c.maxPackage,
            avgPackage: c.offers > 0 ? Number((c.totalPackage / c.offers).toFixed(2)) : 0
        }))
        .sort((a, b) => b.offers - a.offers)
        .slice(0, 8);

    // 4. Recruitment Funnel Conversion (active pipeline excluding withdrawn applications)
    const activeApplications = totalApplications - withdrawnApplications;
    const funnel = [
        { stage: "Applied", count: activeApplications },
        { stage: "Shortlisted", count: shortlistedApplications + interviewApplications + selectedApplications },
        { stage: "Interviews", count: interviewApplications + selectedApplications },
        { stage: "Selected", count: selectedApplications }
    ];

    const overallPlacementRate = totalStudents > 0
        ? Math.round((placedStudentIds.size / totalStudents) * 100)
        : 0;

    const stats = {
        companies: {
            total: totalCompanies,
            active: activeCompanies,
            inactive: totalCompanies - activeCompanies
        },
        placementDrives: {
            total: totalPlacementDrives,
            active: activePlacementDrives,
            inactive: totalPlacementDrives - activePlacementDrives
        },
        students: {
            total: totalStudents,
            placed: placedStudentIds.size,
            placementRate: overallPlacementRate
        },
        salary: {
            highestCTC,
            averageCTC,
            distribution: salaryDistribution
        },
        applications: {
            total: totalApplications,
            applied: appliedApplications,
            shortlisted: shortlistedApplications,
            interview: interviewApplications,
            rejected: rejectedApplications,
            selected: selectedApplications,
            withdrawn: withdrawnApplications
        },
        funnel,
        branchStats,
        topRecruiters
    };

    return res.status(200).json(
        new ApiResponse(200, stats, "Dashboard statistics fetched successfully")
    );
});

/**
 * Enhanced Student Dashboard Analytics
 * Calculates profile completion readiness gauge, missing items checklist,
 * upcoming interviews with countdowns, and active placement drive eligibility.
 */
const getStudentDashboardStats = asyncHandler(async (req, res) => {
    // Find logged-in student's profile populated with user
    const student = await StudentProfile.findOne({
        user: req.user._id
    }).populate("user", "fullName email phone avatar");

    if (!student) {
        throw new ApiError(404, "Student profile not found");
    }

    const studentId = student._id;
    const currentDate = new Date();

    // 1. Calculate Profile Completion Score & Checklist (No skills requirement)
    const profileChecklist = [
        { field: "Basic Details", completed: Boolean(student.user?.fullName && (student.enrollmentNumber || student.usn)), points: 20, hint: "Name & Enrollment number" },
        { field: "Contact Info", completed: Boolean((student.user?.phone || student.phone || student.alternatePhone) && (student.user?.email || student.collegeEmail)), points: 15, hint: "Email and Phone number" },
        { field: "Academic Standing", completed: Boolean((student.branch || student.department) && (student.cgpa != null) && student.graduationYear), points: 25, hint: "Branch, CGPA, and Graduation Batch" },
        { field: "10th & 12th Marks", completed: Boolean(student.tenthPercentage && student.twelfthPercentage), points: 20, hint: "Board exam percentages" },
        { field: "Verified Resume", completed: Boolean(student.resume && student.resume.url), points: 20, hint: "Uploaded verified resume" }
    ];

    const profileCompletionPercentage = profileChecklist.reduce((acc, item) => {
        return item.completed ? acc + item.points : acc;
    }, 0);

    const missingProfileItems = profileChecklist.filter((item) => !item.completed);

    // 2. Applications Statistics & Upcoming Interviews
    const [
        totalApplications,
        appliedApplications,
        shortlistedApplications,
        interviewApplications,
        selectedApplications,
        rejectedApplications,
        withdrawnApplications,
        recentApplications,
        upcomingInterviews,
        allPlacementDrives
    ] = await Promise.all([
        Application.countDocuments({ student: studentId }),
        Application.countDocuments({ student: studentId, status: "applied" }),
        Application.countDocuments({ student: studentId, status: "shortlisted" }),
        Application.countDocuments({ student: studentId, status: "interview" }),
        Application.countDocuments({ student: studentId, status: "selected" }),
        Application.countDocuments({ student: studentId, status: "rejected" }),
        Application.countDocuments({ student: studentId, status: "withdrawn" }),

        // Recent 5 applications
        Application.find({ student: studentId })
            .populate({
                path: "placementDrive",
                populate: {
                    path: "company",
                    select: "companyName companyLogo"
                }
            })
            .sort({ appliedAt: -1 })
            .limit(5),

        // Upcoming interviews scheduled for this student
        Application.find({
            student: studentId,
            status: "interview"
        })
            .populate({
                path: "placementDrive",
                populate: {
                    path: "company",
                    select: "companyName companyLogo"
                },
                select: "jobTitle location driveDate package"
            })
            .sort({ interviewDate: 1 })
            .limit(5),

        // Active placement drives
        PlacementDrive.find({ isActive: true })
            .populate("company", "companyName companyLogo isActive")
    ]);

    // 3. Filter drives where the student is eligible
    const eligibleDrives = allPlacementDrives.filter((drive) => {
        if (!drive.company || !drive.company.isActive) return false;

        const branchEligible = studentMatchesDriveProgram(student, drive);

        const cgpaEligible = Number(student.cgpa) >= Number(drive.minimumCGPA);
        const backlogEligible = Number(student.backlogs) <= Number(drive.maximumBacklogs);
        const graduationEligible = Number(student.graduationYear) === Number(drive.graduationYear);

        return branchEligible && cgpaEligible && backlogEligible && graduationEligible;
    });

    const activeEligibleDrives = eligibleDrives.filter((drive) => {
        const startDate = new Date(drive.applicationStartDate);
        const deadline = new Date(drive.applicationDeadline);
        return currentDate >= startDate && currentDate <= deadline;
    });

    const upcomingDrives = eligibleDrives
        .filter((drive) => new Date(drive.driveDate) >= currentDate)
        .sort((a, b) => new Date(a.driveDate) - new Date(b.driveDate))
        .slice(0, 5);

    // 4. Offer Celebration Data (if selected in any drive)
    const selectedApp = await Application.findOne({
        student: studentId,
        status: "selected"
    }).populate({
        path: "placementDrive",
        populate: {
            path: "company",
            select: "companyName companyLogo"
        },
        select: "jobTitle package location"
    });

    const offerDetails = selectedApp
        ? {
            companyName: selectedApp.placementDrive?.company?.companyName || "Corporate Partner",
            jobTitle: selectedApp.placementDrive?.jobTitle || "Software Engineer",
            package: selectedApp.offeredPackage || selectedApp.placementDrive?.package,
            selectedAt: selectedApp.statusUpdatedAt || selectedApp.updatedAt
        }
        : null;

    const stats = {
        applications: {
            total: totalApplications,
            applied: appliedApplications,
            shortlisted: shortlistedApplications,
            interview: interviewApplications,
            selected: selectedApplications,
            rejected: rejectedApplications,
            withdrawn: withdrawnApplications
        },
        placementDrives: {
            eligible: eligibleDrives.length,
            activeEligible: activeEligibleDrives.length,
            upcoming: upcomingDrives.length
        },
        profileScore: {
            percentage: profileCompletionPercentage,
            checklist: profileChecklist,
            missingItems: missingProfileItems
        },
        upcomingInterviews,
        offerDetails,
        upcomingDrives,
        recentApplications
    };

    return res.status(200).json(
        new ApiResponse(200, stats, "Student dashboard fetched successfully")
    );
});

export {
    getDashboardStats,
    getStudentDashboardStats
};