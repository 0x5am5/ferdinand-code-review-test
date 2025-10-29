import { z } from "zod";
// Allowed MIME types (copied from upload middleware)
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
    // Google Drive types
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.drawing",
    "application/vnd.google-apps.file",
];
// Schema for Google Drive file metadata
export const driveFileSchema = z.object({
    id: z.string(),
    name: z.string(),
    mimeType: z.string(),
    size: z.string(), // Google Drive returns size as string
    webViewLink: z.string().url(),
    modifiedTime: z.string().datetime(),
});
// Schema for importing Drive files
export const driveImportSchema = z.object({
    fileIds: z.array(z.string()), // Array of Google Drive file IDs
    visibility: z.enum(["private", "shared"]).default("shared"),
});
/**
 * Validates Drive file metadata and formats it for asset creation
 */
/**
 * Validate MIME type against allowed types
 */
export const validateMimeType = (mimeType) => {
    return ALLOWED_MIME_TYPES.includes(mimeType);
};
/**
 * Validate file size against maximum limit
 */
export const validateFileSize = (size) => {
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    return size <= MAX_FILE_SIZE;
};
/**
 * Convert Google Drive file to Ferdinand asset
 */
export const validateDriveFile = (file, clientId, userId) => {
    const validatedFile = driveFileSchema.parse(file);
    return {
        clientId,
        uploadedBy: parseInt(userId, 10),
        fileName: validatedFile.name,
        originalFileName: validatedFile.name,
        fileType: validatedFile.mimeType,
        fileSize: parseInt(validatedFile.size, 10),
        storagePath: `drive/${validatedFile.id}`,
        visibility: "shared",
    };
};
