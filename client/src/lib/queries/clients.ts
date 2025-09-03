import type { BrandAsset, Client, User, UserPersona } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "../queryClient";

export const useClientsQuery = () =>
  useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

export function useFilteredClientsQuery() {
  return useQuery<Client[]>({
    queryKey: ["/api/clients/filtered"],
    queryFn: async () => {
      const response = await fetch("/api/clients/filtered");
      if (!response.ok) {
        throw new Error("Failed to fetch filtered clients");
      }
      return response.json();
    },
  });
}

export const useClientsById = (clientId: number | null) =>
  useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

export const useClientAssetsById = (clientId: number | null) =>
  useQuery<BrandAsset[]>({
    queryKey: [`/api/clients/${clientId}/assets`],
    enabled: !!clientId,
  });

export const useClientPersonasById = (clientId: number | null) =>
  useQuery<UserPersona[]>({
    queryKey: [`/api/clients/${clientId}/personas`],
    enabled: !!clientId,
  });

export const useClientUsersQuery = (clientId: number | null) =>
  useQuery<User[]>({
    queryKey: [`/api/clients/${clientId}/users`],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/users`);
      if (!response.ok) {
        throw new Error("Failed to fetch client users");
      }
      return response.json();
    },
    enabled: !!clientId,
  });

export function useDeleteClientMutation() {
  return useMutation({
    mutationFn: async (id: number) => {
      // Wait for the animation to complete before deleting from the server
      return new Promise((resolve) => {
        setTimeout(async () => {
          const result = await apiRequest("DELETE", `/api/clients/${id}`);
          resolve(result);
        }, 300); // Animation duration
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateClientMutation() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Client> }) => {
      await apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}`] });
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Update client order mutation
export function useUpdateClientOrderMutation(
  setSortOrder: (order: "custom") => void
) {
  return useMutation({
    mutationFn: async (
      clientOrders: { id: number; displayOrder: number }[]
    ) => {
      const response = await apiRequest("PATCH", "/api/clients/order", {
        clientOrders,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update client order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client order updated successfully",
      });
      // Ensure we stay in custom sort mode after reordering
      setSortOrder("custom");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Client user assignment mutations
export function useClientUserMutations(clientId: number) {
  const assignUser = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest("POST", `/api/user-clients`, {
        userId,
        clientId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/users`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "User assigned",
        description: "User has been assigned to this client successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeUser = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest(
        "DELETE",
        `/api/user-clients/${userId}/${clientId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/users`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "User removed",
        description: "User has been removed from this client successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const inviteUser = useMutation({
    mutationFn: async ({
      email,
      name,
      role,
    }: {
      email: string;
      name: string;
      role: string;
    }) => {
      return await apiRequest("POST", "/api/invitations", {
        email,
        name: name || email.split("@")[0], // Generate a default name from email if not provided
        role: role.toLowerCase(),
        clientIds: [clientId],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/users`],
      });
      toast({
        title: "Invitation sent",
        description: "User invitation has been sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return { assignUser, removeUser, inviteUser };
}
