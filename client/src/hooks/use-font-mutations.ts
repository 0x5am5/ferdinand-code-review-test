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

      const response = await fetch(`/api/clients/${clientId}/brand-assets`, {
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
          errorMessage = `HTTP ${response.status}`;
        }
        console.error("Server error:", response.status, errorMessage);
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/brand-assets`],
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
      data: {
        name: string;
        category: string;
        data: {
          source: string;
          weights: string[];
          styles: string[];
          sourceData: unknown;
        };
      };
    }) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }
      const response = await apiRequest(
        "PATCH",
        `/api/clients/${clientId}/brand-assets/${id}`,
        data
      );
      return response.json();
    },
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/brand-assets`],
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
        `/api/clients/${clientId}/brand-assets/${fontId}`
      );
      return response.json();
    },
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/brand-assets`],
        });
      }
      toast({
        title: "Font deleted successfully",
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
