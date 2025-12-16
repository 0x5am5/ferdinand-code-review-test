import { UserRole } from "@shared/schema";
import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useRoleSwitching } from "@/contexts/role-switching-context";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({
  children,
  roles = [],
}) => {
  const { user, isLoading } = useAuth();
  const { currentViewingRole, isReady } = useRoleSwitching();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Determine which role to check: super_admins use the viewing role, others use their actual role
  const roleToCheck =
    user?.role === UserRole.SUPER_ADMIN ? currentViewingRole : user?.role;

  useEffect(() => {
    // Clear any stale redirect once authorized or when loading changes
    const isAuthorized =
      !!user &&
      (roles.length === 0 || (roleToCheck && roles.includes(roleToCheck)));

    if (isLoading || (user?.role === UserRole.SUPER_ADMIN && !isReady)) {
      return; // wait until ready to evaluate access for super_admins
    }

    if (!user) {
      setRedirectTo("/login");
      setRedirecting(false);
      return;
    }

    if (!isAuthorized) {
      setRedirecting(true);
      if (user.role !== UserRole.SUPER_ADMIN) {
        // Fetch their assigned clients and redirect to first one
        fetch("/api/user/clients")
          .then((res) => res.json())
          .then((assignedClients) => {
            const target =
              assignedClients && assignedClients.length > 0
                ? `/clients/${assignedClients[0].id}`
                : "/design-builder";
            const currentPath = window.location.pathname;
            if (target !== currentPath) {
              setRedirectTo(target);
            } else {
              setRedirectTo(null);
            }
          })
          .catch(() => {
            const target = "/design-builder";
            const currentPath = window.location.pathname;
            if (target !== currentPath) {
              setRedirectTo(target);
            } else {
              setRedirectTo(null);
            }
          })
          .finally(() => setRedirecting(false));
      } else {
        // super_admin fallback
        const target = "/dashboard";
        const currentPath = window.location.pathname;
        if (target !== currentPath) {
          setRedirectTo(target);
        } else {
          setRedirectTo(null);
        }
        setRedirecting(false);
      }
    } else {
      // Authorized: ensure we clear any previous redirect state
      if (redirectTo !== null) setRedirectTo(null);
      if (redirecting) setRedirecting(false);
    }
  }, [roles, roleToCheck, user, isLoading, isReady, redirectTo, redirecting]);

  // Wait for auth and role switching readiness (for super_admins)
  if (isLoading || (user?.role === UserRole.SUPER_ADMIN && !isReady)) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // If unauthorized and redirect is pending, show a small loading state
  const isAuthorized =
    roles.length === 0 || (roleToCheck && roles.includes(roleToCheck));
  if (!isAuthorized && !redirectTo) {
    return <div>Loading...</div>;
  }

  if (redirectTo && redirectTo !== window.location.pathname) {
    return <Redirect to={redirectTo} />;
  }

  return <>{children}</>;
};
