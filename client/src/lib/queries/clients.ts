import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../queryClient";
import { Client, UserPersona } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

export const useClientsQuery = () =>
  useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

export const useClientsById = (clientId: number) =>
  useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

export const useClientAssetsById = (clientId: number) =>
  useQuery<BrandAsset[]>({
    queryKey: [`/api/clients/${clientId}/assets`],
    enabled: !!clientId,
  });

export const useClientPersonasById = (clientId: number) =>
  useQuery<UserPersona[]>({
    queryKey: [`/api/clients/${clientId}/personas`],
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
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
  setSortOrder: (order: "custom") => void,
) {
  return useMutation({
    mutationFn: async (
      clientOrders: { id: number; displayOrder: number }[],
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
