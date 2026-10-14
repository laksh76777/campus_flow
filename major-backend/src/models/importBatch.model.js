import mongoose from "mongoose";

const importBatchSchema = new mongoose.Schema(
    {
        batchId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        importType: {
            type: String,
            enum: ["student_records", "academic_history", "historical_placements"],
            required: true,
            index: true
        },
        placementSession: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PlacementSession",
            index: true
        },
        originalFilename: {
            type: String,
            required: true
        },
        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        status: {
            type: String,
            enum: ["PREVIEWED", "COMMITTED", "FAILED", "PARTIAL_COMMIT"],
            default: "PREVIEWED",
            index: true
        },
        conflictStrategy: {
            type: String,
            enum: ["skip", "update_unverified"],
            default: "skip"
        },
        totalRows: {
            type: Number,
            default: 0
        },
        validRows: {
            type: Number,
            default: 0
        },
        invalidRows: {
            type: Number,
            default: 0
        },
        conflictRows: {
            type: Number,
            default: 0
        },
        insertedRows: {
            type: Number,
            default: 0
        },
        updatedRows: {
            type: Number,
            default: 0
        },
        skippedRows: {
            type: Number,
            default: 0
        },
        failedRows: {
            type: Number,
            default: 0
        },
        previewResults: [
            {
                rowNumber: Number,
                identifier: String,
                name: String,
                status: {
                    type: String,
                    enum: ["VALID", "WARNING", "CONFLICT", "ERROR"]
                },
                action: String, // 'INSERT', 'UPDATE', 'SKIP', 'ERROR'
                proposedAction: String, // 'INSERT', 'UPDATE', 'SKIP', 'ERROR'
                details: mongoose.Schema.Types.Mixed,
                reason: String
            }
        ],
        errorReport: [
            {
                rowNumber: Number,
                identifier: String,
                failedField: String,
                reason: String
            }
        ],
        summary: {
            type: String,
            default: ""
        },
        startedAt: {
            type: Date,
            default: Date.now
        },
        completedAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

export const ImportBatch = mongoose.model("ImportBatch", importBatchSchema);
