import { assets } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { checkAssetPermission } from "./asset-permissions";
/**
 * Update sharing settings for a single asset
 */
export const updateAssetSharing = async (options) => {
    const { userId, clientId, assetId, visibility } = options;
    // Check if user has permission to modify the asset
    const permission = await checkAssetPermission(userId, assetId, clientId, "write");
    if (!permission.allowed) {
        throw new Error(permission.reason || "Not authorized to modify this asset");
    }
    // Update visibility
    const [updatedAsset] = await db
        .update(assets)
        .set({
        visibility,
        updatedAt: new Date(),
    })
        .where(eq(assets.id, assetId))
        .returning();
    return updatedAsset;
};
/**
 * Update sharing settings for multiple assets
 */
export const bulkUpdateAssetSharing = async (options) => {
    const { userId, clientId, assetIds, visibility } = options;
    // Check permissions for all assets
    const permissionChecks = await Promise.all(assetIds.map((assetId) => checkAssetPermission(userId, assetId, clientId, "write")));
    // If any asset check fails, reject the entire operation
    const unauthorizedAssets = permissionChecks.filter((p) => !p.allowed);
    if (unauthorizedAssets.length > 0) {
        throw new Error("Not authorized to modify some assets");
    }
    // Update visibility for all assets
    const updatedAssets = await db
        .update(assets)
        .set({
        visibility,
        updatedAt: new Date(),
    })
        .where(inArray(assets.id, assetIds))
        .returning();
    return updatedAssets;
};
/**
 * Get current sharing settings for an asset
 */
export const getAssetSharing = async (userId, assetId, clientId) => {
    const permission = await checkAssetPermission(userId, assetId, clientId, "read");
    if (!permission.allowed || !permission.asset) {
        throw new Error(permission.reason || "Not authorized to view this asset");
    }
    return {
        visibility: permission.asset.visibility,
        isOwner: permission.asset.uploadedBy === userId,
    };
};
