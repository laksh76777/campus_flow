import mongoose from "mongoose";

const studentProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        enrollmentNumber: {
            type: String,
            required: [true, "Enrollment number is required"],
            unique: true,
            trim: true,
        },

        branch: {
            type: String,
            required: [true, "Branch is required"],
            trim: true,
        },

        semester: {
            type: Number,
            required: [true, "Semester is required"],
            min: 1,
            max: 8,
        },

        graduationYear: {
            type: Number,
            required: [true, "Graduation year is required"],
        },

        cgpa: {
            type: Number,
            required: [true, "CGPA is required"],
            min: 0,
            max: 10,
        },

        backlogs: {
            type: Number,
            default: 0,
            min: 0,
        },

        skills: {
            type: [String],
            default: [],
        },

        tenthPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: null,
        },

        twelfthPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: null,
        },

        certificates: [
            {
                title: {
                    type: String,
                    required: true,
                    trim: true,
                },
                issuer: {
                    type: String,
                    trim: true,
                    default: "",
                },
                issueDate: {
                    type: String,
                    trim: true,
                    default: "",
                },
                certificateUrl: {
                    type: String,
                    trim: true,
                    default: "",
                },
                credentialId: {
                    type: String,
                    trim: true,
                    default: "",
                },
            }
        ],

        about: {
            type: String,
            trim: true,
            maxlength: [500, "About cannot exceed 500 characters"],
            default: "",
        },

        resume: {
            url: {
                type: String,
                default: ""
            },
            publicId: {
                type: String,
                default: ""
            }
        }
    },
    {
        timestamps: true,
    }
);

export const StudentProfile = mongoose.model(
    "StudentProfile",
    studentProfileSchema
);