import { assets, UserRole } from "@shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";

type Asset = typeof assets.$inferSelect;

export const checkAssetPermission = async (
  userId: number,
  assetId: number,
  clientId: number,
  requiredPermission: "read" | "write" | "delete"
): Promise<{ allowed: boolean; asset?: Asset }> => {
  // Get the asset
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), isNull(assets.deletedAt)));

  if (!asset) {
    return { allowed: false };
  }

  // Verify asset belongs to the client
  if (asset.clientId !== clientId) {
    return { allowed: false };
  }

  // Get user to check role
  const [user] = await db
    .select()
    .from((await import("@shared/schema")).users)
    .where(eq((await import("@shared/schema")).users.id, userId));

  if (!user) {
    return { allowed: false };
  }

  // Permission logic based on role and asset visibility
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isAdmin = user.role === UserRole.ADMIN;
  const isEditor = user.role === UserRole.EDITOR;
  const isOwner = asset.uploadedBy === userId;

  switch (requiredPermission) {
    case "read":
      // Guest can view shared assets only
      if (user.role === UserRole.GUEST) {
        return { allowed: asset.visibility === "shared", asset };
      }
      // All other roles can view if asset is shared or they own it
      return {
        allowed:
          asset.visibility === "shared" || isOwner || isAdmin || isSuperAdmin,
        asset,
      };

    case "write":
      // Guest cannot edit
      if (user.role === UserRole.GUEST) {
        return { allowed: false };
      }
      // Owner, editor, admin, and super admin can edit
      return {
        allowed: isOwner || isEditor || isAdmin || isSuperAdmin,
        asset,
      };

    case "delete":
      // Only owner, admin, or super admin can delete
      return { allowed: isOwner || isAdmin || isSuperAdmin, asset };

    default:
      return { allowed: false };
  }
};
