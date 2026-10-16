const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_CONFIGURATION_ERROR =
  import.meta.env.PROD && !configuredApiUrl
    ? "VITE_API_URL must be configured for production builds (include the API base path, for example /api/v1)."
    : null;

export const API_BASE_URL = (
  configuredApiUrl || (import.meta.env.DEV ? "http://localhost:8000/api/v1" : "")
).replace(/\/+$/, "");
