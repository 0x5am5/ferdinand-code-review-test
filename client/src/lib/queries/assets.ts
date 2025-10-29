import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "../queryClient";

// Types for assets
export interface Asset {
  id: number;
  clientId: number;
  uploadedBy: number;
  fileName: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  visibility: "private" | "shared";
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  // Reference-only flag for Google Workspace files
  referenceOnly?: boolean;
  // Google Drive fields
  isGoogleDrive?: boolean;
  driveFileId?: string;
  driveWebLink?: string;
  driveLastModified?: Date;
  driveOwner?: string;
  driveThumbnailUrl?: string;
  driveWebContentLink?: string;
  driveSharingMetadata?: Record<string, unknown>;
  cachedThumbnailPath?: string;
  thumbnailCachedAt?: Date;
  thumbnailCacheVersion?: string;
  categories?: AssetCategory[];
  tags?: AssetTag[];
  uploader?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface AssetCategory {
  id: number;
  name: string;
  slug: string;
  isDefault: boolean;
  clientId: number | null;
}

export interface AssetTag {
  id: number;
  name: string;
  slug: string;
  clientId: number;
}

export interface AssetFilters {
  search?: string;
  categoryId?: number;
  tagIds?: number[];
  fileType?: string;
  visibility?: "private" | "shared";
  isGoogleDrive?: boolean;
  limit?: number;
  offset?: number;
}

// Query hooks
export const useAssetsQuery = (filters?: AssetFilters) => {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.categoryId)
    params.append("categoryId", filters.categoryId.toString());
  if (filters?.tagIds?.length)
    params.append("tagIds", filters.tagIds.join(","));
  if (filters?.fileType) params.append("fileType", filters.fileType);
  if (filters?.visibility) params.append("visibility", filters.visibility);
  if (filters?.isGoogleDrive !== undefined)
    params.append("isGoogleDrive", filters.isGoogleDrive.toString());
  if (filters?.limit) params.append("limit", filters.limit.toString());
  if (filters?.offset) params.append("offset", filters.offset.toString());

  const queryString = params.toString();
  const url = `/api/assets${queryString ? `?${queryString}` : ""}`;

  return useQuery<Asset[]>({
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

export const useAssetQuery = (assetId: number | null) =>
  useQuery<Asset>({
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

export const useAssetCategoriesQuery = () =>
  useQuery<AssetCategory[]>({
    queryKey: ["/api/asset-categories"],
    queryFn: async () => {
      const response = await fetch("/api/asset-categories");
      if (!response.ok) {
        throw new Error("Failed to fetch asset categories");
      }
      return response.json();
    },
  });

export const useAssetTagsQuery = () =>
  useQuery<AssetTag[]>({
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
    mutationFn: async (formData: FormData) => {
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
    onError: (error: Error) => {
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<Asset> }) => {
      const response = await apiRequest("PATCH", `/api/assets/${id}`, data);
      return response.json();
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/assets/${id}`] });
      await queryClient.cancelQueries({ queryKey: ["/api/assets"] });

      // Snapshot the previous values
      const previousAsset = queryClient.getQueryData<Asset>([
        `/api/assets/${id}`,
      ]);
      const previousAssetsList = queryClient.getQueryData<Asset[]>([
        "/api/assets",
      ]);

      // Optimistically update the individual asset
      if (previousAsset) {
        queryClient.setQueryData<Asset>([`/api/assets/${id}`], {
          ...previousAsset,
          ...data,
        });
      }

      // Optimistically update the asset in the list
      if (previousAssetsList) {
        queryClient.setQueryData<Asset[]>(
          ["/api/assets"],
          previousAssetsList.map((asset) =>
            asset.id === id ? { ...asset, ...data } : asset
          )
        );
      }

      // Return a context with the snapshots
      return { previousAsset, previousAssetsList, id };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousAsset) {
        queryClient.setQueryData(
          [`/api/assets/${context.id}`],
          context.previousAsset
        );
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
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/assets/${id}`);
      return response.json();
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/assets"] });
      await queryClient.cancelQueries({ queryKey: [`/api/assets/${id}`] });

      // Snapshot the previous values
      const previousAssetsList = queryClient.getQueryData<Asset[]>([
        "/api/assets",
      ]);

      // Optimistically remove the asset from all lists
      if (previousAssetsList) {
        queryClient.setQueryData<Asset[]>(
          ["/api/assets"],
          previousAssetsList.filter((asset) => asset.id !== id)
        );
      }

      // Also optimistically update any filtered queries
      const allQueries = queryClient.getQueriesData<Asset[]>({
        queryKey: ["/api/assets"],
      });
      allQueries.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData<Asset[]>(
            queryKey,
            data.filter((asset) => asset.id !== id)
          );
        }
      });

      // Return a context with the snapshots
      return { previousAssetsList, id };
    },
    onError: (error: Error, _id, context) => {
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
    mutationFn: async (ids: number[]) => {
      const response = await apiRequest("POST", "/api/assets/bulk-delete", {
        assetIds: ids,
      });
      return response.json();
    },
    onMutate: async (ids) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/assets"] });

      // Snapshot the previous values
      const previousAssetsList = queryClient.getQueryData<Asset[]>([
        "/api/assets",
      ]);

      // Optimistically remove the assets from all lists
      if (previousAssetsList) {
        queryClient.setQueryData<Asset[]>(
          ["/api/assets"],
          previousAssetsList.filter((asset) => !ids.includes(asset.id))
        );
      }

      // Also optimistically update any filtered queries
      const allQueries = queryClient.getQueriesData<Asset[]>({
        queryKey: ["/api/assets"],
      });
      allQueries.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData<Asset[]>(
            queryKey,
            data.filter((asset) => !ids.includes(asset.id))
          );
        }
      });

      // Return a context with the snapshots
      return { previousAssetsList, ids };
    },
    onError: (error: Error, _ids, context) => {
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
    mutationFn: async (data: {
      assetIds: number[];
      categoryId?: number | null;
      tagIds?: number[];
      addTags?: number[];
      removeTags?: number[];
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/assets/bulk-update",
        data
      );
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
    onError: (error: Error) => {
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
    mutationFn: async (data: { name: string; slug: string }) => {
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
    onError: (error: Error) => {
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
    mutationFn: async (data: { name: string; slug: string }) => {
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
    onError: (error: Error) => {
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
    mutationFn: async (id: number) => {
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
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Public link types and hooks
export interface AssetPublicLink {
  id: number;
  assetId: number;
  token: string;
  createdBy: number;
  expiresAt: Date | null;
  createdAt: Date;
}

export const useAssetPublicLinksQuery = (
  clientId: number | null,
  assetId: number | null
) =>
  useQuery<AssetPublicLink[]>({
    queryKey: [`/api/clients/${clientId}/assets/${assetId}/public-links`],
    queryFn: async () => {
      const response = await fetch(
        `/api/clients/${clientId}/assets/${assetId}/public-links`
      );
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
    mutationFn: async ({
      clientId,
      assetId,
      expiresInDays,
    }: {
      clientId: number;
      assetId: number;
      expiresInDays: number | null;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/clients/${clientId}/assets/${assetId}/public-links`,
        { expiresInDays }
      );
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
    onError: (error: Error) => {
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
    mutationFn: async ({
      clientId,
      assetId,
      linkId,
    }: {
      clientId: number;
      assetId: number;
      linkId: number;
    }) => {
      const response = await apiRequest(
        "DELETE",
        `/api/clients/${clientId}/assets/${assetId}/public-links/${linkId}`
      );
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
    onError: (error: Error) => {
      toast({
        title: "Failed to delete link",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
