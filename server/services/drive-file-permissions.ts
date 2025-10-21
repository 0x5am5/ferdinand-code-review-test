import { UserRole, type UserRoleType } from "@shared/schema";

/**
 * Google Drive File Permission Mapping for Ferdinand
 *
 * This module defines how Ferdinand's role-based access control system
 * integrates with imported Google Drive files. It maps Ferdinand user roles
 * to specific permissions on Drive files, taking into account both the
 * Drive file's sharing metadata and the user's role in Ferdinand.
 *
 * @module drive-file-permissions
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Actions that can be performed on imported Drive files
 */
export type DriveFileAction = "read" | "write" | "delete" | "share";

/**
 * Drive file sharing status from Google Drive API
 */
export interface DriveFileSharingMetadata {
  /** Whether the file is shared with others */
  isShared?: boolean;
  /** Whether the importing user is the owner in Google Drive */
  isOwnedByImporter?: boolean;
  /** Email/name of the original Drive file owner */
  driveOwner?: string;
  /** Whether the file has public link sharing enabled */
  hasPublicLink?: boolean;
  /** Drive permission level the importing user has (owner, writer, reader) */
  importerDriveRole?: "owner" | "writer" | "commenter" | "reader";
}

/**
 * Result of a permission check for a Drive file
 */
export interface DrivePermissionCheck {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Reason for denial if not allowed */
  reason?: string;
  /** The user's role in Ferdinand */
  userRole?: UserRoleType;
  /** Drive sharing metadata that influenced the decision */
  driveMetadata?: DriveFileSharingMetadata;
}

// ============================================================================
// Permission Mapping Rules
// ============================================================================

/**
 * Ferdinand Role-Based Permission Matrix for Drive Files
 *
 * This matrix defines what actions each Ferdinand role can perform on
 * imported Drive files, considering the file's sharing status.
 *
 * GUEST:
 *   - Can only VIEW files that are explicitly marked as "shared" in Ferdinand
 *   - Cannot upload/import Drive files
 *   - Cannot edit or delete any files
 *   - Serves as a read-only viewer for shared content
 *
 * STANDARD:
 *   - Can VIEW all Drive files in their client
 *   - Can EDIT only files they imported themselves (uploadedBy matches)
 *   - Cannot delete files
 *   - Can import Drive files (becomes owner in Ferdinand)
 *
 * EDITOR:
 *   - Can VIEW all Drive files in their client
 *   - Can EDIT all Drive files in their client
 *   - Cannot delete files
 *   - Can import Drive files
 *   - Can share files (generate public links)
 *
 * ADMIN / SUPER_ADMIN:
 *   - Full access to all Drive files
 *   - Can VIEW, EDIT, DELETE, and SHARE all files
 *   - Can import Drive files
 *   - Has complete control over Drive file assets
 */
export const DRIVE_FILE_PERMISSIONS = {
  [UserRole.GUEST]: {
    read: true, // Only if file visibility is "shared"
    write: false,
    delete: false,
    share: false,
    canImport: false, // Guests cannot import Drive files
  },
  [UserRole.STANDARD]: {
    read: true, // Can view all files in client
    write: true, // Only own files (checked separately)
    delete: false,
    share: false,
    canImport: true, // Can import Drive files
  },
  [UserRole.EDITOR]: {
    read: true,
    write: true, // Can edit all files
    delete: false,
    share: true, // Can create public links
    canImport: true,
  },
  [UserRole.ADMIN]: {
    read: true,
    write: true,
    delete: true,
    share: true,
    canImport: true,
  },
  [UserRole.SUPER_ADMIN]: {
    read: true,
    write: true,
    delete: true,
    share: true,
    canImport: true,
  },
} as const;

// ============================================================================
// Permission Checking Functions
// ============================================================================

/**
 * Checks if a user role has permission to perform an action on a Drive file
 *
 * @param userRole - The Ferdinand user role
 * @param action - The action to perform (read, write, delete, share)
 * @param options - Additional context for permission check
 * @returns Whether the action is allowed
 *
 * @example
 * ```typescript
 * // Check if a STANDARD user can edit their own file
 * const canEdit = hasPermission(UserRole.STANDARD, "write", {
 *   isOwner: true,
 *   assetVisibility: "shared"
 * });
 * ```
 */
export function hasPermission(
  userRole: UserRoleType,
  action: DriveFileAction,
  options: {
    /** Whether the user owns this file in Ferdinand (uploadedBy matches) */
    isOwner?: boolean;
    /** File visibility in Ferdinand (private/shared) */
    assetVisibility?: "private" | "shared";
    /** Drive sharing metadata */
    driveMetadata?: DriveFileSharingMetadata;
  } = {}
): boolean {
  const permissions =
    DRIVE_FILE_PERMISSIONS[userRole as keyof typeof DRIVE_FILE_PERMISSIONS];

  // Check if the role has the base permission
  if (!permissions[action as keyof typeof permissions]) {
    return false;
  }

  // Special rules for GUEST role
  if (userRole === UserRole.GUEST) {
    // Guests can only read shared files
    if (action === "read") {
      return options.assetVisibility === "shared";
    }
    return false;
  }

  // Special rules for STANDARD role
  if (userRole === UserRole.STANDARD) {
    // Standard users can only write/delete their own files
    if (action === "write" || action === "delete") {
      return options.isOwner === true;
    }
    return true;
  }

  // EDITOR, ADMIN, and SUPER_ADMIN have full permissions as defined
  return true;
}

