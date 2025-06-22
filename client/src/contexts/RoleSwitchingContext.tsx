
import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';

interface RoleSwitchingContextType {
  currentViewingRole: UserRole;
  actualUserRole: UserRole;
  switchRole: (role: UserRole) => void;
  resetRole: () => void;
  isRoleSwitched: boolean;
  canAccessCurrentPage: (role: UserRole) => boolean;
}

const RoleSwitchingContext = createContext<RoleSwitchingContextType | undefined>(undefined);

export function RoleSwitchingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentViewingRole, setCurrentViewingRole] = useState<UserRole>(user?.role || UserRole.GUEST);
  const actualUserRole = user?.role || UserRole.GUEST;

  // Load persisted role from sessionStorage on mount
  useEffect(() => {
    if (user && user.role === UserRole.SUPER_ADMIN) {
      const persistedRole = sessionStorage.getItem('ferdinand_viewing_role');
      if (persistedRole && Object.values(UserRole).includes(persistedRole as UserRole)) {
        setCurrentViewingRole(persistedRole as UserRole);
      } else {
        setCurrentViewingRole(actualUserRole);
      }
    } else {
      setCurrentViewingRole(actualUserRole);
    }
  }, [user, actualUserRole]);

  // Persist role changes to sessionStorage
  useEffect(() => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      sessionStorage.setItem('ferdinand_viewing_role', currentViewingRole);
    }
  }, [currentViewingRole, user?.role]);

  const switchRole = (role: UserRole) => {
    if (user?.role === UserRole.SUPER_ADMIN) {
      setCurrentViewingRole(role);
    }
  };

  const resetRole = () => {
    setCurrentViewingRole(actualUserRole);
    sessionStorage.removeItem('ferdinand_viewing_role');
  };

  const isRoleSwitched = currentViewingRole !== actualUserRole;

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
    if (isRoleSwitched && !canAccessCurrentPage(currentViewingRole)) {
      resetRole();
    }
  }, [window.location.pathname, currentViewingRole, isRoleSwitched]);

  const value: RoleSwitchingContextType = {
    currentViewingRole,
    actualUserRole,
    switchRole,
    resetRole,
    isRoleSwitched,
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
    throw new Error('useRoleSwitching must be used within a RoleSwitchingProvider');
  }
  return context;
}
