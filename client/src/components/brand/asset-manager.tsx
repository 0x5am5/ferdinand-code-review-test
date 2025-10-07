import { Upload } from "lucide-react";
import { type DragEvent, type FC, useCallback, useState } from "react";
import { AssetDetailModal } from "@/components/assets/asset-detail-modal";
import { AssetFilters } from "@/components/assets/asset-filters";
import { AssetList } from "@/components/assets/asset-list";
import { AssetUpload } from "@/components/assets/asset-upload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type Asset,
  type AssetFilters as Filters,
  useAssetsQuery,
  useBulkDeleteAssetsMutation,
  useDeleteAssetMutation,
} from "@/lib/queries/assets";

interface AssetManagerProps {
  clientId: number;
}

/**
 * Client-scoped Asset Manager - Manages assets for a specific client
 */
export const AssetManager: FC<AssetManagerProps> = ({ clientId }) => {
  const [filters, setFilters] = useState<Filters>({});
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<number | null>(null);
  const [assetsToDelete, setAssetsToDelete] = useState<number[] | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch assets filtered by clientId
  const { data: allAssets = [], isLoading } = useAssetsQuery(filters);
  const deleteMutation = useDeleteAssetMutation();
  const bulkDeleteMutation = useBulkDeleteAssetsMutation();

  // Filter assets by clientId on the client side
  const assets = allAssets.filter((asset) => asset.clientId === clientId);

  const handleAssetClick = (asset: Asset) => {
    setSelectedAsset(asset);
  };

  const handleDelete = (assetId: number) => {
    setAssetToDelete(assetId);
  };

  const handleBulkDelete = (assetIds: number[]) => {
    setAssetsToDelete(assetIds);
  };

  const confirmDelete = async () => {
    if (assetToDelete) {
      await deleteMutation.mutateAsync(assetToDelete);
      setAssetToDelete(null);
    }
  };

  const confirmBulkDelete = async () => {
    if (assetsToDelete && assetsToDelete.length > 0) {
      await bulkDeleteMutation.mutateAsync(assetsToDelete);
      setAssetsToDelete(null);
    }
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
      setUploadDialogOpen(true);
    }
  }, []);

  return (
    <div
      role="region"
      aria-label="Asset upload drop zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="border-4 border-dashed border-primary rounded-lg p-12 bg-background">
            <Upload className="h-16 w-16 mx-auto mb-4 text-primary" />
            <p className="text-xl font-semibold text-center">
              Drop files to upload
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              You'll be able to add categories and tags
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brand Assets</h1>
          <p className="text-muted-foreground mt-1">
            Manage and organize your brand assets
          </p>
        </div>
        <AssetUpload
          open={uploadDialogOpen}
          onOpenChange={(open) => {
            setUploadDialogOpen(open);
            if (!open) {
              setDroppedFiles([]);
            }
          }}
          initialFiles={droppedFiles}
        />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <AssetFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Asset list */}
      <AssetList
        assets={assets}
        isLoading={isLoading}
        onAssetClick={handleAssetClick}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
      />

      {/* Asset detail modal */}
      <AssetDetailModal
        asset={selectedAsset}
        open={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />

      {/* Single delete confirmation */}
      <AlertDialog
        open={!!assetToDelete}
        onOpenChange={() => setAssetToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this asset? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog
        open={!!assetsToDelete}
        onOpenChange={() => setAssetsToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Assets</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {assetsToDelete?.length} asset
              {assetsToDelete?.length === 1 ? "" : "s"}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
