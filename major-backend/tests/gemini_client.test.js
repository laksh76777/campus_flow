import assert from "node:assert/strict";
import test from "node:test";
import { callGeminiAI } from "../src/services/geminiClient.service.js";

test("Gemini client sends the key in a header and uses Gemini 3 compatible generation fields", async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    let request;
    try {
        const result = await callGeminiAI({
            prompt: "Summarize the active drives.",
            fetchImpl: async (url, options) => {
                request = { url, options, body: JSON.parse(options.body) };
                return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "There are three active drives." }] } }] }) };
            },
        });
        assert.equal(result.text, "There are three active drives.");
        assert.equal(request.options.headers["x-goog-api-key"], "test-key");
        assert.equal(request.url.includes("test-key"), false);
        assert.equal("temperature" in request.body.generationConfig, false);
    } finally {
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
    }
});

test("Gemini client fails closed when no API key is configured", async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    const previousGoogleKey = process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
        await assert.rejects(() => callGeminiAI({ prompt: "Hi", fetchImpl: async () => { throw new Error("must not call provider"); } }), /not configured/);
    } finally {
        if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
        if (previousGoogleKey !== undefined) process.env.GOOGLE_API_KEY = previousGoogleKey;
    }
});
