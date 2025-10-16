import type { drive_v3 } from "googleapis";
import type { DriveFileMetadata } from "../utils/validate-drive-file";

interface FolderImportOptions {
  folderId: string;
  maxDepth?: number;
  maxFiles?: number;
}

/**
 * Recursively list all files in a Google Drive folder
 */
export async function listFolderContents(
  driveClient: drive_v3.Drive,
  options: FolderImportOptions
): Promise<DriveFileMetadata[]> {
  const { folderId, maxDepth = 10, maxFiles = 1000 } = options;

  // Keep track of processed files to avoid duplicates
  const processedFiles = new Set<string>();
  const allFiles: DriveFileMetadata[] = [];

  async function processFolder(
    folderId: string,
    currentDepth: number
  ): Promise<void> {
    if (currentDepth > maxDepth || allFiles.length >= maxFiles) {
      return;
    }

    try {
      // List files in current folder
      const response = await driveClient.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "files(id, name, mimeType, size, webViewLink, modifiedTime)",
        pageSize: 100,
      });

      const files = response.data.files || [];

      // Process each file/folder
      for (const file of files) {
        // Skip if we've seen this file already
        if (processedFiles.has(file.id!)) {
          continue;
        }

        processedFiles.add(file.id!);

        // If it's a folder, process it recursively
        if (file.mimeType === "application/vnd.google-apps.folder") {
          await processFolder(file.id!, currentDepth + 1);
        } else {
          // Add file to results if it's not a folder
          allFiles.push({
            id: file.id!,
            name: file.name!,
            mimeType: file.mimeType!,
            size: file.size || "0",
            webViewLink: file.webViewLink!,
            modifiedTime: file.modifiedTime!,
          });

          // Check if we've reached the file limit
          if (allFiles.length >= maxFiles) {
            return;
          }
        }
      }
    } catch (error) {
      console.error(`Error processing folder ${folderId}:`, error);
      throw new Error("Failed to process Google Drive folder");
    }
  }

  // Start processing from the root folder
  await processFolder(folderId, 0);

  return allFiles;
}

/**
 * Validate folder contents before import
 */
export function validateFolderContents(files: DriveFileMetadata[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check number of files
  if (files.length === 0) {
    errors.push("Folder is empty");
  }

  // Check for unsupported file types
  const unsupportedFiles = files.filter((file) => {
    // Add your mime type validation logic here
    // This should match your existing file validation rules
    return false; // Placeholder
  });

  if (unsupportedFiles.length > 0) {
    errors.push(
      `Found ${unsupportedFiles.length} unsupported files: ${unsupportedFiles
        .map((f) => f.name)
        .join(", ")}`
    );
  }

  // Check total size
  const totalSize = files.reduce(
    (sum, file) => sum + parseInt(file.size || "0", 10),
    0
  );
  const MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB

  if (totalSize > MAX_TOTAL_SIZE) {
    errors.push(
      `Total folder size (${totalSize} bytes) exceeds maximum allowed (${MAX_TOTAL_SIZE} bytes)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
