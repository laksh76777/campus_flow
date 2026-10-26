import assert from "node:assert/strict";
import test from "node:test";
import {
    getAdminSystemContext,
    isExplicitCopilotConfirmation,
    processAdminCopilotPrompt,
    resolveProgramsFromPrompt,
    validateDriveParams,
} from "../src/services/adminCopilot.service.js";

const completeDrive = {
    companyName: "Example Co",
    jobTitle: "Software Engineer",
    package: 18,
    minimumCGPA: 7.5,
    maximumBacklogs: 0,
    eligibleBranches: ["CSE", "ISE"],
    isAutomated: false,
};

test("copilot program targeting requires explicit approved branches", () => {
    assert.deepEqual(resolveProgramsFromPrompt(["Computer Science & Engineering (CSE)"]).programCodes, ["CSE"]);
    assert.deepEqual(resolveProgramsFromPrompt("all approved programs").programCodes.length, 13);
    assert.throws(() => resolveProgramsFromPrompt(""), /Choose eligible programs/);
    assert.throws(() => resolveProgramsFromPrompt(["CSE", "Unknown Branch"]), /could not be matched/);
});

test("copilot only stages drives with validated required criteria", () => {
    assert.equal(validateDriveParams(completeDrive).valid, true);
    const incomplete = validateDriveParams({ companyName: "Example Co", jobTitle: "Engineer" });
    assert.equal(incomplete.valid, false);
    assert.match(incomplete.errors.join(" "), /compensation package/);
    assert.match(incomplete.errors.join(" "), /CGPA cutoff/);
    assert.match(incomplete.errors.join(" "), /backlog count/);
    assert.match(incomplete.errors.join(" "), /eligible programs/);
});

test("explicit automated-drive requests cannot be staged as regular drives", async () => {
    const response = await processAdminCopilotPrompt({
        prompt: "Stage an automated drive with these details",
        loadContext: async () => ({ available: true, activeDrives: [], approvedPrograms: [] }),
        generateAnswer: async () => ({
            text: `Review this drive.\n\n\`\`\`json:drive_intent\n${JSON.stringify({
                action: "DRIVE_READY",
                driveParams: {
                    ...completeDrive,
                    isAutomated: false,
                    rounds: [{ roundNumber: 1, roundName: "Coding", roundType: "coding" }],
                },
            })}\n\`\`\``,
        }),
        getEligibleCount: async () => 1,
    });
    assert.equal(response.action, "DRIVE_READY");
    assert.equal(response.driveParams.isAutomated, true);
});

test("unavailable database context contains no fabricated live metrics", async () => {
    const context = await getAdminSystemContext({ loadContext: async () => { throw new Error("database unavailable"); } });
    assert.equal(context.available, false);
    assert.equal(context.totalStudents, null);
    assert.equal(context.totalApplications, null);
    assert.equal(context.activeSessionYear, null);
    assert.deepEqual(context.activeDrives, []);
});

test("copilot does not answer live-data questions with invented values when Mongo is unavailable", async () => {
    let providerCalled = false;
    const response = await processAdminCopilotPrompt({
        prompt: "How many students are verified?",
        loadContext: async () => ({ available: false, activeDrives: [], approvedPrograms: [] }),
        generateAnswer: async () => { providerCalled = true; return { text: "There are 160 verified students." }; },
    });
    assert.equal(providerCalled, false);
    assert.equal(response.action, "DATA_UNAVAILABLE");
    assert.match(response.answer, /can’t access current CampusFlow data/);
});

test("copilot requires explicit confirmation of the immediately staged card before publishing", async () => {
    let createCalls = 0;
    const context = { available: true, activeDrives: [], approvedPrograms: [] };
    const readyMessage = { sender: "bot", action: "DRIVE_READY", driveParams: completeDrive };
    const notReady = await processAdminCopilotPrompt({
        prompt: "Publish the drive",
        messages: [readyMessage, { sender: "admin", content: "Publish the drive" }],
        loadContext: async () => context,
        generateAnswer: async () => ({ text: "Please review the current details." }),
        createDrive: async () => { createCalls += 1; throw new Error("should not publish"); },
    });
    assert.equal(notReady.action, "GROQ_RESPONSE");
    assert.equal(createCalls, 0);

    const dates = {
        applicationStartDate: new Date("2026-10-26T00:00:00.000Z"),
        applicationDeadline: new Date("2026-11-05T00:00:00.000Z"),
        driveDate: new Date("2026-11-09T00:00:00.000Z"),
    };
    const response = await processAdminCopilotPrompt({
        prompt: "Yes, confirm and publish this drive live!",
        messages: [{ ...readyMessage, driveParams: { ...completeDrive, ...dates } }],
        loadContext: async () => context,
        createDrive: async () => {
            createCalls += 1;
            return {
                drive: { _id: "drive-123" },
                company: { companyName: "Example Co" },
                params: { ...completeDrive, ...dates, salaryPackage: 18, graduationYear: 2027 },
            };
        },
        getEligibleCount: async () => 0,
    });
    assert.equal(createCalls, 1);
    assert.equal(response.action, "DRIVE_CREATED");
    assert.equal(response.driveId, "drive-123");
});

test("confirmation matching is explicit and does not accept a publish question", () => {
    assert.equal(isExplicitCopilotConfirmation("Yes, publish it."), true);
    assert.equal(isExplicitCopilotConfirmation("Should I publish the drive?"), false);
});

test("Groq AI failures return a transparent no-action response", async () => {
    const response = await processAdminCopilotPrompt({
        prompt: "How do I create a drive?",
        loadContext: async () => ({ available: true, activeDrives: [], approvedPrograms: [] }),
        generateAnswer: async () => { throw new Error("provider unavailable"); },
    });
    assert.equal(response.action, "AI_UNAVAILABLE");
    assert.match(response.answer, /No drive or other data changes were made/);
});
