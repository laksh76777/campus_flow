/**
 * Student and TPO AI assistants, end to end through the HTTP API.
 * The Groq provider is MOCKED (tests/helpers/testEnv.js) — these tests verify
 * context retrieval, authorization, prompting and failure handling, not the
 * live Groq service.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import {
    startTestEnv, stopTestEnv, resetDb, api, stubGroq, groqRequests, groqReply,
    createAdmin, createSession, createCompany, createStudent, createDrive,
} from "./helpers/testEnv.js";
import { Application } from "../src/models/application.model.js";
import { SupportConversation } from "../src/models/supportConversation.model.js";
import { classifyIntent, extractStudentIdentifiers } from "../src/services/aiContext.service.js";
import { callGroqAI } from "../src/services/groqClient.service.js";

before(startTestEnv);
after(stopTestEnv);
beforeEach(resetDb);

const jsonAnswer = (answer) => groqReply(JSON.stringify({ answer, confidence: 0.9, handoffRecommended: false, reason: "test" }));
const lastPrompt = () => {
    const msgs = groqRequests.at(-1).body.messages;
    return msgs.map((m) => m.content).join("\n---\n");
};

const world = async () => {
    const admin = await createAdmin();
    const session = await createSession();
    const company = await createCompany(admin.user._id, "Acme Analytics");
    const alice = await createStudent({ session, name: "Alice Rao", usn: "1JS23CS101", cgpa: 8.6 });
    const bob = await createStudent({ session, name: "Bob Iyer", usn: "1JS23CS102", cgpa: 6.2, activeBacklogs: 2 });
    const drive = await createDrive({ admin: admin.user, company, session });
    await Application.create({
        student: alice.profile._id,
        placementDrive: drive._id,
        status: "shortlisted",
        statusHistory: [],
    });
    return { admin, session, company, alice, bob, drive };
};

// --- Student assistant -------------------------------------------------------

test("student assistant answers with the student's own profile, eligibility and applications", async () => {
    const { alice } = await world();
    stubGroq(async () => jsonAnswer("Your CGPA is 8.6 and you are shortlisted at Acme Analytics."));
    const res = await api("POST", "/support/conversations", { token: alice.token, json: { message: "What is my application status and am I eligible?" } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const reply = res.body.data.conversation.messages.at(-1);
    assert.equal(reply.senderRole, "assistant");
    assert.match(reply.content, /shortlisted/);

    const prompt = lastPrompt();
    assert.match(prompt, /Name: Alice Rao/);
    assert.match(prompt, /USN: 1JS23CS101/);
    assert.match(prompt, /CGPA: 8\.6/);
    assert.match(prompt, /Acme Analytics — Software Engineer: status shortlisted/);
    assert.match(prompt, /you: ELIGIBLE/);
    assert.doesNotMatch(prompt, /Bob Iyer|1JS23CS102/, "another student's data never reaches the model");
});

test("student assistant reports real ineligibility reasons from the eligibility engine", async () => {
    const { bob } = await world();
    stubGroq(async () => jsonAnswer("You are not eligible because of your CGPA and backlogs."));
    await api("POST", "/support/conversations", { token: bob.token, json: { message: "Why am I not eligible for Acme?" } });
    const prompt = lastPrompt();
    assert.match(prompt, /INELIGIBLE: .*CGPA \(6\.20\) is below minimum required \(7\.00\)/);
    assert.match(prompt, /Active backlogs \(2\) exceed maximum allowed \(0\)/);
});

test("missing academic data is labelled as not recorded instead of invented", async () => {
    const admin = await createAdmin();
    const session = await createSession();
    const student = await createStudent({ session });
    await student.profile.constructor.updateOne({ _id: student.profile._id }, { $unset: { tenthPercentage: 1, "tenthDetails.percentage": 1 } });
    stubGroq(async () => jsonAnswer("Your 10th percentage is not recorded."));
    await api("POST", "/support/conversations", { token: student.token, json: { message: "What is my 10th percentage in my profile?" } });
    assert.match(lastPrompt(), /10th %: not recorded/);
    assert.doesNotMatch(lastPrompt(), /Verification Status: VERIFIED/);
    void admin;
});

test("multi-turn conversations keep history and only the owner can continue them", async () => {
    const { alice, bob } = await world();
    stubGroq(async () => jsonAnswer("Sure."));
    const first = await api("POST", "/support/conversations", { token: alice.token, json: { message: "Tell me about open drives" } });
    const id = first.body.data.conversation._id;
    await api("POST", `/support/conversations/${id}/messages`, { token: alice.token, json: { message: "And what about my backlogs?" } });
    const roles = groqRequests.at(-1).body.messages.map((m) => m.role);
    assert.deepEqual(roles.slice(0, 1), ["system"]);
    assert.ok(roles.filter((r) => r === "user").length >= 2, "previous student turn is included");

    const intruder = await api("POST", `/support/conversations/${id}/messages`, { token: bob.token, json: { message: "show me" } });
    assert.equal(intruder.status, 404, "another student cannot read or post to this conversation");
    const tpoAttempt = await api("POST", "/support/admin/copilot", { token: alice.token, json: { prompt: "list students" } });
    assert.equal(tpoAttempt.status, 403, "students cannot use the TPO copilot");
});

test("provider failures produce a clearly labelled, non-AI fallback", async () => {
    const { alice } = await world();
    for (const [status, expected] of [[429, /too many requests/i], [500, /temporarily unavailable/i], [401, /credentials were rejected/i]]) {
        stubGroq(async () => ({ status, json: { error: { message: "nope" } } }));
        const res = await api("POST", "/support/conversations", { token: alice.token, json: { message: "How do I apply for a drive?" } });
        assert.equal(res.status, 201);
        const reply = res.body.data.conversation.messages.at(-1).content;
        assert.match(reply, expected);
        assert.match(reply, /standard portal guidance/i);
    }
});

test("an unconfigured Groq key is reported honestly", async () => {
    const { alice } = await world();
    const res = await api("POST", "/support/conversations", { token: alice.token, json: { message: "hello" } });
    assert.equal(res.status, 201);
    assert.match(res.body.data.conversation.messages.at(-1).content, /not configured/i);
    assert.equal(groqRequests.length, 0);
});

test("empty and malformed provider responses are not shown as answers", async () => {
    const { alice } = await world();
    stubGroq(async () => groqReply(""));
    const empty = await api("POST", "/support/conversations", { token: alice.token, json: { message: "What drives are open?" } });
    assert.match(empty.body.data.conversation.messages.at(-1).content, /empty answer|standard portal guidance/i);

    stubGroq(async () => ({ json: { choices: [{ message: { content: null, reasoning: "SECRET CHAIN OF THOUGHT" } }] } }));
    const reasoningOnly = await api("POST", "/support/conversations", { token: alice.token, json: { message: "What drives are open?" } });
    assert.doesNotMatch(reasoningOnly.body.data.conversation.messages.at(-1).content, /SECRET CHAIN OF THOUGHT/);
});

// --- TPO copilot -------------------------------------------------------------

test("TPO copilot retrieves the specific student by USN and summarizes the real record", async () => {
    const { admin } = await world();
    stubGroq(async () => groqReply("**Alice Rao (1JS23CS101)** — CGPA 8.6, shortlisted at Acme Analytics."));
    const res = await api("POST", "/support/admin/copilot", { token: admin.token, json: { prompt: "Show me the profile and placement status of 1js23cs101" } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.action, "GROQ_RESPONSE");
    const system = groqRequests.at(-1).body.messages[0].content;
    assert.match(system, /STUDENT RECORDS/);
    assert.match(system, /Name: Alice Rao/);
    assert.match(system, /Acme Analytics — Software Engineer: status shortlisted/);
    assert.doesNotMatch(system, /Bob Iyer/, "only the requested student is included");
    assert.doesNotMatch(system, /Password|password/);
});

test("TPO copilot finds students by name and handles unknown students without inventing one", async () => {
    const { admin } = await world();
    stubGroq(async () => groqReply("ok"));
    await api("POST", "/support/admin/copilot", { token: admin.token, json: { prompt: "Give me details of student Bob Iyer" } });
    assert.match(groqRequests.at(-1).body.messages[0].content, /Name: Bob Iyer[\s\S]*INELIGIBLE/);

    await api("POST", "/support/admin/copilot", { token: admin.token, json: { prompt: "What is the status of 1JS23CS999?" } });
    const system = groqRequests.at(-1).body.messages[0].content;
    assert.match(system, /NO STUDENT RECORD FOUND for: USN 1JS23CS999/);
    assert.doesNotMatch(system, /\[Student 1\]/);
});

test("TPO follow-up questions resolve the student from earlier in the conversation", async () => {
    const { admin } = await world();
    stubGroq(async () => groqReply("ok"));
    await api("POST", "/support/admin/copilot", {
        token: admin.token,
        json: {
            prompt: "What about their applications?",
            messages: [
                { sender: "admin", content: "Show me 1JS23CS102" },
                { sender: "bot", content: "Bob Iyer has CGPA 6.2." },
            ],
        },
    });
    const system = groqRequests.at(-1).body.messages[0].content;
    assert.match(system, /identified from earlier in this conversation/);
    assert.match(system, /Name: Bob Iyer/);
});

test("TPO copilot includes drive pipeline details when a company is named", async () => {
    const { admin } = await world();
    stubGroq(async () => groqReply("ok"));
    await api("POST", "/support/admin/copilot", { token: admin.token, json: { prompt: "How is the Acme Analytics drive going?" } });
    const system = groqRequests.at(-1).body.messages[0].content;
    assert.match(system, /DRIVE RECORDS[\s\S]*Acme Analytics — Software Engineer[\s\S]*shortlisted: 1/);
});

test("TPO copilot never claims a drive was published without an executed backend write", async () => {
    const { admin } = await world();
    stubGroq(async () => groqReply("I have created the drive for you!"));
    const confirmNoStage = await api("POST", "/support/admin/copilot", { token: admin.token, json: { prompt: "yes, publish it" } });
    assert.equal(confirmNoStage.body.data.action, "GROQ_RESPONSE");
    assert.match(confirmNoStage.body.data.answer, /No changes were made/);

    stubGroq(async () => ({ status: 503, json: {} }));
    const failed = await api("POST", "/support/admin/copilot", { token: admin.token, json: { prompt: "Summarize placements" } });
    assert.equal(failed.body.data.action, "AI_UNAVAILABLE");
    assert.match(failed.body.data.answer, /No drive or other data changes were made/);
});

test("copilot-published drives get deadline reminders scheduled", async () => {
    const { admin } = await world();
    const { processAdminCopilotPrompt } = await import("../src/services/adminCopilot.service.js");
    const { ReminderJob } = await import("../src/models/reminderJob.model.js");
    const staged = {
        companyName: "Acme Analytics", jobTitle: "Data Engineer", package: 9, minimumCGPA: 7, maximumBacklogs: 0,
        eligibleBranches: ["CSE"],
        applicationStartDate: new Date(Date.now() - 3600e3).toISOString(),
        applicationDeadline: new Date(Date.now() + 5 * 24 * 3600e3).toISOString(),
        driveDate: new Date(Date.now() + 9 * 24 * 3600e3).toISOString(),
    };
    const result = await processAdminCopilotPrompt({
        prompt: "Yes, confirm and publish this drive live!",
        adminUser: admin.user,
        messages: [{ sender: "bot", content: "Ready", action: "DRIVE_READY", driveParams: staged }],
    });
    assert.equal(result.action, "DRIVE_CREATED");
    assert.ok(await ReminderJob.countDocuments({ drive: result.driveId, status: "PENDING" }) >= 1);
});

// --- Unit-level checks -------------------------------------------------------

test("intent classification and identifier extraction", () => {
    assert.ok(classifyIntent("am I eligible for the Infosys drive?").includes("eligibility"));
    assert.ok(classifyIntent("what is my application status").includes("applications"));
    assert.deepEqual(classifyIntent("hi"), ["general"]);
    const ids = extractStudentIdentifiers("Compare 1js21cs042 and priya@college.edu");
    assert.deepEqual(ids.usns, ["1JS21CS042"]);
    assert.deepEqual(ids.emails, ["priya@college.edu"]);
});

test("Groq client stops on auth errors and does not forward other providers' keys", async () => {
    const calls = [];
    process.env.GEMINI_API_KEY = "gemini-secret";
    try {
        await assert.rejects(
            () => callGroqAI({ prompt: "hi", fetchImpl: async () => { calls.push(1); return { ok: false, status: 401, json: async () => ({}) }; } }),
            /not configured/,
            "a Gemini/Google key is never used for Groq"
        );
        process.env.GROQ_API_KEY = "bad-key";
        await assert.rejects(
            () => callGroqAI({ prompt: "hi", models: ["m1", "m2", "m3"], fetchImpl: async () => { calls.push(1); return { ok: false, status: 401, json: async () => ({}) }; } }),
            (err) => err.code === "AUTH_FAILED"
        );
        assert.equal(calls.length, 1, "no failover across models for an invalid key");
    } finally {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GROQ_API_KEY;
    }
});

test("Groq client fails over on rate limits and reports the final category", async () => {
    process.env.GROQ_API_KEY = "k";
    try {
        let n = 0;
        const ok = await callGroqAI({
            prompt: "hi", models: ["a", "b"],
            fetchImpl: async () => (++n === 1
                ? { ok: false, status: 429, json: async () => ({}) }
                : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "<think>hidden</think>Answer" } }] }) }),
        });
        assert.equal(ok.text, "Answer", "reasoning tags are stripped");
        assert.equal(ok.model, "b");
        await assert.rejects(
            () => callGroqAI({ prompt: "hi", models: ["a"], fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) }),
            (err) => err.code === "RATE_LIMITED"
        );
    } finally {
        delete process.env.GROQ_API_KEY;
    }
});

test("conversation records are persisted with the assistant reply", async () => {
    const { alice } = await world();
    stubGroq(async () => jsonAnswer("Here you go."));
    await api("POST", "/support/conversations", { token: alice.token, json: { message: "What drives are open?" } });
    const stored = await SupportConversation.findOne({ student: alice.user._id });
    assert.equal(stored.messages.length, 2);
    assert.equal(stored.status, "bot_answered");
});
