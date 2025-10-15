import {
  Calendar,
  Copy,
  Download,
  ExternalLink,
  FileIcon,
  Link2,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import React, { type FC, useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  type Asset,
  useAssetCategoriesQuery,
  useAssetPublicLinksQuery,
  useAssetTagsQuery,
  useCreatePublicLinkMutation,
  useCreateTagMutation,
  useDeleteAssetMutation,
  useDeletePublicLinkMutation,
  useUpdateAssetMutation,
} from "@/lib/queries/assets";

interface AssetDetailModalProps {
  asset: Asset | null;
  open: boolean;
  onClose: () => void;
}

export const AssetDetailModal: FC<AssetDetailModalProps> = ({
  asset,
  open,
  onClose,
}) => {
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "shared">("shared");
  const [linkExpiry, setLinkExpiry] = useState<string>("7");
  const { toast } = useToast();

  // Update state when asset changes
  useEffect(() => {
    if (asset) {
      setSelectedCategories(asset.categories?.map((c) => c.id) || []);
      setSelectedTags(asset.tags?.map((t) => t.id) || []);
      setVisibility(asset.visibility);
    }
  }, [asset]);

  const { data: categories = [] } = useAssetCategoriesQuery();
  const { data: tags = [] } = useAssetTagsQuery();
  const { data: publicLinks = [], isError: publicLinksError } =
    useAssetPublicLinksQuery(asset?.clientId || 0, asset?.id || 0);
  const updateMutation = useUpdateAssetMutation();
  const deleteMutation = useDeleteAssetMutation();
  const createTagMutation = useCreateTagMutation();
  const createPublicLinkMutation = useCreatePublicLinkMutation();
  const deletePublicLinkMutation = useDeletePublicLinkMutation();

  if (!asset) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownload = () => {
    window.open(`/api/assets/${asset.id}/download`, "_blank");
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(asset.id);
    setShowDeleteAlert(false);
    onClose();
  };

  const handleVisibilityChange = async (
    newVisibility: "private" | "shared"
  ) => {
    setVisibility(newVisibility);
    await updateMutation.mutateAsync({
      id: asset.id,
      data: { visibility: newVisibility },
    });
  };

  const handleCategoryToggle = async (categoryId: number) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId];

    setSelectedCategories(newCategories);
    await updateMutation.mutateAsync({
      id: asset.id,
      data: {
        categories: newCategories.map((id) => ({ id })) as Asset["categories"],
      },
    });
  };

  const handleTagToggle = async (tagId: number) => {
    const newTags = selectedTags.includes(tagId)
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId];

    setSelectedTags(newTags);
    await updateMutation.mutateAsync({
      id: asset.id,
      data: { tags: newTags.map((id) => ({ id })) as Asset["tags"] },
    });
  };

  const handleCreateTag = async () => {
    if (!newTagInput.trim()) return;

    setIsCreatingTag(true);
    try {
      const slug = newTagInput.toLowerCase().replace(/\s+/g, "-");
      const newTag = await createTagMutation.mutateAsync({
        name: newTagInput.trim(),
        slug,
      });

      // Add the new tag to the asset
      const newTags = [...selectedTags, newTag.id];
      setSelectedTags(newTags);
      await updateMutation.mutateAsync({
        id: asset.id,
        data: { tags: newTags.map((id) => ({ id })) as Asset["tags"] },
      });

      setNewTagInput("");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleCreateTag();
    }
  };

  const handleCreatePublicLink = async () => {
    const expiresInDays =
      linkExpiry === "never" ? null : parseInt(linkExpiry, 10);
    await createPublicLinkMutation.mutateAsync({
      clientId: asset.clientId,
      assetId: asset.id,
      expiresInDays,
    });
  };

  const handleDeletePublicLink = async (linkId: number) => {
    await deletePublicLinkMutation.mutateAsync({
      clientId: asset.clientId,
      assetId: asset.id,
      linkId,
    });
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/api/public/assets/${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Public link copied to clipboard",
    });
  };

  const formatExpiryDate = (date: Date | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isImage = asset.fileType.startsWith("image/");

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pt-4">
              <span className="truncate pr-4">{asset.originalFileName}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteAlert(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              View and manage asset details, metadata, and sharing options
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-muted rounded-lg flex items-center justify-center min-h-[300px]">
              {isImage ? (
                <img
                  src={`/api/assets/${asset.id}/download`}
                  alt={asset.originalFileName}
                  className="max-h-[500px] max-w-full object-contain"
                />
              ) : (
                <FileIcon className="h-24 w-24 text-muted-foreground" />
              )}
            </div>

            <Separator />

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">File Type</Label>
                  <p className="font-medium">
                    {asset.fileType.split("/")[1]?.toUpperCase() || "Unknown"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">File Size</Label>
                  <p className="font-medium">
                    {formatFileSize(asset.fileSize)}
                  </p>
                </div>
                {asset.uploader && (
                  <div>
                    <Label className="text-muted-foreground">Uploaded By</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{asset.uploader.name}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 text-muted-foreground" />
                    <p className="font-medium m-0">
                      {formatDate(asset.createdAt)}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Modified</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 text-muted-foreground" />
                    <p className="font-medium m-0">
                      {formatDate(asset.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Visibility */}
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(value: "private" | "shared") =>
                  handleVisibilityChange(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">
                    Shared (All team members)
                  </SelectItem>
                  <SelectItem value="private">Private (Only me)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Categories */}
            <div className="space-y-2">
              <Label>Categories ({selectedCategories.length})</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  return (
                    <Badge
                      key={category.id}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleCategoryToggle(category.id)}
                    >
                      {category.name}
                      {isSelected && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags ({selectedTags.length})</Label>

              {/* Existing tags */}
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleTagToggle(tag.id)}
                    >
                      {tag.name}
                      {isSelected && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>

              {/* Create new tag */}
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="Create new tag (press Enter or comma)..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  disabled={isCreatingTag}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={!newTagInput.trim() || isCreatingTag}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <Separator />

            {/* Public Links - only show if supported (no error) */}
            {!publicLinksError && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Public Links
                </Label>
                <p className="text-sm text-muted-foreground">
                  Generate shareable links for this asset
                </p>

                {/* Existing links */}
                {publicLinks.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {publicLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-mono truncate">
                              {`/public/assets/${link.token.substring(0, 16)}...`}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires: {formatExpiryDate(link.expiresAt)}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLink(link.token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePublicLink(link.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Create new link */}
                <div className="flex gap-2 mt-3">
                  <Select value={linkExpiry} onValueChange={setLinkExpiry}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="never">No expiry</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreatePublicLink}
                    disabled={createPublicLinkMutation.isPending}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Generate Link
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{asset.originalFileName}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
