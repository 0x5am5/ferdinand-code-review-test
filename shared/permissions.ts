import { UserRole } from "./schema";

/**
 * Role hierarchy levels for comparison
 * Higher number = more permissions
 */
export const ROLE_HIERARCHY = {
  [UserRole.GUEST]: 1,
  [UserRole.STANDARD]: 2,
  [UserRole.EDITOR]: 3,
  [UserRole.ADMIN]: 4,
  [UserRole.SUPER_ADMIN]: 5,
} as const;

/**
 * Permission actions that can be performed on resources
 */
export const PermissionAction = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  SHARE: "share",
  MANAGE_ROLES: "manage_roles",
} as const;

export type PermissionActionType =
  (typeof PermissionAction)[keyof typeof PermissionAction];

/**
 * Resources in the application that require permission checks
 */
export const Resource = {
  BRAND_ASSETS: "brand_assets",
  FILE_ASSETS: "file_assets",
  TYPE_SCALES: "type_scales",
  USER_PERSONAS: "user_personas",
  INSPIRATION_BOARDS: "inspiration_boards",
  USERS: "users",
  CLIENTS: "clients",
  SETTINGS: "settings",
  HIDDEN_SECTIONS: "hidden_sections",
  SLACK_INTEGRATION: "slack_integration",
} as const;

export type ResourceType = (typeof Resource)[keyof typeof Resource];

/**
 * Permission matrix mapping roles to allowed actions on resources
 * Based on RBAC_GUIDELINES.md
 */
export const ROLE_PERMISSIONS: Record<
  string,
  Partial<Record<ResourceType, PermissionActionType[]>>
> = {
  [UserRole.GUEST]: {
    [Resource.BRAND_ASSETS]: [PermissionAction.READ],
    [Resource.FILE_ASSETS]: [PermissionAction.READ],
    [Resource.TYPE_SCALES]: [PermissionAction.READ],
    [Resource.USER_PERSONAS]: [PermissionAction.READ],
    [Resource.INSPIRATION_BOARDS]: [PermissionAction.READ],
    [Resource.HIDDEN_SECTIONS]: [PermissionAction.READ],
  },
  [UserRole.STANDARD]: {
    [Resource.BRAND_ASSETS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
    ],
    [Resource.FILE_ASSETS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
    ],
    [Resource.TYPE_SCALES]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
    ],
    [Resource.USER_PERSONAS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
    ],
    [Resource.INSPIRATION_BOARDS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
    ],
    [Resource.HIDDEN_SECTIONS]: [PermissionAction.READ],
  },
  [UserRole.EDITOR]: {
    [Resource.BRAND_ASSETS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.FILE_ASSETS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
      PermissionAction.SHARE,
    ],
    [Resource.TYPE_SCALES]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.USER_PERSONAS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.INSPIRATION_BOARDS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.HIDDEN_SECTIONS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
  },
  [UserRole.ADMIN]: {
    [Resource.BRAND_ASSETS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.FILE_ASSETS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
      PermissionAction.SHARE,
    ],
    [Resource.TYPE_SCALES]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.USER_PERSONAS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.INSPIRATION_BOARDS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.HIDDEN_SECTIONS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.SLACK_INTEGRATION]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.USERS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
      PermissionAction.MANAGE_ROLES,
    ],
    [Resource.SETTINGS]: [PermissionAction.READ, PermissionAction.UPDATE],
  },
  [UserRole.SUPER_ADMIN]: {
    [Resource.BRAND_ASSETS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.FILE_ASSETS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
      PermissionAction.SHARE,
    ],
    [Resource.TYPE_SCALES]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.USER_PERSONAS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.INSPIRATION_BOARDS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.HIDDEN_SECTIONS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.SLACK_INTEGRATION]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.USERS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
      PermissionAction.MANAGE_ROLES,
    ],
    [Resource.CLIENTS]: [
      PermissionAction.READ,
      PermissionAction.CREATE,
      PermissionAction.UPDATE,
      PermissionAction.DELETE,
    ],
    [Resource.SETTINGS]: [PermissionAction.READ, PermissionAction.UPDATE],
  },
};

/**
 * Check if a user's role meets the minimum required role level
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if user meets or exceeds the required role level
 *
 * @example
 * hasMinimumRole(UserRole.ADMIN, UserRole.EDITOR) // true
 * hasMinimumRole(UserRole.GUEST, UserRole.EDITOR) // false
 */
