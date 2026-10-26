/**
 * Isolated integration-test environment.
 *
 * - Runs against an in-memory MongoDB (mongodb-memory-server); never the
 *   database in .env.
 * - Importing the app loads .env (via mailService -> env.js), so every external
 *   credential is scrubbed afterwards: no real email, Cloudinary upload or Groq
 *   call can happen from a test.
 * - Mail and Cloudinary are replaced with recording fakes; outbound Groq calls
 *   fail unless a test installs a stub with `stubGroq`.
 */
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../../src/app.js";
import { resetTransporterForTesting } from "../../src/utils/mailService.js";
import { cloudinary } from "../../src/utils/cloudinary.js";
import { User } from "../../src/models/user.models.js";
import { Admin } from "../../src/models/admin.model.js";
import { StudentProfile } from "../../src/models/studentProfile.model.js";
import { PlacementSession } from "../../src/models/placementSession.model.js";
import { Company } from "../../src/models/company.model.js";
import { PlacementDrive } from "../../src/models/placementDrive.model.js";

const SCRUBBED_ENV = [
    "MONGODB_URI", "EMAIL_USER", "EMAIL_PASS", "SMTP_USER", "SMTP_PASS", "SMTP_HOST", "RESEND_API_KEY",
    "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
    "GROQ_API_KEY", "grog_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GROQ_MODEL", "GROQ_FALLBACK_MODELS",
];

export const scrubEnv = () => {
    for (const key of SCRUBBED_ENV) delete process.env[key];
    process.env.NODE_ENV = "test";
    process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
    process.env.ACCESS_TOKEN_EXPIRY = "1h";
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
    process.env.REFRESH_TOKEN_EXPIRY = "1d";
    // Fake Cloudinary credentials so the config check passes; uploads are stubbed below.
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
};
scrubEnv();

// --- Mail -----------------------------------------------------------------
export const sentMail = [];
export let mailShouldFail = () => false;
export const setMailFailure = (fn) => { mailShouldFail = fn; };
export const installMailMock = () => {
    resetTransporterForTesting({
        sendMail: async (opts) => {
            if (mailShouldFail(opts)) {
                const err = new Error("SMTP connection timed out");
                err.code = "ETIMEDOUT";
                throw err;
            }
            sentMail.push(opts);
            return { messageId: `mock-${sentMail.length}`, accepted: [opts.to] };
        },
    });
    process.env.EMAIL_USER = "placement@test.local";
    process.env.EMAIL_PASS = "not-a-real-password";
};

// --- Cloudinary -------------------------------------------------------------
export const cloudinaryCalls = { uploads: [], destroys: [] };
export let cloudinaryUploadShouldFail = false;
export const setCloudinaryUploadFailure = (value) => { cloudinaryUploadShouldFail = value; };
cloudinary.uploader.upload = async (filePath, options = {}) => {
    if (cloudinaryUploadShouldFail) throw new Error("Simulated Cloudinary outage");
    const n = cloudinaryCalls.uploads.length + 1;
    const record = {
        secure_url: `https://res.cloudinary.test/${options.folder || "files"}/upload-${n}.pdf`,
        public_id: `${options.folder || "files"}/upload-${n}`,
        resource_type: options.resource_type || "image",
    };
    cloudinaryCalls.uploads.push({ filePath, options, record });
    return record;
};
cloudinary.uploader.destroy = async (publicId, options = {}) => {
    cloudinaryCalls.destroys.push({ publicId, options });
    return { result: "ok" };
};

// --- Groq -------------------------------------------------------------------
const realFetch = globalThis.fetch;
let groqHandler = null;
export const groqRequests = [];
/** Install a fake Groq API: handler(body) -> { status, json } */
export const stubGroq = (handler) => {
    groqHandler = handler;
    process.env.GROQ_API_KEY = "test-groq-key";
};
export const clearGroqStub = () => {
    groqHandler = null;
    delete process.env.GROQ_API_KEY;
};
globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith("https://api.groq.com")) {
        if (!groqHandler) throw new Error("Unexpected live Groq call in test");
        const body = JSON.parse(options.body);
        groqRequests.push({ body, headers: options.headers });
        const { status = 200, json = {} } = await groqHandler(body);
        return { ok: status >= 200 && status < 300, status, json: async () => json };
    }
    return realFetch(url, options);
};
export const groqReply = (content) => ({ json: { choices: [{ message: { content } }] } });

