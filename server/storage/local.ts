import fs from "fs/promises";
import path from "path";
import { storageConfig } from "./config";

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

/**
 * Upload a file to local filesystem storage
 */
export async function uploadFile(
  storagePath: string,
  fileBuffer: Buffer
): Promise<StorageResult> {
  try {
    if (!storageConfig.basePath) {
      throw new Error("Storage base path not configured");
    }

    const fullPath = path.join(storageConfig.basePath, storagePath);
    const directory = path.dirname(fullPath);

    // Create directory if it doesn't exist
    await fs.mkdir(directory, { recursive: true });

    // Write file to disk
    await fs.writeFile(fullPath, fileBuffer);

    return {
      success: true,
      path: storagePath,
    };
  } catch (error) {
    console.error("Error uploading file to local storage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download a file from local filesystem storage
 */
export async function downloadFile(
  storagePath: string
): Promise<DownloadResult> {
  try {
    if (!storageConfig.basePath) {
      throw new Error("Storage base path not configured");
    }

    const fullPath = path.join(storageConfig.basePath, storagePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return {
        success: false,
        error: "File not found",
      };
    }

    // Read file
    const data = await fs.readFile(fullPath);

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Error downloading file from local storage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a file from local filesystem storage
 */
export async function deleteFile(storagePath: string): Promise<StorageResult> {
  try {
    if (!storageConfig.basePath) {
      throw new Error("Storage base path not configured");
    }

    const fullPath = path.join(storageConfig.basePath, storagePath);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return {
        success: false,
        error: "File not found",
      };
    }

    // Delete file
    await fs.unlink(fullPath);

    return {
      success: true,
      path: storagePath,
    };
  } catch (error) {
    console.error("Error deleting file from local storage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if a file exists in local filesystem storage
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  try {
    if (!storageConfig.basePath) {
      return false;
    }

    const fullPath = path.join(storageConfig.basePath, storagePath);
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the full filesystem path for a storage path
 */
export function getFullPath(storagePath: string): string {
  if (!storageConfig.basePath) {
    throw new Error("Storage base path not configured");
  }

  return path.join(storageConfig.basePath, storagePath);
}
