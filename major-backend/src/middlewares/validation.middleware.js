import { ApiError } from "../utils/ApiError.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegister = (req, res, next) => {
    const { fullName, email, password, role, adminSecretKey } = req.body;

    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
        throw new ApiError(400, "Full name is required (at least 2 characters)");
    }

    if (!email || !EMAIL_REGEX.test(email.trim())) {
        throw new ApiError(400, "A valid email address is required");
    }

    if (!password || typeof password !== "string" || password.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters long");
    }

    const assignedRole = role ? role.toLowerCase().trim() : "student";
    if (!["student", "admin"].includes(assignedRole)) {
        throw new ApiError(400, "Role must be either 'student' or 'admin'");
    }

    // Role protection: Require admin passkey when registering an admin account
    if (assignedRole === "admin") {
        const expectedSecret = process.env.ADMIN_SECRET_KEY || "TPO_ADMIN_2026";
        if (!adminSecretKey || adminSecretKey.trim() !== expectedSecret) {
            throw new ApiError(
                403,
                "Unauthorized: Valid admin secret passkey is required to register as Administrator."
            );
        }
    }

    next();
};

export const validateLogin = (req, res, next) => {
    const { email, rollNumber, password } = req.body;

    if (!password || typeof password !== "string" || password.trim() === "") {
        throw new ApiError(400, "Password is required");
    }

    if ((!email || email.trim() === "") && (!rollNumber || rollNumber.trim() === "")) {
        throw new ApiError(400, "Email or Roll Number is required to log in");
    }

    next();
};

export const validateApplicationStatus = (req, res, next) => {
    const { status, interviewDate, offeredPackage } = req.body;

    const validStatuses = [
        "applied",
        "shortlisted",
        "interview",
        "selected",
        "rejected",
        "withdrawn"
    ];

    if (!status || !validStatuses.includes(status)) {
        throw new ApiError(
            400,
            `Invalid status. Must be one of: ${validStatuses.join(", ")}`
        );
    }

    if (status === "interview" && interviewDate) {
        const parsed = new Date(interviewDate);
        if (isNaN(parsed.getTime())) {
            throw new ApiError(400, "Invalid interview date format");
        }
    }

    if (status === "selected" && offeredPackage !== undefined && offeredPackage !== null) {
        const pkg = Number(offeredPackage);
        if (isNaN(pkg) || pkg < 0) {
            throw new ApiError(400, "Offered package (CTC) must be a positive number");
        }
    }

    next();
};

export const validateDrive = (req, res, next) => {
    const { companyName, jobTitle, jobRole, batch, deadline, minCgpa } = req.body;

    if (!companyName || companyName.trim() === "") {
        throw new ApiError(400, "Company name is required");
    }

    if (!jobTitle || jobTitle.trim() === "") {
        throw new ApiError(400, "Job title is required");
    }

    if (!jobRole || jobRole.trim() === "") {
        throw new ApiError(400, "Job role is required");
    }

    if (!batch || isNaN(Number(batch))) {
        throw new ApiError(400, "Valid graduation batch year is required");
    }

    if (!deadline || isNaN(new Date(deadline).getTime())) {
        throw new ApiError(400, "Valid application deadline date is required");
    }

    if (minCgpa !== undefined && minCgpa !== null) {
        const cgpa = Number(minCgpa);
        if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
            throw new ApiError(400, "Minimum CGPA must be between 0.0 and 10.0");
        }
    }

    next();
};
