import { Router } from "express";
import { verifyJWT,verifyAdmin} from "../middlewares/auth.middleware.js";
import { registerAdmin,loginAdmin,logoutAdmin } from "../controllers/admin.controller.js";

const router = Router();

router.route("/register").post(registerAdmin);
router.route("/login").post(loginAdmin);
router.route("/logout").post(
    verifyJWT,
    verifyAdmin,
    logoutAdmin
);

export default router;