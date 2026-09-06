import mongoose from "mongoose";
const applicationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "StudentProfile",
            required: true,
        },
        placementDrive: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PlacementDrive",
             required: true,
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
                    "withdrawn"
                ],
                message: "Invalid application status",
            },
            default: "applied",
        },
        appliedAt: {
            type: Date,
            default: Date.now,
        },
        interviewDate: {
            type: Date,
            default: null,
        },
        interviewRound: {
            type: String,
            trim: true,
            default: "",
        },
        interviewLocation: {
            type: String,
            trim: true,
            default: "",
        },
        offeredPackage: {
            type: Number,
            default: null,
        },
        remarks: {
            type: String,
            trim: true,
            default: "",
        },
        statusUpdatedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);
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