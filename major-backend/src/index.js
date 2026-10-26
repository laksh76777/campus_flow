import "../env.js";
import mongoose from "mongoose";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import { validateEnvironment } from "./config.js";
import { startReminderScheduler, stopReminderScheduler } from "./services/reminderScheduler.service.js";
import { isGroqConfigured } from "./services/groqClient.service.js";
import { isCloudinaryConfigured } from "./utils/cloudinary.js";
import { isSmtpConfigured } from "./utils/mailService.js";

// Report optional integrations at boot (names only, never values) so a missing
// key is visible in the deployment logs instead of surfacing as a runtime error.
const reportOptionalIntegrations = () => {
    const integrations = {
        "Groq AI (GROQ_API_KEY)": isGroqConfigured(),
        "Cloudinary file storage (CLOUDINARY_*)": isCloudinaryConfigured(),
        "Email delivery (EMAIL_USER/EMAIL_PASS or RESEND_API_KEY)": isSmtpConfigured() || Boolean(process.env.RESEND_API_KEY),
    };
    for (const [name, ready] of Object.entries(integrations)) {
        console.log(`[Startup] ${name}: ${ready ? "configured" : "NOT configured"}`);
    }
};

let server;

const shutdown = (signal) => {
    console.log(`[Shutdown] ${signal} received; stopping scheduler and closing connections.`);
    stopReminderScheduler();
    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();
    const closeDb = () =>
        mongoose.connection.close(false).finally(() => process.exit(0));
    if (server) server.close(closeDb);
    else closeDb();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
    console.error("[Process] Unhandled promise rejection:", reason?.message || reason);
});

try {
    validateEnvironment();
    reportOptionalIntegrations();
    await connectDB();
    startReminderScheduler();

    const port = Number(process.env.PORT) || 8000;
    server = app.listen(port, "0.0.0.0", () => {
        console.log(`Server is listening on port ${port}`);
    });
} catch (error) {
    const errorCode = error?.code || error?.name || "ConfigurationError";
    console.error(
        `Server startup failed (${errorCode}): ${error?.message || error}. Check required environment settings and MongoDB connectivity.`
    );
    process.exitCode = 1;
}
