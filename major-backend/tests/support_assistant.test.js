import assert from "node:assert/strict";
import test from "node:test";
import { generateSupportAnswer, parseAssistantOutput, SUPPORT_MODEL } from "../src/services/supportAssistant.service.js";

test("support assistant parses structured Gemini responses and clamps confidence", () => {
    const result = parseAssistantOutput({ output_text: JSON.stringify({
        answer: "Check the live drive details in Placement Drives.",
        confidence: 1.8,
        handoffRecommended: false,
        reason: "General portal guidance",
    }) });
    assert.equal(result.answer, "Check the live drive details in Placement Drives.");
    assert.equal(result.confidence, 1);
    assert.equal(result.handoffRecommended, false);
});

test("support assistant requests grounded JSON without storing the conversation", async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    let request;
    try {
        const result = await generateSupportAnswer({
            messages: [{ senderRole: "student", content: "How do I apply?" }],
            liveDrives: [{ role: "Engineer", company: "Example Co" }],
            fetchImpl: async (url, options) => {
                request = { url, options, body: JSON.parse(options.body) };
                return { ok: true, json: async () => ({ output_text: JSON.stringify({
                    answer: "Open the drive and select Apply.", confidence: 0.93, handoffRecommended: false, reason: "Portal help",
                }) }) };
            },
        });
        assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/interactions");
        assert.equal(request.options.headers["x-goog-api-key"], "test-key");
        assert.equal(request.body.model, SUPPORT_MODEL);
        assert.equal(request.body.store, false);
        assert.match(request.body.input, /Example Co/);
        assert.equal(result.confidence, 0.93);
    } finally {
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
    }
});

test("support assistant fails closed when Gemini is not configured", async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    const previousGoogleKey = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
        await assert.rejects(() => generateSupportAnswer({ messages: [], liveDrives: [], fetchImpl: async () => { throw new Error("must not call provider"); } }), /not configured/);
    } finally {
        if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
        if (previousGoogleKey !== undefined) process.env.GOOGLE_API_KEY = previousGoogleKey;
    }
});
