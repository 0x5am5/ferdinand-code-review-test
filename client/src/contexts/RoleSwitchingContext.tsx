import { UserRole, type UserRoleType } from "@shared/schema";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/hooks/use-auth";

interface ViewingUser {
  id: number;
  name: string;
  email: string;
  role: UserRoleType;
  client_id?: number | null;
}

interface RoleSwitchingContextType {
  currentViewingRole: UserRoleType;
  actualUserRole: UserRoleType;
  currentViewingUser: ViewingUser | null;
  switchRole: (role: UserRoleType) => void;
  switchToUser: (user: ViewingUser) => void;
  resetRole: () => void;
  isRoleSwitched: boolean;
  isUserSwitched: boolean;
  isReady: boolean; // role switching state is initialized and ready to use
  canAccessCurrentPage: (role: UserRoleType) => boolean;
  getEffectiveClientId: () => number | null;
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
  const [currentViewingRole, setCurrentViewingRole] = useState<UserRoleType>(
    UserRole.GUEST
  );
  const [currentViewingUser, setCurrentViewingUser] =
    useState<ViewingUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const actualUserRole = user?.role || UserRole.GUEST;

  // Initialize role switching state once auth is resolved
  useEffect(() => {
    if (isLoading) return; // wait for auth to resolve

    if (user && user.role === UserRole.SUPER_ADMIN) {
      const persistedRole = sessionStorage.getItem("ferdinand_viewing_role");
      const persistedUser = sessionStorage.getItem("ferdinand_viewing_user");

      if (persistedUser) {
        try {
          const parsedUser = JSON.parse(persistedUser);
          setCurrentViewingUser(parsedUser);
          setCurrentViewingRole(parsedUser.role);
        } catch (e: unknown) {
          console.error("Error parsing persisted user:", e);
          sessionStorage.removeItem("ferdinand_viewing_user");
          setCurrentViewingUser(null);
          setCurrentViewingRole(UserRole.SUPER_ADMIN);
        }
      } else if (
        persistedRole &&
        Object.values(UserRole).includes(persistedRole as UserRoleType)
      ) {
        setCurrentViewingUser(null);
        setCurrentViewingRole(persistedRole as UserRoleType);
      } else {
        setCurrentViewingUser(null);
        setCurrentViewingRole(UserRole.SUPER_ADMIN);
      }
    } else {
      // Not super admin: role switching disabled; use actual role and clear persisted values
      setCurrentViewingUser(null);
      setCurrentViewingRole(actualUserRole);
      sessionStorage.removeItem("ferdinand_viewing_role");
      sessionStorage.removeItem("ferdinand_viewing_user");
    }

    setIsReady(true);
  }, [isLoading, user, actualUserRole]);

// Persist changes to sessionStorage (only for super_admins and after ready)
  useEffect(() => {
    if (!isReady) return;
    if (user?.role === UserRole.SUPER_ADMIN) {
      if (currentViewingUser) {
        sessionStorage.setItem(
          "ferdinand_viewing_user",
          JSON.stringify(currentViewingUser)
        );
        sessionStorage.removeItem("ferdinand_viewing_role");
      } else {
        sessionStorage.setItem("ferdinand_viewing_role", currentViewingRole);
        sessionStorage.removeItem("ferdinand_viewing_user");
      }
    }
  }, [isReady, currentViewingRole, currentViewingUser, user?.role]);

  const switchRole = (role: UserRoleType) => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      setCurrentViewingRole(role);
      setCurrentViewingUser(null);
    }
  };

  const switchToUser = (viewingUser: ViewingUser) => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      setCurrentViewingUser(viewingUser);
      setCurrentViewingRole(viewingUser.role);
    }
  };

  const resetRole = useCallback(() => {
    setCurrentViewingRole(actualUserRole);
    setCurrentViewingUser(null);
    sessionStorage.removeItem("ferdinand_viewing_role");
    sessionStorage.removeItem("ferdinand_viewing_user");
  }, [actualUserRole]);

  const isRoleSwitched = currentViewingRole !== actualUserRole;
  const isUserSwitched = currentViewingUser !== null;

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
      if (
        (isRoleSwitched || isUserSwitched) &&
        !canAccessCurrentPage(currentViewingRole)
      ) {
        resetRole();
      }
    };

    // Check on mount
    handleRouteChange();

    // Listen for route changes (for SPA navigation)
    const handlePopState = () => {
      handleRouteChange();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [
    currentViewingRole,
    isRoleSwitched,
    isUserSwitched,
    resetRole,
    canAccessCurrentPage,
  ]);

  // Get the effective client ID for data filtering
  const getEffectiveClientId = (): number | null => {
    if (currentViewingUser) {
      // If viewing as a specific user, use their client ID for filtering
      return currentViewingUser.id;
    }

    // If just role switching (not user switching), the client ID should be managed
    // through the userClients relationship instead of user.client_id
    // For now, return null to indicate no direct client association
    return null;
  };

  const value: RoleSwitchingContextType = {
    currentViewingRole,
    actualUserRole,
    currentViewingUser,
    switchRole,
    switchToUser,
    resetRole,
    isRoleSwitched,
    isUserSwitched,
    isReady,
    canAccessCurrentPage,
    getEffectiveClientId,
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
