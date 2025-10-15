import { UserRole } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import {
  googleAuthMiddleware,
  handleGoogleCallback,
} from "../middlewares/google-drive-auth";
import { validateClientId } from "../middlewares/vaildateClientId";
import {
  createDriveClient,
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

  // OAuth callback endpoint
  app.get("/api/auth/google/callback", handleGoogleCallback);

  // List Drive files
  app.get(
    "/api/drive/files",
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

  // Import Drive files endpoint (client-scoped)
  app.post(
    "/api/clients/:clientId/drive/import",
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

        // Check user role - guests cannot import files
        const [user] = await db
          .select()
          .from((await import("@shared/schema")).users)
          .where(
            eq((await import("@shared/schema")).users.id, req.session.userId)
          );

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        if (user.role === UserRole.GUEST) {
          return res
            .status(403)
            .json({ message: "Guests cannot import files" });
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
