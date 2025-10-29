/**
 * Drive File Permissions Service
 *
 * This service handles permission checks for Google Drive files
 * based on user roles and file ownership.
 */

export type DriveFileAction = "read" | "write" | "delete" | "share";

interface DriveFilePermissionContext {
  uploadedBy: number;
  visibility: "private" | "shared";
  isGoogleDrive: boolean;
  driveOwner: number;
  driveMetadata?: unknown;
}

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a user has permission to perform an action on a Drive file
 */
export function checkDriveFilePermission(
  userId: number,
  userRole: string,
  action: DriveFileAction,
  context: DriveFilePermissionContext
): PermissionCheckResult {
  // Super admins can do anything
  if (userRole === "super_admin") {
    return { allowed: true };
  }

  // Guests can only read shared files
  if (userRole === "guest") {
    if (action !== "read") {
      return { allowed: false, reason: "Guests can only read files" };
    }
    if (context.visibility !== "shared") {
      return { allowed: false, reason: "Guests can only access shared files" };
    }
    return { allowed: true };
  }

  // Standard users can read shared files and modify their own files
  if (userRole === "standard") {
    if (action === "read") {
      if (context.visibility === "shared") {
        return { allowed: true };
      }
      if (context.uploadedBy === userId) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "Cannot read private files owned by others",
      };
    }

    if (action === "write" || action === "delete") {
      if (context.uploadedBy === userId) {
        return { allowed: true };
      }
      return { allowed: false, reason: "Can only modify own files" };
    }

    if (action === "share") {
      if (context.uploadedBy === userId) {
        return { allowed: true };
      }
      return { allowed: false, reason: "Can only share own files" };
    }
  }

  // Editors and admins can read all files and modify most files
  if (userRole === "editor" || userRole === "admin") {
    if (action === "read") {
      return { allowed: true };
    }

    if (action === "write" || action === "delete") {
      // Can modify files they don't own, but not system files
      if (context.uploadedBy === userId) {
        return { allowed: true };
      }
      // For now, allow editors/admins to modify other files
      return { allowed: true };
    }

    if (action === "share") {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: "Unknown user role" };
}
