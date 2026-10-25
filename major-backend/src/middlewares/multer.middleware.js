import multer from "multer";
import fs from "fs";
import path from "node:path";
import { ApiError } from "../utils/ApiError.js";

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

export const validateJobDescriptionPdf = async (req, res, next) => {
    if (!req.file) return next();
    const isPdfName = path.extname(req.file.originalname || "").toLowerCase() === ".pdf";
    const isPdfMime = req.file.mimetype === "application/pdf";
    let hasPdfSignature = false;

    try {
        if (isPdfName && isPdfMime) {
            const handle = await fs.promises.open(req.file.path, "r");
            try {
                const signature = Buffer.alloc(5);
                const { bytesRead } = await handle.read(signature, 0, 5, 0);
                hasPdfSignature = bytesRead === 5 && signature.toString("ascii") === "%PDF-";
            } finally {
                await handle.close();
            }
        }

        if (!hasPdfName || !isPdfMime || !hasPdfSignature) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            return next(new ApiError(400, "The job description attachment must be a valid PDF file."));
        }
        return next();
    } catch (error) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return next(error);
    }
};
