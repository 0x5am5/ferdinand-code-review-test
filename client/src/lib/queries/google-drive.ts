import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Types for Google Drive integration
export interface GoogleDriveConnection {
  id: number;
  userId: number;
  scopes: string[];
  connectedAt: Date;
  lastUsedAt: Date | null;
}

export interface GoogleDriveImportRequest {
  files: google.picker.DocumentObject[];
  clientId: number;
}

export interface GoogleDriveImportResponse {
  success: boolean;
  imported: number;
  failed: number;
  errors?: string[];
}

// Query to check Google Drive connection status
export const useGoogleDriveConnectionQuery = () =>
  useQuery<GoogleDriveConnection | null>({
    queryKey: ["/api/google-drive/status"],
    queryFn: async () => {
      const response = await fetch("/api/google-drive/status");
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No connection found
        }
        throw new Error("Failed to fetch Google Drive connection status");
      }
      return response.json();
    },
    retry: false, // Don't retry on 404
  });

// Query to get OAuth access token for Google Picker
export const useGoogleDriveTokenQuery = () =>
  useQuery<{ accessToken: string; expiresAt: Date } | null>({
    queryKey: ["/api/google-drive/token"],
    queryFn: async () => {
      const response = await fetch("/api/google-drive/token");
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No connection found
        }
        throw new Error("Failed to fetch Google Drive access token");
      }
      return response.json();
    },
    retry: false,
    enabled: false, // Only fetch when explicitly requested
  });

// Mutation to initiate Google OAuth flow
export const useGoogleDriveConnectMutation = () => {
  return useMutation({
    mutationFn: async (clientId?: number) => {
      // Get the OAuth URL from the backend with optional clientId
      const url = clientId
        ? `/api/auth/google/url?clientId=${clientId}`
        : "/api/auth/google/url";

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to get Google authorization URL");
      }
      const { url: authUrl } = await response.json();

      // Redirect to Google OAuth consent screen
      window.location.href = authUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Mutation to disconnect Google Drive
export const useGoogleDriveDisconnectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/google-drive/disconnect", {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to disconnect Google Drive");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-drive/status"] });
      toast({
        title: "Success",
        description: "Google Drive disconnected successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Mutation to import files from Google Drive
export const useGoogleDriveImportMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<
    GoogleDriveImportResponse,
    Error,
    GoogleDriveImportRequest
  >({
    mutationFn: async ({ files, clientId }) => {
      const response = await fetch("/api/google-drive/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: files.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
          })),
          clientId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || "Failed to import files from Google Drive"
        );
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate assets cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/google-drive/status"] });

      const message =
        data.failed > 0
          ? `Imported ${data.imported} files successfully. ${data.failed} failed.`
          : `Successfully imported ${data.imported} files from Google Drive`;

      toast({
        title: "Import Complete",
        description: message,
        variant: data.failed > 0 ? "default" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
