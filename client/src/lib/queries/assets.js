import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "../queryClient";
// Query hooks
export const useAssetsQuery = (filters) => {
    const params = new URLSearchParams();
    if (filters?.search)
        params.append("search", filters.search);
    if (filters?.categoryId)
        params.append("categoryId", filters.categoryId.toString());
    if (filters?.tagIds?.length)
        params.append("tagIds", filters.tagIds.join(","));
    if (filters?.fileType)
        params.append("fileType", filters.fileType);
    if (filters?.visibility)
        params.append("visibility", filters.visibility);
    if (filters?.isGoogleDrive !== undefined)
        params.append("isGoogleDrive", filters.isGoogleDrive.toString());
    if (filters?.limit)
        params.append("limit", filters.limit.toString());
    if (filters?.offset)
        params.append("offset", filters.offset.toString());
    const queryString = params.toString();
    const url = `/api/assets${queryString ? `?${queryString}` : ""}`;
    return useQuery({
        queryKey: ["/api/assets", filters],
        queryFn: async () => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch assets");
            }
            return response.json();
        },
    });
};
export const useAssetQuery = (assetId) => useQuery({
    queryKey: [`/api/assets/${assetId}`],
    queryFn: async () => {
        const response = await fetch(`/api/assets/${assetId}`);
        if (!response.ok) {
            throw new Error("Failed to fetch asset");
        }
        return response.json();
    },
    enabled: !!assetId,
});
export const useAssetCategoriesQuery = () => useQuery({
    queryKey: ["/api/asset-categories"],
    queryFn: async () => {
        const response = await fetch("/api/asset-categories");
        if (!response.ok) {
            throw new Error("Failed to fetch asset categories");
        }
        return response.json();
    },
});
export const useAssetTagsQuery = () => useQuery({
    queryKey: ["/api/asset-tags"],
    queryFn: async () => {
        const response = await fetch("/api/asset-tags");
        if (!response.ok) {
            throw new Error("Failed to fetch asset tags");
        }
        return response.json();
    },
});
// Mutation hooks
export const useUploadAssetMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (formData) => {
            const response = await fetch("/api/assets/upload", {
                method: "POST",
                body: formData,
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to upload asset");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
            queryClient.invalidateQueries({ queryKey: ["/api/asset-tags"] });
            toast({
                title: "Success",
                description: "Asset uploaded successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Upload failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
export const useUpdateAssetMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }) => {
            const response = await apiRequest("PATCH", `/api/assets/${id}`, data);
            return response.json();
        },
        onMutate: async ({ id, data }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: [`/api/assets/${id}`] });
            await queryClient.cancelQueries({ queryKey: ["/api/assets"] });
            // Snapshot the previous values
            const previousAsset = queryClient.getQueryData([
                `/api/assets/${id}`,
            ]);
            const previousAssetsList = queryClient.getQueryData([
                "/api/assets",
            ]);
            // Optimistically update the individual asset
            if (previousAsset) {
                queryClient.setQueryData([`/api/assets/${id}`], {
                    ...previousAsset,
                    ...data,
                });
            }
            // Optimistically update the asset in the list
            if (previousAssetsList) {
                queryClient.setQueryData(["/api/assets"], previousAssetsList.map((asset) => asset.id === id ? { ...asset, ...data } : asset));
            }
            // Return a context with the snapshots
            return { previousAsset, previousAssetsList, id };
        },
        onError: (error, _variables, context) => {
            // Rollback on error
            if (context?.previousAsset) {
                queryClient.setQueryData([`/api/assets/${context.id}`], context.previousAsset);
            }
            if (context?.previousAssetsList) {
                queryClient.setQueryData(["/api/assets"], context.previousAssetsList);
            }
            toast({
                title: "Update failed",
                description: error.message,
                variant: "destructive",
            });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
            queryClient.invalidateQueries({
                queryKey: [`/api/assets/${variables.id}`],
            });
            toast({
                title: "Success",
                description: "Asset updated successfully",
            });
        },
    });
};
export const useDeleteAssetMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            const response = await apiRequest("DELETE", `/api/assets/${id}`);
            return response.json();
        },
        onMutate: async (id) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ["/api/assets"] });
            await queryClient.cancelQueries({ queryKey: [`/api/assets/${id}`] });
            // Snapshot the previous values
            const previousAssetsList = queryClient.getQueryData([
                "/api/assets",
            ]);
            // Optimistically remove the asset from all lists
            if (previousAssetsList) {
                queryClient.setQueryData(["/api/assets"], previousAssetsList.filter((asset) => asset.id !== id));
            }
            // Also optimistically update any filtered queries
            const allQueries = queryClient.getQueriesData({
                queryKey: ["/api/assets"],
            });
            allQueries.forEach(([queryKey, data]) => {
                if (data) {
                    queryClient.setQueryData(queryKey, data.filter((asset) => asset.id !== id));
                }
            });
            // Return a context with the snapshots
            return { previousAssetsList, id };
        },
        onError: (error, _id, context) => {
            // Rollback on error
            if (context?.previousAssetsList) {
                queryClient.setQueryData(["/api/assets"], context.previousAssetsList);
            }
            toast({
                title: "Delete failed",
                description: error.message,
                variant: "destructive",
            });
        },
        onSuccess: () => {
            // Invalidate to ensure fresh data from server
            queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
            toast({
                title: "Success",
                description: "Asset deleted successfully",
            });
        },
    });
};
export const useBulkDeleteAssetsMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (ids) => {
            const response = await apiRequest("POST", "/api/assets/bulk-delete", {
                assetIds: ids,
            });
            return response.json();
        },
        onMutate: async (ids) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ["/api/assets"] });
            // Snapshot the previous values
            const previousAssetsList = queryClient.getQueryData([
                "/api/assets",
            ]);
            // Optimistically remove the assets from all lists
            if (previousAssetsList) {
                queryClient.setQueryData(["/api/assets"], previousAssetsList.filter((asset) => !ids.includes(asset.id)));
            }
            // Also optimistically update any filtered queries
            const allQueries = queryClient.getQueriesData({
                queryKey: ["/api/assets"],
            });
            allQueries.forEach(([queryKey, data]) => {
                if (data) {
                    queryClient.setQueryData(queryKey, data.filter((asset) => !ids.includes(asset.id)));
                }
            });
            // Return a context with the snapshots
            return { previousAssetsList, ids };
        },
        onError: (error, _ids, context) => {
            // Rollback on error
            if (context?.previousAssetsList) {
                queryClient.setQueryData(["/api/assets"], context.previousAssetsList);
            }
            toast({
                title: "Delete failed",
                description: error.message,
                variant: "destructive",
            });
        },
        onSuccess: (_, ids) => {
            // Invalidate to ensure fresh data from server
            queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
            toast({
                title: "Success",
                description: `${ids.length} asset${ids.length === 1 ? "" : "s"} deleted successfully`,
            });
        },
    });
};
export const useBulkUpdateAssetsMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data) => {
            const response = await apiRequest("POST", "/api/assets/bulk-update", data);
            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
            queryClient.invalidateQueries({ queryKey: ["/api/asset-tags"] });
            toast({
                title: "Success",
                description: `${variables.assetIds.length} asset${variables.assetIds.length === 1 ? "" : "s"} updated successfully`,
            });
        },
        onError: (error) => {
            toast({
                title: "Update failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
export const useCreateCategoryMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data) => {
            const response = await apiRequest("POST", "/api/asset-categories", data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/asset-categories"] });
            toast({
                title: "Success",
                description: "Category created successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Creation failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
export const useCreateTagMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data) => {
            const response = await apiRequest("POST", "/api/asset-tags", data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/asset-tags"] });
            toast({
                title: "Success",
                description: "Tag created successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Creation failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
export const useDeleteTagMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            const response = await apiRequest("DELETE", `/api/asset-tags/${id}`);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/asset-tags"] });
            toast({
                title: "Success",
                description: "Tag deleted successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Delete failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
// Get public links for an asset
export const useAssetPublicLinksQuery = (clientId, assetId) => useQuery({
    queryKey: [`/api/clients/${clientId}/assets/${assetId}/public-links`],
    queryFn: async () => {
        const response = await fetch(`/api/clients/${clientId}/assets/${assetId}/public-links`);
        if (!response.ok) {
            throw new Error("Failed to fetch public links");
        }
        return response.json();
    },
    enabled: !!clientId && !!assetId,
});
// Create a public link
export const useCreatePublicLinkMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ clientId, assetId, expiresInDays, }) => {
            const response = await apiRequest("POST", `/api/clients/${clientId}/assets/${assetId}/public-links`, { expiresInDays });
            return response.json();
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [
                    `/api/clients/${variables.clientId}/assets/${variables.assetId}/public-links`,
                ],
            });
            toast({
                title: "Success",
                description: "Public link created successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Failed to create link",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
// Delete a public link
export const useDeletePublicLinkMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ clientId, assetId, linkId, }) => {
            const response = await apiRequest("DELETE", `/api/clients/${clientId}/assets/${assetId}/public-links/${linkId}`);
            return response.json();
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [
                    `/api/clients/${variables.clientId}/assets/${variables.assetId}/public-links`,
                ],
            });
            toast({
                title: "Success",
                description: "Public link deleted successfully",
            });
        },
        onError: (error) => {
            toast({
                title: "Failed to delete link",
                description: error.message,
                variant: "destructive",
            });
        },
    });
};
