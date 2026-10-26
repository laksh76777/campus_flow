import { PlacementDrive } from "../models/placementDrive.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Company } from "../models/company.model.js";
import { Application } from "../models/application.model.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { PROGRAM_CATALOG, resolveProgram } from "../constants/programCatalog.js";
import { EligibilityService } from "./eligibility.service.js";
import { updateDriveRoundsConfig } from "./automatedDrive.service.js";
import { callGroqAI, describeAIFailure } from "./groqClient.service.js";
import { buildTpoQueryContext, extractStudentIdentifiers } from "./aiContext.service.js";
import { formatDateTime } from "../utils/dateFormat.js";
import { syncDriveReminders } from "./reminderScheduler.service.js";

/**
 * Resolves program codes and branch names from raw text
 */
export const resolveProgramsFromPrompt = (branchText) => {
    const text = Array.isArray(branchText) ? branchText.join(", ") : String(branchText || "").trim();
    if (/^(all|all branches|all programs|all approved branches|all approved programs|any branch|any program|open to all)$/i.test(text)) {
        return {
            programCodes: PROGRAM_CATALOG.map((p) => p.code),
            branches: PROGRAM_CATALOG.map((p) => p.name),
        };
    }
    if (!text) throw new Error("Choose eligible programs or explicitly select all approved programs.");
    const inputs = Array.isArray(branchText) ? branchText : [text];
    const tokens = inputs.flatMap((input) => {
        const value = String(input || "").trim();
        if (resolveProgram(value)) return [value];
        return value.split(/[,/|]+|\band\b|\s&\s/i).map((token) => token.trim()).filter(Boolean);
    });
    const resolved = [];
    for (const token of tokens) {
        const prog = resolveProgram(token);
        if (prog && !resolved.some((r) => r.code === prog.code)) {
            resolved.push(prog);
        } else if (!prog) {
            throw new Error(`The eligible program “${token}” could not be matched to the approved program catalogue.`);
        }
    }
    if (resolved.length === 0) throw new Error("Choose at least one approved eligible program.");
    return {
        programCodes: resolved.map((p) => p.code),
        branches: resolved.map((p) => p.name),
    };
};

export const validateDriveParams = (driveParams = {}) => {
    const errors = [];
    const companyName = typeof driveParams.companyName === "string" ? driveParams.companyName.trim() : "";
    const jobTitle = typeof driveParams.jobTitle === "string" ? driveParams.jobTitle.trim() : "";
    const salaryPackage = Number(driveParams.package ?? driveParams.salaryPackage);
    const minimumCGPA = Number(driveParams.minimumCGPA);
    const maximumBacklogs = Number(driveParams.maximumBacklogs);
    let programs = null;

    if (!companyName || companyName.length > 120) errors.push("a company name (up to 120 characters)");
    if (!jobTitle || jobTitle.length > 120) errors.push("a job title (up to 120 characters)");
    if (driveParams.package == null && driveParams.salaryPackage == null) errors.push("the compensation package in LPA");
    else if (!Number.isFinite(salaryPackage) || salaryPackage < 0) errors.push("a valid non-negative compensation package");
    if (driveParams.minimumCGPA == null) errors.push("the minimum CGPA cutoff");
    else if (!Number.isFinite(minimumCGPA) || minimumCGPA < 0 || minimumCGPA > 10) errors.push("a CGPA cutoff from 0 to 10");
    if (driveParams.maximumBacklogs == null) errors.push("the maximum active backlog count");
    else if (!Number.isInteger(maximumBacklogs) || maximumBacklogs < 0) errors.push("a non-negative whole-number backlog limit");

    try {
        programs = resolveProgramsFromPrompt(driveParams.eligibleBranches);
    } catch (error) {
        errors.push(error.message);
    }

    const rounds = Array.isArray(driveParams.rounds) ? driveParams.rounds : [];
    if (driveParams.isAutomated === true) {
        if (rounds.length === 0 || rounds.length > 10) errors.push("between 1 and 10 selection rounds for an automated drive");
        const names = rounds.map((round) => String(round?.roundName || round?.name || "").trim());
        if (names.some((name) => !name || name.length > 80)) errors.push("a valid name for every selection round");
        if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) errors.push("unique names for each selection round");
    }

    return {
        valid: errors.length === 0,
        errors,
        programs,
        params: errors.length === 0 ? {
            ...driveParams,
            companyName,
            jobTitle,
            package: salaryPackage,
            minimumCGPA,
            maximumBacklogs,
            eligibleBranches: programs.branches,
        } : null,
    };
};

