import { and, eq } from "drizzle-orm";
import type { Express } from "express";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import {
  googleAuthMiddleware,
  handleGoogleCallback,
} from "../middlewares/google-drive-auth";
import {
  driveImportRateLimit,
  driveListingRateLimit,
} from "../middlewares/rate-limit";
import {
  createDriveClient,
  importDriveFile,
  listDriveFiles,
  validateFileForImport,
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

      // Get user email to display in the connection status
      const [user] = await db
        .select()
        .from((await import("@shared/schema")).users)
        .where(
          eq((await import("@shared/schema")).users.id, connection.userId)
        );

      res.json({
        id: connection.id,
        userId: connection.userId,
        userEmail: user?.email || null,
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

  // List Drive files (for browsing)
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

  // Import Drive files via Google Picker (with progress tracking)
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

        // Verify user has access to this client (SUPER_ADMIN bypass)
        if (
          user.role !== (await import("@shared/schema")).UserRole.SUPER_ADMIN
        ) {
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
        }

        // Set up Server-Sent Events for progress tracking
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        const driveClient = createDriveClient(req.googleAuth);
        let importedCount = 0;
        let failedCount = 0;
        const failedFiles: string[] = [];

        // Process each file with progress updates
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          try {
            // Send progress update
            res.write(
              `data: ${JSON.stringify({
                status: "downloading",
                file: file.name,
                progress: i + 1,
                total: files.length,
                message: `Downloading ${file.name}...`,
              })}\n\n`
            );

            // Validate file for import
            const validation = validateFileForImport(file);
            if (!validation.valid) {
              throw new Error(validation.error);
            }

            // Import the file (download and store)
            const asset = await importDriveFile({
              userId: req.session.userId,
              userRole: user.role,
              clientId,
              driveFile: file,
              visibility: "shared",
              driveClient,
            });

            importedCount++;

            // Send success update
            res.write(
              `data: ${JSON.stringify({
                status: "completed",
                file: file.name,
                progress: i + 1,
                total: files.length,
                assetId: asset.id,
                message: `Successfully imported ${file.name}`,
              })}\n\n`
            );
          } catch (error) {
            console.error(`Failed to import file ${file.name}:`, error);
            failedCount++;
            failedFiles.push(file.name);

            // Send error update
            res.write(
              `data: ${JSON.stringify({
                status: "error",
                file: file.name,
                progress: i + 1,
                total: files.length,
                error: error instanceof Error ? error.message : "Unknown error",
                message: `Failed to import ${file.name}`,
              })}\n\n`
            );
          }
        }

        // Send final summary
        res.write(
          `data: ${JSON.stringify({
            status: "finished",
            imported: importedCount,
            failed: failedCount,
            errors: failedFiles.length > 0 ? failedFiles : undefined,
            message: `Import complete: ${importedCount} successful, ${failedCount} failed`,
          })}\n\n`
        );

        res.end();
      } catch (error) {
        console.error("Error importing Drive files:", error);

        // If headers haven't been sent yet, send JSON error
        if (!res.headersSent) {
          res.status(500).json({ message: "Error importing Drive files" });
        } else {
          // Send error through SSE
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
              message: "Import failed due to server error",
            })}\n\n`
          );
          res.end();
        }
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

          if (!response.ok) {
            console.warn(
              "Failed to revoke token with Google:",
              response.status
            );
          }
        } catch (error) {
          console.error("Error revoking token with Google:", error);
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
