import { type FC, useState } from "react";
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

/**
 * Brand Assets page - Main asset management interface
 */
const BrandAssets: FC = () => {
  const [filters, setFilters] = useState<Filters>({});
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<number | null>(null);
  const [assetsToDelete, setAssetsToDelete] = useState<number[] | null>(null);

  const { data: assets = [], isLoading } = useAssetsQuery(filters);
  const deleteMutation = useDeleteAssetMutation();
  const bulkDeleteMutation = useBulkDeleteAssetsMutation();

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

  return (
    <div className="h-full">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Brand Assets</h1>
            <p className="text-muted-foreground mt-2">
              Manage and organize your brand assets
            </p>
          </div>
          <AssetUpload />
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters sidebar */}
          <div className="lg:col-span-1">
            <AssetFilters filters={filters} onFiltersChange={setFilters} />
          </div>

          {/* Asset list */}
          <div className="lg:col-span-3">
            <AssetList
              assets={assets}
              isLoading={isLoading}
              onAssetClick={handleAssetClick}
              onDelete={handleDelete}
              onBulkDelete={handleBulkDelete}
            />
          </div>
        </div>
      </div>

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

export default BrandAssets;
