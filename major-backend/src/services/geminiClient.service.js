/**
 * Centralized, High-Performance Google Gemini AI Client
 * Provides resilient multi-model failover, automatic retries, and JSON output parsing.
 */

const CANDIDATE_MODELS = [
    process.env.GEMINI_MODEL,
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
].filter((model, index, models) => Boolean(model) && models.indexOf(model) === index);

export const callGeminiAI = async ({
    systemInstruction = "",
    prompt = "",
    messages = [],
    responseMimeType = "text/plain",
    maxTokens = 1500,
    fetchImpl = fetch,
}) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }

    const rawItems = [];
    if (Array.isArray(messages) && messages.length > 0) {
        for (const msg of messages.slice(-12)) {
            const text = String(msg.content || msg.text || "").trim();
            if (!text) continue;
            // Ignore introductory greeting placeholder from bot if at start
            if (rawItems.length === 0 && (msg.sender === "bot" || msg.role === "model" || msg.senderRole === "assistant")) {
                continue;
            }
            const role =
                msg.sender === "admin" ||
                    msg.sender === "user" ||
                    msg.senderRole === "student" ||
                    msg.role === "user"
                    ? "user"
                    : "model";
            rawItems.push({ role, text });
        }
    }

    if (prompt && String(prompt).trim()) {
        rawItems.push({ role: "user", text: String(prompt).trim() });
    }

    if (rawItems.length === 0) {
        throw new Error("No prompt or messages provided to Gemini.");
    }

    // Merge consecutive turns of the same role so Gemini multiturn validation never fails
    const contents = [];
    for (const item of rawItems) {
        if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
            contents[contents.length - 1].parts[0].text += `\n\n${item.text}`;
        } else {
            contents.push({
                role: item.role,
                parts: [{ text: item.text }],
            });
        }
    }

    const payload = {
        contents,
        generationConfig: {
            maxOutputTokens: maxTokens,
        },
    };

    if (systemInstruction) {
        payload.systemInstruction = {
            parts: [{ text: systemInstruction }],
        };
    }

    if (responseMimeType === "application/json") {
        payload.generationConfig.responseMimeType = "application/json";
    }

    let lastError = null;

    // Try models in sequence for maximum reliability against Google 503/404 temporary spikes
    for (const model of CANDIDATE_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        try {
            const res = await fetchImpl(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(25000),
            });

            if (res.ok) {
                const data = await res.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text && typeof text === "string" && text.trim().length > 0) {
                    return {
                        text: text.trim(),
                        model,
                    };
                }
            } else {
                const errJson = await res.json().catch(() => ({}));
                const errMessage = errJson?.error?.message || `HTTP ${res.status}`;
                console.warn(`[GeminiClient] Model ${model} returned ${res.status}: ${errMessage}. Trying fallback model...`);
                lastError = new Error(`Model ${model}: ${errMessage}`);
            }
        } catch (callErr) {
            console.warn(`[GeminiClient] Model ${model} request failed: ${callErr.message}. Trying fallback model...`);
            lastError = callErr;
        }
    }

    throw lastError || new Error("All Gemini candidate models failed to respond.");
};
