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
            default: undefined
        },
        programCode: {
            type: String,
            trim: true,
            uppercase: true,
            index: true
        },
        programLevel: {
            type: String,
            enum: ["Undergraduate", "Postgraduate"]
        },
        degreeType: {
            type: String,
            enum: ["B.E.", "MBA", "MCA", "M.Tech"]
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
                recipientName: { type: String, trim: true, default: "" },
                issueDate: { type: String, trim: true, default: "" },
                expirationDate: { type: String, trim: true, default: "" },
                certificateUrl: { type: String, trim: true, default: "" },
                credentialId: { type: String, trim: true, default: "" },
                category: {
                    type: String,
                    trim: true,
                    enum: [
                        "Course Completion",
                        "Technical Certification",
                        "Internship",
                        "Workshop",
                        "Academic Achievement",
                        "Other"
                    ],
                    default: "Course Completion"
                },
                verificationStatus: {
                    type: String,
                    enum: ["Pending", "Verified", "Needs Review", "Unable to Verify", "Rejected"],
                    default: "Pending"
                },
                verificationMethod: {
                    type: String,
                    enum: ["OFFICIAL_ISSUER", "AI_ANALYSIS", "MANUAL_REVIEW", "UNVERIFIED"],
                    default: "UNVERIFIED"
                },
                identityMatch: {
                    type: String,
                    enum: ["Match", "Possible Match", "Mismatch", "Insufficient Information"],
                    default: "Insufficient Information"
                },
                officialVerificationUrl: { type: String, trim: true, default: "" },
                documentUrl: { type: String, trim: true, default: "" },
                documentPublicId: { type: String, trim: true, default: "" },
                aiAnalysis: {
                    summary: { type: String, default: "" },
                    warnings: { type: [String], default: [] },
                    inconsistencies: { type: [String], default: [] },
                    confidence: { type: String, default: "" }
                },
                evidence: {
                    sourceType: { type: String, default: "" }, // URL, UPLOAD
                    checkedAt: { type: Date, default: Date.now },
                    issuerIdentified: { type: Boolean, default: false },
                    officialRecordFound: { type: Boolean, default: false },
                    details: { type: String, default: "" }
                },
                fileHash: { type: String, trim: true, default: "" },
                authenticityStatus: {
                    type: String,
                    enum: ["AUTHENTIC", "UNVERIFIED", "SUSPICIOUS", "UNKNOWN"],
                    default: "UNVERIFIED"
                },
                ownershipStatus: {
                    type: String,
                    enum: ["MATCH", "POSSIBLE_MATCH", "MISMATCH", "INSUFFICIENT_INFORMATION"],
                    default: "INSUFFICIENT_INFORMATION"
                },
                duplicateStatus: {
                    type: String,
                    enum: ["NONE", "CROSS_STUDENT_DUPLICATE", "SAME_STUDENT_DUPLICATE"],
                    default: "NONE"
                },
                duplicateDetails: { type: String, trim: true, default: "" },
                reviewNotes: { type: String, default: "" },
                reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
                reviewedByName: { type: String, default: "" },
                reviewedAt: { type: Date, default: null }
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
        },

        // Profile Locking & Modification Permissions Tracking
        isProfileLocked: {
            type: Boolean,
            default: false
        },
        profileLockedAt: {
            type: Date,
            default: null
        },
        modificationRequests: [
            {
                requestedAt: {
                    type: Date,
                    default: Date.now
                },
                status: {
                    type: String,
                    enum: ["PENDING", "APPROVED", "REJECTED"],
                    default: "PENDING"
                },
                reason: {
                    type: String,
                    trim: true,
                    default: ""
                },
                changes: [
                    {
                        field: { type: String, required: true },
                        fieldLabel: { type: String, required: true },
                        beforeValue: { type: mongoose.Schema.Types.Mixed },
                        afterValue: { type: mongoose.Schema.Types.Mixed }
                    }
                ],
                reviewedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                reviewedAt: {
                    type: Date
                },
                reviewRemarks: {
                    type: String,
                    trim: true,
                    default: ""
                }
            }
        ]
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
    } else if (Array.isArray(this.backlogDetails) && this.backlogDetails.length === 0 && this.isModified("backlogDetails") && !this.isNew) {
        // Itemized backlog records were explicitly cleared
        this.activeBacklogs = 0;
        this.clearedBacklogsCount = 0;
        this.historicalBacklogs = 0;
        this.backlogs = 0;
    } else {
        // No itemized records: keep the recorded counts (profile form, TPO edits and
        // Excel/CSV imports store counts only). Never reset them to zero here, which
        // would silently make students with backlogs eligible.
        if (this.isModified("activeBacklogs") && this.activeBacklogs != null) {
            this.backlogs = this.activeBacklogs;
        } else if (this.backlogs != null && this.activeBacklogs == null) {
            this.activeBacklogs = this.backlogs;
        } else if (this.backlogs != null && this.isModified("backlogs")) {
            this.activeBacklogs = this.backlogs;
        }
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

// Fast global lookup indexes for certificate verification and duplicate detection
studentProfileSchema.index({ "certificates.credentialId": 1, "certificates.issuer": 1 });
studentProfileSchema.index({ "certificates.fileHash": 1 });
studentProfileSchema.index({ "certificates.certificateUrl": 1 });

export const StudentProfile = mongoose.model(
    "StudentProfile",
    studentProfileSchema
);