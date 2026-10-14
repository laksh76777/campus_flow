import mongoose from "mongoose";

const exportLogSchema = new mongoose.Schema(
    {
        placementDrive: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PlacementDrive",
            required: true,
            index: true
        },
        exportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        exportFormat: {
            type: String,
            enum: ["csv", "xlsx", "json"],
            default: "csv"
        },
        exportedFields: {
            type: [String],
            default: []
        },
        applicantCount: {
            type: Number,
            default: 0
        },
        statusFilter: {
            type: String,
            default: "all"
        },
        branchFilter: {
            type: String,
            default: "all"
        },
        ipAddress: {
            type: String,
            default: ""
        },
        userAgent: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

export const ExportLog = mongoose.model("ExportLog", exportLogSchema);
