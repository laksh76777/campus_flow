export const REQUIRED_ENVIRONMENT_VARIABLES = [
    "MONGODB_URI",
    "ACCESS_TOKEN_SECRET",
    "ACCESS_TOKEN_EXPIRY",
    "REFRESH_TOKEN_SECRET",
    "REFRESH_TOKEN_EXPIRY",
    "ADMIN_SECRET_KEY"
];

export function validateEnvironment(environment = process.env) {
    const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter(
        (name) => !environment[name]?.trim()
    );

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
    }

    if (environment.NODE_ENV === "production") {
        const allowedOrigins = (environment.CORS_ORIGIN || "")
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean);
        if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
            throw new Error(
                "Production requires explicit HTTPS origins in CORS_ORIGIN."
            );
        }

        const invalidOrigins = allowedOrigins.filter((origin) => {
            try {
                const parsed = new URL(origin);
                return parsed.protocol !== "https:" || parsed.origin !== origin;
            } catch {
                return true;
            }
        });
        if (invalidOrigins.length > 0) {
            throw new Error(
                "Production CORS_ORIGIN entries must be exact HTTPS origins without paths."
            );
        }
    }

    return environment;
}
