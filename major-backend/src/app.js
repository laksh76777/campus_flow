 import express from 'express';
 import cors from 'cors';
 import cookieParser from 'cookie-parser';
 const app = express();
 const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.CORS_ORIGIN
];
app.get("/",(req,res)=>{
    res.send("backend is running");
})
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));
app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))  
app.use(cookieParser())
import userRouter from "./routes/user.routes.js"
import studentRouter from "./routes/studentProfile.routes.js"
import companyRouter from "./routes/company.routes.js"
import adminRouter from "./routes/admin.routes.js"
import  placementDriveRouter  from './routes/placementDrive.routes.js';
import applicationRouter from "./routes/application.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"
app.use("/api/v1/users",userRouter);
app.use("/api/v1/studentprofile",studentRouter);
app.use("/api/v1/company",companyRouter);
app.use("/api/v1/admin",adminRouter);

app.use(
    "/api/v1/placementdrive",
    placementDriveRouter
);
app.use(
    "/api/v1/application",
    applicationRouter
);
app.use(
    "/api/v1/dashboard",
    dashboardRouter
);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
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