/**
 * Determines the initial Ferdinand ownership and permissions when importing
 * a Drive file.
 *
 * @param importingUserId - The Ferdinand user ID of the user importing the file
 * @param userRole - The role of the importing user
 * @param driveMetadata - Google Drive sharing metadata
 * @returns Initial ownership and permission settings
 *
 * @example
 * ```typescript
 * const settings = getInitialImportPermissions(123, UserRole.STANDARD, {
 *   isShared: true,
 *   isOwnedByImporter: false,
 *   driveOwner: "jane@example.com"
 * });
 * // Returns:
 * // {
 * //   ferdinandOwner: 123,
 * //   initialVisibility: "shared",
 * //   storeDriveMetadata: {...}
 * // }
 * ```
 */
export function getInitialImportPermissions(
  importingUserId: number,
  _userRole: UserRoleType,
  driveMetadata: DriveFileSharingMetadata
) {
  // The importing user always becomes the owner in Ferdinand
  const ferdinandOwner = importingUserId;

  // Determine initial visibility based on Drive sharing status
  // If the file is shared in Drive or has a public link, default to "shared" in Ferdinand
  // Otherwise, default to "shared" (can be changed by user later)
  let initialVisibility: "private" | "shared" = "shared";

  if (driveMetadata.hasPublicLink || driveMetadata.isShared) {
    initialVisibility = "shared";
  }

  // Store Drive metadata for reference and potential sync
  const storeDriveMetadata = {
    isShared: driveMetadata.isShared ?? false,
    isOwnedByImporter: driveMetadata.isOwnedByImporter ?? false,
    driveOwner: driveMetadata.driveOwner,
    hasPublicLink: driveMetadata.hasPublicLink ?? false,
    importerDriveRole: driveMetadata.importerDriveRole ?? "reader",
    importedAt: new Date().toISOString(),
  };

  return {
    ferdinandOwner,
    initialVisibility,
    storeDriveMetadata,
  };
}

/**
 * Comprehensive permission check for Drive file operations
 *
 * This is the main function to use for checking permissions on imported
 * Drive files. It considers the user's role, ownership, and Drive sharing
 * metadata to make a permission decision.
 *
 * @param userId - Ferdinand user ID
 * @param userRole - User's role in Ferdinand
 * @param action - Action to perform
 * @param assetData - Asset information including ownership and Drive metadata
 * @returns Permission check result with detailed reason
 *
 * @example
 * ```typescript
 * const check = checkDriveFilePermission(
 *   userId: 123,
 *   userRole: UserRole.STANDARD,
 *   action: "write",
 *   assetData: {
 *     uploadedBy: 123,
 *     visibility: "shared",
 *     isGoogleDrive: true,
 *     driveOwner: "user@example.com"
 *   }
 * );
 *
 * if (!check.allowed) {
 *   console.log(check.reason); // "Role standard can only edit their own files"
 * }
 * ```
 */
export function checkDriveFilePermission(
  userId: number,
  userRole: UserRoleType,
  action: DriveFileAction,
  assetData: {
    uploadedBy: number;
    visibility: "private" | "shared";
    isGoogleDrive: boolean;
    driveOwner?: string | null;
    driveMetadata?: DriveFileSharingMetadata;
  }
): DrivePermissionCheck {
  // First check if user's role allows this action at all
  const basePermission =
    DRIVE_FILE_PERMISSIONS[userRole as keyof typeof DRIVE_FILE_PERMISSIONS];
  if (!basePermission[action as keyof typeof basePermission]) {
    return {
      allowed: false,
      reason: `Role ${userRole} does not have ${action} permission`,
      userRole,
    };
  }

  const isOwner = assetData.uploadedBy === userId;

  // Guest-specific checks
  if (userRole === UserRole.GUEST) {
    if (action === "read" && assetData.visibility === "shared") {
      return { allowed: true, userRole };
    }
    return {
      allowed: false,
      reason: "Guests can only view shared files",
      userRole,
    };
  }

  // Standard user-specific checks
  if (userRole === UserRole.STANDARD) {
    if ((action === "write" || action === "delete") && !isOwner) {
      return {
        allowed: false,
        reason: `Role ${userRole} can only ${action} their own files`,
        userRole,
      };
    }
  }

  // For all other roles with valid permissions, allow the action
  return {
    allowed: true,
    userRole,
    driveMetadata: assetData.driveMetadata,
  };
}

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Checks if a user can import Drive files based on their role
 */
export function canImportDriveFiles(userRole: UserRoleType): boolean {
  return DRIVE_FILE_PERMISSIONS[userRole as keyof typeof DRIVE_FILE_PERMISSIONS]
    .canImport;
}

/**
 * Gets a human-readable description of what a role can do with Drive files
 */
export function getRolePermissionDescription(userRole: UserRoleType): string {
  const perms =
    DRIVE_FILE_PERMISSIONS[userRole as keyof typeof DRIVE_FILE_PERMISSIONS];

  const actions: string[] = [];
  if (perms.read) actions.push("view");
  if (perms.write) {
    if (userRole === UserRole.STANDARD) {
      actions.push("edit own");
    } else {
      actions.push("edit");
    }
  }
  if (perms.delete) actions.push("delete");
  if (perms.share) actions.push("share");

  if (actions.length === 0) return "No permissions";

  return `${actions.join(", ")} Drive files`;
}

/**
 * Gets all permissions a role has for Drive files
 */
export function getRolePermissions(userRole: UserRoleType): {
  actions: DriveFileAction[];
  canImport: boolean;
  description: string;
} {
  const perms =
    DRIVE_FILE_PERMISSIONS[userRole as keyof typeof DRIVE_FILE_PERMISSIONS];
  const actions: DriveFileAction[] = [];

  if (perms.read) actions.push("read");
  if (perms.write) actions.push("write");
  if (perms.delete) actions.push("delete");
  if (perms.share) actions.push("share");

  return {
    actions,
    canImport: perms.canImport,
    description: getRolePermissionDescription(userRole),
  };
}
