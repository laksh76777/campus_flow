import { Router } from "express";

import {
    getDashboardStats,getStudentDashboardStats
} from "../controllers/dashboard.controller.js";

import {
    verifyJWT,
    verifyAdmin
} from "../middlewares/auth.middleware.js";

const router = Router();

router
    .route("/stats")
    .get(
        verifyJWT,
        verifyAdmin,
        getDashboardStats
    );
router
    .route("/student/stats")
    .get(
        verifyJWT,
        getStudentDashboardStats
    );


export default router;