import { hasMinimumRole } from "@shared/permissions";
import { UserRole } from "@shared/schema";
import { storage } from "../storage";

/**
 * Validation result for user role change operations
 */
interface RoleChangeValidation {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if an admin has access to manage a specific user
 * An admin can only manage users in their assigned clients
 */
async function canAdminAccessUser(
  adminId: number,
  targetUserId: number
): Promise<boolean> {
  const adminClients = await storage.getUserClients(adminId);
  const adminClientIds = adminClients.map((c) => c.id);

  const targetUserClients = await storage.getUserClients(targetUserId);

  // Check if there's any overlap in clients
  return targetUserClients.some((targetClient) =>
    adminClientIds.includes(targetClient.id)
  );
}

/**
 * Validate if a user can change another user's role
 *
 * Rules:
 * - Super admins can change any user's role to any role
 * - Admins can only assign editor, standard, or guest roles
 * - Admins cannot modify super_admin users
 * - Admins cannot change their own role
 * - Admins can only modify users in their assigned clients
 * - Other roles cannot change roles at all
 *
 * @param currentUser - The user attempting to make the change
 * @param targetUser - The user whose role is being changed
 * @param newRole - The new role being assigned
 * @returns Validation result with allowed flag and optional reason
 */
export async function validateRoleChange(
  currentUser: { id: number; role: string },
  targetUser: { id: number; role: string },
  newRole: string
): Promise<RoleChangeValidation> {
  // Only super admins and admins can change roles
  if (!hasMinimumRole(currentUser.role, UserRole.ADMIN)) {
    return {
      allowed: false,
      reason: "Insufficient permissions to change user roles",
    };
  }

  // Super admins can do anything
  if (currentUser.role === UserRole.SUPER_ADMIN) {
    return { allowed: true };
  }

  // From here, we're dealing with an admin
  // Admins cannot assign super_admin or admin roles
  if (newRole === UserRole.SUPER_ADMIN || newRole === UserRole.ADMIN) {
    return {
      allowed: false,
      reason: "Only super admins can assign admin roles",
    };
  }

  // Admins cannot modify super_admin users
  if (targetUser.role === UserRole.SUPER_ADMIN) {
    return {
      allowed: false,
      reason: "You cannot modify super admin roles",
    };
  }

  // Admins cannot change their own role
  if (targetUser.id === currentUser.id) {
    return {
      allowed: false,
      reason: "You cannot change your own role",
    };
  }

  // Verify the target user is in one of the admin's assigned clients
  const hasAccess = await canAdminAccessUser(currentUser.id, targetUser.id);
  if (!hasAccess) {
    return {
      allowed: false,
      reason: "You can only modify users in your assigned clients",
    };
  }

  return { allowed: true };
}

/**
 * Check if a user can delete another user
 *
 * Rules:
 * - Super admins can delete any user
 * - Admins can delete users in their assigned clients (except super_admins)
 * - Users cannot delete themselves
 * - Other roles cannot delete users
 *
 * @param currentUser - The user attempting the deletion
 * @param targetUser - The user being deleted
 * @returns Validation result with allowed flag and optional reason
 */
export async function validateUserDeletion(
  currentUser: { id: number; role: string },
  targetUser: { id: number; role: string }
): Promise<RoleChangeValidation> {
  // Only super admins and admins can delete users
  if (!hasMinimumRole(currentUser.role, UserRole.ADMIN)) {
    return {
      allowed: false,
      reason: "Insufficient permissions to delete users",
    };
  }

  // Users cannot delete themselves
  if (targetUser.id === currentUser.id) {
    return {
      allowed: false,
      reason: "You cannot delete your own account",
    };
  }

  // Super admins can delete anyone (except themselves, checked above)
  if (currentUser.role === UserRole.SUPER_ADMIN) {
    return { allowed: true };
  }

  // Admins cannot delete super_admin users
  if (targetUser.role === UserRole.SUPER_ADMIN) {
    return {
      allowed: false,
      reason: "You cannot delete super admin users",
    };
  }

  // Verify the target user is in one of the admin's assigned clients
  const hasAccess = await canAdminAccessUser(currentUser.id, targetUser.id);
  if (!hasAccess) {
    return {
      allowed: false,
      reason: "You can only delete users in your assigned clients",
    };
  }

  return { allowed: true };
}

/**
 * Check if a user can view the list of all users
 *
 * Rules:
 * - Super admins can view all users
 * - Admins can view users in their assigned clients
 * - Other roles cannot view user lists
 *
 * @param user - The user requesting the list
 * @returns true if the user can view users
 */
export function canViewUsers(user: { role: string }): boolean {
  return hasMinimumRole(user.role, UserRole.ADMIN);
}

/**
 * Filter users based on the current user's permissions
 *
 * @param currentUser - The user requesting the filtered list
 * @param allUsers - All users in the system
 * @returns Users the current user can see/manage
 */
export async function filterUsersForRole(
  currentUser: { id: number; role: string },
  allUsers: Array<{ id: number; role: string }>
): Promise<number[]> {
  // Super admins see everyone
  if (currentUser.role === UserRole.SUPER_ADMIN) {
    return allUsers.map((u) => u.id);
  }

  // Admins see users in their assigned clients
  if (currentUser.role === UserRole.ADMIN) {
    const adminClients = await storage.getUserClients(currentUser.id);
    const adminClientIds = adminClients.map((c) => c.id);

    // Batch fetch all user-client relationships
    const allUserIds = allUsers.map((u) => u.id);
    const userClientMap = await storage.getBatchUserClients(allUserIds);

    const visibleUserIds: number[] = [];

    for (const user of allUsers) {
      const userClientIds = userClientMap.get(user.id) || [];
      const hasSharedClient = userClientIds.some((clientId) =>
        adminClientIds.includes(clientId)
      );

      if (hasSharedClient) {
        visibleUserIds.push(user.id);
      }
    }

    return visibleUserIds;
  }

  // Other roles cannot view user lists
  return [];
}
