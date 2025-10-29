import { assets, UserRole } from "@shared/schema";
import { and, eq, or } from "drizzle-orm";
import { db } from "../db";
const ROLE_PERMISSIONS = {
    [UserRole.GUEST]: ["read"],
    [UserRole.STANDARD]: ["read", "write"],
    [UserRole.EDITOR]: ["read", "write", "share"],
    [UserRole.ADMIN]: ["read", "write", "delete", "share"],
    [UserRole.SUPER_ADMIN]: ["read", "write", "delete", "share"],
};
/**
 * Check if a user has permission to perform an action on an asset
 */
export const checkAssetPermission = async (userId, assetId, clientId, permission) => {
    try {
        const userIdNum = typeof userId === "string" ? parseInt(userId, 10) : userId;
        // Get user's role
        const [user] = await db
            .select()
            .from((await import("@shared/schema")).users)
            .where(eq((await import("@shared/schema")).users.id, userIdNum));
        if (!user) {
            return { allowed: false, reason: "User not found" };
        }
        // Get the asset
        const [asset] = await db
            .select()
            .from(assets)
            .where(eq(assets.id, assetId));
        if (!asset) {
            return { allowed: false, reason: "Asset not found" };
        }
        // Verify asset belongs to the provided client
        if (asset.clientId !== clientId) {
            return { allowed: false, reason: "Asset not in client" };
        }
        // Verify client access - check both clientId and userId
        const [userClient] = await db
            .select()
            .from((await import("@shared/schema")).userClients)
            .where(and(eq((await import("@shared/schema")).userClients.clientId, clientId), eq((await import("@shared/schema")).userClients.userId, userIdNum)));
        if (!userClient) {
            return { allowed: false, reason: "Not authorized for this client" };
        }
        // Check if user has required role-based permission
        const allowedPermissions = ROLE_PERMISSIONS[user.role];
        if (!allowedPermissions.includes(permission)) {
            return {
                allowed: false,
                reason: `Role ${user.role} cannot ${permission} assets`,
            };
        }
        // For guests, only allow access to shared assets
        if (user.role === UserRole.GUEST && asset.visibility !== "shared") {
            return { allowed: false, reason: "Asset is not shared" };
        }
        // For standard users, check if they own the asset for write/delete
        if (user.role === UserRole.STANDARD) {
            if ((permission === "write" || permission === "delete") &&
                asset.uploadedBy !== userIdNum) {
                return { allowed: false, reason: "Can only modify own assets" };
            }
        }
        return { allowed: true, asset };
    }
    catch (error) {
        console.error("Error checking asset permission:", error);
        return { allowed: false, reason: "Error checking permissions" };
    }
};
/**
 * Get all assets a user has access to in a client
 */
export const getAccessibleAssets = async (userId, clientId) => {
    try {
        const userIdNum = typeof userId === "string" ? parseInt(userId, 10) : userId;
        // Get user's role
        const [user] = await db
            .select()
            .from((await import("@shared/schema")).users)
            .where(eq((await import("@shared/schema")).users.id, userIdNum));
        if (!user) {
            return [];
        }
        // Build query conditions based on role
        // Guests can only see shared assets
        if (user.role === UserRole.GUEST) {
            const accessibleAssets = await db
                .select()
                .from(assets)
                .where(and(eq(assets.clientId, clientId), eq(assets.visibility, "shared")));
            return accessibleAssets;
        }
        // Standard users can see shared assets and their own private assets
        else if (user.role === UserRole.STANDARD) {
            const accessibleAssets = await db
                .select()
                .from(assets)
                .where(and(eq(assets.clientId, clientId), or(eq(assets.visibility, "shared"), eq(assets.uploadedBy, userIdNum))));
            return accessibleAssets;
        }
        // Admins and editors can see all assets in the client
        const accessibleAssets = await db
            .select()
            .from(assets)
            .where(eq(assets.clientId, clientId));
        return accessibleAssets;
    }
    catch (error) {
        console.error("Error getting accessible assets:", error);
        return [];
    }
};
