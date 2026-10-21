const configuredApiUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

const isProduction = Boolean(import.meta.env.PROD);
const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(configuredApiUrl);

export const API_CONFIGURATION_ERROR =
  isProduction && (!configuredApiUrl || isLocalhostUrl)
    ? "Production configuration error: VITE_API_URL environment variable is required and must point to your deployed backend (e.g., https://your-backend.onrender.com/api/v1)."
    : null;

// Normalize: ensure the API base URL has /api/v1
const resolveBaseUrl = (rawUrl) => {
  if (!rawUrl) return "http://localhost:8000/api/v1";
  const trimmed = rawUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/api/v1")) return trimmed;
  if (trimmed.endsWith("/api")) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
};

export const API_BASE_URL = resolveBaseUrl(configuredApiUrl);


