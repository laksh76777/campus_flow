import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { ApiError } from "./utils/ApiError.js";

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

    if (configuredOrigins.includes(normalizedOrigin)) {
        return true;
    }

    if (
        process.env.NODE_ENV !== "production" &&
        (defaultAllowedOrigins.includes(normalizedOrigin) ||
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin))
    ) {
        return true;
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

import { securityHeaders, generalApiLimiter } from "./middlewares/security.middleware.js";

app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(express.json({ limit: "16kb" }));
app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb"
    })
);
app.use(express.static("public"));
app.use(cookieParser());
app.use("/api", generalApiLimiter);

app.get("/", (req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    return res
        .status(databaseReady ? 200 : 503)
        .send(databaseReady ? "backend is running" : "backend database unavailable");
});

app.get("/health", (req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    return res.status(databaseReady ? 200 : 503).json({
        status: databaseReady ? "ok" : "unavailable",
        database: databaseReady ? "connected" : "disconnected"
    });
});

import userRouter from "./routes/user.routes.js";
import studentRouter from "./routes/studentProfile.routes.js";
import companyRouter from "./routes/company.routes.js";
import adminRouter from "./routes/admin.routes.js";
import placementDriveRouter from "./routes/placementDrive.routes.js";
import applicationRouter from "./routes/application.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import sessionRouter from "./routes/placementSession.routes.js";
import departmentRouter from "./routes/department.routes.js";
import excelRouter from "./routes/excel.routes.js";

app.use("/api/v1/users", userRouter);
app.use("/api/v1/studentprofile", studentRouter);
app.use("/api/v1/company", companyRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/placementdrive", placementDriveRouter);
app.use("/api/v1/application", applicationRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/sessions", sessionRouter);
app.use("/api/v1/departments", departmentRouter);
app.use("/api/v1/excel", excelRouter);

app.use((req, res, next) => {
    next(new ApiError(404, `Route not found: ${req.method} ${req.path}`));
});

// Global Error Handler
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const statusCode =
        Number.isInteger(err.statusCode) && err.statusCode >= 400
            ? err.statusCode
            : 500;
    const isServerError = statusCode >= 500;
    if (isServerError) {
        console.error("Unhandled API error", {
            method: req.method,
            path: req.path,
            statusCode,
            errorName: err.name
        });
    }

    return res.status(statusCode).json({
        statusCode,
        success: false,
        message: isServerError ? "Internal Server Error" : err.message,
        errors: isServerError || !Array.isArray(err.errors) ? [] : err.errors
    });
});

export { app };