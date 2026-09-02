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
    },
    {
        timestamps: true,
    }
);

export const PlacementDrive = mongoose.model(
    "PlacementDrive",
    placementDriveSchema
);