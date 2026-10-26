/**
 * Centralized Groq AI client (OpenAI-compatible chat completions API).
 *
 * - Reads only Groq credentials (GROQ_API_KEY; the misspelled grog_API_KEY is
 *   still accepted for existing deployments). Keys for other providers are
 *   never forwarded to Groq.
 * - Fails over across candidate models on model/availability errors, but stops
 *   immediately on authentication errors and respects an overall time budget.
 * - Throws GroqAIError with a stable `code` so callers can report failures
 *   truthfully (NOT_CONFIGURED, AUTH_FAILED, RATE_LIMITED, TIMEOUT,
 *   EMPTY_RESPONSE, PROVIDER_ERROR).
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const PER_REQUEST_TIMEOUT_MS = 20000;
const TOTAL_BUDGET_MS = 45000;

const DEFAULT_FALLBACK_MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "llama-3.1-8b-instant",
];

export class GroqAIError extends Error {
    constructor(code, message, { status, model } = {}) {
        super(message);
        this.name = "GroqAIError";
        this.code = code;
        this.status = status;
        this.model = model;
    }
}

export const getGroqApiKey = () => {
    const key = (process.env.GROQ_API_KEY || process.env.grog_API_KEY || "").trim();
    return key && !/^your[_-]/i.test(key) ? key : "";
};

export const isGroqConfigured = () => Boolean(getGroqApiKey());

export const getCandidateModels = () => {
    const configured = (process.env.GROQ_MODEL || "").split(",").map((m) => m.trim());
    const fallbacks = (process.env.GROQ_FALLBACK_MODELS || "").split(",").map((m) => m.trim());
    const list = [...configured, ...(fallbacks.some(Boolean) ? fallbacks : DEFAULT_FALLBACK_MODELS)];
    return list.filter((model, index) => model && list.indexOf(model) === index);
};

const buildMessages = (systemInstruction, messages, prompt) => {
    const formatted = [];
    if (systemInstruction && String(systemInstruction).trim()) {
        formatted.push({ role: "system", content: String(systemInstruction).trim() });
    }

    for (const msg of (Array.isArray(messages) ? messages : []).slice(-12)) {
        const text = String(msg?.content || msg?.text || "").trim();
        if (!text) continue;
        const isUser =
            msg.sender === "admin" ||
            msg.sender === "user" ||
            msg.senderRole === "student" ||
            msg.role === "user";
        // A conversation must not open with an assistant greeting
        if (!isUser && !formatted.some((m) => m.role !== "system")) continue;
        formatted.push({ role: isUser ? "user" : "assistant", content: text });
    }

    if (prompt && String(prompt).trim()) {
        formatted.push({ role: "user", content: String(prompt).trim() });
    }

    if (!formatted.some((m) => m.role !== "system")) {
        throw new GroqAIError("NO_INPUT", "No prompt or messages provided to Groq.");
    }

    // Merge consecutive turns of the same role (excluding system)
    const merged = [];
    for (const item of formatted) {
        const last = merged[merged.length - 1];
        if (last && item.role !== "system" && last.role === item.role) {
            last.content += `\n\n${item.content}`;
        } else {
            merged.push({ ...item });
        }
    }
    return merged;
};

// Some reasoning models wrap hidden thinking in <think> tags inside content.
const stripReasoning = (text) => text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

export const callGroqAI = async ({
    systemInstruction = "",
    prompt = "",
    messages = [],
    responseMimeType = "text/plain",
    temperature,
    maxTokens = 1500,
    fetchImpl = fetch,
    models = getCandidateModels(),
}) => {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
        throw new GroqAIError("NOT_CONFIGURED", "Groq API key is not configured.");
    }

    const finalMessages = buildMessages(systemInstruction, messages, prompt);
    const startedAt = Date.now();
    let lastError = null;

    for (const model of models) {
        const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
        if (remaining <= 1000) {
            lastError = new GroqAIError("TIMEOUT", "The AI provider did not respond in time.", { model });
            break;
        }

        const requestBody = {
            model,
            messages: finalMessages,
            max_tokens: maxTokens || 1500,
        };
        if (typeof temperature === "number") requestBody.temperature = temperature;
        if (responseMimeType === "application/json") requestBody.response_format = { type: "json_object" };

        let res;
        try {
            res = await fetchImpl(GROQ_CHAT_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(Math.min(PER_REQUEST_TIMEOUT_MS, remaining)),
            });
        } catch (callErr) {
            const timedOut = callErr?.name === "TimeoutError" || callErr?.name === "AbortError";
            console.warn(`[GroqClient] Model ${model} request failed: ${timedOut ? "timeout" : callErr.message}`);
            lastError = new GroqAIError(timedOut ? "TIMEOUT" : "PROVIDER_ERROR", timedOut ? "The AI provider did not respond in time." : "Could not reach the AI provider.", { model });
            continue;
        }

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const providerMessage = errJson?.error?.message || `HTTP ${res.status}`;
            console.warn(`[GroqClient] Model ${model} returned ${res.status}: ${providerMessage}`);
            if (res.status === 401 || res.status === 403) {
                // Every model would fail the same way; don't burn the time budget.
                throw new GroqAIError("AUTH_FAILED", "The AI provider rejected the configured API key.", { status: res.status, model });
            }
            lastError = new GroqAIError(
                res.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR",
                res.status === 429 ? "The AI provider rate limit or quota was reached." : `The AI provider returned an error (${res.status}).`,
                { status: res.status, model }
            );
            continue;
        }

        const data = await res.json().catch(() => null);
        const content = data?.choices?.[0]?.message?.content;
        const text = typeof content === "string" ? stripReasoning(content) : "";
        if (text) {
            return { text, model };
        }
        // Never fall back to `message.reasoning`: that is the model's hidden chain of thought.
        lastError = new GroqAIError("EMPTY_RESPONSE", "The AI provider returned an empty response.", { model });
    }

    throw lastError || new GroqAIError("PROVIDER_ERROR", "All Groq candidate models failed to respond.");
};

/** User-facing explanation for an AI failure (no internals or secrets). */
export const describeAIFailure = (error) => {
    switch (error?.code) {
        case "NOT_CONFIGURED":
            return "The AI assistant is not configured on this server yet.";
        case "AUTH_FAILED":
            return "The AI assistant's provider credentials were rejected. An administrator needs to update them.";
        case "RATE_LIMITED":
            return "The AI assistant is receiving too many requests right now. Please try again in a minute.";
        case "TIMEOUT":
            return "The AI assistant took too long to respond. Please try again.";
        case "EMPTY_RESPONSE":
            return "The AI assistant returned an empty answer. Please try rephrasing your question.";
        default:
            return "The AI assistant is temporarily unavailable. Please try again shortly.";
    }
};

// Aliases for seamless drop-in backwards compatibility
export const callGeminiAI = callGroqAI;
export const callAI = callGroqAI;
