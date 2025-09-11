import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useFontMutations(clientId: number | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Add font mutation
  const addFont = useMutation({
    mutationFn: async (data: FormData) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      console.log("Sending font data to server for client:", clientId);

      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: "POST",
        body: data,
        credentials: "include",
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        console.error("Server error:", response.status, errorMessage);
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("Font added successfully:", data);
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/assets`],
        });
      }
      toast({
        title: "Success",
        description: `${data.name} font added successfully`,
        variant: "default",
      });
    },
    onError: (error: Error) => {
      console.error(
        "Font addition failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Error adding font",
        description: error.message || "Failed to add font. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Edit font mutation
  const editFont = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; data: string };
    }) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }
      const response = await apiRequest(
        "PATCH",
        `/api/clients/${clientId}/assets/${id}`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/assets`],
        });
      }
      toast({
        title: "Font updated successfully",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating font",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete font mutation
  const deleteFont = useMutation({
    mutationFn: async (fontId: number) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }
      const response = await apiRequest(
        "DELETE",
        `/api/clients/${clientId}/assets/${fontId}`
      );
      return response.json();
    },
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/assets`],
        });
      }
      toast({
        title: "Font deleted successfully",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting font",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    addFont,
    editFont,
    deleteFont,
  };
}