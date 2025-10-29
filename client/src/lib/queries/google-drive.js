import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";
// Query to check Google Drive connection status
export const useGoogleDriveConnectionQuery = () => useQuery({
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
export const useGoogleDriveTokenQuery = () => useQuery({
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
        mutationFn: async (clientId) => {
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
        onError: (error) => {
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
        onError: (error) => {
            toast({
                title: "Disconnection failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
// Mutation to import files from Google Drive with progress tracking
export const useGoogleDriveImportMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ files, clientId, onProgress }) => {
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
                throw new Error(error.message || "Failed to import files from Google Drive");
            }
            // Handle Server-Sent Events for progress tracking
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) {
                throw new Error("No response body received");
            }
            let finalResult = {
                success: false,
                imported: 0,
                failed: 0,
            };
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    const chunk = decoder.decode(value);
                    const lines = chunk.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                // Call progress callback if provided
                                if (onProgress) {
                                    onProgress(data);
                                }
                                // Handle final result
                                if (data.status === "finished") {
                                    finalResult = {
                                        success: true,
                                        imported: data.imported,
                                        failed: data.failed,
                                        errors: data.errors,
                                    };
                                }
                            }
                            catch (parseError) {
                                console.error("Error parsing SSE data:", parseError);
                            }
                        }
                    }
                }
            }
            finally {
                reader.releaseLock();
            }
            return finalResult;
        },
        onSuccess: (data) => {
            // Invalidate assets cache to refresh the list
            queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
            queryClient.invalidateQueries({ queryKey: ["/api/google-drive/status"] });
            const message = data.failed > 0
                ? `Downloaded ${data.imported} files successfully. ${data.failed} failed.`
                : `Successfully downloaded ${data.imported} files from Google Drive`;
            toast({
                title: "Download Complete",
                description: message,
                variant: data.failed > 0 ? "default" : "default",
            });
        },
        onError: (error) => {
            toast({
                title: "Download failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
/**
 * Hook to handle OAuth callback detection and trigger refetch of Drive connection status
 * This should be used in a top-level layout or shared component to ensure global state updates
 */
export const useGoogleDriveOAuthCallback = () => {
    const queryClient = useQueryClient();
    useEffect(() => {
        // Check if we're returning from OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const googleAuthStatus = urlParams.get("google_auth");
        if (googleAuthStatus === "success") {
            // Refetch connection status and token after successful OAuth
            queryClient.invalidateQueries({ queryKey: ["/api/google-drive/status"] });
            queryClient.invalidateQueries({ queryKey: ["/api/google-drive/token"] });
            // Show success toast
            toast({
                title: "Success",
                description: "Google Drive connected successfully",
            });
            // Clean up URL parameters without page reload
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("google_auth");
            window.history.replaceState({}, "", newUrl.toString());
            console.log("Google Drive OAuth successful, connection status refreshed");
        }
        else if (googleAuthStatus === "error") {
            const reason = urlParams.get("reason");
            console.error("Google Drive OAuth failed:", reason);
            // Show error toast
            toast({
                title: "Connection failed",
                description: reason === "not_authenticated"
                    ? "Please log in to connect Google Drive"
                    : "Failed to connect Google Drive. Please try again.",
                variant: "destructive",
            });
            // Clean up URL parameters
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("google_auth");
            newUrl.searchParams.delete("reason");
            window.history.replaceState({}, "", newUrl.toString());
        }
    }, [queryClient]);
};
/**
 * Enhanced token query that can be manually triggered for refresh
 */
export const useGoogleDriveTokenQueryWithRefresh = () => {
    const queryClient = useQueryClient();
    const baseQuery = useQuery({
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
    const refreshToken = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/google-drive/token"] });
        queryClient.refetchQueries({ queryKey: ["/api/google-drive/token"] });
    };
    return {
        ...baseQuery,
        refreshToken,
    };
};
