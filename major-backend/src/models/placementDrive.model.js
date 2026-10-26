import mongoose from "mongoose";

const placementDriveSchema = new mongoose.Schema(
    {
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: [true, "Company is required"],
        },

        jobTitle: {
            type: String,
            required: [true, "Job title is required"],
            trim: true,
        },

        jobDescription: {
            type: String,
            trim: true,
            default: "",
        },

        jobType: {
            type: String,
            enum: {
                values: ["full-time", "internship", "internship-to-full-time"],
                message: "Invalid job type",
            },
            required: true,
        },

        internshipType: {
            type: String,
            enum: {
                values: ["paid", "unpaid", "not_applicable"],
                message: "Invalid internship type",
            },
            default: "not_applicable",
        },

        stipend: {
            type: String,
            trim: true,
            default: "",
        },

        internshipDuration: {
            type: String,
            trim: true,
            default: "",
        },

        jdPdf: {
            url: {
                type: String,
                trim: true,
                default: "",
            },
            fileName: {
                type: String,
                trim: true,
                default: "",
            },
        },

        package: {
            type: Number,
            required: [true, "Package is required"],
            min: 0,
        },

        location: {
            type: String,
            trim: true,
            default: "",
        },

        eligibleBranches: {
            type: [String],
            required: [true, "Eligible branches are required"],
        },
        eligibleProgramCodes: {
            type: [String],
            default: undefined,
            index: true
        },

        minimumCGPA: {
            type: Number,
            required: [true, "Minimum CGPA is required"],
            min: 0,
            max: 10,
        },

        maximumBacklogs: {
            type: Number,
            default: 0,
            min: 0,
        },

        graduationYear: {
            type: Number,
            required: [true, "Graduation year is required"],
        },

        placementSession: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PlacementSession",
            index: true,
        },

        checkCgpa: {
            type: Boolean,
            default: true,
        },

        checkBacklogs: {
            type: Boolean,
            default: true,
        },

        checkTenthMarks: {
            type: Boolean,
            default: false,
        },

        minimumTenthPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

        checkTwelfthMarks: {
            type: Boolean,
            default: false,
        },

        minimumTwelfthPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

        checkEducationGaps: {
            type: Boolean,
            default: false,
        },

        allowEducationGaps: {
            type: Boolean,
            default: true,
        },

        maxEducationGapYears: {
            type: Number,
            default: 0,
            min: 0,
        },

        customQuestions: [
            {
                id: {
                    type: String,
                    required: true,
                    trim: true,
                },
                question: {
                    type: String,
                    required: true,
                    trim: true,
                },
                type: {
                    type: String,
                    enum: ["text", "textarea", "select", "radio", "boolean"],
                    default: "text",
                },
                options: {
                    type: [String],
                    default: [],
                },
                required: {
                    type: Boolean,
                    default: false,
                },
                placeholder: {
                    type: String,
                    trim: true,
                    default: "",
                },
            },
        ],

        maximumHistoricalBacklogs: {
            type: Number,
            default: null,
        },

        reminderSettings: {
            remindersEnabled: {
                type: Boolean,
                default: true,
            },
            reminderOffsetsHours: {
                type: [Number],
                default: [6],
            },
            channels: {
                type: [String],
                enum: ["in_app", "email"],
                default: ["in_app", "email"],
            },
        },

        applicationStartDate: {
            type: Date,
            required: [true, "Application start date is required"],
        },

        applicationDeadline: {
            type: Date,
            required: [true, "Application deadline is required"],
        },

        driveDate: {
            type: Date,
            required: [true, "Drive date is required"],
        },

        venue: {
            type: String,
            trim: true,
            default: "",
        },

        applicationLink: {
            type: String,
            trim: true,
            default: "",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },

        deletedAt: {
            type: Date,
            default: null,
        },

        // V2 Phase - Student Information Requirements
        requirementsVersion: {
            type: Number,
            default: 1,
        },
        studentRequirements: [
            {
                fieldKey: {
                    type: String,
                    required: true,
                    trim: true,
                },
                label: {
                    type: String,
                    required: true,
                    trim: true,
                },
                category: {
                    type: String,
                    enum: ["personal", "academic", "documents", "family_address", "additional"],
                    default: "academic",
                },
                requiredToApply: {
                    type: Boolean,
                    default: false,
                },
                visibleToTpo: {
                    type: Boolean,
                    default: true,
                },
                shareWithCompany: {
                    type: Boolean,
                    default: false,
                },
                requiredSemesters: {
                    type: [Number],
                    default: [],
                },
                documentRequired: {
                    type: Boolean,
                    default: false,
                },
            },
        ],

        // Automated Placement Drive - Selection Rounds & Lifecycle
        selectionRounds: [
            {
                roundNumber: { type: Number, required: true },
                name: { type: String, required: true, trim: true },
                description: { type: String, trim: true, default: "" },
                status: {
                    type: String,
                    enum: ["pending", "in_progress", "completed"],
                    default: "pending",
                },
                conductedAt: { type: Date, default: null },
                advancedCount: { type: Number, default: 0 },
                rejectedCount: { type: Number, default: 0 },
                batchId: { type: String, default: null },
            },
        ],
        currentRoundNumber: {
            type: Number,
            default: 1,
        },
        isPlacementCompleted: {
            type: Boolean,
            default: false,
        },
        completedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Default sequential selection rounds catalogue
