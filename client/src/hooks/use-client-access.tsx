import { type Client, UserRole } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

/**
 * Hook to validate client access and redirect if unauthorized
 * @param clientId - The client ID to validate access for
 * @returns object with loading state and client access status
 */
export function useClientAccess(clientId: number | null) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Get user's assigned clients
  const { data: assignedClients = [], isLoading: isLoadingClients } = useQuery<
    Client[]
  >({
    queryKey: ["/api/user/clients"],
    queryFn: async () => {
      const response = await fetch("/api/user/clients");
      if (!response.ok) {
        throw new Error("Failed to fetch user clients");
      }
      return response.json();
    },
    enabled: !!user && user.role !== UserRole.SUPER_ADMIN,
  });

  // Check if user has access to the client
  const hasAccess =
    !clientId ||
    user?.role === UserRole.SUPER_ADMIN ||
    assignedClients.some((client) => client.id === clientId);

  // Redirect if user doesn't have access
  useEffect(() => {
    if (!isLoadingClients && user && clientId && !hasAccess) {
      // If user has assigned clients, redirect to the first one
      if (assignedClients.length > 0) {
        setLocation(`/clients/${assignedClients[0].id}`);
      } else if (user.role === UserRole.SUPER_ADMIN) {
        // Super admins go to dashboard
        setLocation("/dashboard");
      } else {
        // Fallback to design builder
        setLocation("/design-builder");
      }
    }
  }, [
    clientId,
    hasAccess,
    isLoadingClients,
    user,
    assignedClients,
    setLocation,
  ]);

  return {
    hasAccess,
    isLoading: isLoadingClients,
    assignedClients,
  };
}

/**
 * Hook to get the first assigned client for the current user
 * Useful for redirecting admins to their client on login
 */
export function useUserPrimaryClient() {
  const { user } = useAuth();

  const { data: assignedClients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/user/clients"],
    queryFn: async () => {
      const response = await fetch("/api/user/clients");
      if (!response.ok) {
        throw new Error("Failed to fetch user clients");
      }
      return response.json();
    },
    enabled: !!user,
  });

  const primaryClient = assignedClients.length > 0 ? assignedClients[0] : null;

  return {
    primaryClient,
    assignedClients,
    isLoading,
  };
}
