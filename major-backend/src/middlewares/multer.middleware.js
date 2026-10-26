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

        if (!isPdfName || !isPdfMime || !hasPdfSignature) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            return next(new ApiError(400, "The job description attachment must be a valid PDF file."));
        }
        return next();
    } catch (error) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return next(error);
    }
};

// Resume documents: PDF, DOCX or legacy DOC, verified by file signature (not just
// the extension or client-supplied MIME type), max 5 MB.
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_SIGNATURES = {
    ".pdf": [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
    ".docx": [0x50, 0x4b, 0x03, 0x04], // ZIP container
    ".doc": [0xd0, 0xcf, 0x11, 0xe0], // OLE compound file
};

export const validateResumeFile = async (file) => {
    const ext = path.extname(file?.originalname || "").toLowerCase();
    const expected = RESUME_SIGNATURES[ext];
    if (!expected) return "Resume must be a PDF, DOCX or DOC file.";
    if (file.size > RESUME_MAX_BYTES) return "Resume file must be 5 MB or smaller.";
    const handle = await fs.promises.open(file.path, "r");
    try {
        const header = Buffer.alloc(expected.length);
        const { bytesRead } = await handle.read(header, 0, expected.length, 0);
        if (bytesRead !== expected.length || !expected.every((byte, i) => header[i] === byte)) {
            return "The resume file appears to be corrupted or is not the file type its name suggests.";
        }
    } finally {
        await handle.close();
    }
    return null;
};

export const validateResumeUpload = async (req, res, next) => {
    if (!req.file) return next();
    try {
        const problem = await validateResumeFile(req.file);
        if (problem) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            return next(new ApiError(400, problem));
        }
        return next();
    } catch (error) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return next(error);
    }
};
