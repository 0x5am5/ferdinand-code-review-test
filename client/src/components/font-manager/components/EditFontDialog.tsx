import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditFontDialogProps, FontData } from "../types";
import { WeightStyleSelector } from "./WeightStyleSelector";

export function EditFontDialog({
  editingFont,
  setEditingFont,
  selectedWeights,
  selectedStyles,
  setSelectedWeights,
  setSelectedStyles,
  onUpdateFont,
  isUpdating,
}: EditFontDialogProps) {
  return (
    <Dialog
      open={!!editingFont}
      onOpenChange={(open) => !open && setEditingFont(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Font</DialogTitle>
          <DialogDescription>Update font properties</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Font Name</Label>
            <Input
              value={editingFont?.name || ""}
              onChange={(e) =>
                setEditingFont((prev: FontData | null) =>
                  prev ? { ...prev, name: e.target.value } : null
                )
              }
            />
          </div>

          <WeightStyleSelector
            selectedWeights={selectedWeights}
            selectedStyles={selectedStyles}
            onWeightChange={setSelectedWeights}
            onStyleChange={setSelectedStyles}
            availableWeights={editingFont?.weights || ["400"]}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFont(null)}>
              Cancel
            </Button>
            <Button onClick={onUpdateFont} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update Font"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}