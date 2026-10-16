import multer from "multer";
import fs from "fs";

const tempDir = "./public/temp";
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const cleanName = (file.originalname || "upload").replace(/[^a-zA-Z0-9.-]/g, "_");
        const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
        cb(null, `${uniquePrefix}-${cleanName}`);
    }
});

export const upload = multer({
    storage,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25 MB max
    }
});