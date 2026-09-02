import { Router } from "express";
import {
    createCompany,getAllCompanies,getCompanyById,updateCompany,updateCompanyLogo,deactivateCompany,reactivateCompany
} from "../controllers/company.controller.js";

import {
    verifyJWT,
    verifyAdmin
} from "../middlewares/auth.middleware.js";

import { upload } from "../middlewares/multer.middleware.js";

const router = Router();


router
    .route("/create-company")
    .post(
        verifyJWT,
        verifyAdmin,
        upload.single("companyLogo"),
        createCompany
    );
router
    .route("/all-companies")
    .get(
        verifyJWT,
        getAllCompanies
    );
router
    .route("/:companyId")
    .get(
        verifyJWT,
        getCompanyById
    );
router
    .route("/:companyId")
    .patch(
        verifyJWT,
        verifyAdmin,
        updateCompany
    );
router
    .route("/:companyId/logo")
    .patch(
        verifyJWT,
        verifyAdmin,
        upload.single("companyLogo"),
        updateCompanyLogo
    );
router
    .route("/:companyId/deactivate")
    .patch(
        verifyJWT,
        verifyAdmin,
        deactivateCompany
    );
router
    .route("/:companyId/reactivate")
    .patch(
        verifyJWT,
        verifyAdmin,
        reactivateCompany
    );
export default router;