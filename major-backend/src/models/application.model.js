import mongoose from "mongoose";

const interviewRoundSchema = new mongoose.Schema(
    {
        roundNumber: {
            type: Number,
            required: true
        },
        roundName: {
            type: String,
            required: true,
            trim: true
        },
        scheduledAt: {
            type: Date,
            default: Date.now
        },
        location: {
            type: String,
            trim: true,
            default: "Campus Venue / Virtual"
        },
        status: {
            type: String,
            enum: ["scheduled", "cleared", "failed", "rescheduled"],
            default: "scheduled"
        },
        feedback: {
            type: String,
            trim: true,
            default: ""
        }
    },
    { _id: true }
);

const applicationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "StudentProfile",
            required: true,
            index: true
        },
        placementDrive: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PlacementDrive",
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: {
                values: [
                    "applied",
                    "shortlisted",
                    "interview",
                    "selected",
                    "rejected",
                    "on_hold",
                    "offer_received",
                    "offer_accepted",
                    "offer_declined",
                    "withdrawn"
                ],
                message: "Invalid application status"
            },
            default: "applied",
            index: true
        },
        appliedAt: {
            type: Date,
            default: Date.now
        },

        // Primary / Latest interview info
        interviewDate: {
            type: Date,
            default: null
        },
        interviewRound: {
            type: String,
            trim: true,
            default: ""
        },
        interviewLocation: {
            type: String,
            trim: true,
            default: ""
        },
        interviewRounds: [interviewRoundSchema],

        // Offer management details
        offeredPackage: {
            type: Number,
            default: null
        },
        offerDetails: {
            offeredPackage: { type: Number, default: null },
            designation: { type: String, trim: true, default: "" },
            joiningDate: { type: Date, default: null },
            offerLetterUrl: { type: String, default: "" },
            decisionDeadline: { type: Date, default: null },
            studentDecision: {
                type: String,
                enum: ["pending", "accepted", "declined"],
                default: "pending"
            },
            decisionAt: { type: Date, default: null }
        },

        remarks: {
            type: String,
            trim: true,
            default: ""
        },
        statusUpdatedAt: {
            type: Date,
            default: null
        },

        // Preserved eligibility evaluation snapshot & rule versioning
        eligibilitySnapshot: {
            status: {
                type: String,
                enum: ["ELIGIBLE", "INELIGIBLE", "MISSING_DATA", "OVERRIDDEN"],
                default: "ELIGIBLE"
            },
            cgpa: Number,
            activeBacklogs: Number,
            historicalBacklogs: Number,
            branch: String,
            programCode: String,
            tenthPercentage: Number,
            twelfthPercentage: Number,
            ruleVersion: {
                type: Number,
                default: 2
            },
            criteriaBreakdown: {
                type: Array,
                default: []
            },
            evaluatedAt: {
                type: Date,
                default: Date.now
            }
        },

        // Authorized TPO override tracking
        isOverridden: {
            type: Boolean,
            default: false
        },
        overrideReason: {
            type: String,
            trim: true,
            default: ""
        },
        overriddenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        overriddenAt: {
            type: Date,
            default: null
        },

        // Audit log of state transitions
        statusHistory: [
            {
                fromStatus: String,
                toStatus: String,
                remarks: String,
                updatedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                updatedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        // V2 Phase - Immutable Application Data Submission Snapshot
        submittedSnapshot: {
            studentProfileId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "StudentProfile"
            },
            fullName: String,
            usn: String,
            email: String,
            personalEmail: String,
            phone: String,
            department: String,
            branch: String,
            course: String,
            admissionYear: Number,
            graduationYear: Number,
            currentSemester: Number,
            cgpa: Number,
            semesterResults: Array,
            activeBacklogs: Number,
            historicalBacklogs: Number,
            backlogDetails: Array,
            tenthDetails: Object,
            twelfthOrDiplomaDetails: Object,
            educationGaps: Array,
            hasEducationGap: Boolean,
            resume: Object,
            family: Object,
            permanentAddress: Object,
            currentAddress: Object,
            requirementsVersion: Number,
            submittedAt: {
                type: Date,
                default: Date.now
            }
        }
    },
    {
        timestamps: true
    }
);

// Database-level uniqueness: A student can only have 1 application per placement drive
applicationSchema.index(
    {
        student: 1,
        placementDrive: 1
    },
    {
        unique: true
    }
);

export const Application = mongoose.model(
    "Application",
    applicationSchema
);