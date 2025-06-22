
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';

interface ViewingUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  client_id?: number | null;
}

interface RoleSwitchingContextType {
  currentViewingRole: UserRole;
  actualUserRole: UserRole;
  currentViewingUser: ViewingUser | null;
  switchRole: (role: UserRole) => void;
  switchToUser: (user: ViewingUser) => void;
  resetRole: () => void;
  isRoleSwitched: boolean;
  isUserSwitched: boolean;
  canAccessCurrentPage: (role: UserRole) => boolean;
  getEffectiveClientId: () => number | null;
}

const RoleSwitchingContext = createContext<RoleSwitchingContextType | undefined>(undefined);

export function RoleSwitchingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentViewingRole, setCurrentViewingRole] = useState<UserRole>(user?.role || UserRole.GUEST);
  const [currentViewingUser, setCurrentViewingUser] = useState<ViewingUser | null>(null);
  const actualUserRole = user?.role || UserRole.GUEST;

  // Load persisted state from sessionStorage on mount
  useEffect(() => {
    if (user && user.role === UserRole.SUPER_ADMIN) {
      const persistedRole = sessionStorage.getItem('ferdinand_viewing_role');
      const persistedUser = sessionStorage.getItem('ferdinand_viewing_user');
      
      if (persistedUser) {
        try {
          const parsedUser = JSON.parse(persistedUser);
          setCurrentViewingUser(parsedUser);
          setCurrentViewingRole(parsedUser.role);
        } catch (e) {
          console.error('Error parsing persisted user:', e);
          sessionStorage.removeItem('ferdinand_viewing_user');
        }
      } else if (persistedRole && Object.values(UserRole).includes(persistedRole as UserRole)) {
        setCurrentViewingRole(persistedRole as UserRole);
        setCurrentViewingUser(null);
      } else {
        setCurrentViewingRole(actualUserRole);
        setCurrentViewingUser(null);
      }
    } else {
      setCurrentViewingRole(actualUserRole);
      setCurrentViewingUser(null);
    }
  }, [user, actualUserRole]);

  // Persist changes to sessionStorage
  useEffect(() => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      if (currentViewingUser) {
        sessionStorage.setItem('ferdinand_viewing_user', JSON.stringify(currentViewingUser));
        sessionStorage.removeItem('ferdinand_viewing_role');
      } else {
        sessionStorage.setItem('ferdinand_viewing_role', currentViewingRole);
        sessionStorage.removeItem('ferdinand_viewing_user');
      }
    }
  }, [currentViewingRole, currentViewingUser, user?.role]);

  const switchRole = (role: UserRole) => {
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

  const resetRole = () => {
    setCurrentViewingRole(actualUserRole);
    setCurrentViewingUser(null);
    sessionStorage.removeItem('ferdinand_viewing_role');
    sessionStorage.removeItem('ferdinand_viewing_user');
  };

  const isRoleSwitched = currentViewingRole !== actualUserRole;
  const isUserSwitched = currentViewingUser !== null;

  // Determine if a role can access the current page
  const canAccessCurrentPage = (role: UserRole): boolean => {
    const currentPath = window.location.pathname;
    
    // Dashboard is only accessible to super admins and admins
    if (currentPath === '/dashboard') {
      return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
    }
    
    // Users page is only accessible to admins and super admins
    if (currentPath === '/users') {
      return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
    }
    
    // Clients page is only accessible to admins and super admins  
    if (currentPath === '/clients') {
      return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
    }
    
    // Design builder is accessible to super admins, admins, and editors
    if (currentPath === '/design-builder') {
      return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || role === UserRole.EDITOR;
    }
    
    // Client-specific pages (brand guidelines) are accessible to all roles
    if (currentPath.startsWith('/clients/')) {
      return true;
    }
    
    // Default: allow access
    return true;
  };

  // Auto-revert when navigating to restricted pages
  useEffect(() => {
    if ((isRoleSwitched || isUserSwitched) && !canAccessCurrentPage(currentViewingRole)) {
      resetRole();
    }
  }, [window.location.pathname, currentViewingRole, isRoleSwitched, isUserSwitched]);

  // Get the effective client ID for data filtering
  const getEffectiveClientId = (): number | null => {
    if (currentViewingUser) {
      // If viewing as a specific user, use their client ID for filtering
      return currentViewingUser.id;
    }
    
    // If just role switching (not user switching), use actual user's client access
    return user?.client_id || null;
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
    throw new Error('useRoleSwitching must be used within a RoleSwitchingProvider');
  }
  return context;
}
