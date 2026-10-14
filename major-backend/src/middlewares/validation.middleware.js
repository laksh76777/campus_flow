import { ApiError } from "../utils/ApiError.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegister = (req, res, next) => {
    const { fullName, email, password, confirmPassword, usn, enrollmentNumber, role } = req.body;

    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
        throw new ApiError(400, "Full name is required (at least 2 characters)");
    }

    if (!email || !EMAIL_REGEX.test(email.trim())) {
        throw new ApiError(400, "A valid email address is required");
    }

    if (!password || typeof password !== "string" || password.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters long");
    }

    if (confirmPassword !== undefined && confirmPassword !== password) {
        throw new ApiError(400, "Password and confirm password do not match");
    }

    const rawUsn = usn || enrollmentNumber;
    if (rawUsn !== undefined && (typeof rawUsn !== "string" || rawUsn.trim().length < 3)) {
        throw new ApiError(400, "USN / Enrollment Number must be at least 3 characters long");
    }

    // Role protection: Admin provisioning is strictly prohibited on the public user registration endpoint
    if (role && role.toLowerCase().trim() === "admin") {
        throw new ApiError(
            403,
            "Admin registration is prohibited on this endpoint. Administrative accounts must be provisioned via the secure Admin Portal."
        );
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
        "withdrawn",
        "on_hold",
        "offer_received",
        "offer_accepted",
        "offer_declined"
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
