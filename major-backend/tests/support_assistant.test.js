import assert from "node:assert/strict";
import test from "node:test";
import { generateSupportAnswer, parseAssistantOutput, SUPPORT_MODEL } from "../src/services/supportAssistant.service.js";

test("support assistant parses structured Groq AI responses and clamps confidence", () => {
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

test("support assistant requests grounded JSON from Groq AI", async () => {
    const previousKey = process.env.GROQ_API_KEY;
    const previousGrog = process.env.grog_API_KEY;
    process.env.GROQ_API_KEY = "test-key";
    let request;
    try {
        const result = await generateSupportAnswer({
            messages: [{ senderRole: "student", content: "How do I apply?" }],
            liveDrives: [{ role: "Engineer", company: "Example Co" }],
            fetchImpl: async (url, options) => {
                request = { url, options, body: JSON.parse(options.body) };
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                            message: {
                                content: JSON.stringify({
                                    answer: "Open the drive and select Apply.",
                                    confidence: 0.93,
                                    handoffRecommended: false,
                                    reason: "Portal help",
                                }),
                            },
                        }],
                    }),
                };
            },
        });
        assert.equal(request.url, "https://api.groq.com/openai/v1/chat/completions");
        assert.equal(request.options.headers["Authorization"], "Bearer test-key");
        assert.equal(request.body.model, SUPPORT_MODEL);
        assert.equal(request.body.response_format?.type, "json_object");
        assert.equal(result.confidence, 0.93);
    } finally {
        if (previousKey === undefined) delete process.env.GROQ_API_KEY;
        else process.env.GROQ_API_KEY = previousKey;
        if (previousGrog === undefined) delete process.env.grog_API_KEY;
        else process.env.grog_API_KEY = previousGrog;
    }
});

test("support assistant fails closed when Groq AI is not configured", async () => {
    const previousGroq = process.env.GROQ_API_KEY;
    const previousGrog = process.env.grog_API_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousGoogle = process.env.GOOGLE_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.grog_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
        await assert.rejects(
            () => generateSupportAnswer({ messages: [], liveDrives: [], fetchImpl: async () => { throw new Error("must not call provider"); } }),
            /not configured/
        );
    } finally {
        if (previousGroq !== undefined) process.env.GROQ_API_KEY = previousGroq;
        if (previousGrog !== undefined) process.env.grog_API_KEY = previousGrog;
        if (previousGemini !== undefined) process.env.GEMINI_API_KEY = previousGemini;
        if (previousGoogle !== undefined) process.env.GOOGLE_API_KEY = previousGoogle;
    }
});
