import { storageConfig } from "./config";
import * as localStorage from "./local";
import * as s3Storage from "./s3";

export interface StorageResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  data?: Buffer;
  mimeType?: string;
  error?: string;
}

export interface SignedUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a file to configured storage backend
 */
export async function uploadFile(
  storagePath: string,
  fileBuffer: Buffer
): Promise<StorageResult> {
  if (storageConfig.type === "s3" || storageConfig.type === "r2") {
    return s3Storage.uploadFile(storagePath, fileBuffer);
  }

  return localStorage.uploadFile(storagePath, fileBuffer);
}

/**
 * Download a file from configured storage backend
 */
export async function downloadFile(
  storagePath: string
): Promise<DownloadResult> {
  if (storageConfig.type === "s3" || storageConfig.type === "r2") {
    return s3Storage.downloadFile(storagePath);
  }

  return localStorage.downloadFile(storagePath);
}

/**
 * Delete a file from configured storage backend
 */
export async function deleteFile(storagePath: string): Promise<StorageResult> {
  if (storageConfig.type === "s3" || storageConfig.type === "r2") {
    return s3Storage.deleteFile(storagePath);
  }

  return localStorage.deleteFile(storagePath);
}

/**
 * Check if a file exists in configured storage backend
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  if (storageConfig.type === "s3" || storageConfig.type === "r2") {
    return s3Storage.fileExists(storagePath);
  }

  return localStorage.fileExists(storagePath);
}

/**
 * Generate a signed URL for temporary file access
 * Applicable for S3/R2 storage. For local storage, returns the storage path.
 */
export async function generateSignedUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<SignedUrlResult> {
  if (storageConfig.type === "s3" || storageConfig.type === "r2") {
    return s3Storage.generateSignedUrl(storagePath, expiresIn);
  }

  // For local storage, we'll return the path and handle it via download endpoint
  return {
    success: true,
    url: `/api/assets/download/${encodeURIComponent(storagePath)}`,
  };
}

/**
 * Get the full filesystem path for a storage path (local storage only)
 */
export function getFullPath(storagePath: string): string {
  if (storageConfig.type === "s3" || storageConfig.type === "r2") {
    throw new Error("getFullPath is not applicable for S3/R2 storage");
  }

  return localStorage.getFullPath(storagePath);
}

// Re-export utility functions from config
export {
  generateStoragePath,
  generateUniqueFileName,
  isRiskyFileType,
  storageConfig,
  validateFileSize,
  validateMimeType,
} from "./config";
