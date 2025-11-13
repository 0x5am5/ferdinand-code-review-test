import {
  Cloud,
  Download,
  ExternalLink,
  Eye,
  FileIcon,
  Grid,
  List,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import React, {
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type Asset,
  type AssetCategory,
  type AssetTag,
  useCreateTagMutation,
} from "@/lib/queries/assets";
import { getFileTypeIcon } from "@/utils/file-icons";

interface AssetListProps {
  assets: Asset[];
  isLoading?: boolean;
  onAssetClick: (asset: Asset) => void;
  onDelete: (assetId: number) => void;
  onBulkDelete?: (assetIds: number[]) => void;
  onBulkUpdate?: (
    assetIds: number[],
    updates: {
      categoryId?: number | null;
      addTags?: number[];
      removeTags?: number[];
    }
  ) => void;
  categories?: AssetCategory[];
  tags?: AssetTag[];
  canEdit?: boolean;
}

export const AssetList: FC<AssetListProps> = ({
  assets,
  isLoading,
  onAssetClick,
  onDelete,
  onBulkDelete,
  onBulkUpdate,
  categories = [],
  tags = [],
  canEdit = true,
}) => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set());
  const [newTagName, setNewTagName] = useState("");
  const createTagMutation = useCreateTagMutation();

  // Calculate shared tags across all selected assets
  const sharedTagIds = React.useMemo(() => {
    if (selectedAssets.size === 0) return new Set<number>();

    const selectedAssetsList = assets.filter((asset) =>
      selectedAssets.has(asset.id)
    );

    if (selectedAssetsList.length === 0) return new Set<number>();

    // Get tag IDs from the first asset
    const firstAssetTagIds = new Set(
      selectedAssetsList[0].tags?.map((tag) => tag.id) || []
    );

    // Find intersection with all other selected assets
    for (let i = 1; i < selectedAssetsList.length; i++) {
      const assetTagIds = new Set(
        selectedAssetsList[i].tags?.map((tag) => tag.id) || []
      );
      // Keep only tags that exist in this asset too
      const tagIdsToCheck = Array.from(firstAssetTagIds);
      for (const tagId of tagIdsToCheck) {
        if (!assetTagIds.has(tagId)) {
          firstAssetTagIds.delete(tagId);
        }
      }
    }

    return firstAssetTagIds;
  }, [selectedAssets, assets]);

  const toggleAssetSelection = (assetId: number) => {
    setSelectedAssets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = () => {
    if (onBulkDelete && selectedAssets.size > 0) {
      onBulkDelete(Array.from(selectedAssets));
      setSelectedAssets(new Set());
    }
  };

  const handleCreateAndApplyTag = async () => {
    if (!newTagName.trim() || !onBulkUpdate) return;

    try {
      const newTag = await createTagMutation.mutateAsync({
        name: newTagName.trim(),
        slug: newTagName.trim().toLowerCase().replace(/\s+/g, "-"),
      });

      // Apply the newly created tag to selected assets
      onBulkUpdate(Array.from(selectedAssets), {
        addTags: [newTag.id],
      });

      setNewTagName("");
      // Keep assets selected for additional bulk operations
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateAndApplyTag();
    }
  };

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
      {/* View toggle and bulk actions */}
      <div className="flex justify-between items-center gap-2">
        {selectedAssets.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Bulk Actions:</span>

            {/* Category dropdown */}
            {onBulkUpdate && categories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FileIcon className="h-4 w-4 mr-2" />
                    Change Category
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Select Category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        onBulkUpdate(Array.from(selectedAssets), {
                          categoryId: category.id,
                        });
                      }}
                    >
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      onBulkUpdate(Array.from(selectedAssets), {
                        categoryId: null,
                      });
                    }}
                  >
                    Remove Category
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Tags dropdown */}
            {onBulkUpdate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Tag className="h-4 w-4 mr-2" />
                    Add Tags
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Select Tags to Add</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {/* Create new tag input */}
                  <div className="px-2 py-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Create new tag..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          handleTagInputKeyDown(e);
                        }}
                        className="h-8"
                      />
                      <Button
                        size="sm"
                        onClick={handleCreateAndApplyTag}
                        disabled={
                          !newTagName.trim() || createTagMutation.isPending
                        }
                        className="h-8 px-2"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {tags.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      {tags.map((tag) => {
                        const isShared = sharedTagIds.has(tag.id);
                        return (
                          <DropdownMenuItem
                            key={tag.id}
                            onSelect={(e) => {
                              e.preventDefault();
                              // Toggle tag: if it's shared, remove it; otherwise add it
                              if (isShared) {
                                onBulkUpdate(Array.from(selectedAssets), {
                                  removeTags: [tag.id],
                                });
                              } else {
                                onBulkUpdate(Array.from(selectedAssets), {
                                  addTags: [tag.id],
                                });
                              }
                            }}
                            className={
                              isShared
                                ? "bg-blue-50 text-blue-700 font-medium"
                                : undefined
                            }
                          >
                            {tag.name}
                          </DropdownMenuItem>
                        );
                      })}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {canEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete {selectedAssets.size}
              </Button>
            )}
          </div>
        )}
        <div className="flex gap-2 ml-auto">
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
      </div>

      {/* Grid view */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => onAssetClick(asset)}
            >
              <div className="aspect-square bg-muted flex items-center justify-center relative">
                {asset.referenceOnly ? (
                  // Reference-only assets show file type icon with reference label
                  <div className="flex flex-col items-center gap-2">
                    {getFileTypeIcon(asset.fileType, true, "lg")}
                  </div>
                ) : asset.fileType?.startsWith("image/") ||
                  asset.fileType === "application/pdf" ? (
                  <img
                    src={`/api/assets/${asset.id}/thumbnail/medium`}
                    alt={asset.originalFileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getFileTypeIcon(asset.fileType, false, "lg")
                )}
                <div
                  className={`absolute top-2 left-2 transition-opacity ${selectedAssets.has(asset.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                >
                  <Checkbox
                    checked={selectedAssets.has(asset.id)}
                    onCheckedChange={() => toggleAssetSelection(asset.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white border-2"
                  />
                </div>
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  <Badge
                    variant={
                      asset.visibility === "private" ? "secondary" : "default"
                    }
                  >
                    {asset.visibility}
                  </Badge>
                  {asset.isGoogleDrive && (
                    <Badge
                      variant="outline"
                      className="bg-white/90 backdrop-blur-sm"
                      aria-label="Imported from Google Drive"
                    >
                      <Cloud className="h-3 w-3 mr-1" aria-hidden="true" />
                      Google Drive
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium truncate mb-1">
                  {asset.originalFileName}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {asset.referenceOnly
                    ? "Reference-only asset"
                    : formatFileSize(asset.fileSize)}
                  {asset.isGoogleDrive && asset.driveLastModified && (
                    <>
                      {" "}
                      · Modified {formatDate(new Date(asset.driveLastModified))}
                    </>
                  )}
                </p>
                {asset.isGoogleDrive && asset.driveOwner && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Owner: {asset.driveOwner}
                  </p>
                )}
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
                  {asset.referenceOnly && asset.driveWebLink ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (asset.driveWebLink) {
                          window.open(
                            asset.driveWebLink,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }
                      }}
                      aria-label="View reference in Google Drive"
                      title="View reference in Google Drive"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  ) : asset.isGoogleDrive && asset.driveWebLink ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (asset.driveWebLink) {
                          window.open(
                            asset.driveWebLink,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }
                      }}
                      aria-label="View in Google Drive"
                      title="View in Google Drive"
                    >
                      <Eye className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => handleDownload(asset, e)}
                      aria-label="Download asset"
                    >
                      <Download className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  )}
                  {canEdit && (
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
                  )}
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
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer group"
                  onClick={() => onAssetClick(asset)}
                >
                  <TableCell>
                    <div
                      className={`transition-opacity ${selectedAssets.has(asset.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    >
                      <Checkbox
                        checked={selectedAssets.has(asset.id)}
                        onCheckedChange={() => toggleAssetSelection(asset.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {asset.fileType?.startsWith("image/") ||
                    asset.fileType === "application/pdf" ? (
                      <img
                        src={`/api/assets/${asset.id}/thumbnail/small`}
                        alt={asset.originalFileName}
                        className="h-10 w-10 object-cover rounded"
                      />
                    ) : (
                      getFileTypeIcon(asset.fileType, asset.referenceOnly, "sm")
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {asset.originalFileName}
                  </TableCell>
                  <TableCell>
                    {asset.isGoogleDrive ? (
                      <Badge
                        variant="outline"
                        className="gap-1"
                        aria-label="Source: Google Drive"
                      >
                        <Cloud className="h-3 w-3" aria-hidden="true" />
                        Google Drive
                      </Badge>
                    ) : (
                      <Badge variant="secondary" aria-label="Source: Uploaded">
                        Uploaded
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {asset.fileType?.split("/")[1]?.toUpperCase() || "Unknown"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(asset.fileSize)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {asset.isGoogleDrive && asset.driveLastModified
                      ? formatDate(new Date(asset.driveLastModified))
                      : formatDate(asset.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {asset.isGoogleDrive && asset.driveOwner
                      ? asset.driveOwner
                      : asset.uploader?.name || "-"}
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
                      {asset.referenceOnly && asset.driveWebLink ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (asset.driveWebLink) {
                              window.open(
                                asset.driveWebLink,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }
                          }}
                          aria-label={`View ${asset.originalFileName} in Google Drive`}
                          title="View reference in Google Drive"
                        >
                          <ExternalLink
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </Button>
                      ) : asset.isGoogleDrive && asset.driveWebLink ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (asset.driveWebLink) {
                              window.open(
                                asset.driveWebLink,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }
                          }}
                          aria-label={`View ${asset.originalFileName} in Google Drive`}
                          title="View in Google Drive"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDownload(asset, e)}
                          aria-label={`Download ${asset.originalFileName}`}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                      {canEdit && (
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
                      )}
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
