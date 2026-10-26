export const getAuthCookieOptions = (environment = process.env.NODE_ENV) => ({
    httpOnly: true,
    secure: environment === "production",
    sameSite: environment === "production" ? "none" : "lax",
});
