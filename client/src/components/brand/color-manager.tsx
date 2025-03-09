import { Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandAsset, ColorCategory } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ColorManagerProps {
  clientId: number;
  colors: BrandAsset[];
}

interface ColorData {
  hex: string;
  rgb?: string;
  hsl?: string;
  cmyk?: string;
  pantone?: string;
  name: string;
  category: keyof typeof ColorCategory;
}

// Default colors from the inspiration image
const DEFAULT_COLORS = {
  [ColorCategory.BRAND]: [
    { hex: '#FF983B', name: 'Neon Carrot' },
    { hex: '#AA3A39', name: 'Medium Carmine' },
    { hex: '#FE4E4E', name: 'Sunset Orange' },
  ],
  [ColorCategory.NEUTRAL]: Array.from({ length: 11 }, (_, i) => ({
    hex: `#${Math.floor((i * 255) / 10).toString(16).padStart(2, '0').repeat(3)}`,
    name: `Gray ${i * 10}`,
  })),
  [ColorCategory.INTERACTIVE]: [
    { hex: '#EE5397', name: 'Brilliant Rose' },
    { hex: '#634490', name: 'Affair' },
    { hex: '#3466A5', name: 'Azure' },
    { hex: '#00C4D4', name: "Robin's Egg Blue" },
  ],
} as const;

function generateTintsAndShades(hex: string) {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Generate tints (lighter versions)
  const tints = [60, 40, 20].map(percent => {
    const tintR = r + ((255 - r) * percent) / 100;
    const tintG = g + ((255 - g) * percent) / 100;
    const tintB = b + ((255 - b) * percent) / 100;
    return `#${Math.round(tintR).toString(16).padStart(2, '0')}${Math.round(tintG).toString(16).padStart(2, '0')}${Math.round(tintB).toString(16).padStart(2, '0')}`;
  });

  // Generate shades (darker versions)
  const shades = [20, 40, 60].map(percent => {
    const shadeR = r * (1 - percent / 100);
    const shadeG = g * (1 - percent / 100);
    const shadeB = b * (1 - percent / 100);
    return `#${Math.round(shadeR).toString(16).padStart(2, '0')}${Math.round(shadeG).toString(16).padStart(2, '0')}${Math.round(shadeB).toString(16).padStart(2, '0')}`;
  });

  return { tints, shades };
}

function ColorChip({ color, onEdit, onDelete }: {
  color: ColorData;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { tints, shades } = generateTintsAndShades(color.hex);

  return (
    <div className="min-w-[200px] border rounded-lg p-4 bg-white">
      <div className="space-y-4">
        {/* Main color display */}
        <div>
          <div
            className="h-16 rounded-md mb-2"
            style={{ backgroundColor: color.hex }}
          />
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{color.name}</h4>
              <p className="text-sm text-muted-foreground">{color.hex}</p>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Color</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this color? This action
                        cannot be undone.
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
              )}
            </div>
          </div>
        </div>

        {/* Additional color information */}
        <div className="space-y-1 text-sm">
          {color.rgb && <p>RGB: {color.rgb}</p>}
          {color.hsl && <p>HSL: {color.hsl}</p>}
          {color.cmyk && <p>CMYK: {color.cmyk}</p>}
          {color.pantone && <p>Pantone: {color.pantone}</p>}
        </div>

        {/* Tints and Shades */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Tints</p>
          <div className="grid grid-cols-3 gap-1">
            {tints.map((tint, index) => (
              <div
                key={`tint-${index}`}
                className="h-6 rounded"
                style={{ backgroundColor: tint }}
                title={tint}
              />
            ))}
          </div>
          <p className="text-sm font-medium">Shades</p>
          <div className="grid grid-cols-3 gap-1">
            {shades.map((shade, index) => (
              <div
                key={`shade-${index}`}
                className="h-6 rounded"
                style={{ backgroundColor: shade }}
                title={shade}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorSection({ title, colors, onAddColor }: {
  title: string;
  colors: ColorData[];
  onAddColor: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Button variant="outline" size="icon" onClick={onAddColor}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <div className="flex w-max space-x-4 p-4">
          {colors.map((color, index) => (
            <ColorChip key={`${color.hex}-${index}`} color={color} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export function ColorManager({ clientId, colors = [] }: ColorManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof ColorCategory>("BRAND");
  const [colorType, setColorType] = useState<"solid" | "gradient">("solid");

  const createColor = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'color',
          ...data,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create color");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`]
      });
      toast({
        title: "Success",
        description: "Color added successfully",
      });
      setIsAddingColor(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteColor = useMutation({
    mutationFn: async (colorId: number) => {
      const response = await fetch(`/api/clients/${clientId}/assets/${colorId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete color");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`]
      });
      toast({
        title: "Success",
        description: "Color deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // If no colors are provided, use the default colors
  const brandColors = colors.length ? colors.filter(c => c.category === ColorCategory.BRAND) : DEFAULT_COLORS.BRAND;
  const neutralColors = colors.length ? colors.filter(c => c.category === ColorCategory.NEUTRAL) : DEFAULT_COLORS.NEUTRAL;
  const interactiveColors = colors.length ? colors.filter(c => c.category === ColorCategory.INTERACTIVE) : DEFAULT_COLORS.INTERACTIVE;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Color System</h2>
      </div>

      <div className="space-y-8">
        <ColorSection
          title="Brand Colors"
          colors={brandColors}
          onAddColor={() => {
            setSelectedCategory("BRAND");
            setIsAddingColor(true);
          }}
        />

        <ColorSection
          title="Neutral Colors"
          colors={neutralColors}
          onAddColor={() => {
            setSelectedCategory("NEUTRAL");
            setIsAddingColor(true);
          }}
        />

        <ColorSection
          title="Interactive Colors"
          colors={interactiveColors}
          onAddColor={() => {
            setSelectedCategory("INTERACTIVE");
            setIsAddingColor(true);
          }}
        />
      </div>

      <Dialog open={isAddingColor} onOpenChange={setIsAddingColor}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Color</DialogTitle>
            <DialogDescription>
              Add a new color to your brand system. You can specify various
              color formats and create gradients.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Color Type</Label>
              <Select
                value={colorType}
                onValueChange={(value: "solid" | "gradient") =>
                  setColorType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid Color</SelectItem>
                  <SelectItem value="gradient">Gradient</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Color Name</Label>
              <Input id="name" placeholder="e.g., Primary Blue" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hex">Hex Code</Label>
              <Input id="hex" placeholder="#000000" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rgb">RGB (Optional)</Label>
              <Input id="rgb" placeholder="rgb(0, 0, 0)" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cmyk">CMYK (Optional)</Label>
              <Input id="cmyk" placeholder="cmyk(0, 0, 0, 100)" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pantone">Pantone (Optional)</Label>
              <Input id="pantone" placeholder="e.g., PMS 000" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="default" onClick={() => setIsAddingColor(false)}>Cancel</Button>
            <Button type="submit" onClick={() => {
              //Handle submit here,  using createColor mutation
            }}>Add Color</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}