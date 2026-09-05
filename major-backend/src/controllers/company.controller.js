import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Company } from "../models/company.model.js";
import {
    cloudinary,
    uploadOnCloudinary
} from "../utils/cloudinary.js";

const createCompany = asyncHandler(async (req, res) => {
    const {
        companyName,companyDescription,companyWebsite, industry, location, contactEmail,contactPhone
    } = req.body;
    if (!companyName) {
        throw new ApiError(
            400,
            "Company name is required"
        );
    }
    const existingCompany = await Company.findOne({
        companyName: companyName.trim()
    });

    if (existingCompany) {
        throw new ApiError(
            409,
            "Company already exists"
        );
    }
    let companyLogo = {
        url: "",
        publicId: ""
    };
    const logoLocalPath = req.file?.path;
    if (logoLocalPath) {
        const uploadedLogo = await uploadOnCloudinary(
            logoLocalPath
        );
        if (!uploadedLogo || !uploadedLogo.url) {
            throw new ApiError(
                400,
                "Error while uploading company logo"
            );
        }
        companyLogo = {
            url: uploadedLogo.url,
            publicId: uploadedLogo.public_id
        };
    }
    const company = await Company.create({

        companyName: companyName.trim(),
        companyDescription,
        companyWebsite,
        industry,
        location,
        contactEmail,
        contactPhone,
        companyLogo,
        createdBy: req.user._id
    });
    return res.status(201).json(
        new ApiResponse(
            201,
            company,
            "Company created successfully"
        )
    );
});

const getAllCompanies = asyncHandler(async (req, res) => {
    const filter = req.user?.role === "admin" ? {} : { isActive: true };
    const companies = await Company.find(filter).sort({
        createdAt: -1
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            companies,
            "Companies fetched successfully"
        )
    );
});

const getCompanyById = asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    if (!companyId) {
        throw new ApiError(
            400,
            "Company ID is required"
        );
    }
    const company = await Company.findOne({
        _id: companyId,
        isActive: true
    });
    if (!company) {
        throw new ApiError(
            404,
            "Company not found"
        );
    }
    return res.status(200).json(
        new ApiResponse(
            200,
            company,
            "Company fetched successfully"
        )
    );
});

const updateCompany = asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    const {
        companyName, companyDescription, companyWebsite, industry, location, contactEmail, contactPhone
    } = req.body;

    if (!companyId) {
        throw new ApiError(
            400,
            "Company ID is required"
        );
    }

    const company = await Company.findOne({
        _id: companyId,
        isActive: true
    });

    if (!company) {
        throw new ApiError(
            404,
            "Company not found"
        );
    }

    if (companyName !== undefined) {
        company.companyName = companyName.trim();
    }
    if (companyDescription !== undefined) {
        company.companyDescription = companyDescription;
    }
    if (companyWebsite !== undefined) {
        company.companyWebsite = companyWebsite;
    }
    if (industry !== undefined) {
        company.industry = industry;
    }
    if (location !== undefined) {
        company.location = location;
    }
    if (contactEmail !== undefined) {
        company.contactEmail = contactEmail;
    }
    if (contactPhone !== undefined) {
        company.contactPhone = contactPhone;
    }
    await company.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            company,
            "Company updated successfully"
        )
    );
});

const updateCompanyLogo = asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    if (!companyId) {
        throw new ApiError(
            400,
            "Company ID is required"
        );
    }
    const logoLocalPath = req.file?.path;
    if (!logoLocalPath) {
        throw new ApiError(
            400,
            "Company logo is missing"
        );
    }
    const company = await Company.findOne({
        _id: companyId,
        isActive: true
    });
    if (!company) {
        throw new ApiError(
            404,
            "Company not found"
        );
    }
    const uploadedLogo = await uploadOnCloudinary(
        logoLocalPath
    );
    if (!uploadedLogo || !uploadedLogo.url) {
        throw new ApiError(
            400,
            "Error while uploading new company logo"
        );
    }
    if (company.companyLogo?.publicId) {
        await cloudinary.uploader.destroy(
            company.companyLogo.publicId,
            {
                resource_type: "image"
            }
        );
    }
    company.companyLogo = {
        url: uploadedLogo.url,
        publicId: uploadedLogo.public_id
    };
    await company.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            company,
            "Company logo updated successfully"
        )
    );
});

const deactivateCompany = asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    if (!companyId) {
        throw new ApiError(
            400,
            "Company ID is required"
        );
    }
    const company = await Company.findById(companyId);
    if (!company) {
        throw new ApiError(
            404,
            "Company not found"
        );
    }
    if (!company.isActive) {
        throw new ApiError(
            400,
            "Company is already inactive"
        );
    }
    company.isActive = false;
    await company.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            company,
            "Company deactivated successfully"
        )
    );
});

const reactivateCompany = asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    if (!companyId) {
        throw new ApiError(
            400,
            "Company ID is required"
        );
    }
    const company = await Company.findById(companyId);

    if (!company) {
        throw new ApiError(
            404,
            "Company not found"
        );
    }
    if (company.isActive) {
        throw new ApiError(
            400,
            "Company is already active"
        );
    }
    company.isActive = true;

    await company.save();
    return res.status(200).json(
        new ApiResponse(
            200,
            company,
            "Company reactivated successfully"
        )
    );
});
export {
    createCompany,
    getAllCompanies,
    getCompanyById,
    updateCompany,
    updateCompanyLogo,
    deactivateCompany,
    reactivateCompany
};