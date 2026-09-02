import {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
import { Admin } from "../models/admin.model.js";


const registerAdmin = asyncHandler(async (req, res) => {
    const {fullName,email,password,phone,employeeId,designation,department
    } = req.body;
    if (
        !fullName || !email || !password || !employeeId || !designation
    ) {
        throw new ApiError(
            400,
            "Full name, email, password, employee ID and designation are required"
        );
    }
    const existingUser = await User.findOne({
        email: email.toLowerCase()
    });
    if (existingUser) {
        throw new ApiError(
            409,
            "User with this email already exists"
        );
    }
    const existingAdmin = await Admin.findOne({
        employeeId
    });

    if (existingAdmin) {
        throw new ApiError(
            409,
            "Admin with this employee ID already exists"
        );
    }
    const user = await User.create({
        fullName,
        email: email.toLowerCase(),
        password,
        phone,
        role: "admin"
    });
    const admin = await Admin.create({
        user: user._id,
        employeeId,
        designation,
        department: department || "Training & Placement",
        isPlacementOfficer: true
    });
    const createdUser = await User.findById(user._id)
        .select("-password -refreshToken");
    return res.status(201).json(
        new ApiResponse(
            201,
            {
                user: createdUser,
                admin
            },
            "Admin registered successfully"
        )
    );
});

const loginAdmin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new ApiError(
            400,
            "Email and password are required"
        );
    }
    const user = await User.findOne({
        email: email.toLowerCase()
    });

    if (!user) {
        throw new ApiError(
            404,
            "Admin does not exist"
        );
    }
    if (user.role !== "admin") {
        throw new ApiError(
            403,
            "This account is not an admin account"
        );
    }
    if (!user.isActive) {
        throw new ApiError(
            403,
            "Admin account is inactive"
        );
    }
    const isPasswordCorrect =
        await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
        throw new ApiError(
            401,
            "Invalid email or password"
        );
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    user.lastLoginAt = new Date();
    await user.save({
        validateBeforeSave: false
    });
    const admin = await Admin.findOne({
        user: user._id
    });

    if (!admin) {
        throw new ApiError(
            404,
            "Admin profile not found"
        );
    }
    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");
    const options = {
        httpOnly: true,
        secure: true
    };
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    admin,
                    accessToken,
                    refreshToken
                },
                "Admin logged in successfully"
            )
        );
});
const logoutAdmin = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "Admin logged out successfully"
            )
        );
});
export {
    registerAdmin,
    loginAdmin,
    logoutAdmin
};