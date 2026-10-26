import assert from "node:assert/strict";
import test from "node:test";
import { callGroqAI, callGeminiAI } from "../src/services/groqClient.service.js";

test("Groq client sends the key in an Authorization Bearer header and uses OpenAI-compatible schema", async () => {
    const previousKey = process.env.GROQ_API_KEY;
    const previousGrogKey = process.env.grog_API_KEY;
    process.env.GROQ_API_KEY = "test-groq-key";
    let request;
    try {
        const result = await callGroqAI({
            prompt: "Summarize the active drives.",
            fetchImpl: async (url, options) => {
                request = { url, options, body: JSON.parse(options.body) };
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: "There are three active drives." } }],
                    }),
                };
            },
        });
        assert.equal(result.text, "There are three active drives.");
        assert.equal(request.url, "https://api.groq.com/openai/v1/chat/completions");
        assert.equal(request.options.headers["Authorization"], "Bearer test-groq-key");
        assert.equal(request.body.messages[0].role, "user");
        assert.equal(request.body.messages[0].content, "Summarize the active drives.");
    } finally {
        if (previousKey === undefined) delete process.env.GROQ_API_KEY;
        else process.env.GROQ_API_KEY = previousKey;
        if (previousGrogKey === undefined) delete process.env.grog_API_KEY;
        else process.env.grog_API_KEY = previousGrogKey;
    }
});

test("Groq client alias callGeminiAI forwards seamlessly", async () => {
    const previousKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "test-groq-key";
    try {
        const result = await callGeminiAI({
            prompt: "Test query",
            fetchImpl: async () => ({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: "OK" } }],
                }),
            }),
        });
        assert.equal(result.text, "OK");
    } finally {
        if (previousKey === undefined) delete process.env.GROQ_API_KEY;
        else process.env.GROQ_API_KEY = previousKey;
    }
});

test("Groq client fails closed when no API key is configured", async () => {
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
            () =>
                callGroqAI({
                    prompt: "Hi",
                    fetchImpl: async () => {
                        throw new Error("must not call provider");
                    },
                }),
            /not configured/
        );
    } finally {
        if (previousGroq !== undefined) process.env.GROQ_API_KEY = previousGroq;
        if (previousGrog !== undefined) process.env.grog_API_KEY = previousGrog;
        if (previousGemini !== undefined) process.env.GEMINI_API_KEY = previousGemini;
        if (previousGoogle !== undefined) process.env.GOOGLE_API_KEY = previousGoogle;
    }
});
