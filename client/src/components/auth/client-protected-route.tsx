import { UserRole } from "@shared/schema";
import type { FC, ReactNode } from "react";
import { Redirect, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useClientAccess } from "@/hooks/use-client-access";

interface ClientProtectedRouteProps {
  children: ReactNode;
}

export const ClientProtectedRoute: FC<ClientProtectedRouteProps> = ({
  children,
}) => {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { id } = useParams();
  const clientId = id ? parseInt(id, 10) : null;

  const {
    hasAccess,
    isLoading: isLoadingAccess,
    assignedClients,
  } = useClientAccess(clientId);

  // Show loading while authentication or access check is in progress
  if (isLoadingAuth || isLoadingAccess) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is not authenticated, redirect to login
  if (!user) {
    return <Redirect to="/login" />;
  }

  // If client ID is invalid
  if (!clientId || Number.isNaN(clientId)) {
    // Super admins go to dashboard, others to their first client or design builder
    if (user.role === UserRole.SUPER_ADMIN) {
      return <Redirect to="/dashboard" />;
    } else if (assignedClients.length > 0) {
      return <Redirect to={`/clients/${assignedClients[0].id}`} />;
    } else {
      return <Redirect to="/design-builder" />;
    }
  }

  // Super admins always have access
  if (user.role === UserRole.SUPER_ADMIN) {
    return <>{children}</>;
  }

  // For non-super admins, check if they have access to this specific client
  if (!hasAccess) {
    // Redirect to user's first assigned client, or design builder if none
    if (assignedClients.length > 0) {
      return <Redirect to={`/clients/${assignedClients[0].id}`} />;
    } else {
      return <Redirect to="/design-builder" />;
    }
  }

  // User has access, render children
  return <>{children}</>;
};
