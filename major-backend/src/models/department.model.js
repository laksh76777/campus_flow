import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Department name is required"],
            unique: true,
            trim: true
        },
        code: {
            type: String,
            required: [true, "Department code is required"],
            unique: true,
            trim: true,
            uppercase: true
        },
        course: {
            type: String,
            trim: true,
            default: "B.Tech"
        },
        college: {
            type: String,
            trim: true,
            default: "Engineering & Technology"
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        description: {
            type: String,
            trim: true,
            default: ""
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

export const Department = mongoose.model("Department", departmentSchema);
