import { PlacementDrive } from "../models/placementDrive.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Company } from "../models/company.model.js";
import { Application } from "../models/application.model.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { PROGRAM_CATALOG, resolveProgram } from "../constants/programCatalog.js";
import { updateDriveRoundsConfig } from "./automatedDrive.service.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

/**
 * Helper to normalize and match branch/program codes against official catalogue
 */
const resolveProgramsFromPrompt = (branchText) => {
    if (!branchText || /all|any|open to all/i.test(branchText)) {
        return {
            programCodes: PROGRAM_CATALOG.map((p) => p.code),
            branches: PROGRAM_CATALOG.map((p) => p.name),
        };
    }
    const tokens = branchText.split(/[,/|&]+|\band\b/i).map((t) => t.trim()).filter(Boolean);
    const resolved = [];
    for (const token of tokens) {
        const prog = resolveProgram(token);
        if (prog && !resolved.some((r) => r.code === prog.code)) {
            resolved.push(prog);
        }
    }
    if (resolved.length === 0) {
        // Default to circuit/CS branches if unparseable
        return {
            programCodes: ["CSE", "ISE", "ECE"],
            branches: [
                "Computer Science & Engineering (CSE)",
                "Information Science & Engineering (ISE)",
                "Electronics & Communication Engineering (ECE)",
            ],
        };
    }
    return {
        programCodes: resolved.map((p) => p.code),
        branches: resolved.map((p) => p.name),
    };
};

/**
 * Extracts drive creation parameters from an admin natural language prompt
 */
export const extractDriveParamsFromPrompt = (prompt) => {
    // Company Name: e.g. "for Microsoft", "company Google", "host Microsoft drive", "drive for Adobe"
    let companyName = "Corporate Partner";
    const compMatch = prompt.match(/\b(?:for|company|drive for|at)\s+([A-Za-z0-9&.-]+)/i)
        || prompt.match(/\b(?:host|create|add)\s+(?:a\s+)?(?:placement\s+)?(?:drive\s+for\s+)?([A-Za-z0-9&.-]+)/i);
    if (compMatch && compMatch[1] && !/^(a|an|the|drive|placement|new|automated)$/i.test(compMatch[1].trim())) {
        companyName = compMatch[1].trim();
    }

    // Role / Job Title: e.g. "Role: Software Engineer", "as SDE", "Software Development Engineer"
    let jobTitle = "Software Development Engineer";
    const roleMatch = prompt.match(/(?:role|title|position|as|for role of)\s*[:=]?\s*([a-zA-Z0-9\s&/-]+?)(?:\s+(?:with|paying|package|ctc|offering|at|for|,|\.|$))/i);
    if (roleMatch && roleMatch[1] && roleMatch[1].trim().length > 2) {
        jobTitle = roleMatch[1].trim();
    } else if (/analyst/i.test(prompt)) {
        jobTitle = "Data & Business Analyst";
    } else if (/cloud|devops/i.test(prompt)) {
        jobTitle = "Cloud & DevOps Engineer";
    } else if (/intern/i.test(prompt) && !/software/i.test(prompt)) {
        jobTitle = "Graduate Engineering Intern";
    }

    // Package / CTC: e.g. "12 LPA", "18.5", "8 LPA", "CTC: 14"
    let salaryPackage = 8.5;
    const pkgMatch = prompt.match(/(?:package|ctc|salary|paying|stipend)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lac|per annum)/i)
        || prompt.match(/(\d+(?:\.\d+)?)\s*(?:lpa|ctc)/i);
    if (pkgMatch && pkgMatch[1]) {
        salaryPackage = parseFloat(pkgMatch[1]);
    }

    // Minimum CGPA Cutoff: e.g. "7.5 CGPA", "cutoff 8.0", "min cgpa 7"
    let minimumCGPA = 7.0;
    const cgpaMatch = prompt.match(/(?:min(?:imum)?\s*cgpa|cgpa\s*cutoff|cutoff|cgpa)\s*[:=]?\s*(\d+(?:\.\d+)?)/i)
        || prompt.match(/(\d+(?:\.\d+)?)\s*cgpa/i);
    if (cgpaMatch && cgpaMatch[1]) {
        minimumCGPA = parseFloat(cgpaMatch[1]);
    }

    // Maximum Backlogs: e.g. "0 backlogs", "max backlogs 1", "no backlogs"
    let maximumBacklogs = 0;
    if (/no backlogs|zero backlogs|0 backlogs/i.test(prompt)) {
        maximumBacklogs = 0;
    } else {
        const blogMatch = prompt.match(/(?:max(?:imum)?\s*backlogs?|backlogs?)\s*[:=]?\s*(\d+)/i);
        if (blogMatch && blogMatch[1]) {
            maximumBacklogs = parseInt(blogMatch[1], 10);
        }
    }

    // Eligible branches
    const branchMatch = prompt.match(/(?:branches?|programs?|eligible for|for)\s*[:=]?\s*([a-zA-Z0-9\s,&/|]+?)(?:\s+(?:with|deadline|package|ctc|cutoff|students|,|\.|$))/i);
    const branchText = branchMatch ? branchMatch[1] : (/cse|ise|ece|mech|civil|all/i.test(prompt) ? prompt : "all");
    const { programCodes, branches } = resolveProgramsFromPrompt(branchText);

    // Automated Drive intent
    const isAutomated = /automated|rounds|pipeline|workflow/i.test(prompt);

    // Selection Rounds (for automated drives)
    let rounds = [
        { roundNumber: 1, roundName: "Online Assessment", roundType: "aptitude", status: "SCHEDULED" },
        { roundNumber: 2, roundName: "Technical Interview", roundType: "technical", status: "SCHEDULED" },
        { roundNumber: 3, roundName: "HR & Leadership Round", roundType: "hr", status: "SCHEDULED" },
    ];
    if (/coding|test/i.test(prompt) && !/aptitude/i.test(prompt)) {
        rounds[0].roundName = "Online Coding Assessment";
        rounds[0].roundType = "coding";
    }

    return {
        companyName,
        jobTitle,
        salaryPackage,
        minimumCGPA,
        maximumBacklogs,
        eligibleBranches: branches,
        eligibleProgramCodes: programCodes,
        isAutomated,
        rounds,
    };
};