const createDefaultSchedule = (now = new Date()) => ({
    applicationStartDate: now,
    applicationDeadline: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    driveDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
});

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Execute automated creation of a placement drive in MongoDB
 */
export const executeDriveCreation = async ({ driveParams, adminUser }) => {
    const validation = validateDriveParams(driveParams);
    if (!validation.valid) throw new Error(`Drive details are incomplete: ${validation.errors.join("; ")}.`);

    const { params: normalized } = validation;
    const { companyName, jobTitle, minimumCGPA, maximumBacklogs } = normalized;
    const salaryPackage = normalized.package;
    const isAutomated = normalized.isAutomated === true;
    const { programCodes, branches } = validation.programs;
    const adminId = adminUser?._id || adminUser?.id;
    if (!adminId) throw new Error("The authenticated administrator could not be resolved.");

    // 1. Resolve the active cohort before writing any records.
    const session = await PlacementSession.findOne({
        isActive: true,
        isClosed: { $ne: true },
        isArchived: { $ne: true },
    });
    if (!session) throw new Error("There is no active placement session. Set an open session before publishing a drive.");
    const sessionYear = session.sessionYear;
    const sessionId = session._id;

    const schedule = {
        applicationStartDate: new Date(normalized.applicationStartDate),
        applicationDeadline: new Date(normalized.applicationDeadline),
        driveDate: new Date(normalized.driveDate),
    };
    if (Object.values(schedule).some((date) => Number.isNaN(date.getTime())) || schedule.applicationDeadline <= schedule.applicationStartDate || schedule.driveDate < schedule.applicationDeadline) {
        throw new Error("The staged application and drive dates are invalid. Please review the schedule and try again.");
    }

    // 2. Find or create Company record.
    let companyDoc = await Company.findOne({
        companyName: { $regex: new RegExp(`^${escapeRegExp(companyName)}$`, "i") },
        isActive: true,
    });
    if (!companyDoc) {
        companyDoc = await Company.create({
            companyName: companyName,
            createdBy: adminId,
        });
    }

    // 3. Use the schedule shown in the confirmation card.
    // Normalize jobType to valid schema enum ("full-time", "internship", "internship-to-full-time")
    let jobType = "full-time";
    const rawJobType = String(driveParams.jobType || "").toLowerCase();
    if (rawJobType.includes("internship-to") || rawJobType.includes("fte")) {
        jobType = "internship-to-full-time";
    } else if (rawJobType.includes("intern")) {
        jobType = "internship";
    }

    // 4. Create Placement Drive.
    let drive;
    try {
        drive = await PlacementDrive.create({
        company: companyDoc._id,
        jobTitle: jobTitle,
        jobDescription: driveParams.jobDescription || "",
        jobType: jobType,
        package: salaryPackage,
        location: driveParams.location || "",
        eligibleBranches: branches,
        eligibleProgramCodes: programCodes,
        minimumCGPA: minimumCGPA,
        checkCgpa: true,
        maximumBacklogs: maximumBacklogs,
        checkBacklogs: true,
        graduationYear: sessionYear,
        placementSession: sessionId,
        ...schedule,
        venue: driveParams.venue || "",
        isActive: true,
            createdBy: adminId,
        });
    } catch (error) {
        throw error;
    }

    // 5. If automated drive or rounds requested, initialize selection rounds
    const rounds = Array.isArray(driveParams.rounds) && driveParams.rounds.length > 0
        ? driveParams.rounds
        : [
            { roundNumber: 1, roundName: "Online Assessment", roundType: "aptitude", status: "SCHEDULED" },
            { roundNumber: 2, roundName: "Technical Interview", roundType: "technical", status: "SCHEDULED" },
            { roundNumber: 3, roundName: "HR & Leadership Round", roundType: "hr", status: "SCHEDULED" },
        ];

    if (isAutomated && drive._id) {
        try {
            await updateDriveRoundsConfig(drive._id, rounds);
        } catch (roundErr) {
            let driveDeactivated = false;
            try {
                await PlacementDrive.findByIdAndUpdate(drive._id, { $set: { isActive: false } });
                driveDeactivated = true;
            } catch {
                // Keep the error actionable if even the safety update cannot be persisted.
            }
            throw new Error(`Automated round setup failed. ${driveDeactivated ? "The drive was deactivated." : "The drive status could not be verified; check the admin drive list before retrying."} ${roundErr.message}`);
        }
    }

    // Copilot-published drives get the same deadline reminders as form-created drives
    await syncDriveReminders(drive._id);

    return {
        drive,
        company: companyDoc,
        params: {
            companyName,
            jobTitle,
            salaryPackage,
            minimumCGPA,
            maximumBacklogs,
            eligibleBranches: branches,
            isAutomated,
            rounds,
            graduationYear: sessionYear,
            ...schedule,
            location: driveParams.location || "",
            venue: driveParams.venue || "",
        },
    };
};

