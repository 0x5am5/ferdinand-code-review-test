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

/**
 * Log audit events for Google Drive operations
 */
async function _logAuditEvent({
  userId,
  clientId,
  action,
  fileId,
  fileName,
  success,
  error,
  metadata,
}: {
  userId: number;
  clientId: number;
  action: string;
  fileId?: string;
  fileName?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    // For now, log to console. In a real implementation, this would go to an audit log table
    console.log(`[AUDIT] Google Drive ${action}:`, {
      userId,
      clientId,
      fileId,
      fileName,
      success,
      error,
      timestamp: new Date().toISOString(),
      metadata,
    });

    // TODO: Implement proper audit logging table when available
    // await db.insert(auditLogs).values({
    //   userId,
    //   clientId,
    //   action: `google_drive_${action}`,
    //   resourceType: 'drive_file',
    //   resourceId: fileId,
    //   resourceName: fileName,
    //   success,
    //   errorMessage: error,
    //   metadata,
    //   createdAt: new Date(),
    // });
  } catch (logError) {
    console.error("Failed to log audit event:", logError);
  }
}

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
      `Starting import of Drive file: ${driveFile.name} (${driveFile.id})`
    );

    // Log import start
    await _logAuditEvent({
      userId,
      clientId,
      action: "import_start",
      fileId: driveFile.id,
      fileName: driveFile.name,
      success: true,
      metadata: {
        mimeType: driveFile.mimeType,
        size: driveFile.size,
        isReferenceAsset: isGoogleWorkspaceFile(driveFile),
        userRole,
      },
    });

    // Check if this is a Google Workspace file that should be handled as reference
    const isReferenceAsset = isGoogleWorkspaceFile(driveFile);

    if (isReferenceAsset) {
      console.log(
        `Importing Google Workspace file as reference asset: ${driveFile.name}`
      );

      // Update permissions to "anyone with the link can view"
      const permissionResult = await updateFilePermissions(
        driveClient,
        driveFile.id
      );
      if (!permissionResult.success) {
        throw new Error(
          `Failed to update file permissions: ${permissionResult.error}`
        );
      }

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

      // Create reference asset record
      const assetData = {
        clientId,
        uploadedBy: userId,
        fileName: driveFile.name, // Use original name for reference assets
        originalFileName: driveFile.name,
        fileType: driveFile.mimeType,
        fileSize: 0, // Reference assets have no local file size
        storagePath: "", // No local storage for reference assets
        visibility: visibility || "shared",
        isGoogleDrive: true,
        driveFileId: driveFile.id,
        driveWebLink: driveFile.webViewLink, // Store the webViewLink
        referenceOnly: true, // Mark as reference-only asset
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

          console.log(
            `Assigned reference asset ${asset.id} to category ${categoryId}`
          );
        } catch (assignmentError) {
          console.warn(
            "Failed to assign category to reference asset:",
            assignmentError
          );
          // Continue even if category assignment fails
        }
      }

      console.log(
        `Google Workspace file imported as reference: ${driveFile.name} (ID: ${asset.id}) by user ${userId} (${userRole})${categoryId ? `, category: ${categoryId}` : ""}`
      );

      return asset;
    }

    // For non-Google Workspace files, use existing download logic
    console.log(`Importing regular file: ${driveFile.name}`);

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

  // Google Workspace files are now allowed for reference import
  // These will be handled as reference-only assets with webViewLink
  const _googleWorkspaceMimeTypes = [
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

  // Note: Google Workspace files are now allowed and will be handled as reference assets
  // No blocking validation needed here

  return { valid: true };
};

/**
 * Update Google Drive file permissions to "anyone with the link can view"
 */
export const updateFilePermissions = async (
  driveClient: drive_v3.Drive,
  fileId: string,
  userId?: number,
  clientId?: number,
  fileName?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`Updating permissions for file: ${fileId}`);

    const response = await driveClient.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    if (response.data) {
      console.log(
        `Successfully updated permissions for file ${fileId} to anyone with link can view`
      );

      // Log successful permission update
      if (userId && clientId) {
        await _logAuditEvent({
          userId,
          clientId,
          action: "permission_update",
          fileId,
          fileName,
          success: true,
          metadata: {
            newPermission: "anyone_with_link_can_view",
            role: "reader",
            type: "anyone",
          },
        });
      }

      return { success: true };
    } else {
      console.error(
        `Failed to update permissions for file ${fileId}:`,
        response.statusText
      );

      // Log failed permission update
      if (userId && clientId) {
        await _logAuditEvent({
          userId,
          clientId,
          action: "permission_update",
          fileId,
          fileName,
          success: false,
          error: response.statusText || "Unknown error",
          metadata: {
            attemptedPermission: "anyone_with_link_can_view",
            role: "reader",
            type: "anyone",
          },
        });
      }

      return {
        success: false,
        error: `Failed to update permissions: ${response.statusText || "Unknown error"}`,
      };
    }
  } catch (error) {
    console.error(`Error updating permissions for file ${fileId}:`, error);

    // Log error during permission update
    if (userId && clientId) {
      await _logAuditEvent({
        userId,
        clientId,
        action: "permission_update",
        fileId,
        fileName,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          attemptedPermission: "anyone_with_link_can_view",
          role: "reader",
          type: "anyone",
        },
      });
    }

    return {
      success: false,
      error: `Error updating permissions: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
};

/**
 * Check if a file is a Google Workspace file that should be handled as a reference
 */
export const isGoogleWorkspaceFile = (
  driveFile: DriveFileMetadata
): boolean => {
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

  return googleWorkspaceMimeTypes.includes(driveFile.mimeType);
};
