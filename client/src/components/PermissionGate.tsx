import type { PermissionActionType, ResourceType } from "@shared/permissions";
import type React from "react";
import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

interface PermissionGateProps {
  /**
   * The action to check (create, read, update, delete, etc.)
   */
  action: PermissionActionType;

  /**
   * The resource type to check (brand_assets, file_assets, etc.)
   */
  resource: ResourceType;

  /**
   * Optional: The owner ID of the resource (for ownership checks)
   * If provided, will check if user can modify this specific resource
   */
  resourceOwnerId?: number | null;

  /**
   * Optional: Minimum role required (alternative to action/resource check)
   * When provided, checks if user meets minimum role level instead
   */
  minimumRole?: string;

  /**
   * Content to render if user has permission
   */
  children: ReactNode;

  /**
   * Optional: Content to render if user lacks permission
   */
  fallback?: ReactNode;

  /**
   * Optional: Content to render while loading authentication state
   */
  loadingFallback?: ReactNode;
}

/**
 * Permission-based conditional rendering component
 *
 * Renders children only if the current user has the required permissions.
 * Can check either specific permissions (action + resource) or minimum role level.
 *
 * @example
 * // Check specific permission
 * <PermissionGate
 *   action={PermissionAction.CREATE}
 *   resource={Resource.BRAND_ASSETS}
 * >
 *   <Button>Create Asset</Button>
 * </PermissionGate>
 *
 * @example
 * // Check ownership for modify permissions
 * <PermissionGate
 *   action={PermissionAction.DELETE}
 *   resource={Resource.BRAND_ASSETS}
 *   resourceOwnerId={asset.createdBy}
 * >
 *   <Button>Delete</Button>
 * </PermissionGate>
 *
 * @example
 * // Check minimum role
 * <PermissionGate minimumRole={UserRole.ADMIN}>
 *   <AdminPanel />
 * </PermissionGate>
 *
 * @example
 * // With fallback content
 * <PermissionGate
 *   action={PermissionAction.CREATE}
 *   resource={Resource.BRAND_ASSETS}
 *   fallback={<div>You don't have permission to create assets</div>}
 * >
 *   <Button>Create Asset</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  action,
  resource,
  resourceOwnerId,
  minimumRole,
  children,
  fallback = null,
  loadingFallback = null,
}: PermissionGateProps) {
  const { can, hasRole, canModify, isLoading } = usePermissions();

  // Show loading state if provided
  if (isLoading && loadingFallback) {
    return <>{loadingFallback}</>;
  }

  // Check minimum role if provided
  if (minimumRole) {
    return hasRole(minimumRole) ? <>{children}</> : <>{fallback}</>;
  }

  // Check ownership-based permission if resourceOwnerId is provided
  if (resourceOwnerId !== undefined) {
    return canModify(action, resource, resourceOwnerId) ? (
      <>{children}</>
    ) : (
      <>{fallback}</>
    );
  }

  // Check general permission
  return can(action, resource) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Higher-order component for protecting entire components with permissions
 *
 * @example
 * const ProtectedAdminPanel = withPermission(
 *   AdminPanel,
 *   { minimumRole: UserRole.ADMIN },
 *   <AccessDenied />
 * );
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permissionProps: Omit<
    PermissionGateProps,
    "children" | "fallback" | "loadingFallback"
  >,
  fallback?: ReactNode,
  loadingFallback?: ReactNode
) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGate
        {...permissionProps}
        fallback={fallback}
        loadingFallback={loadingFallback}
      >
        <Component {...props} />
      </PermissionGate>
    );
  };
}
