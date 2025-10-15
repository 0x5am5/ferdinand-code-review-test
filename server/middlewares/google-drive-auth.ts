import { googleDriveConnections } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { NextFunction, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import type { RequestWithClientId } from "../routes";
import {
  decryptTokens,
  encryptTokens,
  isTokenExpired,
} from "../utils/encryption";

// Initialize the OAuth2 client
const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

// Required scopes for Drive API access
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

/**
 * Refresh Google OAuth tokens for a user
 * @param userId User ID to refresh tokens for
 * @returns Updated OAuth2Client with new tokens
 */
export async function refreshUserTokens(userId: string): Promise<OAuth2Client> {
  try {
    const userIdNum = parseInt(userId, 10);
    if (Number.isNaN(userIdNum)) {
      throw new Error("Invalid user ID");
    }

    // Get existing connection
    const [connection] = await db
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userIdNum));

    if (!connection) {
      throw new Error("No Google Drive connection found for user");
    }

    // Decrypt tokens
    const tokens = decryptTokens({
      encryptedAccessToken: connection.encryptedAccessToken,
      encryptedRefreshToken: connection.encryptedRefreshToken,
      tokenExpiresAt: connection.tokenExpiresAt,
    });

    // Create a new OAuth2Client instance for refreshing
    const refreshClient = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    });

    // Set the refresh token
    refreshClient.setCredentials({
      refresh_token: tokens.refresh_token,
    });

    // Request new access token
    const { credentials } = await refreshClient.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("Failed to obtain new access token");
    }

    // Encrypt new tokens - handle potential null values from Google's API
    const { encryptedAccessToken, encryptedRefreshToken, expiresAt } =
      encryptTokens({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date ?? undefined,
      });

    // Update database with new tokens
    await db
      .update(googleDriveConnections)
      .set({
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(googleDriveConnections.userId, userIdNum));

    console.log(`Successfully refreshed tokens for user ${userId}`);

    // Return client with updated credentials
    refreshClient.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || tokens.refresh_token,
      expiry_date: credentials.expiry_date,
    });

    return refreshClient;
  } catch (error) {
    console.error("Token refresh error:", error);
    throw new Error("Failed to refresh access token");
  }
}

export const googleAuthMiddleware = async (
  req: RequestWithClientId,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userIdNum = req.session.userId;

    // Retrieve token from database
    const [connection] = await db
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userIdNum));

    if (!connection) {
      // Generate OAuth URL for authentication
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
        state: req.clientId?.toString(), // Pass clientId as state to retrieve after auth
      });

      return res.status(401).json({
        message: "Google Drive authentication required",
        authUrl,
      });
    }

    // Check if token is expired or will expire soon
    if (isTokenExpired(connection.tokenExpiresAt)) {
      console.log(
        `Token expired for user ${req.session.userId}, refreshing...`
      );

      try {
        // Refresh tokens and get new OAuth client
        const refreshedClient = await refreshUserTokens(
          req.session.userId.toString()
        );

        // Add refreshed client to request
        req.googleAuth = refreshedClient;

        // Continue to next middleware
        return next();
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);

        // If refresh fails, user needs to re-authenticate
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: SCOPES,
          prompt: "consent",
          state: req.clientId?.toString(),
        });

        return res.status(401).json({
          message:
            "Google Drive authentication expired. Please re-authenticate.",
          authUrl,
          requiresReauth: true,
        });
      }
    }

    // Token is still valid - decrypt and use
    const tokens = decryptTokens({
      encryptedAccessToken: connection.encryptedAccessToken,
      encryptedRefreshToken: connection.encryptedRefreshToken,
      tokenExpiresAt: connection.tokenExpiresAt,
    });

    // Set credentials
    oauth2Client.setCredentials(tokens);

    // Update last used timestamp
    await db
      .update(googleDriveConnections)
      .set({ lastUsedAt: new Date() })
      .where(eq(googleDriveConnections.userId, userIdNum));

    // Add oauth client to request for use in route handlers
    req.googleAuth = oauth2Client;

    next();
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Google authentication error" });
  }
};

// OAuth callback handler
export const handleGoogleCallback = async (
  req: RequestWithClientId,
  res: Response
) => {
  try {
    if (!req.session.userId) {
      return res.redirect("/dashboard?google_auth=error&reason=not_authenticated");
    }

    const userIdNum = req.session.userId;

    const { code, state } = req.query;
    const { tokens } = await oauth2Client.getToken(code as string);

    // Encrypt tokens - handle potential null values from Google's API
    const { encryptedAccessToken, encryptedRefreshToken, expiresAt } =
      encryptTokens({
        access_token: tokens.access_token ?? undefined,
        refresh_token: tokens.refresh_token ?? undefined,
        expiry_date: tokens.expiry_date ?? undefined,
      });

    // Check if user already has a connection
    const [existingConnection] = await db
      .select()
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userIdNum));

    if (existingConnection) {
      // Update existing connection
      await db
        .update(googleDriveConnections)
        .set({
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt: expiresAt,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(googleDriveConnections.userId, userIdNum));
    } else {
      // Create new connection
      await db.insert(googleDriveConnections).values({
        userId: userIdNum,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
      });
    }

    // Redirect back to the referring page or dashboard
    // State parameter contains the client ID if coming from a client page
    const stateValue = state as string;
    const redirectUrl =
      stateValue && stateValue !== "undefined" && stateValue !== "dashboard"
        ? `/clients/${stateValue}?tab=assets&google_auth=success`
        : `/dashboard?google_auth=success`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google auth callback error:", error);
    res.redirect("/dashboard?google_auth=error");
  }
};
