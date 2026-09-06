import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import {User} from "../models/user.models.js"
export const verifyJWT= asyncHandler( async (req, res, next)=>{
    try {
        const token =
            req.header("Authorization")?.replace("Bearer ", "")?.trim() ||
            req.cookies?.accessToken;
        if(!token) {
            throw new ApiError(401, "unauthoirzed request")
        }
        const decodedToken  = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
        if(!user) {
            throw new ApiError(401, "invalid access token ")
        }
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid access token")
    }

})
export const verifyAdmin = (req, res, next) => {

    if (!req.user) {
        throw new ApiError(401, "Unauthorized request");
    }

    if (req.user.role !== "admin") {
        throw new ApiError(
            403,
            "Access denied. Admin privileges required."
        );
    }

    next();
};

export const verifyStudent = (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized request");
    }

    if (req.user.role !== "student") {
        throw new ApiError(
            403,
            "Access denied. Student access only."
        );
    }

    next();
};

export const verifyRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized request");
        }

        if (!roles.includes(req.user.role)) {
            throw new ApiError(
                403,
                `Access denied. Requires one of: ${roles.join(", ")}`
            );
        }

        next();
    };
};