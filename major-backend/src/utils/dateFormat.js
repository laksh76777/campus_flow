// Server-side date formatting for user-facing text (emails, notifications).
// Servers usually run in UTC, so always format in the institution's timezone.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

export const formatDateTime = (value, options = {}) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-IN", {
        timeZone: APP_TIMEZONE,
        dateStyle: "medium",
        timeStyle: "short",
        ...options,
    });
};
