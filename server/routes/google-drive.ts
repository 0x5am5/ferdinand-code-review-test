import { and, eq } from "drizzle-orm";
import type { Express } from "express";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import {
  googleAuthMiddleware,
  handleGoogleCallback,
} from "../middlewares/google-drive-auth";
import {
  driveFileAccessRateLimit,
  driveImportRateLimit,
  driveListingRateLimit,
  driveThumbnailRateLimit,
} from "../middlewares/rate-limit";
import { validateClientId } from "../middlewares/vaildateClientId";
import {
  createDriveClient,
  getFileMetadata,
  importDriveFile,
  listDriveFiles,
} from "../services/google-drive";
import type { RequestWithClientId } from "./index";

// Initialize OAuth2 client for generating auth URLs
const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export function registerGoogleDriveRoutes(app: Express) {
  // Get OAuth authorization URL
  app.get("/api/auth/google/url", (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get optional clientId from query params for redirect after OAuth
      const clientId = req.query.clientId as string | undefined;

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
        state: clientId || "dashboard", // Pass clientId or 'dashboard' as state
      });

      res.json({ url: authUrl });
    } catch (error) {
      console.error("Error generating OAuth URL:", error);
      res.status(500).json({ message: "Error generating OAuth URL" });
    }
  });

  // Get Google Drive connection status
  app.get("/api/google-drive/status", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const [connection] = await db
        .select()
        .from((await import("@shared/schema")).googleDriveConnections)
        .where(
          eq(
            (await import("@shared/schema")).googleDriveConnections.userId,
            req.session.userId
          )
        );

      if (!connection) {
        return res.status(404).json({ message: "No connection found" });
      }

      res.json({
        id: connection.id,
        userId: connection.userId,
        scopes: connection.scopes,
        connectedAt: connection.connectedAt,
        lastUsedAt: connection.lastUsedAt,
      });
    } catch (error) {
      console.error("Error fetching Google Drive status:", error);
      res.status(500).json({ message: "Error fetching connection status" });
    }
  });

  // Get OAuth access token for Google Picker
  app.get("/api/google-drive/token", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const [connection] = await db
        .select()
        .from((await import("@shared/schema")).googleDriveConnections)
        .where(
          eq(
            (await import("@shared/schema")).googleDriveConnections.userId,
            req.session.userId
          )
        );

      if (!connection) {
        return res.status(404).json({ message: "No connection found" });
      }

      // Check if token is expired
      const { isTokenExpired } = await import("../utils/encryption");
      if (isTokenExpired(connection.tokenExpiresAt)) {
        // Refresh the token
        const { refreshUserTokens } = await import(
          "../middlewares/google-drive-auth"
        );
        const refreshedClient = await refreshUserTokens(
          req.session.userId.toString()
        );
        const credentials = refreshedClient.credentials;

        return res.json({
          accessToken: credentials.access_token,
          expiresAt: credentials.expiry_date,
        });
      }

      // Decrypt and return valid token
      const { decryptTokens } = await import("../utils/encryption");
      const tokens = decryptTokens({
        encryptedAccessToken: connection.encryptedAccessToken,
        encryptedRefreshToken: connection.encryptedRefreshToken,
        tokenExpiresAt: connection.tokenExpiresAt,
      });

      res.json({
        accessToken: tokens.access_token,
        expiresAt: connection.tokenExpiresAt,
      });
    } catch (error) {
      console.error("Error fetching Google Drive token:", error);
      res.status(500).json({ message: "Error fetching access token" });
    }
  });

  // OAuth callback endpoint
  app.get("/api/auth/google/callback", handleGoogleCallback);

  // List Drive files
  app.get(
    "/api/drive/files",
    driveListingRateLimit,
    googleAuthMiddleware,
    async (req: RequestWithClientId, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.googleAuth) {
          return res
            .status(401)
            .json({ message: "Google Drive authentication required" });
        }

        const folderId = req.query.folderId as string | undefined;

        const driveClient = createDriveClient(req.googleAuth);
        const files = await listDriveFiles(driveClient, folderId);

        res.json(files);
      } catch (error) {
        console.error("Error listing Drive files:", error);
        res.status(500).json({ message: "Error listing Drive files" });
      }
    }
  );

  // Get detailed file metadata
  app.get(
    "/api/google-drive/files/:id",
    driveFileAccessRateLimit,
    googleAuthMiddleware,
    async (req: RequestWithClientId, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.googleAuth) {
          return res
            .status(401)
            .json({ message: "Google Drive authentication required" });
        }

        const { id } = req.params;

        if (!id) {
          return res.status(400).json({ message: "File ID is required" });
        }

        const driveClient = createDriveClient(req.googleAuth);
        const metadata = await getFileMetadata(driveClient, id);

        res.json(metadata);
      } catch (error) {
        console.error("Error fetching file metadata:", error);
        res.status(500).json({ message: "Error fetching file metadata" });
      }
    }
  );

  // Import Drive files via Google Picker (simplified endpoint)
  app.post(
    "/api/google-drive/import",
    driveImportRateLimit,
    googleAuthMiddleware,
    async (req: RequestWithClientId, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.googleAuth) {
          return res
            .status(401)
            .json({ message: "Google Drive authentication required" });
        }

        const { files, clientId } = req.body;

        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        if (!Array.isArray(files) || files.length === 0) {
          return res
            .status(400)
            .json({ message: "No files selected for import" });
        }

        // Check user role and permissions
        const [user] = await db
          .select()
          .from((await import("@shared/schema")).users)
          .where(
            eq((await import("@shared/schema")).users.id, req.session.userId)
          );

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Check if user has permission to import Drive files based on their role
        const { canImportDriveFiles } = await import(
          "../services/drive-file-permissions"
        );
        if (!canImportDriveFiles(user.role)) {
          return res.status(403).json({
            message: `Users with role ${user.role} cannot import files`,
          });
        }

        // Verify user has access to this client
        const [userClient] = await db
          .select()
          .from((await import("@shared/schema")).userClients)
          .where(
            and(
              eq(
                (await import("@shared/schema")).userClients.userId,
                req.session.userId
              ),
              eq(
                (await import("@shared/schema")).userClients.clientId,
                clientId
              )
            )
          );

        if (!userClient) {
          return res
            .status(403)
            .json({ message: "Not authorized for this client" });
        }

        const driveClient = createDriveClient(req.googleAuth);
        const imported: unknown[] = [];
        const failed: string[] = [];

        // Import each file
        for (const file of files) {
          try {
            // Fetch complete file metadata from Google Drive API
            const fileMetadata = await driveClient.files.get({
              fileId: file.id,
              fields:
                "id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, thumbnailLink, owners(displayName, emailAddress)",
            });

            if (!fileMetadata.data) {
              failed.push(file.name);
              continue;
            }

            const asset = await importDriveFile({
              userId: req.session.userId,
              userRole: user.role,
              clientId,
              driveFile: {
                id: fileMetadata.data.id as string,
                name: fileMetadata.data.name as string,
                mimeType: fileMetadata.data.mimeType as string,
                size: fileMetadata.data.size as string,
                modifiedTime: fileMetadata.data.modifiedTime as string,
                webViewLink: fileMetadata.data.webViewLink as string,
                owners: fileMetadata.data.owners as Array<{
                  displayName?: string;
                  emailAddress?: string;
                }>,
                thumbnailLink: fileMetadata.data.thumbnailLink || undefined,
                webContentLink: fileMetadata.data.webContentLink || undefined,
              },
              visibility: "shared",
            });
            imported.push(asset);
          } catch (error) {
            console.error(`Failed to import file ${file.name}:`, error);
            failed.push(file.name);
          }
        }

        res.json({
          success: true,
          imported: imported.length,
          failed: failed.length,
          errors: failed.length > 0 ? failed : undefined,
        });
      } catch (error) {
        console.error("Error importing Drive files:", error);
        res.status(500).json({ message: "Error importing Drive files" });
      }
    }
  );

  // Import Drive files endpoint (client-scoped)
  app.post(
    "/api/clients/:clientId/drive/import",
    driveImportRateLimit,
    validateClientId,
    googleAuthMiddleware,
    async (req: RequestWithClientId, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        if (!req.googleAuth) {
          return res
            .status(401)
            .json({ message: "Google Drive authentication required" });
        }

        const clientId = req.clientId;

        // Check user role and permissions
        const [user] = await db
          .select()
          .from((await import("@shared/schema")).users)
          .where(
            eq((await import("@shared/schema")).users.id, req.session.userId)
          );

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Check if user has permission to import Drive files based on their role
        const { canImportDriveFiles } = await import(
          "../services/drive-file-permissions"
        );
        if (!canImportDriveFiles(user.role)) {
          return res.status(403).json({
            message: `Users with role ${user.role} cannot import files`,
          });
        }

        const {
          fileIds, // Array of Google Drive file IDs to import
          visibility = "shared", // Optional visibility setting
        } = req.body;

        if (!Array.isArray(fileIds) || fileIds.length === 0) {
          return res
            .status(400)
            .json({ message: "No files selected for import" });
        }

        // List files to get metadata
        const driveClient = createDriveClient(req.googleAuth);
        const files = await listDriveFiles(driveClient);
        const selectedFiles = files.filter((f) => fileIds.includes(f.id));

        // Import each selected file
        const importedAssets = await Promise.all(
          selectedFiles.map((file) =>
            importDriveFile({
              userId: req.session.userId as number,
              userRole: user.role,
              clientId,
              driveFile: file,
              visibility,
            })
          )
        );

        res.json({
          message: `Successfully imported ${importedAssets.length} files`,
          assets: importedAssets,
        });
      } catch (error) {
        console.error("Error importing Drive files:", error);
        res.status(500).json({ message: "Error importing Drive files" });
      }
    }
  );

  // Generate secure, time-limited URL for Drive file access
  app.post(
    "/api/google-drive/files/:fileId/secure-url",
    googleAuthMiddleware,
    async (req: RequestWithClientId, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const { fileId } = req.params;
        const { action = "read", expirationSeconds = 300 } = req.body;

        if (!fileId) {
          return res.status(400).json({ message: "File ID is required" });
        }

        // Validate action
        if (!["read", "download", "thumbnail"].includes(action)) {
          return res.status(400).json({ message: "Invalid action" });
        }

        // Validate expiration (max 15 minutes for security)
        const maxExpiration = 15 * 60; // 15 minutes
        const validExpiration = Math.min(
          Math.max(60, expirationSeconds),
          maxExpiration
        );

        // Find the asset associated with this Drive file
        const [asset] = await db
          .select()
          .from((await import("@shared/schema")).assets)
          .where(
            eq((await import("@shared/schema")).assets.driveFileId, fileId)
          );

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        // Check if user has permission to access this asset
        const { checkAssetPermission } = await import(
          "../services/asset-permissions"
        );
        const permission = await checkAssetPermission(
          req.session.userId,
          asset.id,
          asset.clientId,
          "read"
        );

        if (!permission.allowed) {
          return res.status(403).json({
            message: "Not authorized to access this file",
          });
        }

        // Generate secure URL
        const { generateSecureDriveUrl } = await import(
          "../services/drive-secure-access"
        );
        const result = await generateSecureDriveUrl({
          assetId: asset.id,
          driveFileId: fileId,
          userId: req.session.userId,
          action: action as "read" | "download" | "thumbnail",
          expirationSeconds: validExpiration,
        });

        res.json({
          url: result.url,
          token: result.token,
          expiresAt: result.expiresAt,
          expiresInSeconds: result.expiresInSeconds,
        });
      } catch (error) {
        console.error("Error generating secure URL:", error);
        res.status(500).json({ message: "Error generating secure URL" });
      }
    }
  );

  // Secure proxy endpoint for Drive file access
  app.get(
    "/api/drive/secure/:fileId",
    driveFileAccessRateLimit,
    async (req: RequestWithClientId, res) => {
      const { logDriveFileAccess, logFailedAccess } = await import(
        "../services/drive-audit-logger"
      );
      const { handleValidationError, handleAuthError, DriveErrorCode } =
        await import("../services/drive-error-handler");

      // Extract params at top level so they're accessible in catch block
      const { fileId } = req.params;
      const { token, action = "read" } = req.query;

      try {
        if (!token || typeof token !== "string") {
          await logFailedAccess(
            {
              driveFileId: fileId,
              action: action as "read" | "download",
              errorCode: DriveErrorCode.MISSING_TOKEN,
              errorMessage: "Access token is required",
            },
            req
          );
          return handleValidationError(res, DriveErrorCode.MISSING_TOKEN);
        }

        if (!fileId) {
          await logFailedAccess(
            {
              action: action as "read" | "download",
              errorCode: DriveErrorCode.MISSING_FILE_ID,
              errorMessage: "File ID is required in the request",
            },
            req
          );
          return handleValidationError(res, DriveErrorCode.MISSING_FILE_ID);
        }

        // Validate Drive file ID format
        const { isValidDriveFileId } = await import(
          "../services/drive-secure-access"
        );
        if (!isValidDriveFileId(fileId)) {
          await logFailedAccess(
            {
              driveFileId: fileId,
              action: action as "read" | "download",
              errorCode: DriveErrorCode.INVALID_FILE_ID,
              errorMessage: "Invalid Drive file ID format",
            },
            req
          );
          return handleValidationError(res, DriveErrorCode.INVALID_FILE_ID);
        }

        // Validate the token
        const { validateSecureToken, revokeSecureToken } = await import(
          "../services/drive-secure-access"
        );
        const tokenData = await validateSecureToken(token);

        if (!tokenData) {
          await logFailedAccess(
            {
              driveFileId: fileId,
              action: action as "read" | "download",
              errorCode: DriveErrorCode.INVALID_TOKEN,
              errorMessage: "Access link expired or invalid",
            },
            req
          );
          return handleAuthError(res, DriveErrorCode.INVALID_TOKEN);
        }

        // Verify file ID matches
        if (tokenData.fileId !== fileId) {
          await logFailedAccess(
            {
              userId: tokenData.userId,
              driveFileId: fileId,
              action: action as "read" | "download",
              errorCode: DriveErrorCode.TOKEN_FILE_MISMATCH,
              errorMessage: "Token not valid for requested file",
            },
            req
          );
          return handleAuthError(
            res,
            DriveErrorCode.TOKEN_FILE_MISMATCH,
            "This access token is not valid for the requested file."
          );
        }

        // Verify action matches (if specified in token)
        if (
          tokenData.action &&
          action !== tokenData.action &&
          action !== "read"
        ) {
          await logFailedAccess(
            {
              userId: tokenData.userId,
              driveFileId: fileId,
              action: action as "read" | "download",
              errorCode: DriveErrorCode.ACTION_NOT_PERMITTED,
              errorMessage: `Token only allows '${tokenData.action}' access`,
              metadata: {
                allowedAction: tokenData.action,
                requestedAction: action as string,
              },
            },
            req
          );
          return handleAuthError(
            res,
            DriveErrorCode.ACTION_NOT_PERMITTED,
            `This token only allows '${tokenData.action}' access. Requested action '${action}' is not permitted.`
          );
        }

        // Find the asset to verify permissions
        const { assets } = await import("@shared/schema");
        const [asset] = await db
          .select()
          .from(assets)
          .where(eq(assets.driveFileId, fileId));

        if (!asset) {
          return res.status(404).json({
            message: "File not found. It may have been deleted.",
            code: "FILE_NOT_FOUND",
          });
        }

        // Check if user still has permission to access this asset
        const { checkAssetPermission } = await import(
          "../services/asset-permissions"
        );
        const permission = await checkAssetPermission(
          tokenData.userId,
          asset.id,
          asset.clientId,
          "read"
        );

        if (!permission.allowed) {
          return res.status(403).json({
            message:
              permission.reason ||
              "You no longer have permission to access this file.",
            code: "PERMISSION_REVOKED",
          });
        }

        // Check Drive file permissions
        const { checkAssetPermission: checkDrivePermission } = await import(
          "../middlewares/drive-file-permissions"
        );
        const drivePermission = await checkDrivePermission(
          tokenData.userId,
          asset.id,
          "read"
        );

        if (!drivePermission.allowed) {
          return res.status(403).json({
            message: drivePermission.reason || "Drive file access denied.",
            code: "DRIVE_PERMISSION_DENIED",
          });
        }

        // Get user's Drive connection
        const [connection] = await db
          .select()
          .from((await import("@shared/schema")).googleDriveConnections)
          .where(
            eq(
              (await import("@shared/schema")).googleDriveConnections.userId,
              tokenData.userId
            )
          );

        if (!connection) {
          return res.status(404).json({
            message:
              "Google Drive connection not found. Please reconnect your Drive account.",
            code: "DRIVE_CONNECTION_NOT_FOUND",
          });
        }

        // Check if token is expired and refresh if needed
        const { isTokenExpired, decryptTokens } = await import(
          "../utils/encryption"
        );
        let accessToken: string;

        if (isTokenExpired(connection.tokenExpiresAt)) {
          try {
            const { refreshUserTokens } = await import(
              "../middlewares/google-drive-auth"
            );
            const refreshedClient = await refreshUserTokens(
              tokenData.userId.toString()
            );
            accessToken = refreshedClient.credentials.access_token || "";
          } catch (refreshError) {
            console.error("Error refreshing Drive token:", refreshError);
            return res.status(401).json({
              message:
                "Your Google Drive session has expired. Please reconnect your Drive account.",
              code: "TOKEN_REFRESH_FAILED",
            });
          }
        } else {
          const tokens = decryptTokens({
            encryptedAccessToken: connection.encryptedAccessToken,
            encryptedRefreshToken: connection.encryptedRefreshToken,
            tokenExpiresAt: connection.tokenExpiresAt,
          });
          accessToken = tokens.access_token || "";
        }

        if (!accessToken) {
          return res.status(500).json({
            message:
              "Unable to obtain Drive access token. Please reconnect your Drive account.",
            code: "NO_ACCESS_TOKEN",
          });
        }

        // Download file from Google Drive
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            return res.status(404).json({
              message:
                "File not found in Google Drive. It may have been deleted or moved.",
              code: "DRIVE_FILE_NOT_FOUND",
            });
          }
          if (response.status === 403) {
            return res.status(403).json({
              message:
                "Access denied by Google Drive. You may no longer have permission to this file.",
              code: "DRIVE_ACCESS_DENIED",
            });
          }
          throw new Error(
            `Failed to download from Google Drive: ${response.status} ${response.statusText}`
          );
        }

        // For single-use download tokens, revoke after use
        if (action === "download") {
          await revokeSecureToken(token);
        }

        // Stream the file to the client
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Get user details for audit log
        const { users } = await import("@shared/schema");
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, tokenData.userId));

        // Log successful access
        await logDriveFileAccess(
          {
            userId: tokenData.userId,
            assetId: asset.id,
            driveFileId: fileId,
            action: action as "read" | "download",
            success: true,
            userRole: user?.role,
            clientId: asset.clientId,
            metadata: {
              fileSize: buffer.length,
              mimeType: asset.fileType,
            },
          },
          req
        );

        // Set appropriate headers
        res.setHeader("Content-Type", asset.fileType);
        if (action === "download") {
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${asset.originalFileName}"`
          );
        }
        res.setHeader("Content-Length", buffer.length);
        res.setHeader("Cache-Control", "private, max-age=300"); // 5 minute cache
        res.setHeader("X-Content-Source", "google-drive");

        res.send(buffer);
      } catch (error) {
        console.error("Error accessing secure Drive file:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Log failed access
        await logFailedAccess(
          {
            driveFileId: fileId,
            action: action as "read" | "download",
            errorCode: DriveErrorCode.FILE_ACCESS_ERROR,
            errorMessage: errorMessage,
          },
          req
        );

        res.status(500).json({
          message:
            "Failed to access Drive file. Please try again later or request a new link.",
          code: "FILE_ACCESS_ERROR",
          details: errorMessage,
        });
      }
    }
  );

  // Get cached thumbnail for a Drive file
  app.get(
    "/api/google-drive/files/:fileId/thumbnail",
    driveThumbnailRateLimit,
    googleAuthMiddleware,
    async (req: RequestWithClientId, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({
            message:
              "Authentication required. Please sign in to view this thumbnail.",
            code: "UNAUTHORIZED",
          });
        }

        if (!req.googleAuth) {
          return res.status(401).json({
            message:
              "Google Drive authentication required. Please connect your Google Drive account.",
            code: "DRIVE_AUTH_REQUIRED",
          });
        }

        const { fileId } = req.params;
        const size =
          (req.query.size as "small" | "medium" | "large") || "medium";

        if (!fileId) {
          return res.status(400).json({
            message: "File ID is required in the request",
            code: "MISSING_FILE_ID",
          });
        }

        // Validate Drive file ID format
        const { isValidDriveFileId } = await import(
          "../services/drive-secure-access"
        );
        if (!isValidDriveFileId(fileId)) {
          return res.status(400).json({
            message:
              "Invalid Drive file ID format. The file ID contains invalid characters.",
            code: "INVALID_FILE_ID",
          });
        }

        // Validate size parameter
        if (!["small", "medium", "large"].includes(size)) {
          return res.status(400).json({
            message:
              "Invalid thumbnail size. Must be 'small', 'medium', or 'large'",
            code: "INVALID_SIZE",
          });
        }

        // Find the asset associated with this Drive file
        const { assets } = await import("@shared/schema");
        const [asset] = await db
          .select()
          .from(assets)
          .where(eq(assets.driveFileId, fileId));

        if (!asset) {
          return res.status(404).json({
            message:
              "Asset not found. The file may have been deleted or you don't have access.",
            code: "ASSET_NOT_FOUND",
          });
        }

        // Check if user has permission to access this asset
        const { checkAssetPermission } = await import(
          "../services/asset-permissions"
        );
        const permission = await checkAssetPermission(
          req.session.userId,
          asset.id,
          asset.clientId,
          "read"
        );

        if (!permission.allowed) {
          return res.status(403).json({
            message:
              permission.reason ||
              "You don't have permission to view this file. Contact your administrator for access.",
            code: "PERMISSION_DENIED",
            requiredPermission: "read",
          });
        }

        // Check Drive file permissions
        const { checkAssetPermission: checkDrivePermission } = await import(
          "../middlewares/drive-file-permissions"
        );
        const drivePermission = await checkDrivePermission(
          req.session.userId,
          asset.id,
          "read"
        );

        if (!drivePermission.allowed) {
          return res.status(403).json({
            message:
              drivePermission.reason ||
              "You don't have permission to access this Drive file.",
            code: "DRIVE_PERMISSION_DENIED",
          });
        }

        // Fetch and cache the thumbnail
        const { fetchAndCacheThumbnail } = await import(
          "../services/drive-thumbnail-cache"
        );

        if (!asset.driveLastModified || !asset.driveThumbnailUrl) {
          return res.status(404).json({
            message: "No thumbnail available for this file type",
            code: "NO_THUMBNAIL",
          });
        }

        const driveClient = createDriveClient(req.googleAuth);
        const result = await fetchAndCacheThumbnail(
          driveClient,
          asset.id,
          fileId,
          asset.driveLastModified,
          asset.driveThumbnailUrl,
          size
        );

        // Read and serve the cached thumbnail
        const fs = await import("node:fs/promises");
        const thumbnailData = await fs.readFile(result.path);

        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=604800"); // 7 days
        res.setHeader("X-Thumbnail-Cached", result.cached.toString());
        res.setHeader("X-Cache-Expires", result.expiresAt.toISOString());
        res.send(thumbnailData);
      } catch (error) {
        console.error("Error fetching Drive thumbnail:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({
          message: "Failed to fetch thumbnail. Please try again later.",
          code: "THUMBNAIL_FETCH_ERROR",
          details: errorMessage,
        });
      }
    }
  );

  // Invalidate cached thumbnail for a Drive file
  app.delete(
    "/api/google-drive/files/:fileId/thumbnail/cache",
    googleAuthMiddleware,
    async (req: RequestWithClientId, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const { fileId } = req.params;

        if (!fileId) {
          return res.status(400).json({ message: "File ID is required" });
        }

        // Find the asset associated with this Drive file
        const { assets } = await import("@shared/schema");
        const [asset] = await db
          .select()
          .from(assets)
          .where(eq(assets.driveFileId, fileId));

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        // Check if user has permission to manage this asset
        const { checkAssetPermission } = await import(
          "../services/asset-permissions"
        );
        const permission = await checkAssetPermission(
          req.session.userId,
          asset.id,
          asset.clientId,
          "write"
        );

        if (!permission.allowed) {
          return res.status(403).json({
            message: "Not authorized to manage this file",
          });
        }

        // Invalidate the cache
        const { invalidateThumbnailCache } = await import(
          "../services/drive-thumbnail-cache"
        );
        await invalidateThumbnailCache(asset.id);

        res.json({ message: "Thumbnail cache invalidated successfully" });
      } catch (error) {
        console.error("Error invalidating thumbnail cache:", error);
        res.status(500).json({ message: "Error invalidating cache" });
      }
    }
  );

  // Get thumbnail cache statistics (admin only)
  app.get("/api/google-drive/thumbnail-cache/stats", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if user is admin or super_admin
      const { users } = await import("@shared/schema");
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId));

      if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { getThumbnailCacheStats } = await import(
        "../services/drive-thumbnail-cache"
      );
      const stats = await getThumbnailCacheStats();

      res.json(stats);
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ message: "Error fetching cache stats" });
    }
  });

  // Clear expired thumbnails (admin only)
  app.post(
    "/api/google-drive/thumbnail-cache/clear-expired",
    async (req, res) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        // Check if user is admin or super_admin
        const { users } = await import("@shared/schema");
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.session.userId));

        if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { clearExpiredThumbnails } = await import(
          "../services/drive-thumbnail-cache"
        );
        const cleared = await clearExpiredThumbnails();

        res.json({
          message: `Cleared ${cleared} expired thumbnail(s)`,
          cleared,
        });
      } catch (error) {
        console.error("Error clearing expired thumbnails:", error);
        res.status(500).json({ message: "Error clearing expired thumbnails" });
      }
    }
  );

  // Disconnect Google Drive endpoint
  app.delete("/api/google-drive/disconnect", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userIdNum = req.session.userId;

      // Get the user's Google Drive connection
      const [connection] = await db
        .select()
        .from((await import("@shared/schema")).googleDriveConnections)
        .where(
          eq(
            (await import("@shared/schema")).googleDriveConnections.userId,
            userIdNum
          )
        );

      if (!connection) {
        return res
          .status(404)
          .json({ message: "No Google Drive connection found" });
      }

      // Decrypt tokens to revoke them with Google
      const { decryptTokens } = await import("../utils/encryption");
      const tokens = decryptTokens({
        encryptedAccessToken: connection.encryptedAccessToken,
        encryptedRefreshToken: connection.encryptedRefreshToken,
        tokenExpiresAt: connection.tokenExpiresAt,
      });

      // Revoke the token with Google
      // We can revoke either the access token or refresh token
      // Revoking the refresh token will also revoke all associated access tokens
      const tokenToRevoke = tokens.refresh_token || tokens.access_token;

      if (tokenToRevoke) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `token=${tokenToRevoke}`,
          });

          // Google returns 200 on success, 400 on error
          if (!response.ok) {
            console.warn(
              "Failed to revoke token with Google:",
              response.status
            );
            // Continue with local cleanup even if revocation fails
          }
        } catch (error) {
          console.error("Error revoking token with Google:", error);
          // Continue with local cleanup even if revocation fails
        }
      }

      // Delete the connection from database
      await db
        .delete((await import("@shared/schema")).googleDriveConnections)
        .where(
          eq(
            (await import("@shared/schema")).googleDriveConnections.userId,
            userIdNum
          )
        );

      res.json({ message: "Successfully disconnected from Google Drive" });
    } catch (error) {
      console.error("Error disconnecting Google Drive:", error);
      res.status(500).json({ message: "Error disconnecting Google Drive" });
    }
  });
}
