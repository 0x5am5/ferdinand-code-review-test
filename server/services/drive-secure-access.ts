import crypto from "node:crypto";
import { driveAccessTokens } from "@shared/schema";
import { and, count, eq, gt, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "../db";

/**
 * Google Drive Secure File Access Service
 *
 * This module provides secure, time-limited access to Google Drive files
 * through Ferdinand's permission system. It generates temporary access tokens
 * that can be used to stream or download Drive files without exposing long-lived
 * credentials.
 *
 * Tokens are now stored in the database for persistence and audit trail.
 *
 * @module drive-secure-access
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Temporary access token for Drive file
 */
export interface DriveAccessToken {
  token: string;
  fileId: string;
  assetId: number;
  userId: number;
  expiresAt: Date;
  action: "read" | "download" | "thumbnail";
}

/**
 * Result of generating a secure access URL
 */
export interface SecureUrlResult {
  url: string;
  token: string;
  expiresAt: Date;
  expiresInSeconds: number;
}

/**
 * Options for generating secure URLs
 */
export interface SecureUrlOptions {
  /** Asset ID for the Drive file */
  assetId: number;
  /** Google Drive file ID */
  driveFileId: string;
  /** User ID requesting access */
  userId: number;
  /** Action to perform (read, download, thumbnail) */
  action?: "read" | "download" | "thumbnail";
  /** Expiration time in seconds (default: 300 = 5 minutes) */
  expirationSeconds?: number;
}

// ============================================================================
// Database Token Management
// ============================================================================

/**
 * Clean up expired tokens from the database
 * This should be called periodically (via cron job or scheduled task)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await db
      .delete(driveAccessTokens)
      .where(lt(driveAccessTokens.expiresAt, new Date()));

    return result.rowCount || 0;
  } catch (error) {
    console.error("Error cleaning up expired tokens:", error);
    return 0;
  }
}

// Start periodic cleanup (every 5 minutes)
setInterval(
  async () => {
    const cleaned = await cleanupExpiredTokens();
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired Drive access tokens`);
    }
  },
  5 * 60 * 1000
);

// ============================================================================
// Secure URL Generation
// ============================================================================

/**
 * Generate a secure, time-limited URL for accessing a Drive file
 *
 * This creates a temporary access token that can be used to stream or download
 * a Drive file through Ferdinand's proxy endpoint. The token is short-lived
 * and tied to a specific user and file. Tokens are stored in the database
 * for persistence and audit trail.
 *
 * @param options - URL generation options
 * @returns Secure URL result with token and expiration info
 *
 * @example
 * ```typescript
 * const result = await generateSecureDriveUrl({
 *   assetId: 123,
 *   driveFileId: "abc123xyz",
 *   userId: 456,
 *   action: "download",
 *   expirationSeconds: 300 // 5 minutes
 * });
 *
 * console.log(result.url);
 * // => "/api/drive/secure/abc123def?token=xyz789"
 * ```
 */
export async function generateSecureDriveUrl(
  options: SecureUrlOptions
): Promise<SecureUrlResult> {
  const {
    assetId,
    driveFileId,
    userId,
    action = "read",
    expirationSeconds = 300, // Default: 5 minutes
  } = options;

  // Validate Drive file ID format
  if (!isValidDriveFileId(driveFileId)) {
    throw new Error(`Invalid Drive file ID format: ${driveFileId}`);
  }

  // Generate cryptographically secure random token
  const token = crypto.randomBytes(32).toString("base64url");

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

  // Store token in database
  await db.insert(driveAccessTokens).values({
    token,
    assetId,
    userId,
    driveFileId,
    action,
    expiresAt,
  });

  // Generate URL
  const url = `/api/drive/secure/${driveFileId}?token=${token}&action=${action}`;

  return {
    url,
    token,
    expiresAt,
    expiresInSeconds: expirationSeconds,
  };
}

/**
 * Validate a secure access token and retrieve associated data
 *
 * @param token - The access token to validate
 * @returns Token data if valid, null if invalid or expired
 */
export async function validateSecureToken(
  token: string
): Promise<DriveAccessToken | null> {
  try {
    const [tokenRecord] = await db
      .select()
      .from(driveAccessTokens)
      .where(
        and(
          eq(driveAccessTokens.token, token),
          // Check not revoked
          isNull(driveAccessTokens.revokedAt)
        )
      );

    if (!tokenRecord) {
      return null;
    }

    // Check if token has expired
    if (tokenRecord.expiresAt < new Date()) {
      // Clean up expired token
      await db
        .delete(driveAccessTokens)
        .where(eq(driveAccessTokens.id, tokenRecord.id));
      return null;
    }

    return {
      token: tokenRecord.token,
      fileId: tokenRecord.driveFileId,
      assetId: tokenRecord.assetId,
      userId: tokenRecord.userId,
      expiresAt: tokenRecord.expiresAt,
      action: tokenRecord.action as "read" | "download" | "thumbnail",
    };
  } catch (error) {
    console.error("Error validating secure token:", error);
    return null;
  }
}

/**
 * Revoke a secure access token (for single-use scenarios)
 *
 * @param token - The token to revoke
 */
export async function revokeSecureToken(token: string): Promise<void> {
  try {
    await db
      .update(driveAccessTokens)
      .set({ revokedAt: new Date() })
      .where(eq(driveAccessTokens.token, token));
  } catch (error) {
    console.error("Error revoking secure token:", error);
  }
}

/**
 * Get token store statistics (for monitoring)
 */
export async function getTokenStoreStats(): Promise<{
  activeTokens: number;
  expiredTokens: number;
  revokedTokens: number;
}> {
  try {
    const now = new Date();

    const [activeResult] = await db
      .select({ count: count() })
      .from(driveAccessTokens)
      .where(
        and(
          isNull(driveAccessTokens.revokedAt),
          gt(driveAccessTokens.expiresAt, now)
        )
      );

    const [expiredResult] = await db
      .select({ count: count() })
      .from(driveAccessTokens)
      .where(
        and(
          isNull(driveAccessTokens.revokedAt),
          lt(driveAccessTokens.expiresAt, now)
        )
      );

    const [revokedResult] = await db
      .select({ count: count() })
      .from(driveAccessTokens)
      .where(isNotNull(driveAccessTokens.revokedAt));

    return {
      activeTokens: Number(activeResult?.count || 0),
      expiredTokens: Number(expiredResult?.count || 0),
      revokedTokens: Number(revokedResult?.count || 0),
    };
  } catch (error) {
    console.error("Error getting token stats:", error);
    return {
      activeTokens: 0,
      expiredTokens: 0,
      revokedTokens: 0,
    };
  }
}

// ============================================================================
// Drive API URL Generation
// ============================================================================

/**
 * Generate a direct Google Drive API URL for file download
 *
 * This creates a URL that includes the OAuth access token as a query parameter.
 * The URL is valid as long as the access token is valid.
 *
 * @param driveFileId - Google Drive file ID
 * @param accessToken - Valid OAuth2 access token
 * @param action - Type of access (download or thumbnail)
 * @returns Direct Drive API URL
 */
export function generateDriveApiUrl(
  driveFileId: string,
  accessToken: string,
  action: "download" | "thumbnail" = "download"
): string {
  if (action === "thumbnail") {
    // Use Drive thumbnail endpoint
    return `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&access_token=${accessToken}`;
  }

  // Use Drive download endpoint
  return `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&access_token=${accessToken}`;
}

/**
 * Generate a Drive API URL with proper authentication headers (recommended)
 *
 * This returns the URL and the Authorization header value separately,
 * which is more secure than including the token in the URL.
 *
 * @param driveFileId - Google Drive file ID
 * @param accessToken - Valid OAuth2 access token
 * @returns Object with URL and authorization header
 */
export function generateDriveApiUrlWithHeader(
  driveFileId: string,
  accessToken: string
): { url: string; authHeader: string } {
  return {
    url: `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
    authHeader: `Bearer ${accessToken}`,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate Google Drive file ID format
 *
 * Drive file IDs are typically 25-44 characters long and contain
 * alphanumeric characters, hyphens, and underscores.
 * This helps prevent injection attacks and invalid requests.
 *
 * @param fileId - The file ID to validate
 * @returns True if valid format, false otherwise
 */
export function isValidDriveFileId(fileId: string): boolean {
  if (!fileId || typeof fileId !== "string") {
    return false;
  }

  // Check length (Drive file IDs are typically 25-44 characters)
  if (fileId.length < 10 || fileId.length > 100) {
    return false;
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  // Also allow forward slashes for folder IDs in some contexts
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(fileId)) {
    return false;
  }

  // Reject obviously malicious patterns
  const maliciousPatterns = [
    /\.\./, // Directory traversal
    /[<>]/, // HTML/XML injection
    /[;'"]/, // SQL/command injection
    /\$/, // Template injection
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(fileId)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a token is expired
 *
 * @param expiresAt - Expiration date
 * @returns True if expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return expiresAt < new Date();
}

/**
 * Calculate remaining time for a token
 *
 * @param expiresAt - Expiration date
 * @returns Remaining seconds (0 if expired)
 */
export function getRemainingTime(expiresAt: Date): number {
  const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
}

/**
 * Cleanup function for testing
 */
export async function cleanupTokenStore(): Promise<void> {
  // For backward compatibility with tests - just clean up expired tokens
  await cleanupExpiredTokens();
}
