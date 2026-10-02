import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// Parse configured origins from environment variable (supports comma-separated list)
const configuredOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

const defaultAllowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173"
];

const isOriginAllowed = (origin) => {
    // Allow non-browser requests or requests without Origin header (e.g. Postman, mobile apps, server-to-server)
    if (!origin) return true;

    const normalizedOrigin = origin.replace(/\/$/, "");

    // Allow all if CORS_ORIGIN is '*'
    if (process.env.CORS_ORIGIN === "*" || configuredOrigins.includes("*")) {
        return true;
    }

    // Explicit origins from env or default local dev
    if (
        defaultAllowedOrigins.includes(normalizedOrigin) ||
        configuredOrigins.includes(normalizedOrigin)
    ) {
        return true;
    }

    // Allow any localhost / 127.0.0.1 port for development
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
        return true;
    }

    // Allow all Vercel deployments (preview domains like *-msgcyqj4h.vercel.app and production domains)
    try {
        const parsed = new URL(normalizedOrigin);
        if (
            parsed.protocol === "https:" &&
            (parsed.hostname === "vercel.app" || parsed.hostname.endsWith(".vercel.app"))
        ) {
            return true;
        }
        if (
            parsed.protocol === "https:" &&
            (parsed.hostname === "onrender.com" || parsed.hostname.endsWith(".onrender.com"))
        ) {
            return true;
        }
    } catch {
        // invalid URL format
    }

    return false;
};

const corsOptions = {
    origin: function (origin, callback) {
        if (isOriginAllowed(origin)) {
            return callback(null, true);
        }

        console.warn("Blocked by CORS:", origin);
        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin"
    ],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.get("/", (req, res) => {
    res.send("backend is running");
});

app.use(express.json({ limit: "16kb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb"
    })
);

app.use(express.static("public"));
app.use(cookieParser());

import { securityHeaders, generalApiLimiter } from "./middlewares/security.middleware.js";
app.use(securityHeaders);
app.use("/api", generalApiLimiter);

import userRouter from "./routes/user.routes.js";
import studentRouter from "./routes/studentProfile.routes.js";
import companyRouter from "./routes/company.routes.js";
import adminRouter from "./routes/admin.routes.js";
import placementDriveRouter from "./routes/placementDrive.routes.js";
import applicationRouter from "./routes/application.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

app.use("/api/v1/users", userRouter);
app.use("/api/v1/studentprofile", studentRouter);
app.use("/api/v1/company", companyRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/placementdrive", placementDriveRouter);
app.use("/api/v1/application", applicationRouter);
app.use("/api/v1/dashboard", dashboardRouter);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    return res.status(statusCode).json({
        statusCode,
        success: false,
        message,
        errors: err.errors || []
    });
});

export { app };