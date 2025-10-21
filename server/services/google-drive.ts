import { assets, insertAssetSchema, type UserRoleType } from "@shared/schema";
import type { OAuth2Client } from "google-auth-library";
import { type drive_v3, google } from "googleapis";
import { db } from "../db";
import { generateStoragePath, generateUniqueFileName } from "../storage";
import {
  autoSelectCategory,
  determineAssetCategory,
} from "../utils/asset-categorization";
import {
  ensureDefaultCategories,
  getCategoriesForClient,
} from "./default-categories";

interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
  }>;
  thumbnailLink?: string;
  webContentLink?: string;
}

export const createDriveClient = (auth: OAuth2Client) => {
  return google.drive({ version: "v3", auth });
};

export const listDriveFiles = async (
  driveClient: drive_v3.Drive,
  folderId?: string
): Promise<DriveFileMetadata[]> => {
  try {
    const query = folderId ? `'${folderId}' in parents` : "root in parents";

    const response = await driveClient.files.list({
      q: query,
      fields:
        "files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, thumbnailLink, owners(displayName, emailAddress))",
      pageSize: 1000,
    });

    return response.data.files as DriveFileMetadata[];
  } catch (error) {
    console.error("Error listing Drive files:", error);
    throw new Error("Failed to list Drive files");
  }
};

export const getFileMetadata = async (
  driveClient: drive_v3.Drive,
  fileId: string
): Promise<DriveFileMetadata> => {
  try {
    const response = await driveClient.files.get({
      fileId,
      fields:
        "id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, thumbnailLink, owners(displayName, emailAddress)",
    });

    return response.data as DriveFileMetadata;
  } catch (error) {
    console.error("Error fetching file metadata:", error);
    throw new Error("Failed to fetch file metadata");
  }
};

export const importDriveFile = async ({
  userId,
  userRole,
  clientId,
  driveFile,
  visibility,
  driveClient,
}: {
  userId: number;
  userRole: UserRoleType;
  clientId: number;
  driveFile: DriveFileMetadata;
  visibility?: "private" | "shared";
  driveClient: drive_v3.Drive;
}) => {
  try {
    console.log(
      `Starting download of Drive file: ${driveFile.name} (${driveFile.id})`
    );

    // Download the actual file content from Google Drive
    const response = await driveClient.files.get(
      {
        fileId: driveFile.id,
        alt: "media",
      },
      {
        responseType: "arraybuffer",
      }
    );

    if (!response.data) {
      throw new Error("No data received from Google Drive");
    }

    const fileBuffer = Buffer.from(response.data as ArrayBuffer);
    console.log(
      `Downloaded ${fileBuffer.length} bytes for file: ${driveFile.name}`
    );

    // Generate unique filename and storage path
    const uniqueFileName = generateUniqueFileName(driveFile.name);
    const storagePath = generateStoragePath(clientId, uniqueFileName);

    // Upload to your storage system
    const { uploadFile } = await import("../storage/index");
    const uploadResult = await uploadFile(storagePath, fileBuffer);

    if (!uploadResult.success) {
      throw new Error(`Failed to store file: ${uploadResult.error}`);
    }

    console.log(`File stored successfully at: ${storagePath}`);

    // Determine asset category automatically
    let categoryId: number | null = null;
    try {
      // Ensure default categories exist
      await ensureDefaultCategories();

      // Get available categories for this client (defaults + client-specific)
      const categories = await getCategoriesForClient(clientId);

      // Auto-select category based on file type
      categoryId = autoSelectCategory(
        driveFile.name,
        driveFile.mimeType,
        categories
      );

      if (categoryId) {
        const categoryName = determineAssetCategory(
          driveFile.name,
          driveFile.mimeType
        );
        console.log(
          `Auto-categorized "${driveFile.name}" as "${categoryName}" (ID: ${categoryId})`
        );
      } else {
        console.log(
          `No suitable category found for "${driveFile.name}" (${driveFile.mimeType})`
        );
      }
    } catch (categoryError) {
      console.warn("Failed to auto-categorize file:", categoryError);
      // Continue without categorization if it fails
    }

    // Create clean asset record without any Drive-specific fields
    const assetData = {
      clientId,
      uploadedBy: userId,
      fileName: uniqueFileName,
      originalFileName: driveFile.name,
      fileType: driveFile.mimeType,
      fileSize: fileBuffer.length,
      storagePath,
      visibility: visibility || "shared",
    };

    const validated = insertAssetSchema.parse(assetData);
    const [asset] = await db.insert(assets).values(validated).returning();

    // If we have a category, create the category assignment
    if (categoryId) {
      try {
        await db
          .insert((await import("@shared/schema")).assetCategoryAssignments)
          .values({
            assetId: asset.id,
            categoryId,
          });

        console.log(`Assigned asset ${asset.id} to category ${categoryId}`);
      } catch (assignmentError) {
        console.warn("Failed to assign category to asset:", assignmentError);
        // Continue even if category assignment fails
      }
    }

    console.log(
      `Drive file downloaded and imported: ${driveFile.name} -> ${asset.fileName} (ID: ${asset.id}) by user ${userId} (${userRole})${categoryId ? `, category: ${categoryId}` : ""}`
    );

    return asset;
  } catch (error) {
    console.error("Error importing Drive file:", error);
    throw new Error(
      `Failed to import Drive file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

// Maximum file size for download (100MB)
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const validateFileForImport = (
  driveFile: DriveFileMetadata
): { valid: boolean; error?: string } => {
  // Check file size
  const fileSize = parseInt(driveFile.size || "0", 10);
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  // Check for Google Workspace files that need special handling
  const googleWorkspaceMimeTypes = [
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.drawing",
    "application/vnd.google-apps.forms",
    "application/vnd.google-apps.script",
    "application/vnd.google-apps.site",
    "application/vnd.google-apps.fusiontable",
    "application/vnd.google-apps.map",
  ];

  if (googleWorkspaceMimeTypes.includes(driveFile.mimeType)) {
    return {
      valid: false,
      error: `Google Workspace files (${driveFile.mimeType}) cannot be downloaded directly. Please export them to a standard format first.`,
    };
  }

  return { valid: true };
};
