import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath, options = {}) => {
    try {
        if (!localFilePath) return null;

        const isPdfOrDoc = /\.(pdf|doc|docx|txt)$/i.test(localFilePath);
        const uploadOptions = {
            resource_type: isPdfOrDoc ? "raw" : "auto",
            ...options
        };

        const response = await cloudinary.uploader.upload(localFilePath, uploadOptions);

        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        return response;
    } catch (error) {
        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        throw error;
    }
};

export { cloudinary, uploadOnCloudinary };