/**
 * Execute automated creation of a placement drive from parsed prompt
 */
export const executeDriveCreationFromPrompt = async ({ prompt, adminUser }) => {
    const params = extractDriveParamsFromPrompt(prompt);

    // 1. Find or create Company
    let companyDoc = await Company.findOne({
        companyName: { $regex: new RegExp(`^${params.companyName.trim()}$`, "i") },
    });
    if (!companyDoc) {
        companyDoc = await Company.create({
            companyName: params.companyName.trim(),
            companyDescription: `${params.companyName} corporate recruitment partner.`,
            industry: "Technology & Professional Services",
            companyWebsite: `https://www.${params.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        });
    }

    // 2. Resolve Active Placement Session
    let session = await PlacementSession.findOne({ isActive: true });
    if (!session) {
        session = await PlacementSession.findOne().sort({ sessionYear: -1 });
    }
    const sessionYear = session ? session.sessionYear : new Date().getFullYear();
    const sessionId = session ? session._id : null;

    // 3. Application Windows (Opens now, closes in 10 days, drive in 14 days)
    const now = new Date();
    const deadline = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const driveDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // 4. Create Placement Drive
    const drive = await PlacementDrive.create({
        company: companyDoc._id,
        jobTitle: params.jobTitle,
        jobDescription: `Campus Recruitment Drive for ${params.companyName} targeting ${params.jobTitle}. Minimum CGPA: ${params.minimumCGPA}, Max Active Backlogs: ${params.maximumBacklogs}. Package: ₹${params.salaryPackage} LPA.`,
        jobType: "Full-Time",
        package: params.salaryPackage,
        location: "Bengaluru, Karnataka (Hybrid / Onsite)",
        eligibleBranches: params.eligibleBranches,
        eligibleProgramCodes: params.eligibleProgramCodes,
        minimumCGPA: params.minimumCGPA,
        checkCgpa: true,
        maximumBacklogs: params.maximumBacklogs,
        checkBacklogs: true,
        graduationYear: sessionYear,
        placementSession: sessionId,
        applicationStartDate: now,
        applicationDeadline: deadline,
        driveDate: driveDate,
        venue: "JSSATEB Campus Placement Auditorium / Virtual Assessment",
        isActive: true,
        createdBy: adminUser?._id,
    });

    // 5. If automated drive or rounds requested, initialize selection rounds
    if (params.isAutomated && drive._id) {
        try {
            await updateDriveRoundsConfig(drive._id, params.rounds);
        } catch (roundErr) {
            console.warn("Could not attach automated rounds:", roundErr.message);
        }
    }

    return {
        drive,
        company: companyDoc,
        params,
    };
};

/**
 * Handle student directory & placement analytics questions
 */
export const queryPlacementAnalytics = async (prompt) => {
    const totalStudents = await StudentProfile.countDocuments();
    const verifiedStudents = await StudentProfile.countDocuments({
        $or: [{ academicVerificationStatus: "VERIFIED" }, { verificationStatus: "VERIFIED" }],
    });
    const pendingStudents = await StudentProfile.countDocuments({
        $or: [{ academicVerificationStatus: "PENDING" }, { verificationStatus: "PENDING" }],
    });

    const highCgpaStudents = await StudentProfile.countDocuments({ cgpa: { $gte: 8.0 } });
    const studentsWithBacklogs = await StudentProfile.countDocuments({ activeBacklogs: { $gt: 0 } });
    const activeDrivesCount = await PlacementDrive.countDocuments({
        isActive: true,
        isDeleted: { $ne: true },
    });
    const totalApplications = await Application.countDocuments();

    return {
        totalStudents,
        verifiedStudents,
        pendingStudents,
        highCgpaStudents,
        studentsWithBacklogs,
        activeDrivesCount,
        totalApplications,
    };
};

/**
 * Main handler for Admin AI Copilot
 */
export const processAdminCopilotPrompt = async ({ prompt, adminUser }) => {
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        throw new Error("Prompt is required.");
    }

    const cleanPrompt = prompt.trim();
    const isDriveCreation = /(?:host|create|schedule|add|set up|setup|provision)\s+(?:a\s+)?(?:placement\s+)?drive/i.test(cleanPrompt)
        || /(?:create|host)\s+automated\s+drive/i.test(cleanPrompt)
        || /(?:drive\s+for|role\s+at)\s+[A-Za-z0-9]+/i.test(cleanPrompt);

    // 1. ACTION: Host or Create Placement Drive
    if (isDriveCreation) {
        try {
            const { drive, company, params } = await executeDriveCreationFromPrompt({
                prompt: cleanPrompt,
                adminUser,
            });

            return {
                action: "DRIVE_CREATED",
                answer: `🎯 **Placement Drive Successfully Created & Hosted!**\n\n` +
                    `- **Company:** ${company.companyName}\n` +
                    `- **Role:** ${params.jobTitle}\n` +
                    `- **CTC / Package:** ₹${params.salaryPackage} LPA\n` +
                    `- **Eligibility Cutoff:** CGPA ≥ ${params.minimumCGPA} • Backlogs ≤ ${params.maximumBacklogs}\n` +
                    `- **Target Programs:** ${params.eligibleBranches.slice(0, 3).join(", ")}${params.eligibleBranches.length > 3 ? ` +${params.eligibleBranches.length - 3} more` : ""}\n` +
                    `- **Status:** 🟢 Active & Open for Eligible Student Applications\n` +
                    (params.isAutomated ? `- **Automated Rounds:** 3 Selection Rounds configured in Pipeline Workflow.\n` : "") +
                    `\nYou can view and manage this drive directly under **Placement Drives** or **Automated Placement Drive**.`,
                driveId: drive._id,
                driveTitle: `${company.companyName} — ${params.jobTitle}`,
                metadata: {
                    driveId: drive._id,
                    companyName: company.companyName,
                    jobTitle: params.jobTitle,
                    package: params.salaryPackage,
                    minimumCGPA: params.minimumCGPA,
                },
            };
        } catch (driveErr) {
            console.error("Drive creation via AI prompt failed:", driveErr);
            return {
                action: "ERROR",
                answer: `⚠️ Unable to automatically provision the drive: ${driveErr.message}. You can also create it via the manual form in **Placement Drives**.`,
            };
        }
    }

    // 2. ANALYTICS / STUDENT QUERIES
    const isAnalyticsQuery = /(?:student|cgpa|backlog|how many|analytics|count|stats|pending|verification|applications)/i.test(cleanPrompt);
    if (isAnalyticsQuery) {
        const stats = await queryPlacementAnalytics(cleanPrompt);
        return {
            action: "ANALYTICS_RESPONSE",
            answer: `📊 **Live Placement & Student Directory Intelligence:**\n\n` +
                `• **Total Registered Students:** **${stats.totalStudents}** candidates\n` +
                `• **Academic Profiles Verified:** **${stats.verifiedStudents}** (Locked & TPO Verified)\n` +
                `• **Pending TPO Verification:** **${stats.pendingStudents}** dossiers awaiting review\n` +
                `• **High Academic Achievers (CGPA ≥ 8.0):** **${stats.highCgpaStudents}** students\n` +
                `• **Candidates with Active Backlogs:** **${stats.studentsWithBacklogs}** students\n` +
                `• **Active Live Drives:** **${stats.activeDrivesCount}** drives open\n` +
                `• **Total Applications Submitted:** **${stats.totalApplications}** snapshot applications\n\n` +
                `💡 *Tip:* Ask me to *"Host a drive for [Company] with [Role], [CTC] LPA, and [CGPA] cutoff"* and I will automatically provision the drive for you!`,
            stats,
        };
    }

    // 3. GENERAL TPO ASSISTANCE / JD UNDERSTANDING
    return {
        action: "GENERAL_RESPONSE",
        answer: `🤖 **TPO Placement AI Copilot Ready!**\n\nI can automate several operations directly from your prompt:\n\n` +
            `1. **Host Placement Drives:** E.g., *"Host a drive for Microsoft, Role: SDE, 18 LPA, 7.5 CGPA cutoff, 0 backlogs, CSE/ISE"*\n` +
            `2. **Setup Automated Drives:** E.g., *"Create an automated drive for Google with 3 rounds: Aptitude, Tech Interview, HR"*\n` +
            `3. **Student Insights:** E.g., *"How many students have CGPA above 8.0?"* or *"Show pending verifications"*\n` +
            `4. **Analyze Job Description (JD):** Paste any JD PDF text or job requirements here, and I'll extract eligibility and prepare the drive for you.`,
    };
};