// --- Database & HTTP ----------------------------------------------------------
let mongo;
let server;
export let baseUrl = "";

export const startTestEnv = async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: "campusflow_test" });
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
    installMailMock();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
};

export const stopTestEnv = async () => {
    resetTransporterForTesting(null);
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
};

export const resetDb = async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    sentMail.length = 0;
    cloudinaryCalls.uploads.length = 0;
    cloudinaryCalls.destroys.length = 0;
    groqRequests.length = 0;
    setMailFailure(() => false);
    setCloudinaryUploadFailure(false);
    clearGroqStub();
};

/** Minimal JSON/multipart API client with bearer auth. */
export const api = async (method, path, { token, json, form } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let body;
    if (json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(json);
    } else if (form) {
        body = form;
    }
    const res = await realFetch(`${baseUrl}${path}`, { method, headers, body });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, body: data };
};

// --- Fixtures -----------------------------------------------------------------
let seq = 0;
const next = () => ++seq;

export const createAdmin = async () => {
    const n = next();
    const user = await User.create({ fullName: `Test Officer ${n}`, email: `tpo${n}@test.local`, password: "Password@123", role: "admin" });
    await Admin.create({ user: user._id, employeeId: `TPO-${n}`, designation: "Placement Officer" });
    return { user, token: user.generateAccessToken() };
};

export const createSession = async ({ year = 2027 } = {}) =>
    PlacementSession.create({
        name: `Class of ${year}`,
        sessionYear: year,
        course: "B.E.",
        courseDurationYears: 4,
        admissionYear: year - 4,
        isActive: true,
    });

export const createCompany = async (adminId, name = `Example Systems ${next()}`) =>
    Company.create({ companyName: name, createdBy: adminId, isActive: true });

export const createStudent = async ({ session, cgpa = 8.2, activeBacklogs = 0, programCode = "CSE", resumeUrl = null, name, usn } = {}) => {
    const n = next();
    const user = await User.create({
        fullName: name || `Test Student ${n}`,
        email: `student${n}@test.local`,
        password: "Password@123",
        role: "student",
    });
    const profile = await StudentProfile.create({
        user: user._id,
        enrollmentNumber: usn || `1JS23CS${String(n).padStart(3, "0")}`,
        branch: "Computer Science & Engineering (CSE)",
        programCode,
        course: "B.E.",
        graduationYear: session?.sessionYear || 2027,
        placementSession: session?._id,
        semester: 7,
        cgpa,
        activeBacklogs,
        backlogs: activeBacklogs,
        historicalBacklogs: 0,
        tenthPercentage: 90,
        twelfthPercentage: 88,
        ...(resumeUrl ? { resume: { url: resumeUrl, publicId: `profile/${n}` } } : {}),
    });
    return { user, profile, token: user.generateAccessToken() };
};

const HOUR = 3600 * 1000;
export const createDrive = async ({ admin, company, session, deadlineInHours = 48, startInHours = -1, overrides = {} } = {}) =>
    PlacementDrive.create({
        company: company._id,
        jobTitle: "Software Engineer",
        jobType: "full-time",
        package: 12,
        eligibleBranches: ["Computer Science & Engineering (CSE)"],
        eligibleProgramCodes: ["CSE"],
        minimumCGPA: 7,
        maximumBacklogs: 0,
        graduationYear: session.sessionYear,
        placementSession: session._id,
        applicationStartDate: new Date(Date.now() + startInHours * HOUR),
        applicationDeadline: new Date(Date.now() + deadlineInHours * HOUR),
        driveDate: new Date(Date.now() + (deadlineInHours + 72) * HOUR),
        createdBy: admin._id,
        reminderSettings: { remindersEnabled: true, reminderOffsetsHours: [24], channels: ["in_app", "email"] },
        ...overrides,
    });
