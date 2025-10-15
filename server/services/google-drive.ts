import { assets, insertAssetSchema } from "@shared/schema";
import type { OAuth2Client } from "google-auth-library";
import { type drive_v3, google } from "googleapis";
import { db } from "../db";
import { generateStoragePath, generateUniqueFileName } from "../storage";

interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
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
      fields: "files(id, name, mimeType, size, modifiedTime, webViewLink)",
      pageSize: 1000,
    });

    return response.data.files as DriveFileMetadata[];
  } catch (error) {
    console.error("Error listing Drive files:", error);
    throw new Error("Failed to list Drive files");
  }
};

export const importDriveFile = async ({
  userId,
  clientId,
  driveFile,
  visibility = "shared",
}: {
  userId: number;
  clientId: number;
  driveFile: DriveFileMetadata;
  visibility?: "private" | "shared";
}) => {
  try {
    // Generate a unique file name for the Drive reference
    const uniqueFileName = generateUniqueFileName(driveFile.name);
    const storagePath = generateStoragePath(clientId, uniqueFileName);

    // Create asset record for the Drive file
    const assetData = {
      clientId,
      uploadedBy: userId,
      fileName: uniqueFileName,
      originalFileName: driveFile.name,
      fileType: driveFile.mimeType,
      fileSize: parseInt(driveFile.size || "0", 10),
      storagePath,
      visibility,
      isGoogleDrive: true,
      driveFileId: driveFile.id,
      driveWebLink: driveFile.webViewLink,
      driveLastModified: new Date(driveFile.modifiedTime),
    };

    const validated = insertAssetSchema.parse(assetData);
    const [asset] = await db.insert(assets).values(validated).returning();

    return asset;
  } catch (error) {
    console.error("Error importing Drive file:", error);
    throw new Error("Failed to import Drive file");
  }
};
