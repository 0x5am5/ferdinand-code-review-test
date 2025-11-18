import {
  canManageClients,
  canManageUsers,
  canModifyResource,
  hasMinimumRole,
  hasPermission,
  PermissionAction,
  type PermissionActionType,
  Resource,
  type ResourceType,
} from "@shared/permissions";
import { useMemo } from "react";
import { useAuth } from "./use-auth";

export interface UsePermissionsResult {
  /**
   * Check if the current user has permission to perform an action on a resource
   *
   * @example
   * can(PermissionAction.CREATE, Resource.BRAND_ASSETS)
   * can('create', 'brand_assets')
   */
  can: (action: PermissionActionType, resource: ResourceType) => boolean;

  /**
   * Check if the current user meets or exceeds a minimum role level
   *
   * @example
   * hasRole(UserRole.EDITOR)
   * hasRole('editor')
   */
  hasRole: (minimumRole: string) => boolean;

  /**
   * Check if the current user can modify a specific resource (considering ownership)
   *
   * @example
   * canModify(PermissionAction.DELETE, Resource.BRAND_ASSETS, assetOwnerId)
   */
  canModify: (
    action: PermissionActionType,
    resource: ResourceType,
    resourceOwnerId: number | null
  ) => boolean;

  /**
   * Check if the current user can manage users
   */
  canManageUsers: boolean;

  /**
   * Check if the current user can manage clients (super_admin only)
   */
  canManageClients: boolean;

  /**
   * The current user's role
   */
  role: string | null;

  /**
   * Whether the user is authenticated
   */
  isAuthenticated: boolean;

  /**
   * Whether authentication is still loading
   */
  isLoading: boolean;
}

/**
 * Hook for checking user permissions in React components
 *
 * Provides a convenient interface for checking role-based permissions
 * and resource-specific access control.
 *
 * @example
 * function AssetManager() {
 *   const { can, hasRole, canModify } = usePermissions();
 *
 *   if (can(PermissionAction.CREATE, Resource.BRAND_ASSETS)) {
 *     return <Button>Create Asset</Button>;
 *   }
 *
 *   if (canModify(PermissionAction.DELETE, Resource.BRAND_ASSETS, assetOwnerId)) {
 *     return <Button>Delete</Button>;
 *   }
 *
 *   return null;
 * }
 */
export function usePermissions(): UsePermissionsResult {
  const { user, isLoading } = useAuth();

  const result = useMemo(() => {
    const role = user?.role || null;
    const isAuthenticated = !!user;
    const userId = user?.id || 0;

    return {
      can: (action: PermissionActionType, resource: ResourceType): boolean => {
        if (!role) return false;
        return hasPermission(role, action, resource);
      },

      hasRole: (minimumRole: string): boolean => {
        if (!role) return false;
        return hasMinimumRole(role, minimumRole);
      },

      canModify: (
        action: PermissionActionType,
        resource: ResourceType,
        resourceOwnerId: number | null
      ): boolean => {
        if (!role) return false;
        return canModifyResource(
          role,
          action,
          resource,
          resourceOwnerId,
          userId
        );
      },

      canManageUsers: role ? canManageUsers(role) : false,
      canManageClients: role ? canManageClients(role) : false,
      role,
      isAuthenticated,
      isLoading,
    };
  }, [user, isLoading]);

  return result;
}

/**
 * Re-export permission constants for convenience
 */
export { PermissionAction, Resource };
