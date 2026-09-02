import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        employeeId: {
            type: String,
            required: [true, "Employee ID is required"],
            unique: true,
            trim: true,
        },

        designation: {
            type: String,
            required: [true, "Designation is required"],
            trim: true,
        },

        department: {
            type: String,
            default: "Training & Placement",
            trim: true,
        },

        isPlacementOfficer: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

export const Admin = mongoose.model("Admin", adminSchema);