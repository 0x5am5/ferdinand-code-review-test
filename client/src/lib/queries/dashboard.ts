
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Client, UserRole } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Get all clients query with role-based filtering
export function useClientsQuery(user: { role?: UserRole; clientIds?: number[] } | null) {
  return useQuery<Client[]>({
    queryKey: ["/api/clients"],
    select: (data) => {
      let filteredData = [...data];
      
      if (user?.role === UserRole.ADMIN) {
        filteredData = filteredData.filter(client => 
          user.clientIds?.includes(client.id)
        );
      }

      return filteredData.sort((a, b) => {
        if (
          a.displayOrder !== null &&
          a.displayOrder !== undefined &&
          b.displayOrder !== null &&
          b.displayOrder !== undefined
        ) {
          return Number(a.displayOrder) - Number(b.displayOrder);
        }
        return a.id - b.id;
      });
    },
  });
}

// Update client mutation
export function useUpdateClientMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
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

// Delete client mutation
export function useDeleteClientMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
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

// Update client order mutation
export function useUpdateClientOrderMutation(setSortOrder: (order: "custom") => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientOrders: { id: number; displayOrder: number }[]) => {
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
