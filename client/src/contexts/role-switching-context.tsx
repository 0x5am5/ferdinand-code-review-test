import { UserRole, type UserRoleType } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/hooks/use-auth";

interface RoleSwitchingContextType {
  currentViewingRole: UserRoleType;
  actualUserRole: UserRoleType;
  switchRole: (role: UserRoleType) => void;
  resetRole: () => void;
  isRoleSwitched: boolean;
  isReady: boolean; // role switching state is initialized and ready to use
  canAccessCurrentPage: (role: UserRoleType) => boolean;
}

const RoleSwitchingContext = createContext<
  RoleSwitchingContextType | undefined
>(undefined);

export function RoleSwitchingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [currentViewingRole, setCurrentViewingRole] = useState<UserRoleType>(
    UserRole.GUEST
  );
  const [isReady, setIsReady] = useState(false);
  const actualUserRole = user?.role || UserRole.GUEST;
  const isInitialMount = useRef(true);
  const hasCheckedInitialRoute = useRef(false);

  // Initialize role switching state once auth is resolved
  useEffect(() => {
    if (isLoading) return; // wait for auth to resolve

    const userRole = user?.role || UserRole.GUEST;

    if (user && user.role === UserRole.SUPER_ADMIN) {
      const persistedRole = sessionStorage.getItem("ferdinand_viewing_role");

      if (
        persistedRole &&
        Object.values(UserRole).includes(persistedRole as UserRoleType)
      ) {
        setCurrentViewingRole(persistedRole as UserRoleType);
      } else {
        setCurrentViewingRole(UserRole.SUPER_ADMIN);
      }
    } else {
      // Not super admin: role switching disabled; use actual role and clear persisted values
      setCurrentViewingRole(userRole);
      sessionStorage.removeItem("ferdinand_viewing_role");
    }

    setIsReady(true);
  }, [isLoading, user]);

  // Persist changes to sessionStorage (only for super_admins and after ready)
  useEffect(() => {
    if (!isReady) return;

    // Skip persistence on initial mount to avoid race condition
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (user?.role === UserRole.SUPER_ADMIN) {
      // If viewing role equals actual role, clear sessionStorage (not role switching)
      if (currentViewingRole === actualUserRole) {
        sessionStorage.removeItem("ferdinand_viewing_role");
      } else {
        // Otherwise persist the switched role
        sessionStorage.setItem("ferdinand_viewing_role", currentViewingRole);
      }
    }
  }, [currentViewingRole, user?.role, isReady, actualUserRole]);

  // Invalidate queries that depend on role/permissions
  const invalidateRoleRelatedQueries = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        if (typeof key !== "string") return false;
        // Invalidate queries that fetch role-dependent data
        return (
          key.startsWith("/api/clients") ||
          key.startsWith("/api/assets") ||
          key.startsWith("/api/users") ||
          key.startsWith("/api/invitations")
        );
      },
    });
  }, [queryClient]);

  const switchRole = useCallback(
    (role: UserRoleType) => {
      if (user?.role === UserRole.SUPER_ADMIN) {
        setCurrentViewingRole(role);
        // Invalidate role-related queries to force fresh data fetch with new role
        invalidateRoleRelatedQueries();
      }
    },
    [user?.role, invalidateRoleRelatedQueries]
  );

  const resetRole = useCallback(() => {
    setCurrentViewingRole(actualUserRole);
    sessionStorage.removeItem("ferdinand_viewing_role");
    // Invalidate role-related queries to force fresh data fetch with actual role
    invalidateRoleRelatedQueries();
  }, [actualUserRole, invalidateRoleRelatedQueries]);

  const isRoleSwitched = currentViewingRole !== actualUserRole;

  // Determine if a role can access the current page
  const canAccessCurrentPage = useCallback((role: UserRoleType): boolean => {
    const currentPath = window.location.pathname;

    // Dashboard is only accessible to super admins
    if (currentPath === "/dashboard") {
      return role === UserRole.SUPER_ADMIN;
    }

    // Users page is only accessible to admins and super admins
    if (currentPath === "/users") {
      return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
    }

    // Clients page is only accessible to admins and super admins
    if (currentPath === "/clients") {
      return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
    }

    // Design builder is accessible to super admins, admins, and editors
    if (currentPath === "/design-builder") {
      return (
        role === UserRole.SUPER_ADMIN ||
        role === UserRole.ADMIN ||
        role === UserRole.EDITOR
      );
    }

    // Client-specific pages (brand guidelines) are accessible to all roles
    if (currentPath.startsWith("/clients/")) {
      return true;
    }

    // Default: allow access
    return true;
  }, []);

  // Auto-revert when navigating to restricted pages
  useEffect(() => {
    const handleRouteChange = () => {
      if (isRoleSwitched && !canAccessCurrentPage(currentViewingRole)) {
        resetRole();
      }
    };

    // Check on initial mount only, not on every currentViewingRole change
    if (!hasCheckedInitialRoute.current && isReady) {
      hasCheckedInitialRoute.current = true;
      handleRouteChange();
    }

    // Listen for route changes (for SPA navigation)
    const handlePopState = () => {
      handleRouteChange();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [currentViewingRole, isRoleSwitched, resetRole, canAccessCurrentPage, isReady]);

  const value: RoleSwitchingContextType = {
    currentViewingRole,
    actualUserRole,
    switchRole,
    resetRole,
    isRoleSwitched,
    isReady,
    canAccessCurrentPage,
  };

  return (
    <RoleSwitchingContext.Provider value={value}>
      {children}
    </RoleSwitchingContext.Provider>
  );
}

export function useRoleSwitching() {
  const context = useContext(RoleSwitchingContext);
  if (context === undefined) {
    throw new Error(
      "useRoleSwitching must be used within a RoleSwitchingProvider"
    );
  }
  return context;
}
