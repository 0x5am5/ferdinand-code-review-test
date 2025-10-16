/**
 * Google Drive File Permissions Service
 *
 * This module defines and enforces Ferdinand's role-based permission model
 * for imported Google Drive files.
 *
 * Permission Model:
 * - GUEST: Can only view files that are explicitly shared
 * - STANDARD: Can view all client files, can edit/delete own files
 * - EDITOR: Can view and edit all client files, can delete own files
 * - ADMIN: Full access to all client files (view, edit, delete)
 * - SUPER_ADMIN: Full access to all files across all clients
 */

import type { Asset, User } from "@shared/schema";
import { UserRole } from "@shared/schema";

/**
 * Drive file actions that can be performed
 */
export enum DriveFileAction {
  VIEW = "view",
  EDIT = "edit",
  DELETE = "delete",
  SHARE = "share",
}

/**
 * Drive sharing metadata structure
 */
export interface DriveSharingMetadata {
  isShared: boolean;
  sharedWith?: string[]; // Array of user emails
  ownerEmail?: string;
  visibility?: "private" | "shared" | "anyone_with_link";
  lastChecked?: Date;
}

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Ferdinand role to Drive file permission mapping
 *
 * This defines what actions each role can perform on Drive files
 */
export const ROLE_PERMISSIONS_MAP: Record<
  (typeof UserRole)[keyof typeof UserRole],
  {
    description: string;
    canView: (asset: Asset, user: User) => boolean;
    canEdit: (asset: Asset, user: User) => boolean;
    canDelete: (asset: Asset, user: User) => boolean;
    canShare: (asset: Asset, user: User) => boolean;
  }
> = {
  [UserRole.GUEST]: {
    description: "Can only view files that are explicitly shared",
    canView: (asset: Asset, user: User) => {
      // Guest can only view shared files
      if (asset.visibility === "private") {
        return false;
      }

      // Check if file is shared with this specific user
      const sharingMetadata =
        asset.driveSharingMetadata as DriveSharingMetadata | null;
      if (sharingMetadata?.isShared) {
        // If shared with specific users, check if user is in the list
        if (
          sharingMetadata.sharedWith &&
          Array.isArray(sharingMetadata.sharedWith)
        ) {
          return sharingMetadata.sharedWith.includes(user.email);
        }
        // If visibility is anyone_with_link or shared, allow
        if (
          sharingMetadata.visibility === "anyone_with_link" ||
          sharingMetadata.visibility === "shared"
        ) {
          return true;
        }
      }

      return false;
    },
    canEdit: () => false,
    canDelete: () => false,
    canShare: () => false,
  },

  [UserRole.STANDARD]: {
    description: "Can view all client files, can edit and delete own files",
    canView: (asset: Asset, user: User) => {
      // Standard users can view all files in their client
      return asset.clientId === user.id || asset.visibility === "shared";
    },
    canEdit: (asset: Asset, user: User) => {
      // Can only edit their own files
      return asset.uploadedBy === user.id;
    },
    canDelete: (asset: Asset, user: User) => {
      // Can only delete their own files
      return asset.uploadedBy === user.id;
    },
    canShare: (asset: Asset, user: User) => {
      // Can only share their own files
      return asset.uploadedBy === user.id;
    },
  },

  [UserRole.EDITOR]: {
    description: "Can view and edit all client files, can delete own files",
    canView: () => true, // Can view all client files
    canEdit: () => true, // Can edit all client files
    canDelete: (asset: Asset, user: User) => {
      // Can only delete their own files
      return asset.uploadedBy === user.id;
    },
    canShare: () => true, // Can share all client files
  },

  [UserRole.ADMIN]: {
    description: "Full access to all client files (view, edit, delete, share)",
    canView: () => true,
    canEdit: () => true,
    canDelete: () => true,
    canShare: () => true,
  },

  [UserRole.SUPER_ADMIN]: {
    description: "Full access to all files across all clients",
    canView: () => true,
    canEdit: () => true,
    canDelete: () => true,
    canShare: () => true,
  },
};

/**
 * Check if a user can perform a specific action on a Drive file
 */
export function canPerformAction(
  action: DriveFileAction,
  asset: Asset,
  user: User
): PermissionResult {
  const rolePermissions = ROLE_PERMISSIONS_MAP[user.role];

  if (!rolePermissions) {
    return {
      allowed: false,
      reason: `Invalid user role: ${user.role}`,
    };
  }

  let allowed = false;

  switch (action) {
    case DriveFileAction.VIEW:
      allowed = rolePermissions.canView(asset, user);
      break;
    case DriveFileAction.EDIT:
      allowed = rolePermissions.canEdit(asset, user);
      break;
    case DriveFileAction.DELETE:
      allowed = rolePermissions.canDelete(asset, user);
      break;
    case DriveFileAction.SHARE:
      allowed = rolePermissions.canShare(asset, user);
      break;
    default:
      return {
        allowed: false,
        reason: `Unknown action: ${action}`,
      };
  }

  if (!allowed) {
    return {
      allowed: false,
      reason: `User role '${user.role}' does not have permission to ${action} this file`,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can view a specific Drive file
 */
export function canViewDriveFile(asset: Asset, user: User): PermissionResult {
  return canPerformAction(DriveFileAction.VIEW, asset, user);
}

/**
 * Check if user can edit a specific Drive file
 */
export function canEditDriveFile(asset: Asset, user: User): PermissionResult {
  return canPerformAction(DriveFileAction.EDIT, asset, user);
}

/**
 * Check if user can delete a specific Drive file
 */
export function canDeleteDriveFile(asset: Asset, user: User): PermissionResult {
  return canPerformAction(DriveFileAction.DELETE, asset, user);
}

/**
 * Check if user can share a specific Drive file
 */
export function canShareDriveFile(asset: Asset, user: User): PermissionResult {
  return canPerformAction(DriveFileAction.SHARE, asset, user);
}

/**
 * Get all permissions for a user on a specific Drive file
 */
export function getDriveFilePermissions(asset: Asset, user: User) {
  return {
    canView: canViewDriveFile(asset, user).allowed,
    canEdit: canEditDriveFile(asset, user).allowed,
    canDelete: canDeleteDriveFile(asset, user).allowed,
    canShare: canShareDriveFile(asset, user).allowed,
  };
}

/**
 * Parse Drive sharing metadata from JSONB field
 */
export function parseDriveSharingMetadata(
  metadata: unknown
): DriveSharingMetadata | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const parsed = metadata as Record<string, unknown>;

  return {
    isShared: Boolean(parsed.isShared),
    sharedWith: Array.isArray(parsed.sharedWith)
      ? (parsed.sharedWith as string[])
      : undefined,
    ownerEmail:
      typeof parsed.ownerEmail === "string" ? parsed.ownerEmail : undefined,
    visibility:
      typeof parsed.visibility === "string"
        ? (parsed.visibility as "private" | "shared" | "anyone_with_link")
        : undefined,
    lastChecked: parsed.lastChecked
      ? new Date(parsed.lastChecked as string)
      : undefined,
  };
}

/**
 * Get human-readable permission description for a role
 */
export function getRolePermissionDescription(
  role: (typeof UserRole)[keyof typeof UserRole]
): string {
  return ROLE_PERMISSIONS_MAP[role]?.description || "Unknown role";
}
