import { UserRole } from "@shared/schema";
import { motion } from "framer-motion";
import { Copy, Edit2, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { ColorData } from "@/types/color";
import { ColorBlock } from "./ColorBlock";

interface ColorChipProps {
  color: ColorData;
  onEdit?: () => void;
  onDelete?: () => void;
  _onUpdate?: (
    colorId: number,
    updates: { hex: string; rgb?: string; hsl?: string; cmyk?: string }
  ) => void;
}

export function ColorChip({
  color,
  onEdit,
  onDelete,
  _onUpdate,
}: ColorChipProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState({
    name: color.name,
    hex: color.hex,
  });

  const { user } = useAuth();

  if (!user) return null;

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({
      title: "Copied!",
      description: `${value} has been copied to your clipboard.`,
    });
  };

  const handleQuickEdit = (e: React.FormEvent) => {
    e.preventDefault();
    onEdit?.();
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      className="relative min-w-[280px] border rounded-lg bg-white overflow-hidden group"
    >
      {/* Quick edit hover menu */}
      {user.role !== UserRole.STANDARD && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={() => handleCopy(color.hex)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-white/90 hover:bg-white"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Color</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this color? This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Color content */}
      <div className="p-4">
        {isEditing ? (
          <form onSubmit={handleQuickEdit} className="space-y-2">
            <Input
              value={editValue.name}
              onChange={(e) =>
                setEditValue((prev) => ({ ...prev, name: e.target.value }))
              }
              className="font-medium"
              autoFocus
            />
            <Input
              value={editValue.hex}
              onChange={(e) =>
                setEditValue((prev) => ({ ...prev, hex: e.target.value }))
              }
              pattern="^#[0-9A-Fa-f]{6}$"
              className="font-mono"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        ) : (
          <>
            <h4 className="font-medium mb-1">{color.name}</h4>
            <ColorBlock hex={color.hex} onClick={() => handleCopy(color.hex)} />
          </>
        )}
      </div>

      {/* Color metadata */}
      <div className="border-t p-4 space-y-4 bg-gray-50">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">HEX</Label>
            <p className="font-mono">{color.hex}</p>
          </div>
          {color.rgb && (
            <div>
              <Label className="text-xs text-muted-foreground">RGB</Label>
              <p className="font-mono">{color.rgb}</p>
            </div>
          )}
          {color.cmyk && (
            <div>
              <Label className="text-xs text-muted-foreground">CMYK</Label>
              <p className="font-mono">{color.cmyk}</p>
            </div>
          )}
          {color.pantone && (
            <div>
              <Label className="text-xs text-muted-foreground">Pantone</Label>
              <p className="font-mono">{color.pantone}</p>
            </div>
          )}
        </div>

        {/* Tints and shades removed for simplicity with gradients */}
      </div>
    </motion.div>
  );
}
