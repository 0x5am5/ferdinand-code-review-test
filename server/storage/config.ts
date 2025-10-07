import * as path from "node:path";

export interface StorageConfig {
  type: "local" | "s3" | "r2";
  basePath?: string; // For local storage
  bucket?: string; // For S3/R2
  region?: string; // For S3/R2
  endpoint?: string; // For R2 custom endpoint
  accountId?: string; // For R2 (Cloudflare account ID)
  accessKeyId?: string; // For S3/R2
  secretAccessKey?: string; // For S3/R2
  maxFileSize: number; // in bytes
  allowedMimeTypes?: string[]; // Empty array means all types allowed
  publicUrl?: string; // For R2 public bucket URL (optional)
}

// Default configuration
export const storageConfig: StorageConfig = {
  type: (process.env.STORAGE_TYPE as "local" | "s3" | "r2") || "local",
  basePath: process.env.STORAGE_PATH || path.join(process.cwd(), "uploads"),
  bucket: process.env.R2_BUCKET || process.env.S3_BUCKET,
  region: process.env.R2_REGION || process.env.S3_REGION || "auto",
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<account_id>.r2.cloudflarestorage.com
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey:
    process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  publicUrl: process.env.R2_PUBLIC_URL, // e.g., https://assets.yourdomain.com
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
  // Use Node.js built-in crypto (available in Node 19+)
  const uuid = globalThis.crypto.randomUUID();
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
  if (
    storageConfig.allowedMimeTypes &&
    storageConfig.allowedMimeTypes.length > 0
  ) {
    return storageConfig.allowedMimeTypes.includes(mimeType.toLowerCase());
  }
  return true; // Allow all if no restrictions
}
