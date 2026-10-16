import { Router } from "express";
import { verifyJWT, verifyAdmin } from "../middlewares/auth.middleware.js";
import {
    createPlacementSession,
    getAllPlacementSessions,
    getActivePlacementSession,
    getPlacementSessionById,
    updatePlacementSession,
    setActivePlacementSession,
    closePlacementSession,
    archivePlacementSession,
    previewSessionBackfill,
    executeSessionBackfill,
    transferStudentsSession
} from "../controllers/placementSession.controller.js";

const router = Router();

// Public / Authenticated read routes
router.route("/").get(getAllPlacementSessions);
router.route("/active").get(getActivePlacementSession);

// Specific static admin routes (MUST come before /:sessionId)
router.route("/").post(verifyJWT, verifyAdmin, createPlacementSession);
router.route("/backfill/preview").get(verifyJWT, verifyAdmin, previewSessionBackfill);
router.route("/backfill/execute").post(verifyJWT, verifyAdmin, executeSessionBackfill);
router.route("/transfer-students").post(verifyJWT, verifyAdmin, transferStudentsSession);

// Dynamic session ID routes
router.route("/:sessionId").get(verifyJWT, getPlacementSessionById);
router.route("/:sessionId").patch(verifyJWT, verifyAdmin, updatePlacementSession);
router.route("/:sessionId/activate").patch(verifyJWT, verifyAdmin, setActivePlacementSession);
router.route("/:sessionId/close").patch(verifyJWT, verifyAdmin, closePlacementSession);
router.route("/:sessionId/archive").patch(verifyJWT, verifyAdmin, archivePlacementSession);

export default router;
