import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Company } from "../models/company.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Application } from "../models/application.model.js";


const getDashboardStats = asyncHandler(async (req, res) => {
    const [
        totalCompanies,
        activeCompanies,
        totalPlacementDrives,
        activePlacementDrives,
        totalStudents,
        totalApplications,
        appliedApplications,
        shortlistedApplications,
        rejectedApplications,
        selectedApplications,
        withdrawnApplications
    ] = await Promise.all([
        Company.countDocuments(),

        Company.countDocuments({
            isActive: true
        }),
        PlacementDrive.countDocuments(),

        PlacementDrive.countDocuments({
            isActive: true
        }),
        StudentProfile.countDocuments(),
        Application.countDocuments(),
        Application.countDocuments({
            status: "applied"
        }),
        Application.countDocuments({
            status: "shortlisted"
        }),
        Application.countDocuments({
            status: "rejected"
        }),
        Application.countDocuments({
            status: "selected"
        }),
        Application.countDocuments({
            status: "withdrawn"
        })
    ]);
    const stats = {
        companies: {
            total: totalCompanies,
            active: activeCompanies,
            inactive: totalCompanies - activeCompanies
        },
        placementDrives: {
            total: totalPlacementDrives,
            active: activePlacementDrives,
            inactive:
                totalPlacementDrives - activePlacementDrives
        },
        students: {
            total: totalStudents
        },
        applications: {
            total: totalApplications,
            applied: appliedApplications,
            shortlisted: shortlistedApplications,
            rejected: rejectedApplications,
            selected: selectedApplications,
            withdrawn: withdrawnApplications
        }
    };
    return res.status(200).json(
        new ApiResponse(
            200,
            stats,
            "Dashboard statistics fetched successfully"
        )
    );
});

const getStudentDashboardStats = asyncHandler(async (req, res) => {
    // Find logged-in student's profile
    const student = await StudentProfile.findOne({
        user: req.user._id
    });

    if (!student) {
        throw new ApiError(
            404,
            "Student profile not found"
        );
    }

    const studentId = student._id;
    const currentDate = new Date();

    // Application statistics
    const [
        totalApplications,
        appliedApplications,
        shortlistedApplications,
        selectedApplications,
        rejectedApplications,
        withdrawnApplications,

        // Recent applications
        recentApplications,

        // Get active placement drives
        placementDrives
    ] = await Promise.all([

        Application.countDocuments({
            student: studentId
        }),

        Application.countDocuments({
            student: studentId,
            status: "applied"
        }),

        Application.countDocuments({
            student: studentId,
            status: "shortlisted"
        }),

        Application.countDocuments({
            student: studentId,
            status: "selected"
        }),

        Application.countDocuments({
            student: studentId,
            status: "rejected"
        }),

        Application.countDocuments({
            student: studentId,
            status: "withdrawn"
        }),

        Application.find({
            student: studentId
        })
            .populate({
                path: "placementDrive",
                populate: {
                    path: "company",
                    select: "companyName companyLogo"
                }
            })
            .sort({
                appliedAt: -1
            })
            .limit(5),

        PlacementDrive.find({
            isActive: true
        })
            .populate(
                "company",
                "companyName companyLogo isActive"
            )
    ]);

    // Filter drives where the student is eligible
    const eligibleDrives = placementDrives.filter((drive) => {

        // Company must be active
        if (!drive.company || !drive.company.isActive) {
            return false;
        }

        const branchEligible =
            drive.eligibleBranches.includes(student.branch);

        const cgpaEligible =
            student.cgpa >= drive.minimumCGPA;

        const backlogEligible =
            student.backlogs <= drive.maximumBacklogs;

        const graduationEligible =
            student.graduationYear === drive.graduationYear;

        return (
            branchEligible &&
            cgpaEligible &&
            backlogEligible &&
            graduationEligible
        );
    });


    // Drives where application is still open
    const activeEligibleDrives = eligibleDrives.filter((drive) => {

        const startDate =
            new Date(drive.applicationStartDate);

        const deadline =
            new Date(drive.applicationDeadline);

        return (
            currentDate >= startDate &&
            currentDate <= deadline
        );
    });


    // Upcoming placement drives
    const upcomingDrives = eligibleDrives
        .filter((drive) => {

            const driveDate =
                new Date(drive.driveDate);

            return driveDate >= currentDate;
        })
        .sort((a, b) => {
            return (
                new Date(a.driveDate) -
                new Date(b.driveDate)
            );
        })
        .slice(0, 5);


    const stats = {

        applications: {
            total: totalApplications,
            applied: appliedApplications,
            shortlisted: shortlistedApplications,
            selected: selectedApplications,
            rejected: rejectedApplications,
            withdrawn: withdrawnApplications
        },

        placementDrives: {
            eligible: eligibleDrives.length,
            activeEligible: activeEligibleDrives.length,
            upcoming: upcomingDrives.length
        },

        upcomingDrives,

        recentApplications
    };


    return res.status(200).json(
        new ApiResponse(
            200,
            stats,
            "Student dashboard fetched successfully"
        )
    );
});
export {
    getDashboardStats,
    getStudentDashboardStats
};