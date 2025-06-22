import { FC, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRoleSwitching } from "@/contexts/RoleSwitchingContext";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({
  children,
  roles = [],
}) => {
  const { user, isLoading } = useAuth();
  const { currentViewingRole } = useRoleSwitching();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // Use the current viewing role for access control
  const roleToCheck = user.role === 'super_admin' ? currentViewingRole : user.role;
  
  if (roles.length > 0 && !roles.includes(roleToCheck)) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
};