export function hasMinimumRole(
  userRole: string,
  requiredRole: string
): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY];
  const requiredLevel =
    ROLE_HIERARCHY[requiredRole as keyof typeof ROLE_HIERARCHY];

  if (userLevel === undefined || requiredLevel === undefined) {
    return false;
  }

  return userLevel >= requiredLevel;
}

/**
 * Check if a user has permission to perform an action on a resource
 *
 * @param userRole - The user's current role
 * @param action - The action to perform (create, read, update, delete, etc.)
 * @param resource - The resource type (brand_assets, file_assets, etc.)
 * @returns true if user has permission for this action on this resource
 *
 * @example
 * hasPermission(UserRole.EDITOR, PermissionAction.CREATE, Resource.BRAND_ASSETS) // true
 * hasPermission(UserRole.GUEST, PermissionAction.DELETE, Resource.BRAND_ASSETS) // false
 */
export function hasPermission(
  userRole: string,
  action: PermissionActionType,
  resource: ResourceType
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];

  if (!rolePermissions) {
    return false;
  }

  const resourcePermissions = rolePermissions[resource];

  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}

/**
 * Check if a user can modify a specific resource (considering ownership)
 *
 * @param userRole - The user's current role
 * @param action - The action to perform (update or delete)
 * @param resource - The resource type
 * @param resourceOwnerId - The ID of the user who owns the resource
 * @param currentUserId - The ID of the current user
 * @returns true if user can perform the action on this specific resource
 *
 * @example
 * // Editor trying to delete any asset in their assigned clients
 * canModifyResource(UserRole.EDITOR, PermissionAction.DELETE, Resource.BRAND_ASSETS, 5, 10) // true
 *
 * // Standard trying to delete an asset (no delete permission)
 * canModifyResource(UserRole.STANDARD, PermissionAction.DELETE, Resource.BRAND_ASSETS, 5, 5) // false
 *
 * // Standard trying to update any asset in their assigned clients
 * canModifyResource(UserRole.STANDARD, PermissionAction.UPDATE, Resource.BRAND_ASSETS, 5, 10) // true
 *
 * // Admin trying to delete anyone's asset
 * canModifyResource(UserRole.ADMIN, PermissionAction.DELETE, Resource.BRAND_ASSETS, 5, 10) // true
 */
export function canModifyResource(
  userRole: string,
  action: PermissionActionType,
  resource: ResourceType,
  _resourceOwnerId: number | null,
  _currentUserId: number
): boolean {
  // First check if the role has the permission at all
  if (!hasPermission(userRole, action, resource)) {
    return false;
  }

  // Editor, Admin, and Super_Admin can modify any resource in their assigned clients
  // No ownership restrictions for these roles
  if (
    userRole === UserRole.EDITOR ||
    userRole === UserRole.ADMIN ||
    userRole === UserRole.SUPER_ADMIN
  ) {
    return true;
  }

  // Standard users can create and update any resource in their assigned clients
  // but cannot delete (no DELETE permission in matrix)
  if (userRole === UserRole.STANDARD) {
    if (
      action === PermissionAction.CREATE ||
      action === PermissionAction.UPDATE
    ) {
      return true;
    }
  }

  // For other actions (read, share), if they have permission, they can do it
  return true;
}

/**
 * Get all resources a role can access with a specific action
 *
 * @param userRole - The user's current role
 * @param action - The action to check
 * @returns Array of resource types the role can perform the action on
 *
 * @example
 * getAccessibleResources(UserRole.GUEST, PermissionAction.READ)
 * // Returns: ['brand_assets', 'file_assets', 'type_scales', 'user_personas', 'inspiration_boards']
 */
export function getAccessibleResources(
  userRole: string,
  action: PermissionActionType
): ResourceType[] {
  const rolePermissions = ROLE_PERMISSIONS[userRole];

  if (!rolePermissions) {
    return [];
  }

  return Object.entries(rolePermissions)
    .filter(([_, actions]) => actions.includes(action))
    .map(([resource]) => resource as ResourceType);
}

/**
 * Check if a role can manage users (admin-level permission)
 *
 * @param userRole - The user's current role
 * @returns true if user can manage users and roles
 */
export function canManageUsers(userRole: string): boolean {
  return hasMinimumRole(userRole, UserRole.ADMIN);
}

/**
 * Check if a role can manage clients (super_admin-only permission)
 *
 * @param userRole - The user's current role
 * @returns true if user can manage clients
 */
export function canManageClients(userRole: string): boolean {
  return userRole === UserRole.SUPER_ADMIN;
}
