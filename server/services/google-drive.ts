import { assets, insertAssetSchema, type UserRoleType } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { OAuth2Client } from "google-auth-library";
import { type drive_v3, google } from "googleapis";
import { db } from "../db";
import { generateStoragePath, generateUniqueFileName } from "../storage";
import {
  type DriveFileSharingMetadata,
  getInitialImportPermissions,
} from "./drive-file-permissions";

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

interface DetailedFileMetadata extends DriveFileMetadata {
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
  }>;
  thumbnailLink?: string;
  webContentLink?: string;
  createdTime?: string;
  description?: string;
  fileExtension?: string;
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
): Promise<DetailedFileMetadata> => {
  try {
    const response = await driveClient.files.get({
      fileId,
      fields:
        "id, name, mimeType, size, modifiedTime, createdTime, webViewLink, webContentLink, thumbnailLink, description, fileExtension, owners(displayName, emailAddress, photoLink)",
    });

    return response.data as DetailedFileMetadata;
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
}: {
  userId: number;
  userRole: UserRoleType;
  clientId: number;
  driveFile: DriveFileMetadata;
  visibility?: "private" | "shared";
}) => {
  try {
    // Generate a unique file name for the Drive reference
    const uniqueFileName = generateUniqueFileName(driveFile.name);
    const storagePath = generateStoragePath(clientId, uniqueFileName);

    // Extract owner information (prefer email, fall back to display name)
    const driveOwner = driveFile.owners?.[0]
      ? driveFile.owners[0].emailAddress || driveFile.owners[0].displayName
      : undefined;

    // Determine if the importing user is the owner in Drive
    const isOwnedByImporter = driveFile.owners?.[0]?.emailAddress
      ? // We would need the user's email to check this properly
        // For now, we assume false unless we can confirm
        false
      : false;

    // Check if file has public link (webContentLink indicates downloadable/shareable)
    const hasPublicLink = !!driveFile.webContentLink;

    // Prepare Drive sharing metadata
    const driveSharingMetadata = {
      isShared: driveFile.owners && driveFile.owners.length > 0,
      isOwnedByImporter,
      driveOwner,
      hasPublicLink,
      importerDriveRole: "reader" as const, // We'll determine this based on permissions
    };

    // Get initial permissions using the permission model
    const initialPermissions = getInitialImportPermissions(
      userId,
      userRole,
      driveSharingMetadata
    );

    // Use the calculated visibility or fall back to provided value
    const finalVisibility = visibility || initialPermissions.initialVisibility;

    // Create asset record for the Drive file
    const assetData = {
      clientId,
      uploadedBy: initialPermissions.ferdinandOwner, // Use the calculated owner
      fileName: uniqueFileName,
      originalFileName: driveFile.name,
      fileType: driveFile.mimeType,
      fileSize: parseInt(driveFile.size || "0", 10),
      storagePath,
      visibility: finalVisibility,
      isGoogleDrive: true,
      driveFileId: driveFile.id,
      driveWebLink: driveFile.webViewLink,
      driveLastModified: new Date(driveFile.modifiedTime),
      driveOwner,
      driveThumbnailUrl: driveFile.thumbnailLink,
      driveWebContentLink: driveFile.webContentLink,
      driveSharingMetadata: initialPermissions.storeDriveMetadata, // Store comprehensive metadata
    };

    const validated = insertAssetSchema.parse(assetData);
    const [asset] = await db.insert(assets).values(validated).returning();

    // Log the import action for auditing
    console.log(
      `Drive file imported: ${driveFile.name} (${driveFile.id}) by user ${userId} (${userRole}) with visibility: ${finalVisibility}`
    );

    return asset;
  } catch (error) {
    console.error("Error importing Drive file:", error);
    throw new Error("Failed to import Drive file");
  }
};

// ============================================================================
// Drive Sharing Metadata Helper Functions
// ============================================================================

/**
 * Parses and validates Drive sharing metadata from an asset record
 *
 * @param asset - Asset record with potential driveSharingMetadata
 * @returns Parsed and validated Drive sharing metadata or null
 */
export const parseDriveSharingMetadata = (asset: {
  driveSharingMetadata: unknown;
}): DriveFileSharingMetadata | null => {
  if (!asset.driveSharingMetadata) {
    return null;
  }

  try {
    const metadata = asset.driveSharingMetadata as Record<string, unknown>;

    return {
      isShared:
        typeof metadata.isShared === "boolean" ? metadata.isShared : false,
      isOwnedByImporter:
        typeof metadata.isOwnedByImporter === "boolean"
          ? metadata.isOwnedByImporter
          : false,
      driveOwner:
        typeof metadata.driveOwner === "string"
          ? metadata.driveOwner
          : undefined,
      hasPublicLink:
        typeof metadata.hasPublicLink === "boolean"
          ? metadata.hasPublicLink
          : false,
      importerDriveRole:
        metadata.importerDriveRole === "owner" ||
        metadata.importerDriveRole === "writer" ||
        metadata.importerDriveRole === "commenter" ||
        metadata.importerDriveRole === "reader"
          ? metadata.importerDriveRole
          : "reader",
    };
  } catch (error) {
    console.error("Error parsing Drive sharing metadata:", error);
    return null;
  }
};

/**
 * Retrieves an asset with its Drive sharing metadata
 *
 * @param assetId - Asset ID to retrieve
 * @returns Asset record with parsed metadata or null if not found
 */
export const getAssetWithDriveMetadata = async (assetId: number) => {
  try {
    const [asset] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, assetId));

    if (!asset) {
      return null;
    }

    const metadata = parseDriveSharingMetadata(asset);

    return {
      ...asset,
      parsedDriveMetadata: metadata,
    };
  } catch (error) {
    console.error("Error retrieving asset with Drive metadata:", error);
    throw new Error("Failed to retrieve asset");
  }
};

/**
 * Checks if an asset has public link sharing enabled in Drive
 *
 * @param asset - Asset record to check
 * @returns True if the file has public link sharing
 */
export const hasPublicDriveLink = (asset: {
  driveSharingMetadata: unknown;
}): boolean => {
  const metadata = parseDriveSharingMetadata(asset);
  return metadata?.hasPublicLink ?? false;
};

/**
 * Gets the original Drive owner of an imported file
 *
 * @param asset - Asset record to check
 * @returns Drive owner email/name or null
 */
export const getDriveOwner = (asset: {
  driveSharingMetadata: unknown;
}): string | null => {
  const metadata = parseDriveSharingMetadata(asset);
  return metadata?.driveOwner ?? null;
};

/**
 * Checks if the importing user owned the file in Drive
 *
 * @param asset - Asset record to check
 * @returns True if the importer was the Drive owner
 */
export const wasOwnedByImporter = (asset: {
  driveSharingMetadata: unknown;
}): boolean => {
  const metadata = parseDriveSharingMetadata(asset);
  return metadata?.isOwnedByImporter ?? false;
};