export const DEFAULT_SELECTION_ROUNDS = [
    { roundNumber: 1, name: "Resume Screening", description: "Initial profile & academic eligibility screening", status: "in_progress" },
    { roundNumber: 2, name: "Online Assessment / Aptitude", description: "Cognitive, aptitude & coding assessment", status: "pending" },
    { roundNumber: 3, name: "Technical Interview", description: "In-depth technical problem solving & domain interview", status: "pending" },
    { roundNumber: 4, name: "HR Interview", description: "Behavioral, cultural fit & leadership discussion", status: "pending" },
    { roundNumber: 5, name: "Final Selection", description: "Final placement offers & job confirmation", status: "pending" }
];

// Controlled default catalogue of student information requirements
export const DEFAULT_STUDENT_REQUIREMENTS = [
    { fieldKey: "fullName", label: "Student Full Name", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "usn", label: "USN / Enrollment No", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "email", label: "Institutional Email", category: "personal", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "phone", label: "Mobile Number", category: "personal", requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "personalEmail", label: "Personal Email", category: "personal", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    { fieldKey: "branch", label: "Department / Branch", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "graduationYear", label: "Graduation Year", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "placementSession", label: "Placement Session", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "cgpa", label: "Overall CGPA", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "semesterSGPA", label: "Semester-wise SGPA", category: "academic", requiredToApply: false, visibleToTpo: true, shareWithCompany: true, requiredSemesters: [] },
    { fieldKey: "activeBacklogs", label: "Active Backlogs Count", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "historicalBacklogs", label: "Cleared / Historical Backlogs", category: "academic", requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "tenthPercentage", label: "Class 10 Percentage", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "tenthPassingYear", label: "Class 10 Passing Year", category: "academic", requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "twelfthOrDiploma", label: "Class 12 / Diploma Percentage", category: "academic", requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    { fieldKey: "educationGaps", label: "Education Gap Declaration", category: "academic", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    { fieldKey: "resume", label: "Resume (profile or uploaded with the application)", category: "documents", requiredToApply: true, visibleToTpo: true, shareWithCompany: true, documentRequired: true },
    { fieldKey: "tenthMarksheet", label: "Class 10 Marksheet", category: "documents", requiredToApply: false, visibleToTpo: true, shareWithCompany: false, documentRequired: true },
    { fieldKey: "twelfthMarksheet", label: "Class 12 / Diploma Marksheet", category: "documents", requiredToApply: false, visibleToTpo: true, shareWithCompany: false, documentRequired: true },
    { fieldKey: "currentAddress", label: "Current Address", category: "family_address", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    { fieldKey: "permanentAddress", label: "Permanent Address", category: "family_address", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    { fieldKey: "familyDetails", label: "Parents / Guardian Information", category: "family_address", requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
];

export const PlacementDrive = mongoose.model(
    "PlacementDrive",
    placementDriveSchema
);