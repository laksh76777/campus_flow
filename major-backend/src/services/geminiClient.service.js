/**
 * Centralized AI Client - Routed through Groq AI for high-performance inference.
 * Re-exports callGroqAI as callGeminiAI for backward compatibility.
 */
import { callGroqAI } from "./groqClient.service.js";

export const callGeminiAI = callGroqAI;
export const callAI = callGroqAI;
export { callGroqAI };
