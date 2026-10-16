import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../src/models/user.models.js";
import { StudentProfile } from "../src/models/studentProfile.model.js";
import { PlacementSession } from "../src/models/placementSession.model.js";
import { Company } from "../src/models/company.model.js";
import { PlacementDrive } from "../src/models/placementDrive.model.js";
import { Application } from "../src/models/application.model.js";
import { Notification } from "../src/models/notification.model.js";
import { ReminderJob } from "../src/models/reminderJob.model.js";
import { resolveMongoConnection } from "../src/db/index.js";
import {
    isSmtpConfigured,
    getSenderAddress,
    resetTransporterForTesting,
    sendDeadlineReminderEmail,
    sendBroadcastAnnouncementEmail
} from "../src/utils/mailService.js";
import {
    syncDriveReminders,
    processDueReminders
} from "../src/services/reminderScheduler.service.js";

dotenv.config({ path: "./.env" });

const runNotificationAndRemindersVerification = async () => {
    console.log("================================================================================");
    console.log("   CAMPUSFLOW V2: NOTIFICATIONS, EMAIL DELIVERY & DEADLINE REMINDERS TEST       ");
    console.log("================================================================================");

    const baseUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
    const { connectionUri, databaseName } = resolveMongoConnection(baseUri);
    const isolatedDb = `Place-on_e2e_reminders_${Date.now()}`;
    const parsed = new URL(connectionUri);
    parsed.pathname = `/${isolatedDb}`;
    await mongoose.connect(parsed.toString());
    console.log(` Connected to isolated test database: ${parsed.host}/${isolatedDb}\n`);

    const stats = { passed: 0, failed: 0 };
    const assert = (condition, message) => {
        if (condition) {
            console.log(` [PASS] ${message}`);
            stats.passed++;
        } else {
            console.error(`❌ [FAIL] ${message}`);
            stats.failed++;
        }
    };

    try {
        // -------------------------------------------------------------------------
        // 1. SMTP Configuration Truthfulness & Mock Transport
        // -------------------------------------------------------------------------
        console.log(">>> TEST 1: Truthful SMTP Configuration Reporting");
        const initialSmtpConfigured = isSmtpConfigured();
        console.log(`   Environment SMTP Configured: ${initialSmtpConfigured}`);

        // Mock transporter to verify acceptance without real bulk emails
        const sentEmailsLog = [];
        const mockTransporter = {
            sendMail: async (options) => {
                sentEmailsLog.push(options);
                return { messageId: `mock-msg-${Date.now()}-${Math.random()}` };
            }
        };
        resetTransporterForTesting(mockTransporter);

        const emailResult = await sendDeadlineReminderEmail({
            studentEmail: "test.candidate@campusflow.edu",
            studentName: "Test Candidate",
            companyName: "Acme Tech",
            jobTitle: "Software Engineer",
            deadline: new Date(Date.now() + 24 * 3600 * 1000),
            offsetHours: 6,
            packageLPA: 12
        });

        assert(emailResult.accepted === true, "Mock email transport accepted message");
        assert(sentEmailsLog.length === 1, "Exactly one email dispatched to mock transport");
        assert(sentEmailsLog[0].to === "test.candidate@campusflow.edu", "Recipient email address matches intended candidate");
        assert(sentEmailsLog[0].subject.includes("Acme Tech"), "Subject contains company name");

        // Test missing recipient email safety
        const missingEmailResult = await sendDeadlineReminderEmail({
            studentEmail: "",
            studentName: "Test",
            companyName: "Acme Tech",
            jobTitle: "Software Engineer",
            deadline: new Date(),
            offsetHours: 6
        });
        assert(missingEmailResult.accepted === false, "Handles missing email safely without crash");

        // -------------------------------------------------------------------------
        // 2. Seed Test Hierarchy: Session, Company, Candidates
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 2: Cohort Setup & Targeting Consistency");
        // Create Admin User
        const adminUser = await User.create({
            fullName: "Admin Officer",
            email: "admin.tpo@campusflow.edu",
            password: "HashedPassword123!",
            role: "admin",
            isActive: true
        });

        const session = await PlacementSession.create({
            sessionYear: 2026,
            name: "Class of 2026",
            academicYear: "2025-2026",
            isActive: true
        });

        const company = await Company.create({
            companyName: "Nexus Dynamics",
            contactEmail: "recruitment@nexus.io",
            createdBy: adminUser._id,
            isActive: true
        });

        // Create 3 students:
        // Student A: Eligible, has not applied, has email
        const userA = await User.create({
            fullName: "Aarav Sharma",
            email: "aarav.sharma@campusflow.edu",
            password: "HashedPassword123!",
            role: "student",
            isActive: true
        });
        const profileA = await StudentProfile.create({
            user: userA._id,
            placementSession: session._id,
            graduationYear: 2026,
            branch: "Computer Science and Engineering",
            programCode: "CSE",
            degreeType: "B.E.",
            semester: 8,
            cgpa: 8.5,
            activeBacklogs: 0,
            tenthPercentage: 85,
            twelfthPercentage: 88,
            resume: { url: "https://example.com/aarav_resume.pdf" },
            enrollmentNumber: "ENR001"
        });

        // Student B: Ineligible (CGPA too low)
        const userB = await User.create({
            fullName: "Bhavna Patel",
            email: "bhavna.patel@campusflow.edu",
            password: "HashedPassword123!",
            role: "student",
            isActive: true
        });
        const profileB = await StudentProfile.create({
            user: userB._id,
            placementSession: session._id,
            graduationYear: 2026,
            branch: "Computer Science and Engineering",
            programCode: "CSE",
            degreeType: "B.E.",
            semester: 8,
            cgpa: 5.5, // Drive requires 7.0
            activeBacklogs: 0,
            tenthPercentage: 75,
            twelfthPercentage: 70,
            resume: { url: "https://example.com/bhavna_resume.pdf" },
            enrollmentNumber: "ENR002"
        });

        // Student C: Eligible, but already applied
        const userC = await User.create({
            fullName: "Chetan Kumar",
            email: "chetan.kumar@campusflow.edu",
            password: "HashedPassword123!",
            role: "student",
            isActive: true
        });
        const profileC = await StudentProfile.create({
            user: userC._id,
            placementSession: session._id,
            graduationYear: 2026,
            branch: "Computer Science and Engineering",
            programCode: "CSE",
            degreeType: "B.E.",
            semester: 8,
            cgpa: 9.0,
            activeBacklogs: 0,
            tenthPercentage: 90,
            twelfthPercentage: 92,
            resume: { url: "https://example.com/chetan_resume.pdf" },
            enrollmentNumber: "ENR003"
        });

        assert(profileA._id && profileB._id && profileC._id, "Created candidate profiles with distinct eligibility states");

        // -------------------------------------------------------------------------
        // 3. Drive Creation & Persistent Reminder Settings
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 3: Drive Creation & Persistent Reminder Settings");
        const driveDeadline = new Date(Date.now() + 12 * 3600 * 1000); // 12 hours in future

        const drive = await PlacementDrive.create({
            company: company._id,
            jobTitle: "Cloud Engineer",
            jobType: "full-time",
            package: 14,
            location: "Bengaluru",
            eligibleBranches: ["Computer Science & Engineering (CSE)"],
            eligibleProgramCodes: ["CSE"],
            minimumCGPA: 7.0,
            maximumBacklogs: 0,
            graduationYear: 2026,
            placementSession: session._id,
            applicationStartDate: new Date(Date.now() - 24 * 3600 * 1000),
            applicationDeadline: driveDeadline,
            driveDate: new Date(Date.now() + 48 * 3600 * 1000),
            createdBy: adminUser._id,
            reminderSettings: {
                remindersEnabled: true,
                reminderOffsetsHours: [6, 1], // 6h and 1h reminders
                channels: ["in_app", "email"]
            }
        });

        assert(drive.reminderSettings.remindersEnabled === true, "Drive persists remindersEnabled: true");
        assert(drive.reminderSettings.reminderOffsetsHours.length === 2, "Drive persists multiple reminder offsets: [6, 1]");

        // Student C applies to the drive
        const appC = await Application.create({
            placementDrive: drive._id,
            student: profileC._id,
            status: "applied"
        });
        assert(appC._id !== undefined, "Student C application created");

        // -------------------------------------------------------------------------
        // 4. Synchronization of Scheduled Reminder Jobs
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 4: Scheduler Job Synchronization");
        const syncResult = await syncDriveReminders(drive._id);
        assert(syncResult.synced === true, "Drive reminders synchronized successfully");

        const scheduledJobs = await ReminderJob.find({ drive: drive._id });
        assert(scheduledJobs.length === 2, `Scheduled exactly 2 reminder jobs (found ${scheduledJobs.length})`);
        assert(scheduledJobs.some((j) => j.offsetHours === 6), "6-hour reminder job is scheduled");
        assert(scheduledJobs.some((j) => j.offsetHours === 1), "1-hour reminder job is scheduled");

        // Check scheduled time calculation
        const sixHourJob = scheduledJobs.find((j) => j.offsetHours === 6);
        const expectedSixHourTime = new Date(driveDeadline.getTime() - 6 * 3600 * 1000);
        assert(
            Math.abs(sixHourJob.scheduledTime.getTime() - expectedSixHourTime.getTime()) < 1000,
            "Scheduled time accurately calculated from deadline minus offset"
        );

        // -------------------------------------------------------------------------
        // 5. Idempotency Check (Repeated Scheduler Run)
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 5: Idempotency Protection");
        await syncDriveReminders(drive._id);
        const jobsAfterResync = await ReminderJob.find({ drive: drive._id });
        assert(jobsAfterResync.length === 2, "Repeated sync does not create duplicate jobs");

        // -------------------------------------------------------------------------
        // 6. Deadline Modification & Rescheduling
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 6: Rescheduling on Deadline Modification");
        const newDeadline = new Date(Date.now() + 18 * 3600 * 1000);
        drive.applicationDeadline = newDeadline;
        await drive.save();

        await syncDriveReminders(drive._id);

        const activeJobs = await ReminderJob.find({ drive: drive._id, status: "PENDING" });
        const cancelledJobs = await ReminderJob.find({ drive: drive._id, status: "CANCELLED" });
        assert(activeJobs.length === 2, "Active jobs created for new deadline");
        assert(cancelledJobs.length === 2, "Obsolete jobs from previous deadline cancelled");
        assert(activeJobs[0].driveDeadline.getTime() === newDeadline.getTime(), "Active jobs link to new deadline");

        // -------------------------------------------------------------------------
        // 7. Disabling Reminders
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 7: Cancelling Pending Jobs when Reminders Disabled");
        drive.reminderSettings.remindersEnabled = false;
        await drive.save();
        await syncDriveReminders(drive._id);

        const pendingAfterDisable = await ReminderJob.find({ drive: drive._id, status: "PENDING" });
        assert(pendingAfterDisable.length === 0, "All pending reminder jobs cancelled when reminders disabled");

        // Re-enable for execution tests
        drive.reminderSettings.remindersEnabled = true;
        await drive.save();
        await syncDriveReminders(drive._id);

        // -------------------------------------------------------------------------
        // 8. Reminder Worker Execution: Targeting & Exclusions
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 8: Worker Execution & Recipient Filtering");
        // Fast-forward one job's scheduledTime to past so worker claims it
        const jobToExecute = await ReminderJob.findOne({ drive: drive._id, status: "PENDING" });
        jobToExecute.scheduledTime = new Date(Date.now() - 60000); // 1 minute in past
        await jobToExecute.save();

        sentEmailsLog.length = 0; // Clear sent log
        const initialNotificationsCount = await Notification.countDocuments();

        const processRes = await processDueReminders();
        assert(processRes.processed === 1, "Worker executed exactly 1 due reminder job");

        const executedJob = await ReminderJob.findById(jobToExecute._id);
        assert(executedJob.status === "COMPLETED", "Executed job marked as COMPLETED");
        assert(executedJob.deliverySummary !== undefined, "Delivery summary recorded");

        // Check exclusions:
        // Student A: TARGETED (eligible, not applied)
        // Student B: SKIPPED (ineligible CGPA)
        // Student C: SKIPPED (already applied)
        assert(executedJob.deliverySummary.targetedCandidates === 1, "Targeted exactly 1 candidate (Student A)");
        assert(executedJob.deliverySummary.skippedIneligible === 1, "Excluded exactly 1 ineligible candidate (Student B)");
        assert(executedJob.deliverySummary.skippedAlreadyApplied === 1, "Excluded exactly 1 already-applied candidate (Student C)");

        // Check channel deliveries for Student A
        assert(executedJob.deliverySummary.inAppCreated === 1, "Created exactly 1 in-app alert for Student A");
        assert(executedJob.deliverySummary.emailAccepted === 1, "Dispatched exactly 1 email for Student A");

        const newNotificationsCount = await Notification.countDocuments();
        assert(newNotificationsCount === initialNotificationsCount + 1, "MongoDB persisted exactly 1 new Notification");

        const studentANotification = await Notification.findOne({ user: userA._id });
        assert(studentANotification !== null, "Notification found for Student A");
        assert(studentANotification.title.includes("Deadline Alert"), "Notification contains deadline alert title");

        // -------------------------------------------------------------------------
        // 9. Past Deadline Protection
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 9: Past Deadline Protection");
        const expiredJob = await ReminderJob.create({
            drive: drive._id,
            idempotencyKey: `expired-test-${Date.now()}`,
            offsetHours: 1,
            scheduledTime: new Date(Date.now() - 3600000),
            driveDeadline: new Date(Date.now() - 1000), // Deadline is in past
            channels: ["in_app", "email"],
            status: "PENDING"
        });

        await processDueReminders();
        const checkedExpiredJob = await ReminderJob.findById(expiredJob._id);
        assert(checkedExpiredJob.status === "CANCELLED", "Job with past deadline cancelled without sending");

        // -------------------------------------------------------------------------
        // 10. Multi-Channel Admin Broadcast Workflow
        // -------------------------------------------------------------------------
        console.log("\n>>> TEST 10: Multi-Channel Admin Announcement Broadcast");
        const broadcastEmailRes = await sendBroadcastAnnouncementEmail({
            studentEmail: userA.email,
            studentName: userA.fullName,
            title: "Campus Pool Drive by Tech Giants",
            message: "Report to Main Auditorium at 9:00 AM in formal attire.",
            priority: "urgent"
        });

        assert(broadcastEmailRes.accepted === true, "Broadcast email accepted by provider");

        console.log("\n================================================================================");
        console.log(`   TEST RESULTS: ${stats.passed} PASSED, ${stats.failed} FAILED`);
        console.log("================================================================================");

    } finally {
        try {
            await mongoose.connection.dropDatabase();
            console.log(` Dropped isolated test database: ${isolatedDb}`);
            await mongoose.disconnect();
        } catch (e) {
            console.warn("Cleanup notice:", e.message);
        }
    }

    if (stats.failed > 0) {
        process.exit(1);
    }
};

runNotificationAndRemindersVerification().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
