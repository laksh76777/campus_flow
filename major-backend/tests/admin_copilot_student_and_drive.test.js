import assert from "node:assert/strict";
import test from "node:test";
import {
    isExplicitCopilotConfirmation,
    processAdminCopilotPrompt,
} from "../src/services/adminCopilot.service.js";
import {
    extractStudentIdentifiers,
} from "../src/services/aiContext.service.js";

test("extractStudentIdentifiers correctly identifies single students and various query formats", () => {
    assert.deepEqual(extractStudentIdentifiers("Tell me about Aarav").names, ["Aarav"]);
    assert.deepEqual(extractStudentIdentifiers("What is Aarav's CGPA?").names, ["Aarav"]);
    assert.deepEqual(extractStudentIdentifiers("Who is Vivek Krishnamurthy?").names, ["Vivek Krishnamurthy"]);
    assert.deepEqual(extractStudentIdentifiers("student aarav sharma").names, ["aarav sharma"]);
    assert.deepEqual(extractStudentIdentifiers("Show student details of Vivek").names, ["Vivek"]);
    assert.deepEqual(extractStudentIdentifiers("Check 1MS23CS001").usns, ["1MS23CS001"]);
    assert.deepEqual(extractStudentIdentifiers("email student@campusflow.edu").emails, ["student@campusflow.edu"]);

    // Must NOT extract generic English phrases as student names
    assert.deepEqual(extractStudentIdentifiers("Stage an automated drive with these details").names, []);
    assert.deepEqual(extractStudentIdentifiers("How many students are verified?").names, []);
});

test("isExplicitCopilotConfirmation differentiates confirmations from drive creation requests", () => {
    // True confirmations
    assert.equal(isExplicitCopilotConfirmation("Yes, confirm and publish this drive live!"), true);
    assert.equal(isExplicitCopilotConfirmation("Yes, publish it."), true);
    assert.equal(isExplicitCopilotConfirmation("Confirm"), true);
    assert.equal(isExplicitCopilotConfirmation("Publish the drive"), true);
    assert.equal(isExplicitCopilotConfirmation("Proceed"), true);
    assert.equal(isExplicitCopilotConfirmation("Go ahead"), true);
    assert.equal(isExplicitCopilotConfirmation("Do it"), true);

    // Drive creation requests (must NEVER be treated as confirmation of a pre-existing card)
    assert.equal(isExplicitCopilotConfirmation("publish drive for Google, package 20 LPA, 7.5 CGPA"), false);
    assert.equal(isExplicitCopilotConfirmation("Host a drive for Amazon"), false);
    assert.equal(isExplicitCopilotConfirmation("create drive for Microsoft"), false);
    assert.equal(isExplicitCopilotConfirmation("publish a new drive for Infosys"), false);
    assert.equal(isExplicitCopilotConfirmation("Should I publish the drive?"), false);
});

test("copilot stages drive when Groq outputs standard ```json code fence", async () => {
    const driveSpecs = {
        companyName: "Google",
        jobTitle: "Software Engineer",
        package: 25,
        minimumCGPA: 8.0,
        maximumBacklogs: 0,
        eligibleBranches: ["CSE", "ISE"],
    };

    const response = await processAdminCopilotPrompt({
        prompt: "Host a drive for Google, 25 LPA, 8.0 CGPA, 0 backlogs, CSE and ISE",
        loadContext: async () => ({
            available: true,
            activeDrives: [],
            approvedPrograms: ["CSE", "ISE"],
            activeSessionYear: 2027,
        }),
        loadQueryContext: async () => ({ text: "" }),
        generateAnswer: async () => ({
            text: `Here is the staged drive details:\n\n\`\`\`json\n${JSON.stringify({
                action: "DRIVE_READY",
                driveParams: driveSpecs,
            })}\n\`\`\``,
        }),
        getEligibleCount: async () => 15,
    });

    assert.equal(response.action, "DRIVE_READY");
    assert.equal(response.driveParams.companyName, "Google");
    assert.equal(response.driveParams.package, 25);
    assert.equal(response.driveParams.eligibleCount, 15);
});
