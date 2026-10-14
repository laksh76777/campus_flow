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

        minimumTenthPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

        minimumTwelfthPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

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
                default: [24, 6],
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
    },
    {
        timestamps: true,
    }
);

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
    { fieldKey: "resume", label: "Master Resume Document", category: "documents", requiredToApply: true, visibleToTpo: true, shareWithCompany: true, documentRequired: true },
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