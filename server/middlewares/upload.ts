import multer from "multer";
import path from "node:path";

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

// Risky file types that should be flagged (executable files)
const RISKY_FILE_EXTENSIONS = [
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
  ".js",
  ".ts",
];

// Configure multer for memory storage (we'll handle file system storage ourselves)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check for risky file types
  if (RISKY_FILE_EXTENSIONS.includes(fileExtension)) {
    console.warn(
      `Risky file type detected: ${file.originalname} (${file.mimetype})`
    );
    // Log but don't reject - we'll handle this in the route
    (req as any).riskyFileDetected = true;
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    console.warn(
      `Uncommon MIME type: ${file.mimetype} for file ${file.originalname}`
    );
    // Accept anyway but log for monitoring
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
export const virusScan = (
  req: Express.Request,
  _res: Express.Response,
  next: (err?: Error) => void
) => {
  // In production, integrate with ClamAV or similar
  console.log("Virus scan placeholder - file accepted without scanning");

  if ((req as any).riskyFileDetected) {
    console.warn(
      "WARNING: Risky file type detected - virus scanning recommended"
    );
  }

  next();
};
