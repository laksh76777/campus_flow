import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import {
    getDepartments,
    createDepartment,
    updateDepartment,
    toggleDepartmentStatus,
    seedDepartments
} from "../controllers/department.controller.js";

const router = Router();

// Public / Authenticated read routes for registration dropdown & filtering
router.route("/").get(getDepartments);

// Admin-managed routes
router.route("/").post(verifyJWT, verifyAdmin, createDepartment);
router.route("/seed-defaults").post(verifyJWT, verifyAdmin, seedDepartments);
router.route("/:id").patch(verifyJWT, verifyAdmin, updateDepartment);
router.route("/:id/toggle-status").patch(verifyJWT, verifyAdmin, toggleDepartmentStatus);

export default router;
