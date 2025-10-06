import path from "path";

export interface StorageConfig {
  type: "local" | "s3";
  basePath?: string; // For local storage
  bucket?: string; // For S3
  region?: string; // For S3
  maxFileSize: number; // in bytes
  allowedMimeTypes?: string[]; // Empty array means all types allowed
}

// Default configuration
export const storageConfig: StorageConfig = {
  type: process.env.STORAGE_TYPE === "s3" ? "s3" : "local",
  basePath: process.env.STORAGE_PATH || path.join(process.cwd(), "uploads"),
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION || "us-east-1",
  maxFileSize: 500 * 1024 * 1024, // 500MB
  allowedMimeTypes: [], // Allow all types for now
};

// Risky file types that should be flagged
export const riskyMimeTypes = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "application/x-bat",
  "application/x-ms-dos-executable",
  "text/x-shellscript",
];

// Generate storage path for an asset
export function generateStoragePath(
  clientId: number,
  fileName: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${clientId}/assets/${year}/${month}/${fileName}`;
}

// Generate a unique filename using UUID
export function generateUniqueFileName(originalFileName: string): string {
  const crypto = require("crypto");
  const uuid = crypto.randomUUID();
  const ext = path.extname(originalFileName);
  const nameWithoutExt = path.basename(originalFileName, ext);

  return `${uuid}-${nameWithoutExt}${ext}`;
}

// Check if file type is risky
export function isRiskyFileType(mimeType: string): boolean {
  return riskyMimeTypes.includes(mimeType.toLowerCase());
}

// Validate file size
export function validateFileSize(size: number): boolean {
  return size > 0 && size <= storageConfig.maxFileSize;
}

// Validate MIME type
export function validateMimeType(mimeType: string): boolean {
  if (storageConfig.allowedMimeTypes && storageConfig.allowedMimeTypes.length > 0) {
    return storageConfig.allowedMimeTypes.includes(mimeType.toLowerCase());
  }
  return true; // Allow all if no restrictions
}
