import {
  Plus,
  Edit2,
  Trash2,
  Check,
  Copy,
  RotateCcw,
  Download,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { BrandAsset, UserRole } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { AssetDisplay } from "./asset-display";
import { AssetSection } from "./asset-section";

// ColorCard component for the color manager
function ColorCard({ 
  color, 
  onEdit, 
  onDelete,
}: { 
  color: any; 
  onEdit: (color: any) => void; 
  onDelete: (id: number) => void; 
}) {
  const { toast } = useToast();
  const [showTints, setShowTints] = useState(false);

  const copyHex = (hexValue: string) => {
    navigator.clipboard.writeText(hexValue);
    toast({
      title: "Copied!",
      description: `${hexValue} has been copied to your clipboard.`,
    });
  };

  // Generate tints and shades
  const { tints, shades } = generateTintsAndShades(color.hex);

  return (
    <div className="color-chip-container relative">
      <motion.div 
        className="color-chip"
        style={{ backgroundColor: color.hex }}
        animate={{ 
          width: showTints ? "60%" : "100%",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="color-chip__info">
          <h5 
            className="color-chip--title"
            style={{
              color: parseInt(color.hex.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff',
            }}
          >
            {color.name}
          </h5>
          <p className="text-xs font-mono" 
             style={{
              color: parseInt(color.hex.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff',
            }} >{color.hex}</p>
          {color.rgb && (
            <p className="text-xs font-mono" 
               style={{
              color: parseInt(color.hex.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff',
            }} >{color.rgb}</p>
          )}
          {color.cmyk && (
            <p className="text-xs font-mono" 
               style={{
              color: parseInt(color.hex.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff',
            }} >{color.cmyk}</p>
          )}
          {color.pantone && (
            <p className="text-xs font-mono" 
               style={{
              color: parseInt(color.hex.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff',
            }} >{color.pantone}</p>
          )}
        </div>
        <div className="color-chip__controls">
          {color.category !== "neutral" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowTints(!showTints)}
              title={showTints ? "Hide tints/shades" : "Show tints/shades"}
            >
              <Palette className="h-6 w-6" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => copyHex(color.hex)}
          >
            <Copy className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(color)}
          >
            <Edit2 className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDelete(color.id)}
          >
            <Trash2 className="h-6 w-6" />
          </Button>
        </div>
      </motion.div>

      {/* Tints and Shades Panel */}
      <AnimatePresence>
        {showTints && (
          <motion.div 
            className="absolute top-0 right-0 w-[40%] h-full flex flex-col"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Tints Row (Lighter) */}
            <div className="flex h-1/2">
              {tints.map((tint, index) => (
                <motion.div
                  key={`tint-${index}`}
                  className="flex-1 relative group cursor-pointer"
                  style={{ backgroundColor: tint }}
                  onClick={() => copyHex(tint)}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 bg-black/20 group-hover:opacity-100 transition-opacity">
                    <Copy className="h-3 w-3 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Shades Row (Darker) */}
            <div className="flex h-1/2">
              {shades.map((shade, index) => (
                <motion.div
                  key={`shade-${index}`}
                  className="flex-1 relative group cursor-pointer"
                  style={{ backgroundColor: shade }}
                  onClick={() => copyHex(shade)}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 bg-black/20 group-hover:opacity-100 transition-opacity">
                    <Copy className="h-3 w-3 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Color conversion utilities
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgb(${r}, ${g}, ${b})`;
}

function hexToHsl(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function hexToCmyk(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  let k = 1 - Math.max(r, g, b);
  let c = (1 - r - k) / (1 - k);
  let m = (1 - g - k) / (1 - k);
  let y = (1 - b - k) / (1 - k);

  if (k === 1) {
    c = m = y = 0;
  }

  return `cmyk(${Math.round(c * 100)}, ${Math.round(m * 100)}, ${Math.round(y * 100)}, ${Math.round(k * 100)})`;
}

function generateTintsAndShades(
  hex: string,
  tintPercents = [60, 40, 20],
  shadePercents = [20, 40, 60],
) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const tints = tintPercents.map((percent) => {
    const tintR = r + ((255 - r) * percent) / 100;
    const tintG = g + ((255 - g) * percent) / 100;
    const tintB = b + ((255 - b) * percent) / 100;
    return `#${Math.round(tintR).toString(16).padStart(2, "0")}${Math.round(tintG).toString(16).padStart(2, "0")}${Math.round(tintB).toString(16).padStart(2, "0")}`;
  });

  const shades = shadePercents.map((percent) => {
    const shadeR = r * (1 - percent / 100);
    const shadeG = g * (1 - percent / 100);
    const shadeB = b * (1 - percent / 100);
    return `#${Math.round(shadeR).toString(16).padStart(2, "0")}${Math.round(shadeG).toString(16).padStart(2, "0")}${Math.round(shadeB).toString(16).padStart(2, "0")}`;
  });

  return { tints, shades };
}

function generateNeutralPalette(baseGrey: string) {
  // Generate 10 shades from white to black
  const tints = generateTintsAndShades(baseGrey, [90, 80, 70, 60, 50]).tints;
  const shades = generateTintsAndShades(baseGrey, [40, 30, 20, 10, 5]).shades;
  return [...tints, baseGrey, ...shades];
}

function generateContainerColors(baseColor: string) {
  // Updated to use 60% for both lighter and darker values
  const { tints, shades } = generateTintsAndShades(baseColor, [60], [60]);
  return {
    container: tints[0],
    onContainer: shades[0],
  };
}

function ColorBlock({ hex, onClick }: { hex: string; onClick?: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onClick?.();
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="relative cursor-pointer group" onClick={handleClick}>
      <div
        className="rounded-md transition-all duration-200 group-hover:ring-2 ring-primary/20"
        style={{ backgroundColor: hex, height: onClick ? "8rem" : "1.5rem" }}
      />
      <AnimatePresence>
        {copied ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md"
          >
            <Check className="h-4 w-4 text-white" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 rounded-md transition-colors"
          >
            <Copy className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ColorChip({
  color,
  onEdit,
  onDelete,
}: {
  color: ColorData;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { tints, shades } = useToast();
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
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
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

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Tints</Label>
          <div className="grid grid-cols-3 gap-1">
            {tints.map((tint, index) => (
              <ColorBlock
                key={`tint-${index}`}
                hex={tint}
                onClick={() => handleCopy(tint)}
              />
            ))}
          </div>
          <Label className="text-xs text-muted-foreground">Shades</Label>
          <div className="grid grid-cols-3 gap-1">
            {shades.map((shade, index) => (
              <ColorBlock
                key={`shade-${index}`}
                hex={shade}
                onClick={() => handleCopy(shade)}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ColorSection({
  title,
  colors = [],
  onAddColor,
  deleteColor,
  onEditColor,
}: {
  title: string;
  colors: ColorData[];
  onAddColor: () => void;
  deleteColor: (colorId: number) => void;
  onEditColor: (color: ColorData) => void;
}) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-4">
      {colors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {colors.map((color) => (
              <ColorChip
                key={`${color.hex}-${color.id || Math.random()}`}
                color={color}
                onEdit={() => onEditColor(color)}
                onDelete={() => color.id && deleteColor(color.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground p-8 text-center">
          <p className="text-muted-foreground">No colors added yet</p>
          {user.role !== UserRole.STANDARD && (
            <Button 
              variant="outline" 
              className="mt-4 flex items-center gap-1"
              onClick={onAddColor}
            >
              <Plus className="h-4 w-4" />
              <span>Add {title}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ColorManager({
  clientId,
  colors,
  designSystem,
  updateDraftDesignSystem,
  addToHistory,
}: ColorManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    "brand" | "neutral" | "interactive"
  >("brand");
  const [editingColor, setEditingColor] = useState<ColorData | null>(null);
  // We don't need an extra state since colors are derived from props

  // Color utility functions
  const ColorUtils = {
    // Analyze brightness of a hex color (returns 1-11 scale)
    analyzeBrightness(hex: string): number {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return 6; // Default middle value

      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);

      // Calculate perceived brightness using relative luminance formula
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      // Convert to 1-11 scale
      return Math.round(brightness * 10) + 1;
    },

    // Generate missing grey shades based on existing ones
    generateGreyShades(existingColors: Array<ColorData & { brightness: number }>) {
      const existingLevels = existingColors.map(c => c.brightness);
      const newShades: Array<{ level: number; hex: string }> = [];

      // Generate shades for missing levels (1-11)
      for (let i = 1; i <= 11; i++) {
        if (!existingLevels.includes(i)) {
          // Calculate brightness percentage (0-100)
          const brightness = ((i - 1) / 10) * 100;

          // Generate hex color
          const value = Math.round((brightness / 100) * 255);
          const hex = `#${value.toString(16).padStart(2, '0')}${value.toString(16).padStart(2, '0')}${value.toString(16).padStart(2, '0')}`;

          newShades.push({ level: i, hex: hex.toUpperCase() });
        }
      }

      return newShades;
    }
  };

  const form = useForm<ColorFormData>({
    resolver: zodResolver(colorFormSchema),
    defaultValues: {
      name: "",
      hex: "#000000",
      type: "solid",
    },
  });

  const createColor = useMutation({
    mutationFn: async (data: ColorFormData) => {
      const payload = {
        name: data.name,
        category: "color",
        clientId,
        data: {
          type: data.type,
          category: selectedCategory,
          colors: [
            {
              hex: data.hex,
              rgb: data.rgb,
              cmyk: data.cmyk,
              pantone: data.pantone,
            },
          ],
          tints: generateTintsAndShades(data.hex).tints.map((hex, i) => ({
            percentage: [60, 40, 20][i],
            hex,
          })),
          shades: generateTintsAndShades(data.hex).shades.map((hex, i) => ({
            percentage: [20, 40, 60][i],
            hex,
          })),
        },
      };

      const response = await fetch(
        `/api/clients/${clientId}/assets${editingColor?.id ? `/${editingColor.id}` : ""}`,
        {
          method: editingColor ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save color");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
      });
      toast({
        title: "Success",
        description: editingColor
          ? "Color updated successfully"
          : "Color added successfully",
      });
      setIsAddingColor(false);
      setEditingColor(null);
      form.reset();
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
      const response = await fetch(
        `/api/clients/${clientId}/assets/${colorId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete color");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
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

  const parseColorAsset = (asset: BrandAsset): ColorData | null => {
    try {
      const data =
        typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
      if (!data?.colors?.[0]) return null;

      return {
        id: asset.id,
        hex: data.colors[0].hex,
        rgb: data.colors[0].rgb,
        hsl: data.colors[0].hsl,
        cmyk: data.colors[0].cmyk,
        pantone: data.colors[0].pantone,
        name: asset.name,
        category: data.category,
      };
    } catch (error) {
      console.error("Error parsing color asset:", error);
      return null;
    }
  };

  const transformedColors = colors
    .filter((asset) => asset.category === "color")
    .map(parseColorAsset)
    .filter((color): color is ColorData => color !== null);

  const brandColorsData = transformedColors.filter(
    (c) => c.category === "brand",
  );
  const neutralColorsData = transformedColors.filter(
    (c) => c.category === "neutral",
  );
  const interactiveColorsData = transformedColors.filter(
    (c) => c.category === "interactive",
  );

  const handleEditColor = (color: ColorData) => {
    setEditingColor(color);
    setSelectedCategory(color.category);
    form.reset({
      name: color.name,
      hex: color.hex,
      rgb: color.rgb,
      cmyk: color.cmyk,
      pantone: color.pantone,
      type: "solid",
    });
    setIsAddingColor(true);
  };

  const handleHexChange = (hex: string) => {
    if (hex.match(/^#[0-9A-F]{6}$/i)) {
      // Auto-generate name if not set
      if (!form.getValues("name")) {
        form.setValue("name", `Color ${hex.toUpperCase()}`);
      }

      // Auto-calculate other color formats
      const rgb = hexToRgb(hex);
      const cmyk = hexToCmyk(hex);

      if (rgb) form.setValue("rgb", rgb);
      if (cmyk) form.setValue("cmyk", cmyk);
      if (!form.getValues("pantone")) {
        form.setValue("pantone", ""); // Clear pantone as it can't be auto-calculated
      }
    }
  };

  const handleAddBrandColor = (name: string, hex: string) => {
    const colorKey = name.toLowerCase().replace(/\s+/g, "-");
    handleColorChange(colorKey, hex, true);

    // We're not managing an internal color state anymore
    // The colors will be updated through the API and the component will re-render
  };

  const handleColorChange = (
    key: string,
    value: string,
    isBaseColor = false,
  ) => {
    //  Updated color change handling to dynamically generate container and neutral colors
    const updatedDesignSystem = {
      ...(designSystem || {}),
      colors: {
        ...(designSystem?.colors || {}),
        [key]: value,
      },
    };

    if (isBaseColor) {
      // Generate container colors
      const { container, onContainer } = generateContainerColors(value);

      // Update container colors
      updatedDesignSystem.colors[`${key}-container`] = container;
      updatedDesignSystem.colors[`on-${key}-container`] = onContainer;

      // If it's a neutral base color, generate the palette
      if (key === "neutral-base") {
        const neutralPalette = generateNeutralPalette(value);
        neutralPalette.forEach((color, index) => {
          const colorKey = `neutral-${index * 100}`;
          updatedDesignSystem.colors[colorKey] = color;
        });
      }
    }

    // Only call these if the props are provided
    if (updateDraftDesignSystem) {
      updateDraftDesignSystem(updatedDesignSystem.colors);
    }

    if (addToHistory) {
      addToHistory(updatedDesignSystem);
    }
  };

  if (!user) return null;

  return (
    <div className="color-manager">      <div className="manager__header ">
        <div>
          <h1>Color System</h1>
          <p className="text-muted-foreground">Manage and use the official color palette for this brand</p>
        </div>
        {/* {user.role !== UserRole.STANDARD && (
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                setSelectedCategory("brand");
                setEditingColor(null);
                form.reset();
                setIsAddingColor(true);
              }} 
              variant="outline"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              <span>Add Color</span>
            </Button>
          </div>
        )} */}
      </div>

      <div className="color-manager__sections space-y-8">
        <AssetSection
          title="Brand Colors"
          description={colorDescriptions.brand}
          isEmpty={brandColorsData.length === 0}
          sectionType="brand-colors"
          uploadComponent={
            <Button
              onClick={() => {
                setSelectedCategory("brand");
                setEditingColor(null);
                form.reset();
                setIsAddingColor(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Color
            </Button>
          }
          emptyPlaceholder={
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Palette className="h-8 w-8" />
              </div>
              <p>No brand colors yet</p>
              <p className="text-sm">Contact an admin to add brand colors</p>
            </div>
          }
        >
          {/* This is the layout of the brand colors */}
          <div className="asset-display">
            <div className="asset-display__info">
              {colorDescriptions.brand}
            </div>
            <div className="asset-display__preview">
              {brandColorsData.map((color) => (
                <ColorCard
                  key={color.id}
                  color={color}
                  onEdit={handleEditColor}
                  onDelete={deleteColor.mutate}
                />
              ))}

              <div className="flex flex-col gap-2">
                {!createColor.isPending && (
                  <Button
                    onClick={() => {
                      setSelectedCategory("brand");
                      setEditingColor(null);
                      form.reset();
                      setIsAddingColor(true);
                    }}
                    variant="outline"
                    className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/10 hover:border-muted-foreground/25 w-full h-[120px] transition-colors bg-muted/5"
                  >
                    <Plus className="h-12 w-12 text-muted-foreground/50" />
                    <span className="text-muted-foreground/50">Add New Color</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </AssetSection>

        <AssetSection
          title="Neutral Colors"
          description={colorDescriptions.neutral}
          isEmpty={neutralColorsData.length === 0}
          sectionType="neutral-colors"
          uploadComponent={
            <Button
              onClick={() => {
                setSelectedCategory("neutral");
                setEditingColor(null);
                form.reset();
                setIsAddingColor(true);
              }}
              variant="outline"
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/10 hover:border-muted-foreground/25 w-full h-[120px] transition-colors bg-muted/5"
              >
              <Plus className="h-4 w-4" />
              Add Color
            </Button>
          }
          emptyPlaceholder={
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Palette className="h-8 w-8" />
              </div>
              <p>No neutral colors yet</p>
              <p className="text-sm">Contact an admin to add neutral colors</p>
            </div>
          }
        >
          {/* This is the layout of neutral colors */}
          <div className="asset-display">
            <div className="asset-display__info">
              {colorDescriptions.neutral}
            </div>
            <div className="asset-display__preview">
              {neutralColorsData.map((color) => (
                <ColorCard
                  key={color.id}
                  color={color}
                  onEdit={handleEditColor}
                  onDelete={deleteColor.mutate}
                />
              ))}

              <div className="asset-display__add-generate-buttons">
                <Button
                  onClick={() => {
                    setSelectedCategory("neutral");
                    setEditingColor(null);
                    form.reset();
                    setIsAddingColor(true);
                  }}
                  variant="outline"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/10 hover:border-muted-foreground/25 w-full h-[120px] transition-colors bg-muted/5"
                >
                  <Plus className="h-12 w-12 text-muted-foreground/50" />
                  <span className="text-muted-foreground/50">Add New Color</span>
                </Button>

                <Button
                  onClick={() => {
                    // Get neutral colors and analyze brightness
                    const neutralColors = neutralColorsData.map(color => ({
                      ...color,
                      brightness: ColorUtils.analyzeBrightness(color.hex)
                    }));

                    // Generate missing shades
                    const newShades = ColorUtils.generateGreyShades(neutralColors);

                    // Set category before creating colors
                    setSelectedCategory("neutral");

                    // Create and add new colors
                    newShades.forEach(shade => {
                      createColor.mutate({
                        name: `Grey ${shade.level}`,
                        hex: shade.hex,
                        type: "solid",
                        category: "neutral" // Explicitly set category in payload
                      });
                    });
                  }}
                  variant="outline"
                  className="flex items-center justify-center gap-2 py-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Generate</span>
                </Button>
              </div>
            </div>
          </div>
        </AssetSection>

        <AssetSection
          title="Interactive Colors"
          description={colorDescriptions.interactive}
          isEmpty={interactiveColorsData.length === 0}
          sectionType="interactive-colors"
          uploadComponent={
            <Button
              onClick={() => {
                setSelectedCategory("interactive");
                setEditingColor(null);
                form.reset();
                setIsAddingColor(true);
              }}
              variant="outline"
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/10 hover:border-muted-foreground/25 w-full h-[120px] transition-colors bg-muted/5"
              >
              <Plus className="h-4 w-4" />
              Add Color
            </Button>
          }
          emptyPlaceholder={
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Palette className="h-8 w-8" />
              </div>
              <p>No interactive colors yet</p>
              <p className="text-sm">Contact an admin to add interactive colors</p>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
            {interactiveColorsData.map((color) => (
              <ColorCard
                key={color.id}
                color={color}
                onEdit={handleEditColor}
                onDelete={deleteColor.mutate}
              />
            ))}
          </div>
        </AssetSection>
      </div>

      <Dialog open={isAddingColor} onOpenChange={setIsAddingColor}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingColor ? "Edit Color" : "Add New Color"}
            </DialogTitle>
            <DialogDescription>
              {editingColor
                ? "Edit the color details below."
                : "Add a new color to your brand system. You can specify various color formats and create gradients."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => createColor.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid Color</SelectItem>
                        <SelectItem value="gradient">Gradient</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hex Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="#000000"
                        onChange={(e) => {
                          field.onChange(e);
                          handleHexChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Primary Blue" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rgb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RGB (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="rgb(0, 0, 0)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cmyk"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CMYK (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="cmyk(0, 0, 0, 100)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pantone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pantone (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., PMS 000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddingColor(false);
                    setEditingColor(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createColor.isPending}>
                  {createColor.isPending
                    ? "Saving..."
                    : editingColor
                      ? "Save Changes"
                      : "Add Color"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ColorManagerProps {
  clientId: number;
  colors: BrandAsset[];
  updateDraftDesignSystem?: (colors: any) => void; // Made optional
  addToHistory?: (designSystem: any) => void; // Made optional
  designSystem?: any; // Made optional
}

interface ColorData {
  id?: number;
  hex: string;
  rgb?: string;
  hsl?: string;
  cmyk?: string;
  pantone?: string;
  name: string;
  category: "brand" | "neutral" | "interactive";
}

// Color category descriptions
const colorDescriptions = {
  brand: "Primary colors that define the brand identity and should be used consistently across all materials.",
  neutral: "Supporting colors for backgrounds, text, and UI elements that provide balance to the color system.",
  interactive: "Colors used for buttons, links, and interactive elements to guide user actions."
};

const colorFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  hex: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color code"),
  rgb: z.string().optional(),
  cmyk: z.string().optional(),
  pantone: z.string().optional(),
  type: z.enum(["solid", "gradient"]),
});

type ColorFormData = z.infer<typeof colorFormSchema>;