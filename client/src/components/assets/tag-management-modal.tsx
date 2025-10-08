import { Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type AssetTag,
  useAssetTagsQuery,
  useDeleteTagMutation,
} from "@/lib/queries/assets";

interface TagManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TagManagementModal: FC<TagManagementModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { data: tags = [], isLoading } = useAssetTagsQuery();
  const deleteTagMutation = useDeleteTagMutation();
  const [tagToDelete, setTagToDelete] = useState<AssetTag | null>(null);

  const handleDeleteConfirm = async () => {
    if (tagToDelete) {
      await deleteTagMutation.mutateAsync(tagToDelete.id);
      setTagToDelete(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Delete tags to remove them from all associated assets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Loading tags...
              </p>
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No tags found
              </p>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">{tag.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTagToDelete(tag)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!tagToDelete}
        onOpenChange={(open) => !open && setTagToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{tagToDelete?.name}"?
              This will remove the tag from all associated assets. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
