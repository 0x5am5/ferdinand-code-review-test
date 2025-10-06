import {
  Download,
  Eye,
  FileIcon,
  Grid,
  Image as ImageIcon,
  List,
  Trash2,
} from "lucide-react";
import { type FC, type MouseEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Asset } from "@/lib/queries/assets";

interface AssetListProps {
  assets: Asset[];
  isLoading?: boolean;
  onAssetClick: (asset: Asset) => void;
  onDelete: (assetId: number) => void;
}

export const AssetList: FC<AssetListProps> = ({
  assets,
  isLoading,
  onAssetClick,
  onDelete,
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getFileTypeIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  const handleDownload = async (
    asset: Asset,
    e: MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    window.open(`/api/assets/${asset.id}/download`, "_blank");
  };

  if (isLoading) {
    return (
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-2"
        }
      >
        {Array.from({ length: 8 }, (_, i) => `skeleton-${i}`).map((id) => (
          <Skeleton
            key={id}
            className={viewMode === "grid" ? "h-64" : "h-20"}
          />
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12">
        <FileIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No assets found</h3>
        <p className="text-muted-foreground">
          Upload your first asset to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex justify-end gap-2">
        <Button
          variant={viewMode === "grid" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("grid")}
        >
          <Grid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("list")}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid view */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onAssetClick(asset)}
            >
              <div className="aspect-square bg-muted flex items-center justify-center relative">
                {asset.fileType.startsWith("image/") ? (
                  <img
                    src={`/api/assets/${asset.id}/download`}
                    alt={asset.originalFileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileIcon className="h-16 w-16 text-muted-foreground" />
                )}
                <div className="absolute top-2 right-2">
                  <Badge
                    variant={
                      asset.visibility === "private" ? "secondary" : "default"
                    }
                  >
                    {asset.visibility}
                  </Badge>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium truncate mb-1">
                  {asset.originalFileName}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {formatFileSize(asset.fileSize)}
                </p>
                {asset.categories && asset.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {asset.categories.slice(0, 2).map((category) => (
                      <Badge
                        key={category.id}
                        variant="outline"
                        className="text-xs"
                      >
                        {category.name}
                      </Badge>
                    ))}
                    {asset.categories.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{asset.categories.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-1 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssetClick(asset);
                    }}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => handleDownload(asset, e)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(asset.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => onAssetClick(asset)}
                >
                  <TableCell>
                    {asset.fileType.startsWith("image/") ? (
                      <img
                        src={`/api/assets/${asset.id}/download`}
                        alt={asset.originalFileName}
                        className="h-10 w-10 object-cover rounded"
                      />
                    ) : (
                      getFileTypeIcon(asset.fileType)
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {asset.originalFileName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {asset.fileType.split("/")[1]?.toUpperCase() || "Unknown"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(asset.fileSize)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(asset.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        asset.visibility === "private" ? "secondary" : "default"
                      }
                    >
                      {asset.visibility}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAssetClick(asset);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDownload(asset, e)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(asset.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
