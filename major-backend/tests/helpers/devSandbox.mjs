/**
 * Local QA sandbox: the real CampusFlow API on http://localhost:8000 backed by an
 * in-memory MongoDB with seeded test accounts. Uses the same isolation as the
 * test suite (no real email, Cloudinary or Groq calls; Groq answers are canned).
 *
 *   node tests/helpers/devSandbox.mjs
 *
 * Test logins are printed on start. Nothing here touches the database in .env.
 */
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
    installMailMock, stubGroq, groqReply,
    createAdmin, createSession, createCompany, createStudent, createDrive,
} from "./testEnv.js";
import { app } from "../../src/app.js";
import { startReminderScheduler } from "../../src/services/reminderScheduler.service.js";

process.env.NODE_ENV = "development";

const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri(), { dbName: "campusflow_sandbox" });
installMailMock();
stubGroq(async (body) => {
    const wantsJson = body.response_format?.type === "json_object";
    const text = "This is a **sandbox** reply (Groq is stubbed locally).";
    return groqReply(wantsJson ? JSON.stringify({ answer: text, confidence: 0.9, handoffRecommended: false, reason: "sandbox" }) : text);
});

const admin = await createAdmin();
const session = await createSession();
const company = await createCompany(admin.user._id, "Sandbox Technologies");
const withResume = await createStudent({ session, name: "Sandbox Student One", resumeUrl: "https://res.cloudinary.test/campusflow/resumes/sandbox.pdf" });
const withoutResume = await createStudent({ session, name: "Sandbox Student Two" });
await createDrive({ admin: admin.user, company, session, deadlineInHours: 96 });

startReminderScheduler(30000);
http.createServer(app).listen(8000, "127.0.0.1", () => {
    console.log("CampusFlow sandbox API on http://localhost:8000 (in-memory MongoDB)");
    console.log(`Admin:   ${admin.user.email} / Password@123`);
    console.log(`Student (has profile resume): ${withResume.user.email} / Password@123`);
    console.log(`Student (no profile resume):  ${withoutResume.user.email} / Password@123`);
});
