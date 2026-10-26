/**
 * Intent-aware, authorization-scoped context for the CampusFlow AI assistants.
 *
 * The model never receives a database dump: each request retrieves only the
 * records relevant to the question and to what the caller is allowed to see.
 *  - Students: only their own profile, applications, eligibility and notifications.
 *  - TPO/admin: the specific students/drives named in the question (by USN,
 *    email or name), with a bounded field list.
 * Facts are formatted as plain text; values that are not recorded are labelled
 * "not recorded" so the model cannot mistake absence for a real value.
 */
import { StudentProfile } from "../models/studentProfile.model.js";
import { Application } from "../models/application.model.js";
import { PlacementDrive } from "../models/placementDrive.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.models.js";
import { Company } from "../models/company.model.js";
import { EligibilityService } from "./eligibility.service.js";
import { resolveStudentProgram } from "../constants/programCatalog.js";
import { formatDateTime } from "../utils/dateFormat.js";

const QUERY_TIMEOUT_MS = 3000;
const NOT_RECORDED = "not recorded";

const INTENT_PATTERNS = {
    profile: /\b(my profile|profile|cgpa|gpa|sgpa|marks?|percentage|backlogs?|arrears?|semester|branch|department|program|usn|academic|verification|verified|details?|record|dossier)\b/i,
    eligibility: /\b(eligib\w*|qualif\w*|cut-?off|criteria|can i apply|why (?:can'?t|cannot|am i not)|not allowed)\b/i,
    drives: /\b(drives?|compan(?:y|ies)|hiring|openings?|jobs?|roles?|package|ctc|lpa|stipend|recruit\w*|deadline|last date|closing)\b/i,
    applications: /\b(applications?|applied|apply|status|shortlist\w*|interview\w*|offers?|selected|rejected|withdraw\w*|round|result)\b/i,
    notifications: /\b(notifications?|alerts?|announcements?|messages?|reminders?|broadcast)\b/i,
    statistics: /\b(how many|count|number of|statistics|stats|analytics|summary|report|overview|placed|percentage of|average)\b/i,
    workflow: /\b(how (?:do|to|can)|steps?|process|procedure|where (?:do|can)|upload|update|re-?verif\w*)\b/i,
    action: /\b(create|host|publish|schedule|add|post|delete|remove|update|change|edit|send|email|notify|approve|reject|shortlist)\b/i,
};

/** Classify a question into one or more intents (always returns at least "general"). */
export const classifyIntent = (text = "") => {
    const intents = Object.entries(INTENT_PATTERNS)
        .filter(([, pattern]) => pattern.test(text))
        .map(([intent]) => intent);
    return intents.length > 0 ? intents : ["general"];
};

const show = (value, suffix = "") =>
    value === null || value === undefined || value === "" || Number.isNaN(value) ? NOT_RECORDED : `${value}${suffix}`;

const effectiveCgpa = (profile) => (profile.verifiedCGPA != null ? profile.verifiedCGPA : profile.cgpa);

const describeProfile = (profile, user) => {
    const program = resolveStudentProgram(profile);
    const tenth = profile.tenthDetails?.percentage ?? profile.tenthPercentage;
    const twelfth = profile.twelfthOrDiplomaDetails?.percentage ?? profile.twelfthPercentage;
    const sgpa = (profile.semesterResults || [])
        .slice()
        .sort((a, b) => a.semester - b.semester)
        .map((s) => `S${s.semester}: ${s.sgpa}`)
        .join(", ");
    return [
        `Name: ${show(user?.fullName)}`,
        `USN: ${show(profile.enrollmentNumber || profile.usn)}`,
        `Email: ${show(user?.email || profile.collegeEmail)}`,
        `Program: ${show(program?.name || profile.branch || profile.department)}`,
        `Graduation year (cohort): ${show(profile.graduationYear)}`,
        `Current semester: ${show(profile.currentSemester || profile.semester)}`,
        `CGPA: ${show(effectiveCgpa(profile))}${profile.verifiedCGPA != null ? " (TPO-verified)" : ""}`,
        `Semester SGPA: ${sgpa || NOT_RECORDED}`,
        `Active backlogs: ${show(profile.activeBacklogs ?? profile.backlogs)}`,
        `Historical backlogs: ${show(profile.historicalBacklogs)}`,
        `10th %: ${show(tenth)}`,
        `12th / Diploma %: ${show(twelfth)}`,
        `Profile verification: ${show(profile.verificationStatus)}`,
        `Profile locked: ${profile.isProfileLocked ? "yes" : "no"}`,
        `Profile resume on file: ${profile.resume?.url ? "yes" : "no"}`,
        `Placed: ${profile.isPlaced ? `yes — ${show(profile.placedCompany)} (${show(profile.placedJobTitle)}, ${show(profile.placedPackage, " LPA")})` : "no"}`,
    ].join("\n");
};

const describeApplication = (app) => {
    const drive = app.placementDrive || {};
    const company = drive.company?.companyName || app.archivedDriveSnapshot?.companyName || "Unknown company";
    const role = drive.jobTitle || app.archivedDriveSnapshot?.jobTitle || "Unknown role";
    const parts = [
        `${company} — ${role}: status ${app.status}`,
        `applied ${formatDateTime(app.appliedAt || app.createdAt) || NOT_RECORDED}`,
    ];
    if (drive.applicationDeadline) parts.push(`drive deadline ${formatDateTime(drive.applicationDeadline)}`);
    if (app.interviewRound || app.interviewDate) {
        parts.push(`interview ${app.interviewRound || ""} ${app.interviewDate ? `on ${formatDateTime(app.interviewDate)}` : ""}`.trim());
    }
    if (app.offeredPackage != null) parts.push(`offered ${app.offeredPackage} LPA`);
    if (app.isArchived) parts.push("drive was deleted (archived)");
    return `- ${parts.join("; ")}`;
};

const liveDrivesQuery = () =>
    PlacementDrive.find({ isActive: true, isDeleted: { $ne: true }, applicationDeadline: { $gt: new Date() } })
        .populate("company", "companyName")
        .sort({ applicationDeadline: 1 })
        .limit(15)
        .maxTimeMS(QUERY_TIMEOUT_MS);

const describeDriveForStudent = (drive, profile) => {
    const evaluation = EligibilityService.evaluate(profile, drive);
    const verdict = evaluation.isEligible
        ? "ELIGIBLE"
        : `${evaluation.status}: ${(evaluation.reasons || []).join("; ")}`;
    return `- ${drive.company?.companyName || "Company"} — ${drive.jobTitle} (${drive.jobType}, ${show(drive.package, " LPA")}); applications ${formatDateTime(drive.applicationStartDate)} to ${formatDateTime(drive.applicationDeadline)}; you: ${verdict}`;
};

/**
 * Context for the student assistant: only the authenticated student's own data.
 */
export const buildStudentAssistantContext = async (userId, question) => {
    const intents = classifyIntent(question);
    const sections = [];

    const [user, profile] = await Promise.all([
        User.findById(userId).select("fullName email").maxTimeMS(QUERY_TIMEOUT_MS).lean(),
        StudentProfile.findOne({ user: userId }).maxTimeMS(QUERY_TIMEOUT_MS).lean(),
    ]);

    if (!profile) {
        sections.push("STUDENT PROFILE: No academic profile exists for this student yet. Do not guess any academic details.");
        return { intents, text: sections.join("\n\n"), profile: null, user };
    }
    sections.push(`STUDENT PROFILE (authenticated student only):\n${describeProfile(profile, user)}`);

    const wantsDrives = intents.some((i) => ["drives", "eligibility", "applications", "general", "workflow"].includes(i));
    if (wantsDrives) {
        const drives = await liveDrivesQuery().lean();
        sections.push(
            drives.length
                ? `OPEN PLACEMENT DRIVES with this student's eligibility (computed by the portal's eligibility engine):\n${drives.map((d) => describeDriveForStudent(d, profile)).join("\n")}`
                : "OPEN PLACEMENT DRIVES: none currently accepting applications."
        );
    }

    if (intents.some((i) => ["applications", "general", "profile", "drives"].includes(i))) {
        const apps = await Application.find({ student: profile._id })
            .populate({ path: "placementDrive", select: "jobTitle applicationDeadline company", populate: { path: "company", select: "companyName" } })
            .sort({ createdAt: -1 })
            .limit(15)
            .maxTimeMS(QUERY_TIMEOUT_MS)
            .lean();
        sections.push(
            apps.length
                ? `THIS STUDENT'S APPLICATIONS:\n${apps.map(describeApplication).join("\n")}`
                : "THIS STUDENT'S APPLICATIONS: none submitted yet."
        );
    }

    if (intents.includes("notifications")) {
        const notes = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(8)
            .select("title message isRead createdAt")
            .maxTimeMS(QUERY_TIMEOUT_MS)
            .lean();
        sections.push(
            notes.length
                ? `RECENT NOTIFICATIONS:\n${notes.map((n) => `- [${n.isRead ? "read" : "unread"}] ${formatDateTime(n.createdAt)} — ${n.title}: ${String(n.message || "").slice(0, 200)}`).join("\n")}`
                : "RECENT NOTIFICATIONS: none."
        );
    }

    return { intents, text: sections.join("\n\n"), profile, user };
};

// --- TPO side -------------------------------------------------------------

// VTU-style USN, e.g. 1JS21CS042 / 1js23mca015
const USN_PATTERN = /\b\d[A-Z]{2}\d{2}[A-Z]{2,4}\d{3}\b/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const NAME_PATTERNS = [
    /\b(?:student|candidate)\s+(?:named\s+|called\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/,
    /\b(?:details|profile|record|status|applications?)\s+(?:of|for|about)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/,
    /\babout\s+([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/,
];
const MAX_STUDENTS_IN_CONTEXT = 5;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const extractStudentIdentifiers = (text = "") => {
    const usns = [...new Set((text.match(USN_PATTERN) || []).map((u) => u.toUpperCase()))];
    const emails = [...new Set((text.match(EMAIL_PATTERN) || []).map((e) => e.toLowerCase()))];
    const names = [];
    for (const pattern of NAME_PATTERNS) {
        const m = text.match(pattern);
        if (m?.[1] && !/^(the|this|that|all|every|each|my|our)$/i.test(m[1].split(/\s+/)[0])) names.push(m[1].trim());
    }
    return { usns, emails, names: [...new Set(names)] };
};

const hasIdentifiers = (ids) => ids.usns.length + ids.emails.length + ids.names.length > 0;

/**
 * Locate the students a TPO is asking about. Falls back to identifiers in the
 * TPO's recent messages for follow-ups like "what about his applications?".
 */
export const findStudentsForTpo = async (prompt, recentAdminMessages = []) => {
    let ids = extractStudentIdentifiers(prompt);
    let fromHistory = false;
    if (!hasIdentifiers(ids)) {
        for (const msg of [...recentAdminMessages].reverse()) {
            const candidate = extractStudentIdentifiers(msg);
            if (hasIdentifiers(candidate)) {
                ids = candidate;
                fromHistory = true;
                break;
            }
        }
    }
    if (!hasIdentifiers(ids)) return { requested: false, students: [], notFound: [], fromHistory };

    const found = new Map();
    const notFound = [];

    for (const usn of ids.usns) {
        const profile = await StudentProfile.findOne({
            $or: [
                { enrollmentNumber: new RegExp(`^${escapeRegExp(usn)}$`, "i") },
                { usn: new RegExp(`^${escapeRegExp(usn)}$`, "i") },
            ],
        }).maxTimeMS(QUERY_TIMEOUT_MS).lean();
        if (profile) found.set(String(profile._id), profile);
        else notFound.push(`USN ${usn}`);
    }

    for (const email of ids.emails) {
        const user = await User.findOne({ email }).select("_id").maxTimeMS(QUERY_TIMEOUT_MS).lean();
        const profile = user
            ? await StudentProfile.findOne({ user: user._id }).maxTimeMS(QUERY_TIMEOUT_MS).lean()
            : await StudentProfile.findOne({ collegeEmail: email }).maxTimeMS(QUERY_TIMEOUT_MS).lean();
        if (profile) found.set(String(profile._id), profile);
        else notFound.push(`email ${email}`);
    }

    for (const name of ids.names) {
        const users = await User.find({ fullName: new RegExp(escapeRegExp(name), "i"), role: "student" })
            .select("_id")
            .limit(MAX_STUDENTS_IN_CONTEXT)
            .maxTimeMS(QUERY_TIMEOUT_MS)
            .lean();
        const profiles = users.length
            ? await StudentProfile.find({ user: { $in: users.map((u) => u._id) } }).limit(MAX_STUDENTS_IN_CONTEXT).maxTimeMS(QUERY_TIMEOUT_MS).lean()
            : [];
        if (profiles.length === 0) notFound.push(`name "${name}"`);
        profiles.forEach((p) => found.set(String(p._id), p));
    }

    return {
        requested: true,
        students: [...found.values()].slice(0, MAX_STUDENTS_IN_CONTEXT),
        truncated: found.size > MAX_STUDENTS_IN_CONTEXT,
        notFound,
        fromHistory,
    };
};

const describeStudentForTpo = async (profile) => {
    const user = await User.findById(profile.user).select("fullName email phone").maxTimeMS(QUERY_TIMEOUT_MS).lean();
    const apps = await Application.find({ student: profile._id })
        .populate({ path: "placementDrive", select: "jobTitle applicationDeadline company", populate: { path: "company", select: "companyName" } })
        .sort({ createdAt: -1 })
        .limit(15)
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean();
    const drives = await liveDrivesQuery().lean();
    const eligibility = drives.map((d) => describeDriveForStudent(d, profile).replace("; you: ", "; eligibility: "));
    return [
        describeProfile(profile, user),
        apps.length ? `Applications:\n${apps.map(describeApplication).join("\n")}` : "Applications: none",
        eligibility.length ? `Eligibility for currently open drives:\n${eligibility.join("\n")}` : "Eligibility for currently open drives: no open drives",
    ].join("\n");
};

/** Drives the TPO mentions by company name, with application pipeline counts. */
export const findDrivesForTpo = async (prompt) => {
    const companies = await Company.find({}).select("companyName").limit(500).maxTimeMS(QUERY_TIMEOUT_MS).lean();
    const lower = prompt.toLowerCase();
    const mentioned = companies.filter((c) => c.companyName && c.companyName.length >= 2 && lower.includes(c.companyName.toLowerCase()));
    if (mentioned.length === 0) return [];
    const drives = await PlacementDrive.find({ company: { $in: mentioned.map((c) => c._id) }, isDeleted: { $ne: true } })
        .populate("company", "companyName")
        .populate("placementSession", "name sessionYear")
        .sort({ applicationDeadline: -1 })
        .limit(6)
        .maxTimeMS(QUERY_TIMEOUT_MS)
        .lean();
    const result = [];
    for (const d of drives) {
        const counts = await Application.aggregate([
            { $match: { placementDrive: d._id } },
            { $group: { _id: "$status", n: { $sum: 1 } } },
        ]).option({ maxTimeMS: QUERY_TIMEOUT_MS });
        const pipeline = counts.map((c) => `${c._id}: ${c.n}`).join(", ") || "no applications";
        result.push(
            `- ${d.company?.companyName} — ${d.jobTitle} (${d.jobType}, ${show(d.package, " LPA")}); ` +
            `${d.isPlacementCompleted ? "completed" : d.isActive ? "open" : "closed"}; cohort ${show(d.placementSession?.name || d.graduationYear)}; ` +
            `applications ${formatDateTime(d.applicationStartDate)} to ${formatDateTime(d.applicationDeadline)}; drive date ${formatDateTime(d.driveDate)}; ` +
            `criteria: CGPA ≥ ${d.checkCgpa === false ? "not checked" : d.minimumCGPA}, active backlogs ≤ ${d.checkBacklogs === false ? "not checked" : d.maximumBacklogs}, programs ${(d.eligibleBranches || []).join(", ")}; ` +
            `round ${d.currentRoundNumber || 1}; applications by status: ${pipeline}`
        );
    }
    return result;
};

/**
 * Context block for the TPO copilot: named students and/or drives only.
 */
export const buildTpoQueryContext = async (prompt, recentAdminMessages = []) => {
    const intents = classifyIntent(prompt);
    const sections = [];
    const lookup = await findStudentsForTpo(prompt, recentAdminMessages);

    if (lookup.requested) {
        if (lookup.students.length) {
            const blocks = [];
            for (const student of lookup.students) blocks.push(await describeStudentForTpo(student));
            sections.push(
                `STUDENT RECORDS (retrieved from the database for this question${lookup.fromHistory ? "; identified from earlier in this conversation" : ""}):\n` +
                blocks.map((b, i) => `[Student ${i + 1}]\n${b}`).join("\n\n") +
                (lookup.truncated ? `\n(More than ${MAX_STUDENTS_IN_CONTEXT} matches; ask the TPO to use a USN to narrow it down.)` : "")
            );
        }
        if (lookup.notFound.length) {
            sections.push(`NO STUDENT RECORD FOUND for: ${lookup.notFound.join(", ")}. Say so plainly; do not invent a record.`);
        }
    }

    const drives = await findDrivesForTpo(prompt);
    if (drives.length) sections.push(`DRIVE RECORDS (mentioned in the question):\n${drives.join("\n")}`);

    return { intents, text: sections.join("\n\n"), studentLookup: lookup, driveCount: drives.length };
};
