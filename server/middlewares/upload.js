import path from "node:path";
import multer from "multer";
// File size limits (500MB max)
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes
// Allowed MIME types (accept all, but we'll flag risky types)
const ALLOWED_MIME_TYPES = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Design files
    "application/postscript", // .ai files
    "application/illustrator",
    "image/x-adobe-dng",
    // Archives (for batch uploads)
    "application/zip",
    "application/x-zip-compressed",
    // Text
    "text/plain",
    "text/csv",
];
// Risky file types that should be blocked (executable files)
const BLOCKED_FILE_EXTENSIONS = [
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".ps1",
    ".app",
    ".dmg",
    ".pkg",
    ".deb",
    ".rpm",
    ".jar",
    ".msi",
    ".scr",
    ".vbs",
    ".com",
    ".pif",
    ".cpl",
    ".dll",
];
// Configure multer for memory storage (we'll handle file system storage ourselves)
const storage = multer.memoryStorage();
// File filter function
const fileFilter = (_req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    // Block executable file types for security
    if (BLOCKED_FILE_EXTENSIONS.includes(fileExtension)) {
        console.error(`Blocked executable file type: ${file.originalname} (${file.mimetype})`);
        return cb(new Error(`File type ${fileExtension} is not allowed for security reasons`));
    }
    // Check MIME type - block if not in allowed list
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        console.warn(`Blocked uncommon MIME type: ${file.mimetype} for file ${file.originalname}`);
        return cb(new Error(`File type ${file.mimetype} is not allowed. Please upload a supported file type.`));
    }
    // Accept the file
    cb(null, true);
};
// Create multer upload middleware
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10, // Max 10 files per request
    },
});
// Virus scanning placeholder middleware (log-only for MVP)
export const virusScan = (_req, _res, next) => {
    // In production, integrate with ClamAV or similar
    // TODO: Integrate with virus scanning service before production launch
    console.log("Virus scan placeholder - file accepted without scanning");
    next();
};
