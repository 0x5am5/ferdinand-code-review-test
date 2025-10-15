/**
 * Drive File Permission Middleware
 *
 * This middleware enforces Ferdinand's role-based permissions on imported
 * Google Drive files. It should be used on all API endpoints that access,
 * modify, or delete Drive-sourced assets.
 */

import type { Asset } from "@shared/schema";
import { assets, users } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Response } from "express";
import { db } from "../db";
import type { RequestWithClientId } from "../routes";
import {
  checkDriveFilePermission,
  type DriveFileAction,
} from "../services/drive-file-permissions";
import { parseDriveSharingMetadata } from "../services/google-drive";

/**
 * Extended request type that includes asset information
 */
export interface RequestWithAsset extends RequestWithClientId {
  asset?: Asset;
  user?: typeof users.$inferSelect;
}

/**
 * Middleware factory that creates permission checkers for specific actions
 *
 * @param action - The Drive file action to check (read, write, delete, share)
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // Protect an endpoint that reads/views assets
 * app.get("/api/assets/:id", requireDrivePermission("read"), async (req, res) => {
 *   // User has been verified to have read permission
 *   res.json(req.asset);
 * });
 *
 * // Protect an endpoint that modifies assets
 * app.put("/api/assets/:id", requireDrivePermission("write"), async (req, res) => {
 *   // User has been verified to have write permission
 * });
 * ```
 */
export function requireDrivePermission(action: DriveFileAction) {
  return async (
    req: RequestWithAsset,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Ensure user is authenticated
      if (!req.session?.userId) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      // Get asset ID from params or body
      const assetId = req.params.id || req.params.assetId || req.body.assetId;
      if (!assetId) {
        res.status(400).json({ message: "Asset ID is required" });
        return;
      }

      // Fetch the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, parseInt(assetId, 10)));

      if (!asset) {
        res.status(404).json({ message: "Asset not found" });
        return;
      }

      // Only apply Drive permissions if this is a Google Drive file
      if (!asset.isGoogleDrive) {
        // For non-Drive files, just attach the asset and continue
        req.asset = asset;
        next();
        return;
      }

      // Fetch the user to get their role
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId));

      if (!user) {
        res.status(401).json({ message: "User not found" });
        return;
      }

      // Parse Drive sharing metadata
      const driveMetadata = parseDriveSharingMetadata(asset);

      // Check permissions
      const permissionCheck = checkDriveFilePermission(
        req.session.userId,
        user.role,
        action,
        {
          uploadedBy: asset.uploadedBy,
          visibility: asset.visibility,
          isGoogleDrive: asset.isGoogleDrive,
          driveOwner: asset.driveOwner,
          driveMetadata: driveMetadata || undefined,
        }
      );

      if (!permissionCheck.allowed) {
        res.status(403).json({
          message: permissionCheck.reason || "Permission denied",
          action,
          userRole: user.role,
        });
        return;
      }

      // Attach asset and user to request for downstream handlers
      req.asset = asset;
      req.user = user;

      next();
    } catch (error) {
      console.error("Error checking Drive file permission:", error);
      res.status(500).json({ message: "Error verifying permissions" });
    }
  };
}

/**
 * Convenience middleware for read permission
 */
export const requireDriveReadPermission = requireDrivePermission("read");

/**
 * Convenience middleware for write permission
 */
export const requireDriveWritePermission = requireDrivePermission("write");

/**
 * Convenience middleware for delete permission
 */
export const requireDriveDeletePermission = requireDrivePermission("delete");

/**
 * Convenience middleware for share permission
 */
export const requireDriveSharePermission = requireDrivePermission("share");

/**
 * Middleware to check if user can access a client's assets
 *
 * This checks if the user has access to the client specified in the request
 * and is a prerequisite for Drive file permission checks.
 */
export async function validateAssetClientAccess(
  req: RequestWithClientId,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.session?.userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!req.clientId && !req.params.clientId && !req.body.clientId) {
      res.status(400).json({ message: "Client ID is required" });
      return;
    }

    const clientId =
      req.clientId ||
      parseInt(req.params.clientId, 10) ||
      parseInt(req.body.clientId, 10);

    // Fetch the user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId));

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    // Super admins have access to all clients
    if (user.role === "super_admin") {
      next();
      return;
    }

    // Check if user has access to this client
    const { userClients } = await import("@shared/schema");
    const [userClient] = await db
      .select()
      .from(userClients)
      .where(
        and(
          eq(userClients.userId, req.session.userId),
          eq(userClients.clientId, clientId)
        )
      );

    if (!userClient) {
      res.status(403).json({
        message: "You do not have access to this client",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Error validating client access:", error);
    res.status(500).json({ message: "Error verifying client access" });
  }
}

/**
 * Helper function to check permissions programmatically (not as middleware)
 *
 * Use this in route handlers when you need to check permissions conditionally
 * or for multiple assets.
 *
 * @example
 * ```typescript
 * const hasPermission = await checkAssetPermission(
 *   req.session.userId,
 *   assetId,
 *   "write"
 * );
 *
 * if (!hasPermission.allowed) {
 *   return res.status(403).json({ message: hasPermission.reason });
 * }
 * ```
 */
export async function checkAssetPermission(
  userId: number,
  assetId: number,
  action: DriveFileAction
): Promise<{ allowed: boolean; reason?: string; asset?: Asset }> {
  try {
    // Fetch the asset
    const [asset] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, assetId));

    if (!asset) {
      return { allowed: false, reason: "Asset not found" };
    }

    // For non-Drive files, allow all actions (handled by other middleware)
    if (!asset.isGoogleDrive) {
      return { allowed: true, asset };
    }

    // Fetch the user
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return { allowed: false, reason: "User not found" };
    }

    // Parse Drive metadata
    const driveMetadata = parseDriveSharingMetadata(asset);

    // Check permissions
    const permissionCheck = checkDriveFilePermission(
      userId,
      user.role,
      action,
      {
        uploadedBy: asset.uploadedBy,
        visibility: asset.visibility,
        isGoogleDrive: asset.isGoogleDrive,
        driveOwner: asset.driveOwner,
        driveMetadata: driveMetadata || undefined,
      }
    );

    return {
      allowed: permissionCheck.allowed,
      reason: permissionCheck.reason,
      asset,
    };
  } catch (error) {
    console.error("Error checking asset permission:", error);
    return { allowed: false, reason: "Error checking permissions" };
  }
}
