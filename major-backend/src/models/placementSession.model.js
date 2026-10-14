import mongoose from "mongoose";

const admissionYearMappingSchema = new mongoose.Schema(
    {
        course: {
            type: String,
            required: true,
            trim: true
        },
        courseDurationYears: {
            type: Number,
            required: true,
            default: 4
        },
        admissionYear: {
            type: Number,
            required: true
        }
    },
    { _id: false }
);

const placementSessionSchema = new mongoose.Schema(
    {
        sessionYear: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        academicYear: {
            type: String,
            trim: true,
            default: ""
        },
        description: {
            type: String,
            trim: true,
            default: ""
        },
        isActive: {
            type: Boolean,
            default: false,
            index: true
        },
        isClosed: {
            type: Boolean,
            default: false
        },
        isArchived: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ["UPCOMING", "ACTIVE", "CLOSED", "ARCHIVED"],
            default: "ACTIVE"
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date,
            default: null
        },
        admissionYearMapping: [admissionYearMappingSchema],
        targetPlacementPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 90
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
);

export const PlacementSession = mongoose.model(
    "PlacementSession",
    placementSessionSchema
);
