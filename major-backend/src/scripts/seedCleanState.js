import "dotenv/config";
import connectDB from "../db/index.js";
import { User } from "../models/user.models.js";
import { Admin } from "../models/admin.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { Department } from "../models/department.model.js";
import { Company } from "../models/company.model.js";
import { PlacementDrive, DEFAULT_STUDENT_REQUIREMENTS } from "../models/placementDrive.model.js";
import { Application } from "../models/application.model.js";
import { Notification } from "../models/notification.model.js";
import { ExportLog } from "../models/exportLog.model.js";

async function seedCleanDatabase() {
    console.log("==================================================================");
    console.log("   CAMPUSFLOW V2 - FRESH INITIALIZATION & CANONICAL SEED          ");
    console.log("==================================================================");

    await connectDB();

    console.log("\n[1/7] Purging stale test data and records...");
    await Promise.all([
        User.deleteMany({}),
        Admin.deleteMany({}),
        StudentProfile.deleteMany({}),
        PlacementSession.deleteMany({}),
        Department.deleteMany({}),
        Company.deleteMany({}),
        PlacementDrive.deleteMany({}),
        Application.deleteMany({}),
        Notification.deleteMany({}),
        ExportLog.deleteMany({})
    ]);
    console.log("  ✓ All collections cleanly initialized (0 residual data)");

    console.log("\n[2/7] Seeding standard Placement Sessions...");
    const session2026 = await PlacementSession.create({
        sessionYear: 2026,
        name: "Placement Session 2025-2026",
        academicYear: "2025-2026",
        course: "B.Tech",
        courseDurationYears: 4,
        status: "CLOSED",
        isCurrent: false,
        isClosed: true,
        isArchived: false,
        description: "Placement session for graduating Class of 2026."
    });

    const session2027 = await PlacementSession.create({
        sessionYear: 2027,
        name: "Placement Session 2026-2027 (Current)",
        academicYear: "2026-2027",
        course: "B.Tech",
        courseDurationYears: 4,
        status: "ACTIVE",
        isCurrent: true,
        isClosed: false,
        isArchived: false,
        description: "Official active placement session for graduating Class of 2027."
    });

    const session2028 = await PlacementSession.create({
        sessionYear: 2028,
        name: "Placement Session 2027-2028 (Upcoming)",
        academicYear: "2027-2028",
        course: "B.Tech",
        courseDurationYears: 4,
        status: "UPCOMING",
        isCurrent: false,
        isClosed: false,
        isArchived: false,
        description: "Future placement session for Class of 2028."
    });
    console.log("  ✓ Placement Sessions created (2026, 2027 [ACTIVE], 2028)");

    console.log("\n[3/7] Seeding official Academic Departments...");
    const departmentsData = [
        { name: "Computer Science and Engineering", code: "CSE", applicableCourses: ["B.Tech", "M.Tech"], isActive: true },
        { name: "Information Science and Engineering", code: "ISE", applicableCourses: ["B.Tech"], isActive: true },
        { name: "Electronics and Communication Engineering", code: "ECE", applicableCourses: ["B.Tech", "M.Tech"], isActive: true },
        { name: "Electrical and Electronics Engineering", code: "EEE", applicableCourses: ["B.Tech"], isActive: true },
        { name: "Mechanical Engineering", code: "ME", applicableCourses: ["B.Tech", "M.Tech"], isActive: true },
        { name: "Civil Engineering", code: "CE", applicableCourses: ["B.Tech"], isActive: true },
        { name: "Artificial Intelligence and Data Science", code: "AIDS", applicableCourses: ["B.Tech"], isActive: true }
    ];
    await Department.insertMany(departmentsData);
    console.log(`  ✓ ${departmentsData.length} standard college departments configured`);

    console.log("\n[4/7] Creating authoritative Administrator / TPO Account...");
    const adminUser = await User.create({
        fullName: "Campus Placement Officer",
        email: "admin@campusflow.edu",
        password: "Admin@12345",
        phone: "9876543210",
        role: "admin",
        isActive: true,
        isEmailVerified: true
    });

    const adminProfile = await Admin.create({
        user: adminUser._id,
        employeeId: "TPO-2026-001",
        designation: "Head of Training & Placement",
        department: "Training & Placement",
        isPlacementOfficer: true
    });
    console.log("  ✓ TPO Officer created: admin@campusflow.edu / Admin@12345 (Employee ID: TPO-2026-001)");

    console.log("\n[5/7] Creating canonical Demo Student Account...");
    const demoStudentUser = await User.create({
        fullName: "Aarav Sharma",
        email: "student@campusflow.edu",
        password: "Student@12345",
        phone: "9876543211",
        role: "student",
        isActive: true,
        isEmailVerified: true
    });

    const demoStudentProfile = await StudentProfile.create({
        user: demoStudentUser._id,
        enrollmentNumber: "1MS23CS001",
        usn: "1MS23CS001",
        course: "B.Tech",
        branch: "Computer Science and Engineering",
        department: "Computer Science and Engineering",
        admissionYear: 2023,
        graduationYear: 2027,
        currentSemester: 6,
        semester: 6,
        placementSession: session2027._id,
        personalEmail: "aarav.personal@gmail.com",
        collegeEmail: "student@campusflow.edu",
        alternatePhone: "9876543211",
        gender: "Male",
        dob: new Date("2003-05-15"),
        cgpa: 8.75,
        verifiedCGPA: 8.75,
        activeBacklogs: 0,
        historicalBacklogs: 0,
        verificationStatus: "VERIFIED",
        academicVerificationStatus: "VERIFIED",
        tenthPercentage: 92.5,
        twelfthPercentage: 89.2,
        tenthDetails: {
            schoolName: "Delhi Public School",
            board: "CBSE",
            state: "Karnataka",
            passingYear: 2021,
            marksObtained: 462,
            maxMarks: 500,
            percentage: 92.4,
            marksheetUrl: "https://campusflow.edu/docs/10th_marksheet.pdf"
        },
        twelfthOrDiplomaDetails: {
            qualificationType: "12th",
            instituteName: "Delhi Public School",
            board: "CBSE",
            state: "Karnataka",
            passingYear: 2023,
            marksObtained: 446,
            maxMarks: 500,
            percentage: 89.2,
            marksheetUrl: "https://campusflow.edu/docs/12th_marksheet.pdf"
        },
        semesterResults: [
            { semester: 1, sgpa: 8.5, status: "PASS" },
            { semester: 2, sgpa: 8.7, status: "PASS" },
            { semester: 3, sgpa: 8.8, status: "PASS" },
            { semester: 4, sgpa: 9.0, status: "PASS" }
        ],
        hasEducationGap: false,
        educationGaps: [],
        family: {
            fatherName: "Rajesh Sharma",
            fatherOccupation: "Software Architect",
            fatherPhone: "9876543220",
            fatherEmail: "rajesh.sharma@example.com",
            motherName: "Sunita Sharma",
            motherOccupation: "Educator",
            motherPhone: "9876543221"
        },
        permanentAddress: {
            addressLine: "Flat 402, Green Valley Enclave",
            locality: "Indiranagar",
            city: "Bengaluru",
            district: "Bengaluru Urban",
            state: "Karnataka",
            pincode: "560038",
            country: "India"
        },
        currentAddress: {
            addressLine: "Flat 402, Green Valley Enclave",
            locality: "Indiranagar",
            city: "Bengaluru",
            district: "Bengaluru Urban",
            state: "Karnataka",
            pincode: "560038",
            country: "India"
        },
        sameAsCurrentAddress: true,
        resume: {
            url: "https://campusflow.edu/resumes/aarav_sharma_cse.pdf",
            publicId: "resume_aarav_sharma"
        }
    });
    console.log("  ✓ Demo Student created: student@campusflow.edu / Student@12345 (USN: 1MS23CS001)");

    console.log("\n[6/7] Creating Partner Company & Placement Drive...");
    const company = await Company.create({
        companyName: "TechCorp Solutions",
        companyDescription: "Global enterprise software, cloud infrastructure, and AI engineering provider.",
        companyWebsite: "https://techcorp.example.com",
        industry: "Information Technology",
        location: "Bengaluru, Karnataka",
        contactEmail: "campus-recruitment@techcorp.example.com",
        contactPhone: "080-45678900",
        createdBy: adminUser._id
    });

    const now = Date.now();
    const placementDrive = await PlacementDrive.create({
        company: company._id,
        jobTitle: "Software Development Engineer (SDE-1)",
        jobDescription: "Join our core engineering platform team developing scalable microservices and cloud infrastructure.",
        jobType: "full-time",
        package: 1400000,
        location: "Bengaluru / Hyderabad (Hybrid)",
        eligibleBranches: ["Computer Science and Engineering", "Information Science and Engineering", "Electronics and Communication Engineering"],
        minimumCGPA: 7.5,
        maximumBacklogs: 0,
        maximumHistoricalBacklogs: 1,
        minimumTenthPercentage: 70,
        minimumTwelfthPercentage: 70,
        graduationYear: 2027,
        placementSession: session2027._id,
        applicationStartDate: new Date(now - 1 * 86400000),
        applicationDeadline: new Date(now + 14 * 86400000),
        driveDate: new Date(now + 21 * 86400000),
        createdBy: adminUser._id,
        isActive: true,
        requirementsVersion: 1,
        studentRequirements: DEFAULT_STUDENT_REQUIREMENTS
    });
    console.log("  ✓ Placement Drive created: 'Software Development Engineer (SDE-1)' by TechCorp Solutions (Package: 14 LPA)");

    console.log("\n[7/7] Database Summary & Verification:");
    console.log("------------------------------------------------------------------");
    console.log("  Admin Email:     admin@campusflow.edu");
    console.log("  Admin Password:  Admin@12345");
    console.log("  Admin Role:      Head of Training & Placement");
    console.log("  Secret Passkey:  TPO_ADMIN_2026 (for future TPO registrations)");
    console.log("------------------------------------------------------------------");
    console.log("  Demo Student:    student@campusflow.edu (or USN: 1MS23CS001)");
    console.log("  Demo Password:   Student@12345");
    console.log("  Student Status:  Eligible for Session 2027 Drives (CGPA 8.75)");
    console.log("------------------------------------------------------------------");
    console.log("  New Student Reg: Fully functional via /signup (fresh profile with 0 data)");
    console.log("==================================================================\n");

    process.exit(0);
}

seedCleanDatabase().catch((err) => {
    console.error("Initialization Failed:", err);
    process.exit(1);
});
