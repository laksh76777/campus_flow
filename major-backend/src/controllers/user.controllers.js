import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { PlacementSession } from "../models/placementSession.model.js";
import { getCatalogProgram, resolveStudentProgram, normalizeDegreeType } from "../constants/programCatalog.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { getAuthCookieOptions } from "../utils/authCookieOptions.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return {
            accessToken,
            refreshToken,
        };

    } catch (error) {
        console.error("Token generation error:", error);

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(
            500,
            "Something went wrong while generating access and refresh tokens"
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const {
        fullName,
        email,
        personalEmail,
        password,
        phone,
        usn,
        enrollmentNumber,
        programCode,
        programLevel,
        degreeType,
        course,
        courseDurationYears,
        admissionYear,
        graduationYear,
        semester,
        currentSemester,
        placementSession,
        gender,
        dob
    } = req.body;

    if (!fullName || !email || !password) {
        throw new ApiError(400, "Full name, email, and password are required");
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Check for duplicate account by email
    const existedUser = await User.findOne({ email: cleanEmail });
    if (existedUser) {
        throw new ApiError(409, "User with this email already exists");
    }

    // 2. Check for duplicate USN / enrollmentNumber if provided
    const rawUsn = usn || enrollmentNumber;
    let cleanUsn = rawUsn ? rawUsn.trim().toUpperCase() : null;

    if (cleanUsn) {
        const existingProfile = await StudentProfile.findOne({
            $or: [{ enrollmentNumber: cleanUsn }, { usn: cleanUsn }]
        });
        if (existingProfile) {
            throw new ApiError(409, `Student with USN / Enrollment Number '${cleanUsn}' already exists`);
        }
    }

    // 3. Academic program validation against the authoritative catalogue
    const selectedProgram = getCatalogProgram(programCode) || resolveStudentProgram(req.body);
    if (!selectedProgram) {
        throw new ApiError(400, "A valid approved programCode is required");
    }
    if (
        (programLevel && programLevel !== selectedProgram.programLevel) ||
        (degreeType && normalizeDegreeType(degreeType) !== selectedProgram.degreeType) ||
        (course && normalizeDegreeType(course) !== selectedProgram.degreeType)
    ) {
        throw new ApiError(400, "Program level or degree type does not match the selected academic program");
    }
    const validatedDeptName = selectedProgram.name;

    // 4. Academic Cohort and Placement Session Assignment
    const selectedCourse = selectedProgram.degreeType;
    const duration = selectedProgram.durationYears;
    if (courseDurationYears !== undefined && Number(courseDurationYears) !== duration) {
        throw new ApiError(400, "Course duration does not match the selected academic program");
    }

    let resolvedAdmissionYear = admissionYear ? Number(admissionYear) : null;
    let resolvedGraduationYear = graduationYear ? Number(graduationYear) : null;
    if (!Number.isInteger(resolvedAdmissionYear) || resolvedAdmissionYear < 1900 || resolvedAdmissionYear > 2200) {
        throw new ApiError(400, "A valid admission year is required");
    }

    let targetSession = null;

    if (!resolvedGraduationYear) {
        resolvedGraduationYear = resolvedAdmissionYear + duration;
    } else {
        if (resolvedGraduationYear !== resolvedAdmissionYear + duration) {
            throw new ApiError(
                400,
                `Invalid graduation year (${resolvedGraduationYear}). For a ${duration}-year ${selectedCourse} course starting in ${resolvedAdmissionYear}, expected graduation year is ${resolvedAdmissionYear + duration}.`
            );
        }
    }

    // Resolve Placement Session: Find session matching the graduating year if not already assigned
    if (!targetSession) {
        if (placementSession) {
            targetSession = await PlacementSession.findById(placementSession);
            if (!targetSession) {
                throw new ApiError(404, "Specified placement session not found");
            }
            if (targetSession.sessionYear !== resolvedGraduationYear) {
                const hasMatchingMapping = (targetSession.admissionYearMapping || []).some(
                    (m) => Number(m.admissionYear) === resolvedAdmissionYear
                );
                if (!hasMatchingMapping && targetSession.sessionYear !== resolvedAdmissionYear) {
                    throw new ApiError(
                        400,
                        `Placement session mismatch: selected session is for Class of ${targetSession.sessionYear}, but your academic details indicate Class of ${resolvedGraduationYear}.`
                    );
                }
            }
        } else {
            targetSession = await PlacementSession.findOne({
                $or: [
                    { sessionYear: resolvedGraduationYear },
                    { "admissionYearMapping.admissionYear": resolvedAdmissionYear }
                ]
            });
        }
    }


    if (!targetSession) {
        throw new ApiError(
            400,
            `No placement session is configured for the Class of ${resolvedGraduationYear}. Please contact your Training & Placement Office (TPO) to initialize this placement session.`
        );
    }

    if ((admissionYear || graduationYear) && (targetSession.isClosed || targetSession.isArchived)) {
        throw new ApiError(
            400,
            `The placement session for the Class of ${resolvedGraduationYear} is closed or archived. Please contact your Placement Office.`
        );
    }

    // 5. Avatar Upload (if provided)
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    let avatar = null;
    if (avatarLocalPath) {
        avatar = await uploadOnCloudinary(avatarLocalPath, {
            folder: "campusflow/avatars",
            resource_type: "image"
        });
        if (!avatar) {
            throw new ApiError(500, "Avatar upload failed");
        }
    }

    // 6. Atomic User & StudentProfile Persistence
    const assignedRole = "student";

    const user = await User.create({
        fullName: fullName.trim(),
        email: cleanEmail,
        password,
        phone: phone ? phone.trim() : "",
        role: assignedRole,
        avatar: avatar
            ? {
                  url: avatar.secure_url || avatar.url,
                  publicId: avatar.public_id
              }
            : {
                  url: null,
                  publicId: null
              }
    });

    let studentProfile = null;
    try {
        const finalUsn = cleanUsn || `ENR-${user._id.toString().slice(-6).toUpperCase()}`;
        const sem = Number(semester || currentSemester || 1);

        studentProfile = await StudentProfile.create({
            user: user._id,
            enrollmentNumber: finalUsn,
            usn: finalUsn,
            course: selectedCourse,
            programCode: selectedProgram.code,
            programLevel: selectedProgram.programLevel,
            degreeType: selectedProgram.degreeType,
            branch: validatedDeptName,
            department: validatedDeptName,
            admissionYear: resolvedAdmissionYear,
            graduationYear: resolvedGraduationYear,
            semester: sem,
            currentSemester: sem,
            placementSession: targetSession._id,
            personalEmail: personalEmail ? personalEmail.toLowerCase().trim() : "",
            collegeEmail: cleanEmail,
            gender: gender || "Prefer not to say",
            dob: dob ? new Date(dob) : null,
            cgpa: null,
            verificationStatus: "PENDING"
        });
    } catch (profileErr) {
        // Atomic rollback: Delete created user account on profile failure
        await User.findByIdAndDelete(user._id);
        if (profileErr.code === 11000) {
            throw new ApiError(409, "A student profile with this USN/enrollment number already exists");
        }
        throw profileErr;
    }

    // 7. Token Generation and Safe Response
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    const populatedProfile = await StudentProfile.findById(studentProfile._id).populate(
        "placementSession",
        "sessionYear name academicYear isActive"
    );

    const options = getAuthCookieOptions();

    return res
        .status(201)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                201,
                {
                    ...(createdUser?.toObject ? createdUser.toObject() : createdUser),
                    user: createdUser,
                    studentProfile: populatedProfile,
                    accessToken
                },
                "Student account registered and placement session assigned successfully"
            )
        );
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, fullName, rollNumber, password } = req.body;

    if (!(email || fullName || rollNumber)) {
        throw new ApiError(400, "Email, full name, or roll number is required");
    }

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    const cleanEmail = email ? email.toLowerCase().trim() : null;

    let user = null;
    if (cleanEmail || fullName) {
        user = await User.findOne({
            $or: [
                ...(cleanEmail ? [{ email: cleanEmail }] : []),
                ...(fullName ? [{ fullName: fullName.trim() }] : [])
            ]
        });
    }

    // If not found yet and rollNumber is provided, lookup via StudentProfile
    if (!user && rollNumber) {
        const profile = await mongoose.model("StudentProfile").findOne({
            enrollmentNumber: rollNumber.trim().toUpperCase()
        }).select("user");

        if (profile && profile.user) {
            user = await User.findById(profile.user);
        }
    }

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");

    const options = getAuthCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken
                },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async(req,res) =>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )
    const options = getAuthCookieOptions();
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "user logged out"));
})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken // this comes from user 
    if(!incomingRefreshToken) { // verify users refresh token like is this valid or not ? if not then throw error
        throw new ApiError(401, "unauthorized request")
    }
    try {   // try block when , user's refrresh token is verified
        const decodedToken = jwt.verify( // here  i am veryfying,  was this token created using my secret key ?
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )// and it also verify encrypted information ,bcs whatever info is store in refresh token that is encrypted , jwt decrypt these info and send it as response
        const user = await User.findById(decodedToken?._id);
        if(!user) {
            throw new ApiError(401, "invalid refresh token")
        }
        if (!user.isActive) {
            throw new ApiError(401, "Account is inactive.");
        }
        
        if(incomingRefreshToken!==user.refreshToken) {
            throw new ApiError(401," refreshToken token has expired or used" )
        }
        const options = getAuthCookieOptions();
        const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
        return res.status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken", refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "envalid refress token ")   
    }


})
const currentUser = asyncHandler(async (req,res)=>{
    return res
    .status(200)
    .json(
         new ApiResponse(200,req.user,"current user fetched successfully")
    )
})
const updateAccountDetails = asyncHandler(async (req,res) =>{
    const {fullName, email,phone} = req.body
    if (!fullName || !email || !phone){
        throw new ApiError(400, "all fields are required")
    }
    const user =  await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName:fullName,
                email:email,
                phone:phone
            }
        },
        {new:true} // this returns the values after the updation
    ).select("-password")
    return res.status(200)
    .json(new ApiResponse(200, user,"account details updated successfully"))

})
const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old password and new password are required");
    }
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect) {
        throw new ApiError(400, "invalid old password");
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})
    return res.status(200)
    .json(
        new ApiResponse(200, {},"password changed successfully")
    )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar image file is required");
    }

    const uploadedAvatar = await uploadOnCloudinary(avatarLocalPath, {
        folder: "campusflow/avatars",
        resource_type: "image"
    });

    if (!uploadedAvatar || (!uploadedAvatar.secure_url && !uploadedAvatar.url)) {
        throw new ApiError(400, "Failed to upload avatar to Cloudinary");
    }

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Safely delete previous avatar from Cloudinary if existed
    if (user.avatar?.publicId) {
        await deleteFromCloudinary(user.avatar.publicId, "image");
    }

    user.avatar = {
        url: uploadedAvatar.secure_url || uploadedAvatar.url,
        publicId: uploadedAvatar.public_id
    };

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, { avatar: user.avatar, user }, "Avatar updated successfully")
    );
});

const deleteUserAvatar = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (user.avatar?.publicId) {
        await deleteFromCloudinary(user.avatar.publicId, "image");
    }

    user.avatar = {
        url: "",
        publicId: ""
    };

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(200, { avatar: user.avatar, user }, "Avatar removed successfully")
    );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    currentUser,
    updateAccountDetails,
    changeCurrentPassword,
    updateUserAvatar,
    deleteUserAvatar
}
