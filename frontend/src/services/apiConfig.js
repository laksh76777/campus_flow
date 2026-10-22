const isProduction = Boolean(import.meta.env.PROD);

// In local development, if VITE_API_URL points to an un-deployed remote Render backend or is blank,
// route API requests to the active local dev backend at http://localhost:8000/api/v1.
const getResolvedBaseUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  
  if (!isProduction) {
    if (!envUrl || envUrl.includes("onrender.com") || envUrl.includes("localhost:8000") || envUrl.includes("127.0.0.1:8000")) {
      return "http://localhost:8000/api/v1";
    }
  }

  if (!envUrl) return "http://localhost:8000/api/v1";
  if (envUrl.endsWith("/api/v1")) return envUrl;
  if (envUrl.endsWith("/api")) return `${envUrl}/v1`;
  return `${envUrl}/api/v1`;
};

export const API_BASE_URL = getResolvedBaseUrl();

const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(API_BASE_URL);

export const API_CONFIGURATION_ERROR =
  isProduction && (!API_BASE_URL || isLocalhostUrl)
    ? "Production configuration error: VITE_API_URL environment variable is required and must point to your deployed backend (e.g., https://your-backend.onrender.com/api/v1)."
    : null;


