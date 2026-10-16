import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

/**
 * Ensures Cloudinary is initialized with current environment credentials.
 */
export const ensureCloudinaryConfig = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
};

// Initial config
ensureCloudinaryConfig();

/**
 * Check if Cloudinary is configured with valid credentials.
 */
export const isCloudinaryConfigured = () => {
    const name = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    return Boolean(
        name &&
        key &&
        secret &&
        !name.includes("your_") &&
        !key.includes("your_") &&
        !secret.includes("your_")
    );
};

/**
 * Upload local file to Cloudinary with automatic cleanup.
 *
 * For PDF resumes and documents, uploads under resource_type: "image" or "auto"
 * so Cloudinary allows previewing rendered pages (.png) and manages document assets cleanly.
 */
const uploadOnCloudinary = async (localFilePath, options = {}) => {
    try {
        if (!localFilePath) return null;

        ensureCloudinaryConfig();

        if (!fs.existsSync(localFilePath)) {
            console.warn(`[Cloudinary] File does not exist at path: ${localFilePath}`);
            return null;
        }

        const isPdf = /\.pdf$/i.test(localFilePath);
        const isDoc = /\.(doc|docx|txt)$/i.test(localFilePath);

        // PDFs uploaded with resource_type: "image" enable Cloudinary's multi-page preview rendering
        // which avoids Cloudinary's default 401 ACL raw delivery restrictions.
        let defaultResourceType = "auto";
        if (isPdf) {
            defaultResourceType = "image";
        } else if (isDoc) {
            defaultResourceType = "raw";
        }

        const uploadOptions = {
            resource_type: options.resource_type || defaultResourceType,
            folder: options.folder || "campusflow",
            ...options
        };

        const response = await cloudinary.uploader.upload(localFilePath, uploadOptions);

        return response;
    } catch (error) {
        console.error("[Cloudinary Upload Error]:", error.message || error);
        throw error;
    } finally {
        // Always clean up local temporary file safely
        if (localFilePath && fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (unlinkErr) {
                console.warn(`[Cloudinary] Failed to unlink temp file: ${localFilePath}`, unlinkErr.message);
            }
        }
    }
};

/**
 * Safely delete an asset from Cloudinary by its public ID.
 */
export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
    if (!publicId) return { result: "not_found" };

    try {
        ensureCloudinaryConfig();

        // Try primary resource type
        let result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true
        });

        // If not found as image, try as raw
        if (result?.result !== "ok" && resourceType === "image") {
            const rawResult = await cloudinary.uploader.destroy(publicId, {
                resource_type: "raw",
                invalidate: true
            });
            if (rawResult?.result === "ok") {
                result = rawResult;
            }
        }

        return result;
    } catch (error) {
        console.warn(`[Cloudinary Delete Warning] Failed to delete asset ${publicId}:`, error.message);
        return { result: "error", error: error.message };
    }
};

export { cloudinary, uploadOnCloudinary };