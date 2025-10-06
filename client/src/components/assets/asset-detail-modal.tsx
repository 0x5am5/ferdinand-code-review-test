import { Calendar, Download, FileIcon, Trash2, User, X } from "lucide-react";
import { type FC, useState } from "react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  type Asset,
  useAssetCategoriesQuery,
  useAssetTagsQuery,
  useDeleteAssetMutation,
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
  const [editingVisibility, setEditingVisibility] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>(
    asset?.categories?.map((c) => c.id) || []
  );
  const [selectedTags, setSelectedTags] = useState<number[]>(
    asset?.tags?.map((t) => t.id) || []
  );

  const { data: categories = [] } = useAssetCategoriesQuery();
  const { data: tags = [] } = useAssetTagsQuery();
  const updateMutation = useUpdateAssetMutation();
  const deleteMutation = useDeleteAssetMutation();

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

  const handleVisibilityChange = async (visibility: "private" | "shared") => {
    await updateMutation.mutateAsync({
      id: asset.id,
      data: { visibility },
    });
    setEditingVisibility(false);
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

  const isImage = asset.fileType.startsWith("image/");

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
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
              {editingVisibility ? (
                <div className="flex gap-2">
                  <Select
                    defaultValue={asset.visibility}
                    onValueChange={(value: "private" | "shared") =>
                      handleVisibilityChange(value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">
                        Shared (All team members)
                      </SelectItem>
                      <SelectItem value="private">Private (Only me)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => setEditingVisibility(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      asset.visibility === "private" ? "secondary" : "default"
                    }
                  >
                    {asset.visibility}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingVisibility(true)}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Categories */}
            <div className="space-y-2">
              <Label>Categories</Label>
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
              <Label>Tags</Label>
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
            </div>
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
