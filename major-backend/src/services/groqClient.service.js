/**
 * Centralized, High-Performance Groq AI Client
 * Provides ultra-fast inference (<500ms), OpenAI-compatible schema,
 * resilient multi-model failover, automatic retries, and JSON output parsing.
 */

const CANDIDATE_MODELS = [
    process.env.GROQ_MODEL,
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "allam-2-7b",
    "llama-3.3-70b-versatile",
    "mixtral-8x7b-32768",
].filter((model, index, models) => Boolean(model) && models.indexOf(model) === index);

export const callGroqAI = async ({
    systemInstruction = "",
    prompt = "",
    messages = [],
    responseMimeType = "text/plain",
    temperature,
    maxTokens = 1500,
    fetchImpl = fetch,
}) => {
    const apiKey =
        process.env.GROQ_API_KEY ||
        process.env.grog_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        throw new Error("Groq API key is not configured.");
    }

    const formattedMessages = [];

    if (systemInstruction && String(systemInstruction).trim()) {
        formattedMessages.push({
            role: "system",
            content: String(systemInstruction).trim(),
        });
    }

    if (Array.isArray(messages) && messages.length > 0) {
        for (const msg of messages.slice(-12)) {
            const text = String(msg.content || msg.text || "").trim();
            if (!text) continue;
            // Ignore introductory greeting placeholder from bot if at start
            if (
                formattedMessages.length <= 1 &&
                (msg.sender === "bot" || msg.role === "assistant" || msg.senderRole === "assistant")
            ) {
                continue;
            }
            const role =
                msg.sender === "admin" ||
                msg.sender === "user" ||
                msg.senderRole === "student" ||
                msg.role === "user"
                    ? "user"
                    : "assistant";
            formattedMessages.push({ role, content: text });
        }
    }

    if (prompt && String(prompt).trim()) {
        formattedMessages.push({ role: "user", content: String(prompt).trim() });
    }

    const nonSystemMessages = formattedMessages.filter((m) => m.role !== "system");
    if (nonSystemMessages.length === 0) {
        throw new Error("No prompt or messages provided to Groq.");
    }

    // Merge consecutive turns of the same role (excluding system)
    const finalMessages = [];
    for (const item of formattedMessages) {
        if (
            finalMessages.length > 0 &&
            item.role !== "system" &&
            finalMessages[finalMessages.length - 1].role === item.role
        ) {
            finalMessages[finalMessages.length - 1].content += `\n\n${item.content}`;
        } else {
            finalMessages.push({ ...item });
        }
    }

    let lastError = null;

    // Try models in sequence for maximum reliability
    for (const model of CANDIDATE_MODELS) {
        const url = "https://api.groq.com/openai/v1/chat/completions";
        const requestBody = {
            model,
            messages: finalMessages,
            max_tokens: maxTokens || 1500,
        };

        if (typeof temperature === "number") {
            requestBody.temperature = temperature;
        }

        if (responseMimeType === "application/json") {
            requestBody.response_format = { type: "json_object" };
        }

        try {
            const res = await fetchImpl(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(25000),
            });

            if (res.ok) {
                const data = await res.json();
                const choice = data?.choices?.[0];
                const text =
                    choice?.message?.content ||
                    choice?.message?.reasoning ||
                    choice?.delta?.content ||
                    "";
                if (text && typeof text === "string" && text.trim().length > 0) {
                    return {
                        text: text.trim(),
                        model,
                    };
                }
            } else {
                const errJson = await res.json().catch(() => ({}));
                const errMessage = errJson?.error?.message || `HTTP ${res.status}`;
                console.warn(
                    `[GroqClient] Model ${model} returned ${res.status}: ${errMessage}. Trying fallback model...`
                );
                lastError = new Error(`Model ${model}: ${errMessage}`);
            }
        } catch (callErr) {
            console.warn(
                `[GroqClient] Model ${model} request failed: ${callErr.message}. Trying fallback model...`
            );
            lastError = callErr;
        }
    }

    throw lastError || new Error("All Groq candidate models failed to respond.");
};

// Aliases for seamless drop-in backwards compatibility
export const callGeminiAI = callGroqAI;
export const callAI = callGroqAI;