/**
 * Fetch real-time database context for Gemini
 */
const queryAdminSystemContext = async () => {
    const totalStudents = await StudentProfile.countDocuments().maxTimeMS(3000);
    const verifiedStudents = await StudentProfile.countDocuments({ verificationStatus: "VERIFIED" }).maxTimeMS(3000);
    const pendingStudents = await StudentProfile.countDocuments({ verificationStatus: "PENDING" }).maxTimeMS(3000);
    const highCgpaStudents = await StudentProfile.countDocuments({ cgpa: { $gte: 8.0 } }).maxTimeMS(3000);
    const studentsWithBacklogs = await StudentProfile.countDocuments({ activeBacklogs: { $gt: 0 } }).maxTimeMS(3000);
    const activeDrives = await PlacementDrive.find({ isActive: true, isDeleted: { $ne: true } })
        .populate("company", "companyName")
        .select("jobTitle package minimumCGPA maximumBacklogs applicationDeadline company")
        .limit(6)
        .maxTimeMS(3000)
        .lean();
    const totalApplications = await Application.countDocuments().maxTimeMS(3000);
    const placedStudents = await StudentProfile.countDocuments({ isPlaced: true }).maxTimeMS(3000);
    const applicationStatusCounts = await Application.aggregate([
        { $match: { isArchived: { $ne: true } } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
    ]).option({ maxTimeMS: 3000 });
    const currentSession = await PlacementSession.findOne({ isActive: true, isClosed: { $ne: true }, isArchived: { $ne: true } })
        .maxTimeMS(3000)
        .lean();

    return {
        totalStudents,
        verifiedStudents,
        pendingStudents,
        highCgpaStudents,
        studentsWithBacklogs,
        placedStudents,
        applicationsByStatus: Object.fromEntries(applicationStatusCounts.map((c) => [c._id, c.n])),
        totalApplications,
        activeSessionYear: currentSession?.sessionYear ?? null,
        activeDrives: activeDrives.map((d) => ({
            company: d.company?.companyName || "Company",
            role: d.jobTitle,
            packageLpa: d.package,
            minCgpa: d.minimumCGPA,
            deadline: d.applicationDeadline,
        })),
        approvedPrograms: PROGRAM_CATALOG.map((p) => `${p.code} (${p.name})`),
    };
};

const unavailableAdminSystemContext = () => ({
    available: false,
    totalStudents: null,
    verifiedStudents: null,
    pendingStudents: null,
    highCgpaStudents: null,
    studentsWithBacklogs: null,
    placedStudents: null,
    applicationsByStatus: null,
    totalApplications: null,
    activeSessionYear: null,
    activeDrives: [],
    approvedPrograms: PROGRAM_CATALOG.map((p) => `${p.code} (${p.name})`),
});

export const getAdminSystemContext = async ({ loadContext = queryAdminSystemContext } = {}) => {
    try {
        return { available: true, ...(await loadContext()) };
    } catch (dbErr) {
        console.warn("[AdminCopilot] Database context query skipped:", dbErr.message);
        return unavailableAdminSystemContext();
    }
};

/**
 * Calculate count of verified students who meet criteria
 */
export const countEligibleStudents = async ({ minimumCGPA, maximumBacklogs, eligibleBranches, graduationYear } = {}) => {
    try {
        const session = await PlacementSession.findOne({ isActive: true, isClosed: { $ne: true }, isArchived: { $ne: true } }).lean();
        const targetYear = Number(graduationYear || session?.sessionYear);
        if (!Number.isFinite(targetYear)) return null;
        const programs = resolveProgramsFromPrompt(eligibleBranches);
        const profiles = await StudentProfile.find({ verificationStatus: "VERIFIED", graduationYear: targetYear })
            .maxTimeMS(5000)
            .lean();
        const criteria = {
            isActive: true,
            applicationDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
            graduationYear: targetYear,
            eligibleProgramCodes: programs.programCodes,
            eligibleBranches: programs.branches,
            checkCgpa: true,
            minimumCGPA: Number(minimumCGPA),
            checkBacklogs: true,
            maximumBacklogs: Number(maximumBacklogs),
        };
        return profiles.filter((profile) => EligibilityService.evaluate(profile, criteria).isEligible).length;
    } catch {
        return null;
    }
};

const isLiveDataQuestion = (prompt) =>
    /\b(how many|count|statistics|analytics|list (?:the )?(?:students|drives|applications)|show (?:me )?(?:the )?(?:students|drives|applications|verifications)|pending verification|verified students|active drives|eligible students|candidate pool|student directory|cgpa above|cgpa distribution)\b/i.test(prompt) ||
    hasStudentIdentifier(prompt);

const hasStudentIdentifier = (prompt) => {
    const ids = extractStudentIdentifiers(prompt);
    return ids.usns.length > 0 || ids.emails.length > 0 || ids.names.length > 0;
};

export const isExplicitCopilotConfirmation = (prompt) => {
    if (!prompt || typeof prompt !== "string") return false;
    const clean = prompt.trim();
    // Drive specification keywords: if the prompt specifies criteria for creating a drive, it is NEVER a confirmation
    if (/\b(?:package|lpa|cgpa|backlog|stipend|ctc|branches?|rounds?|selection\s*rounds?|job\s*description|\bjd\b)\b/i.test(clean)) {
        return false;
    }
    // Intent to host/create a drive
    if (/\b(?:drive\s+for|host\s+|new\s+drive|create\s+(?:a\s+)?drive|publish\s+(?:a\s+)?(?:new\s+)?drive\s+for)/i.test(clean)) {
        return false;
    }
    if (/\?/i.test(clean)) return false;
    return /^(?:yes|confirm|publish|proceed|go ahead|do it|create it)(?:[,.!\s]+(?:yes|it|this|the|drive|this drive|this drive live|please|now|confirm|and|publish|go ahead|proceed|live))*[.!]*$/i.test(clean);
};

const sanitizeCopilotMessages = (messages) => (Array.isArray(messages) ? messages : [])
    .slice(-8)
    .filter((message) => message && ["admin", "bot"].includes(message.sender))
    .map((message) => ({
        sender: message.sender,
        content: typeof message.content === "string" ? message.content.slice(0, 1200) : "",
        ...(message.sender === "bot" && message.action === "DRIVE_READY" && message.driveParams && typeof message.driveParams === "object"
            ? { action: "DRIVE_READY", driveParams: message.driveParams }
            : {}),
    }));

/**
 * Main handler for Admin AI Copilot backed by Groq AI
 */
export const processAdminCopilotPrompt = async ({
    prompt,
    adminUser,
    messages = [],
    loadContext = getAdminSystemContext,
    loadQueryContext = buildTpoQueryContext,
    generateAnswer = callGroqAI,
    createDrive = executeDriveCreation,
    getEligibleCount = countEligibleStudents,
}) => {
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        throw new Error("Prompt is required.");
    }

    const cleanPrompt = prompt.trim();
    const systemContext = await loadContext();
    const recentMessages = sanitizeCopilotMessages(messages);

    if (!systemContext.available && isLiveDataQuestion(cleanPrompt)) {
        return {
            action: "DATA_UNAVAILABLE",
            answer: "I can’t access current CampusFlow data right now, so I can’t confirm those counts or records. No data changes were made. Please try again when the database connection is available.",
        };
    }

    const lastMessage = recentMessages.at(-1);
    const stagedParams = lastMessage?.sender === "bot" && lastMessage.action === "DRIVE_READY"
        ? lastMessage.driveParams
        : null;

    if (isExplicitCopilotConfirmation(cleanPrompt) && stagedParams) {
        const { drive, company, params } = await createDrive({ driveParams: stagedParams, adminUser });
        const eligibleCount = await getEligibleCount({ ...params, graduationYear: params.graduationYear });
        return {
            action: "DRIVE_CREATED",
            answer: `**Placement drive published successfully.**\n\n` +
                `• **Company:** ${company.companyName}\n` +
                `• **Role:** ${params.jobTitle}\n` +
                `• **Package:** ₹${params.salaryPackage} LPA\n` +
                `• **Eligibility:** CGPA ≥ ${params.minimumCGPA}; maximum ${params.maximumBacklogs} active backlogs\n` +
                `• **Programs:** ${params.eligibleBranches.join(", ")}\n` +
                `• **Application deadline:** ${formatDateTime(params.applicationDeadline)}\n` +
                `• **Drive date:** ${formatDateTime(params.driveDate)}\n` +
                (eligibleCount !== null ? `• **Students meeting the configured eligibility checks:** ${eligibleCount}\n` : "") +
                `• **Status:** Active on the student portal.`,
            driveId: drive._id,
            driveTitle: `${company.companyName} — ${params.jobTitle}`,
            metadata: {
                driveId: drive._id,
                companyName: company.companyName,
                jobTitle: params.jobTitle,
                package: params.salaryPackage,
                minimumCGPA: params.minimumCGPA,
                eligibleCount,
            },
        };
    }

    if (isExplicitCopilotConfirmation(cleanPrompt)) {
        return {
            action: "GROQ_RESPONSE",
            answer: "There isn’t a drive awaiting confirmation in this conversation. Please stage and review the drive details first. No changes were made.",
        };
    }

    // Records for the specific students/drives this question is about (TPO-authorized, bounded fields)
    let queryContext = { text: "" };
    if (systemContext.available) {
        const priorAdminPrompts = recentMessages.filter((m) => m.sender === "admin").map((m) => m.content);
        try {
            queryContext = await loadQueryContext(cleanPrompt, priorAdminPrompts);
        } catch (ctxErr) {
            console.warn("[AdminCopilot] Record lookup failed:", ctxErr.message);
            if (hasStudentIdentifier(cleanPrompt)) {
                return {
                    action: "DATA_UNAVAILABLE",
                    answer: "I couldn’t look up that student’s records right now, so I can’t answer without guessing. No data changes were made. Please try again.",
                };
            }
        }
    }

    const databaseFacts = systemContext.available
        ? `LIVE CAMPUSFLOW DATABASE FACTS (current at ${formatDateTime(new Date())}):\n- Registered Students: ${systemContext.totalStudents}\n- TPO-Verified Profiles: ${systemContext.verifiedStudents}\n- Pending Verification Dossiers: ${systemContext.pendingStudents}\n- High Academic Achievers (CGPA >= 8.0): ${systemContext.highCgpaStudents}\n- Candidates with Active Backlogs: ${systemContext.studentsWithBacklogs}\n- Students marked placed: ${systemContext.placedStudents ?? "unknown"}\n- Total Placement Applications: ${systemContext.totalApplications}\n- Applications by status (non-archived): ${JSON.stringify(systemContext.applicationsByStatus || {})}\n- Active Cohort Session: ${systemContext.activeSessionYear ?? "not configured"}\n- Currently Active Live Drives (${systemContext.activeDrives.length}): ${JSON.stringify(systemContext.activeDrives.map((d) => ({ ...d, deadline: formatDateTime(d.deadline) })))}\n- Approved Academic Programs: ${systemContext.approvedPrograms.join("; ")}` +
          (queryContext.text ? `\n\n${queryContext.text}` : "")
        : "LIVE CAMPUSFLOW DATABASE FACTS: unavailable. Do not estimate, invent, or infer counts, student records, drive details, or session information.";

    const systemInstruction = `You are the JSSATEB Senior Placement Officer Copilot & AI Operations Executive powered by Groq AI.
You converse naturally, professionally, and dynamically with the Administrator / Training & Placement Officer (TPO).
You are NOT a simple canned responder. You use real Groq AI reasoning and live database context.

${databaseFacts}

RULES FOR OPERATION & DIALOGUE:
1. Answer naturally, warmly, and conversationally. Never make up live facts. If database facts are unavailable, say so. Do not claim an operation ran; the application confirms all writes separately.
2. DRIVE HOSTING & JOB DESCRIPTION (JD) WORKFLOW:
   - Required Criteria for a placement drive:
     a) Company Name
     b) Job Role / Position Title
     c) Compensation Package (CTC in LPA) or Stipend
     d) Eligibility Cutoff: Minimum CGPA & Maximum active backlogs
     e) Eligible Programs/Branches (e.g. CSE, ISE, ECE, or All)
   - When the TPO asks to host, create, or schedule a placement drive:
     * If ANY key criteria are missing:
       Converse naturally and professionally. Acknowledge what they've stated (e.g. "I'd be glad to help host Adobe!").
       Ask specific clarifying questions for the missing details (e.g. What role? What is the CTC package in LPA? What is the minimum CGPA cutoff and backlog allowance? Which branches?).
       Also let them know: "You can also paste the Job Description (JD) text directly, and I'll extract all criteria automatically!"
       DO NOT output any \`\`\`json:drive_intent block until all key criteria are gathered!
     * When the TPO provides all criteria OR pastes a Job Description (JD):
        Thoroughly parse and extract all criteria: Company Name, Role, Package (in LPA), CGPA cutoff, Backlogs, Eligible Branches, and Selection Rounds for automated drives. Never infer missing criteria.
       If the TPO explicitly requests an automated drive, set isAutomated to true and include each requested selection round with a unique name.
       Present a clear, professional summary of the extracted criteria.
       Ask the TPO: "All criteria are verified and staged. Would you like me to confirm and publish this live to the portal now?"
       Include the machine-readable JSON block at the very end of your response:
       \`\`\`json:drive_intent
       {
         "action": "DRIVE_READY",
         "driveParams": {
           "companyName": "Exact Company Name",
           "jobTitle": "Exact Role Title",
           "package": 18,
           "minimumCGPA": 7.5,
           "maximumBacklogs": 0,
           "eligibleBranches": ["CSE", "ISE", "ECE"],
          "isAutomated": true,
           "rounds": [
             { "roundNumber": 1, "roundName": "Online Coding Assessment", "roundType": "coding" },
             { "roundNumber": 2, "roundName": "Technical Interview", "roundType": "technical" },
             { "roundNumber": 3, "roundName": "HR Round", "roundType": "hr" }
            ]
          }
        }
        \`\`\`
  3. If the TPO asks about student directories, analytics, or verifications, answer only from the LIVE CAMPUSFLOW DATABASE FACTS. If they are unavailable, say you cannot verify the requested data.
  4. STUDENT & DRIVE QUESTIONS: You have direct access to the student database. When STUDENT RECORDS or DRIVE RECORDS are provided above, you have full and complete knowledge of that student's records (academic dossier, semester SGPA, verified CGPA, active/historical backlogs, application history, and drive eligibility). Answer any question or perform any evaluation or task asked by the TPO using these real records in a clear, structured summary. Do not tell the TPO to go and open another page instead. Values marked "not recorded" are missing in the database — say so. If NO STUDENT RECORD FOUND is listed, say the student could not be found and suggest checking the USN. Never mix details between different students.
  5. Eligibility verdicts come from the portal's eligibility engine as given; do not recompute or overrule them.
  6. You can only stage new drives (via the drive_intent block). You cannot edit records, change application statuses, send emails or notifications. If asked, explain where the TPO can do it in the portal and state clearly that nothing was changed.`;

    let aiResponse;
    try {
        aiResponse = await generateAnswer({
            systemInstruction,
            prompt: cleanPrompt,
            messages: recentMessages,
            maxTokens: 1500,
        });
    } catch (aiErr) {
        console.warn("[AdminCopilot] Groq AI call failed:", aiErr.code || aiErr.message);
        return {
            action: "AI_UNAVAILABLE",
            answer: `${describeAIFailure(aiErr)} No drive or other data changes were made.`,
            errorCode: aiErr.code || "PROVIDER_ERROR",
        };
    }

    const outputText = aiResponse.text;

    // Check if AI generated a drive creation intent block with flexible multi-pattern support
    let driveParams = null;
    let cleanDisplayAnswer = outputText;

    // 1. Try fenced blocks: ```json:drive_intent, ```json, or ```drive_intent
    const fencedRegex = /```(?:json:drive_intent|drive_intent|json)?\s*([\s\S]*?)\s*```/gi;
    let match;
    let matchedBlock = null;

    while ((match = fencedRegex.exec(outputText)) !== null) {
        const candidate = match[1].trim();
        if (candidate.startsWith("{") && candidate.endsWith("}")) {
            try {
                const parsed = JSON.parse(candidate);
                if (parsed.driveParams && typeof parsed.driveParams === "object") {
                    driveParams = parsed.driveParams;
                    matchedBlock = match[0];
                    break;
                } else if (parsed.companyName && (parsed.package != null || parsed.salaryPackage != null)) {
                    driveParams = parsed;
                    matchedBlock = match[0];
                    break;
                }
            } catch {
                // not valid json block, keep looking
            }
        }
    }

    // 2. Try raw JSON if no code fence matched
    if (!driveParams) {
        const rawJsonMatch = outputText.match(/\{[\s\S]*?"(?:companyName|driveParams)"[\s\S]*?\}/);
        if (rawJsonMatch) {
            try {
                const parsed = JSON.parse(rawJsonMatch[0]);
                if (parsed.driveParams && typeof parsed.driveParams === "object") {
                    driveParams = parsed.driveParams;
                    matchedBlock = rawJsonMatch[0];
                } else if (parsed.companyName && (parsed.package != null || parsed.salaryPackage != null)) {
                    driveParams = parsed;
                    matchedBlock = rawJsonMatch[0];
                }
            } catch {
                // ignore
            }
        }
    }

    // 3. Fallback: Direct extraction if TPO provided complete drive specs in prompt
    if (!driveParams) {
        try {
            const combinedText = `${cleanPrompt}\n${outputText}`;
            const companyMatch = combinedText.match(/\b(?:company|for)\s*[:\-]?\s*([A-Za-z0-9&.\s]{2,40})(?:,|\.|\n|role|package|cgpa)/i);
            const roleMatch = combinedText.match(/\b(?:role|position|job\s*title)\s*[:\-]?\s*([A-Za-z0-9&.\s]{2,50})(?:,|\.|\n|package|cgpa|salary)/i);
            const packageMatch = combinedText.match(/\b(?:package|ctc|salary|stipend)\s*[:\-]?\s*₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|inr)?/i);
            const cgpaMatch = combinedText.match(/\b(?:cgpa|cutoff|min(?:imum)?\s*cgpa)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
            const backlogMatch = combinedText.match(/\b(?:backlogs?|max(?:imum)?\s*backlogs?)\s*[:\-]?\s*(\d+)/i);
            const branchMatch = combinedText.match(/\b(?:branches?|programs?|eligible\s*(?:branches?|programs?))\s*[:\-]?\s*([A-Za-z0-9,\s/&]+?)(?:,|\.|\n|$)/i);

            if (companyMatch && roleMatch && packageMatch && cgpaMatch && backlogMatch) {
                const candidate = {
                    companyName: companyMatch[1].trim(),
                    jobTitle: roleMatch[1].trim(),
                    package: parseFloat(packageMatch[1]),
                    minimumCGPA: parseFloat(cgpaMatch[1]),
                    maximumBacklogs: parseInt(backlogMatch[1], 10),
                    eligibleBranches: branchMatch ? branchMatch[1].trim() : "All",
                };
                if (validateDriveParams(candidate).valid) {
                    driveParams = candidate;
                }
            }
        } catch {
            // ignore fallback error
        }
    }

    if (matchedBlock) {
        cleanDisplayAnswer = cleanDisplayAnswer.replace(matchedBlock, "").trim();
    }
    cleanDisplayAnswer = cleanDisplayAnswer
        .replace(/```(?:json:drive_intent|drive_intent|json)[\s\S]*?```/gi, "")
        .trim();

    // If drive is ready for admin confirmation
    if (driveParams) {
        const requestsAutomatedDrive = /\b(automated|automation|automatically|selection rounds|rounds workflow)\b/i.test(cleanPrompt);
        if (requestsAutomatedDrive) driveParams.isAutomated = true;
        const validation = validateDriveParams(driveParams);
        if (!validation.valid) {
            return {
                action: "GROQ_RESPONSE",
                answer: `${cleanDisplayAnswer || "I could not verify all drive details."}\n\nI can’t stage this drive yet. Please confirm: ${validation.errors.join("; ")}. No changes were made.`,
            };
        }
        const schedule = createDefaultSchedule();
        const stagedParams = { ...validation.params, ...schedule };
        const eligibleCount = await getEligibleCount({
            ...stagedParams,
            graduationYear: systemContext.activeSessionYear,
        });
        return {
            action: "DRIVE_READY",
            answer: `${cleanDisplayAnswer || "The drive details are ready for review."}\n\nProposed schedule: applications open ${formatDateTime(schedule.applicationStartDate)}, deadline ${formatDateTime(schedule.applicationDeadline)}, drive date ${formatDateTime(schedule.driveDate)}. Review these dates before confirming.`,
            driveParams: {
                ...stagedParams,
                eligibleCount,
            },
        };
    }

    // General dynamic Groq response
    return {
        action: "GROQ_RESPONSE",
        answer: cleanDisplayAnswer || outputText,
        model: aiResponse.model,
    };
};
