import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
    {
        companyName: {
            type: String,
            required: [true, "Company name is required"],
            trim: true,
            unique: true,
        },

        companyDescription: {
            type: String,
            trim: true,
            default: "",
        },

        companyWebsite: {
            type: String,
            trim: true,
            default: "",
        },

        companyLogo: {
            url: {
                type: String,
                default: "",
            },

            publicId: {
                type: String,
                default: "",
            },
        },

        industry: {
            type: String,
            trim: true,
            default: "",
        },

        location: {
            type: String,
            trim: true,
            default: "",
        },

        contactEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: "",
        },

        contactPhone: {
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

export const Company = mongoose.model(
    "Company",
    companySchema
);