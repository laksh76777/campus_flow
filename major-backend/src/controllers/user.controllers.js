import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
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

const registerUser = asyncHandler(async (req,res) =>{
    const {fullName, email, password,phone} = req.body
    if(
        [fullName, email, phone,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400, "all fields are required")
    }
    const existedUser = await User.findOne({
         email: email.toLowerCase().trim()
    })
    if(existedUser) {
        throw new ApiError(409, "user with email or username already exists")
    }
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    let avatar = null;
    if (avatarLocalPath) {
        avatar = await uploadOnCloudinary(
            avatarLocalPath
        );
        if (!avatar) {
            throw new ApiError(
                500,
                "Avatar upload failed"
            );
        }
    
    }
    const user = await User.create({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        password,
        phone: phone.trim(),
        role: "student",
        avatar: avatar
            ? {
                url: avatar.secure_url || avatar.url,
                publicId: avatar.public_id,
            }
            : {
                url: null,
                publicId: null,
            },
    });
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser) {
        throw new ApiError(500, "something went wrong while registering the user")
    }
     return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {

    const { email, fullName, password } = req.body;

    if (!(email || fullName)) {
        throw new ApiError(400, "email or fullName is required");
    }

    if (!password) {
        throw new ApiError(400, "password is required");
    }

    const user = await User.findOne({
        $or: [
            ...(email ? [{ email }] : []),
            ...(fullName ? [{ fullName }] : [])
        ]
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } =
        await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "none"
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
                    accessToken,
                    refreshToken
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
    const options = {
        httpOnly:true,
        secure:false
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out"))
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
        
        if(incomingRefreshToken!==user.refreshToken) {
            throw new ApiError(401," refreshToken token has expired or used" )
        }
        const options = {
            httpOnly:true,
            secure:true
        }
        const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
        return res.status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken", refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken},
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
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    currentUser,
    updateAccountDetails,
    changeCurrentPassword
}