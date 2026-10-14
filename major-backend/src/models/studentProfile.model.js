import mongoose from "mongoose";

const semesterResultSchema = new mongoose.Schema(
    {
        semester: {
            type: Number,
            required: true,
            min: 1,
            max: 10
        },
        sgpa: {
            type: Number,
            required: true,
            min: 0,
            max: 10
        },
        credits: {
            type: Number,
            default: 20,
            min: 1
        },
        passedCredits: {
            type: Number,
            default: 20
        },
        marksheetUrl: {
            type: String,
            default: ""
        },
        isVerified: {
            type: Boolean,
            default: false
        }
    },
    { _id: true }
);

const backlogDetailSchema = new mongoose.Schema(
    {
        subjectCode: {
            type: String,
            trim: true,
            default: ""
        },
        subjectName: {
            type: String,
            trim: true,
            default: ""
        },
        semester: {
            type: Number,
            min: 1,
            max: 10
        },
        status: {
            type: String,
            enum: ["ACTIVE", "CLEARED"],
            default: "ACTIVE"
        },
        clearedDate: {
            type: Date,
            default: null
        },
        attempts: {
            type: Number,
            default: 1,
            min: 1
        }
    },
    { _id: true }
);

const educationGapSchema = new mongoose.Schema(
    {
        hasGap: {
            type: Boolean,
            default: true
        },
        gapType: {
            type: String,
            enum: ["10th_to_12th", "12th_to_College", "During_College", "Other"],
            default: "12th_to_College"
        },
        startYear: {
            type: Number,
            required: true
        },
        endYear: {
            type: Number,
            required: true
        },
        durationMonths: {
            type: Number,
            default: 12
        },
        reason: {
            type: String,
            enum: [
                "Personal reasons",
                "Medical reasons",
                "Entrance examination preparation",
                "Financial reasons",
                "Family responsibilities",
                "Other"
            ],
            default: "Personal reasons"
        },
        explanation: {
            type: String,
            trim: true,
            default: ""
        },
        documentUrl: {
            type: String,
            default: ""
        },
        verificationStatus: {
            type: String,
            enum: ["PENDING", "VERIFIED", "REJECTED"],
            default: "PENDING"
        }
    },
    { _id: true }
);

const studentProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        // College & Academic Identifiers
        enrollmentNumber: {
            type: String,
            required: [true, "Enrollment number is required"],
            unique: true,
            trim: true,
            index: true
        },
        usn: {
            type: String,
            trim: true,
            index: true
        },
        course: {
            type: String,
            trim: true,
            default: "B.Tech"
        },
        branch: {
            type: String,
            required: [true, "Branch is required"],
            trim: true
        },
        department: {
            type: String,
            trim: true
        },
        admissionYear: {
            type: Number
        },
        graduationYear: {
            type: Number,
            required: [true, "Graduation year is required"],
            index: true
        },
        semester: {
            type: Number,
            required: [true, "Semester is required"],
            min: 1,
            max: 10
        },
        currentSemester: {
            type: Number,
            min: 1,
            max: 10
        },
        section: {
            type: String,
            trim: true,
            default: "A"
        },
        placementSession: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PlacementSession",
            index: true
        },

        // Personal & Contact Info
        gender: {
            type: String,
            enum: ["Male", "Female", "Other", "Prefer not to say"],
            default: "Prefer not to say"
        },
        dob: {
            type: Date
        },
        personalEmail: {
            type: String,
            trim: true,
            default: ""
        },
        collegeEmail: {
            type: String,
            trim: true,
            default: ""
        },
        alternatePhone: {
            type: String,
            trim: true,
            default: ""
        },
        aadharNumber: {
            type: String,
            trim: true,
            default: ""
        },

        // Family Details
        family: {
            fatherName: { type: String, trim: true, default: "" },
            fatherOccupation: { type: String, trim: true, default: "" },
            fatherEmployer: { type: String, trim: true, default: "" },
            fatherPhone: { type: String, trim: true, default: "" },
            fatherEmail: { type: String, trim: true, default: "" },
            motherName: { type: String, trim: true, default: "" },
            motherOccupation: { type: String, trim: true, default: "" },
            motherEmployer: { type: String, trim: true, default: "" },
            motherPhone: { type: String, trim: true, default: "" },
            motherEmail: { type: String, trim: true, default: "" },
            guardianName: { type: String, trim: true, default: "" },
            guardianRelation: { type: String, trim: true, default: "" },
            guardianOccupation: { type: String, trim: true, default: "" },
            guardianPhone: { type: String, trim: true, default: "" }
        },

        // Address Details
        currentAddress: {
            street: { type: String, trim: true, default: "" },
            locality: { type: String, trim: true, default: "" },
            city: { type: String, trim: true, default: "" },
            district: { type: String, trim: true, default: "" },
            state: { type: String, trim: true, default: "" },
            pincode: { type: String, trim: true, default: "" },
            country: { type: String, trim: true, default: "India" }
        },
        permanentAddress: {
            street: { type: String, trim: true, default: "" },
            locality: { type: String, trim: true, default: "" },
            city: { type: String, trim: true, default: "" },
            district: { type: String, trim: true, default: "" },
            state: { type: String, trim: true, default: "" },
            pincode: { type: String, trim: true, default: "" },
            country: { type: String, trim: true, default: "India" }
        },
        sameAsCurrent: {
            type: Boolean,
            default: false
        },

        // Academic Qualifications
        tenthDetails: {
            schoolName: { type: String, trim: true, default: "" },
            board: { type: String, trim: true, default: "CBSE" },
            state: { type: String, trim: true, default: "" },
            passingYear: { type: Number, default: null },
            marksObtained: { type: Number, default: null },
            maxMarks: { type: Number, default: null },
            percentage: { type: Number, min: 0, max: 100, default: null },
            cgpa: { type: Number, min: 0, max: 10, default: null },
            marksheetUrl: { type: String, default: "" }
        },
        twelfthOrDiplomaDetails: {
            qualificationType: {
                type: String,
                enum: ["12th", "Diploma", "Other", "None"],
                default: "12th"
            },
            institutionName: { type: String, trim: true, default: "" },
            boardOrUniversity: { type: String, trim: true, default: "" },
            state: { type: String, trim: true, default: "" },
            diplomaBranch: { type: String, trim: true, default: "" },
            passingYear: { type: Number, default: null },
            marksObtained: { type: Number, default: null },
            maxMarks: { type: Number, default: null },
            percentage: { type: Number, min: 0, max: 100, default: null },
            marksheetUrl: { type: String, default: "" }
        },

        // Education Gap Tracking
        hasEducationGap: {
            type: Boolean,
            default: false
        },
        educationGaps: [educationGapSchema],

        // Legacy compatibility shortcuts
        tenthPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        twelfthPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },

        // Semester-Wise Results & Official CGPA
        semesterResults: [semesterResultSchema],
        cgpa: {
            type: Number,
            min: 0,
            max: 10,
            default: null
        },
        verifiedCGPA: {
            type: Number,
            min: 0,
            max: 10,
            default: null
        },

        // Backlogs breakdown (Active vs Historical Cleared)
        backlogs: {
            type: Number,
            default: 0,
            min: 0
        },
        activeBacklogs: {
            type: Number,
            default: 0,
            min: 0
        },
        historicalBacklogs: {
            type: Number,
            default: 0,
            min: 0
        },
        clearedBacklogsCount: {
            type: Number,
            default: 0,
            min: 0
        },
        backlogDetails: [backlogDetailSchema],

        // Skills, Certifications & Bio
        skills: {
            type: [String],
            default: []
        },
        certificates: [
            {
                title: { type: String, required: true, trim: true },
                issuer: { type: String, trim: true, default: "" },
                issueDate: { type: String, trim: true, default: "" },
                certificateUrl: { type: String, trim: true, default: "" },
                credentialId: { type: String, trim: true, default: "" }
            }
        ],
        about: {
            type: String,
            trim: true,
            maxlength: [500, "About cannot exceed 500 characters"],
            default: ""
        },
        resume: {
            url: { type: String, default: "" },
            publicId: { type: String, default: "" }
        },

        // Verification & Profile Completeness
        verificationStatus: {
            type: String,
            enum: ["PENDING", "VERIFIED", "REJECTED", "REVERIFICATION_REQUESTED"],
            default: "PENDING",
            index: true
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        verifiedAt: {
            type: Date
        },
        verificationRemarks: {
            type: String,
            trim: true,
            default: ""
        },
        profileCompleteness: {
            type: Number,
            min: 0,
            max: 100,
            default: 30
        },

        // Placement outcome tracking
        isPlaced: {
            type: Boolean,
            default: false
        },
        placedCompany: {
            type: String,
            trim: true,
            default: ""
        },
        placedPackage: {
            type: Number,
            default: null
        },
        placedAt: {
            type: Date,
            default: null
        },
        placedJobTitle: {
            type: String,
            trim: true,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

// Pre-save synchronization and institutional CGPA calculation hook
studentProfileSchema.pre("save", async function () {
    // 1. Sync aliases
    if (!this.usn && this.enrollmentNumber) {
        this.usn = this.enrollmentNumber;
    }
    if (!this.enrollmentNumber && this.usn) {
        this.enrollmentNumber = this.usn;
    }
    if (!this.department && this.branch) {
        this.department = this.branch;
    }
    if (!this.branch && this.department) {
        this.branch = this.department;
    }
    if (!this.currentSemester && this.semester) {
        this.currentSemester = this.semester;
    }
    if (!this.semester && this.currentSemester) {
        this.semester = this.currentSemester;
    }

    // 2. Sync 10th and 12th percentage backwards compatibility
    if (this.tenthDetails?.percentage !== null && this.tenthDetails?.percentage !== undefined) {
        this.tenthPercentage = this.tenthDetails.percentage;
    } else if (this.tenthPercentage !== null && this.tenthPercentage !== undefined) {
        if (!this.tenthDetails) this.tenthDetails = {};
        this.tenthDetails.percentage = this.tenthPercentage;
    }

    if (this.twelfthOrDiplomaDetails?.percentage !== null && this.twelfthOrDiplomaDetails?.percentage !== undefined) {
        this.twelfthPercentage = this.twelfthOrDiplomaDetails.percentage;
    } else if (this.twelfthPercentage !== null && this.twelfthPercentage !== undefined) {
        if (!this.twelfthOrDiplomaDetails) this.twelfthOrDiplomaDetails = {};
        this.twelfthOrDiplomaDetails.percentage = this.twelfthPercentage;
    }

    // 3. Official CGPA Preservation (Do NOT calculate by averaging semester SGPA values)
    // The student enters the official CGPA directly. If verifiedCGPA is not set, sync with official cgpa if available.
    if (this.cgpa !== null && this.cgpa !== undefined && !this.verifiedCGPA) {
        this.verifiedCGPA = this.cgpa;
    }

    // 4. Backlog breakdown calculation
    if (this.backlogDetails && this.backlogDetails.length > 0) {
        const active = this.backlogDetails.filter((b) => b.status === "ACTIVE").length;
        const cleared = this.backlogDetails.filter((b) => b.status === "CLEARED").length;
        this.activeBacklogs = active;
        this.clearedBacklogsCount = cleared;
        this.historicalBacklogs = this.backlogDetails.length;
        this.backlogs = active; // maintain legacy backlogs field
    } else if (this.backlogs !== undefined) {
        this.activeBacklogs = this.backlogs;
    }

    // 5. Profile completeness percentage calculation
    let filledWeight = 0;
    const totalWeight = 100;

    // Basic Academic Info (25%)
    if (this.enrollmentNumber && this.branch && this.semester && this.graduationYear) filledWeight += 25;
    // CGPA & Semester records (20%)
    if (this.cgpa > 0) filledWeight += 10;
    if (this.semesterResults?.length > 0) filledWeight += 10;
    // 10th & 12th details (15%)
    if (this.tenthDetails?.percentage || this.tenthPercentage) filledWeight += 8;
    if (this.twelfthOrDiplomaDetails?.percentage || this.twelfthPercentage) filledWeight += 7;
    // Resume (15%)
    if (this.resume?.url) filledWeight += 15;
    // Skills & Bio (10%)
    if (this.skills?.length > 0) filledWeight += 5;
    if (this.about?.length > 20) filledWeight += 5;
    // Family & Address (15%)
    if (this.family?.fatherName || this.family?.motherName) filledWeight += 8;
    if (this.currentAddress?.city || this.permanentAddress?.city) filledWeight += 7;

    this.profileCompleteness = Math.min(totalWeight, filledWeight);
});

export const StudentProfile = mongoose.model(
    "StudentProfile",
    studentProfileSchema
);