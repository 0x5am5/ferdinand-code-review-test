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
import { AssetSection, AssetEmptyState } from "@/components/shared/asset-section";

// Color conversion utilities are preserved from the original file
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

// Interfaces
interface ColorManagerProps {
  clientId: number;
  colors: BrandAsset[];
  updateDraftDesignSystem?: (colors: any) => void;
  addToHistory?: (designSystem: any) => void;
  designSystem?: any;
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

const colorFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  hex: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color code"),
  rgb: z.string().optional(),
  cmyk: z.string().optional(),
  pantone: z.string().optional(),
  type: z.enum(["solid", "gradient"]),
});

type ColorFormData = z.infer<typeof colorFormSchema>;

// Color descriptions for each type
const colorDescriptions = {
  brand: "Brand colors reflect your brand's personality and should be used consistently across marketing and communication materials. Add your primary and secondary brand colors here.",
  neutral: "Neutral colors are used for text, backgrounds, and UI elements. They provide the foundation for your design system and help create visual hierarchy.",
  interactive: "Interactive colors are used to communicate the state of UI elements. They include colors for buttons, links, and other interactive elements."
};

// Color Block Component (preserved from original)
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

// ColorDisplay component - transformed into asset display format
function ColorDisplay({ 
  asset, 
  clientId, 
  queryClient, 
  onDelete 
}: { 
  asset: BrandAsset;
  clientId: number;
  queryClient: any;
  onDelete: (assetId: number) => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  // Parse the color data
  let colorData: ColorData | null = null;
  try {
    const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
    colorData = {
      id: asset.id,
      name: asset.name,
      hex: data.colors[0].hex,
      rgb: data.colors[0].rgb,
      cmyk: data.colors[0].cmyk,
      pantone: data.colors[0].pantone,
      category: data.category || "brand"
    };
  } catch (error) {
    console.error("Error parsing color data:", error);
    return null;
  }
  
  if (!colorData) return null;
  
  const { tints, shades } = generateTintsAndShades(colorData.hex);
  
  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({
      title: "Copied!",
      description: `${value} has been copied to your clipboard.`,
    });
  };
  
  return (
    <div className="asset-display">
      <div className="asset-display__info">
        <h4 className="font-medium mb-1">{colorData.name}</h4>
        <ColorBlock hex={colorData.hex} onClick={() => handleCopy(colorData.hex)} />
      </div>
      
      <div className="border-t p-4 space-y-4 bg-gray-50">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">HEX</Label>
            <p className="font-mono">{colorData.hex}</p>
          </div>
          {colorData.rgb && (
            <div>
              <Label className="text-xs text-muted-foreground">RGB</Label>
              <p className="font-mono">{colorData.rgb}</p>
            </div>
          )}
          {colorData.cmyk && (
            <div>
              <Label className="text-xs text-muted-foreground">CMYK</Label>
              <p className="font-mono">{colorData.cmyk}</p>
            </div>
          )}
          {colorData.pantone && (
            <div>
              <Label className="text-xs text-muted-foreground">Pantone</Label>
              <p className="font-mono">{colorData.pantone}</p>
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
      
      {user && user.role !== UserRole.STANDARD && (
        <div className="asset-display__actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Handle edit
            }}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
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
                  onClick={() => onDelete(asset.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

// ColorUpload component for adding new colors
function ColorUpload({ 
  type, 
  clientId, 
  queryClient 
}: { 
  type: string; 
  clientId: number; 
  queryClient: any; 
}) {
  const [isAddingColor, setIsAddingColor] = useState(false);
  const { toast } = useToast();
  
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
          category: type,
          colors: [
            {
              hex: data.hex,
              rgb: data.rgb || hexToRgb(data.hex),
              cmyk: data.cmyk || hexToCmyk(data.hex),
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
        `/api/clients/${clientId}/assets`,
        {
          method: "POST",
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
        description: "Color added successfully",
      });
      setIsAddingColor(false);
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
  
  const onSubmit = (data: ColorFormData) => {
    createColor.mutate(data);
  };
  
  return (
    <div className="color-upload-container">
      <Button 
        variant="outline" 
        className="w-full justify-center gap-2 p-8 border-dashed"
        onClick={() => setIsAddingColor(true)}
      >
        <Plus className="h-5 w-5" />
        <span>Add {type} Color</span>
      </Button>
      
      <Dialog open={isAddingColor} onOpenChange={setIsAddingColor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {type.charAt(0).toUpperCase() + type.slice(1)} Color</DialogTitle>
            <DialogDescription>
              Add a new color to your {type} palette. This will be used in your brand guidelines.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Primary Blue" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="hex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hex Color</FormLabel>
                    <FormControl>
                      <div className="flex gap-2 items-center">
                        <div
                          className="w-10 h-10 rounded-md border"
                          style={{ backgroundColor: field.value }}
                        />
                        <Input placeholder="#000000" {...field} />
                      </div>
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
                    <FormLabel>Pantone (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PMS 287 C" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingColor(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createColor.isPending}>
                  {createColor.isPending ? "Adding..." : "Add Color"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main ColorManager component with new standardized structure
export function ColorManagerRefactored({
  clientId,
  colors,
}: ColorManagerProps) {
  const queryClient = useQueryClient();
  
  // Group colors by category
  const brandColors = colors.filter(color => {
    try {
      const data = typeof color.data === "string" ? JSON.parse(color.data) : color.data;
      return color.category === "color" && data.category === "brand";
    } catch {
      return false;
    }
  });
  
  const neutralColors = colors.filter(color => {
    try {
      const data = typeof color.data === "string" ? JSON.parse(color.data) : color.data;
      return color.category === "color" && data.category === "neutral";
    } catch {
      return false;
    }
  });
  
  const interactiveColors = colors.filter(color => {
    try {
      const data = typeof color.data === "string" ? JSON.parse(color.data) : color.data;
      return color.category === "color" && data.category === "interactive";
    } catch {
      return false;
    }
  });
  
  const deleteColor = useMutation({
    mutationFn: async (colorId: number) => {
      const response = await fetch(
        `/api/clients/${clientId}/assets/${colorId}`,
        {
          method: "DELETE",
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete color");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
      });
    },
  });
  
  return (
    <div className="space-y-8">
      {/* Brand Colors Section */}
      <AssetSection
        type="brand"
        title="Brand Colors"
        assets={brandColors}
        clientId={clientId}
        onDeleteAsset={(assetId) => deleteColor.mutate(assetId)}
        emptyStateDescription={colorDescriptions.brand}
        renderAssetDisplay={({ asset, clientId, queryClient, onDelete }) => (
          <ColorDisplay
            key={asset.id}
            asset={asset}
            clientId={clientId}
            queryClient={queryClient}
            onDelete={onDelete}
          />
        )}
        renderEmptyState={({ type, clientId, queryClient, description }) => (
          <AssetEmptyState
            description={description}
            icon={Palette}
            type={type}
            clientId={clientId}
            queryClient={queryClient}
            uploadComponent={
              <ColorUpload
                type={type}
                clientId={clientId}
                queryClient={queryClient}
              />
            }
          />
        )}
      />
      
      {/* Neutral Colors Section */}
      <AssetSection
        type="neutral"
        title="Neutral Colors"
        assets={neutralColors}
        clientId={clientId}
        onDeleteAsset={(assetId) => deleteColor.mutate(assetId)}
        emptyStateDescription={colorDescriptions.neutral}
        renderAssetDisplay={({ asset, clientId, queryClient, onDelete }) => (
          <ColorDisplay
            key={asset.id}
            asset={asset}
            clientId={clientId}
            queryClient={queryClient}
            onDelete={onDelete}
          />
        )}
        renderEmptyState={({ type, clientId, queryClient, description }) => (
          <AssetEmptyState
            description={description}
            icon={Palette}
            type={type}
            clientId={clientId}
            queryClient={queryClient}
            uploadComponent={
              <ColorUpload
                type={type}
                clientId={clientId}
                queryClient={queryClient}
              />
            }
          />
        )}
      />
      
      {/* Interactive Colors Section */}
      <AssetSection
        type="interactive"
        title="Interactive Colors"
        assets={interactiveColors}
        clientId={clientId}
        onDeleteAsset={(assetId) => deleteColor.mutate(assetId)}
        emptyStateDescription={colorDescriptions.interactive}
        renderAssetDisplay={({ asset, clientId, queryClient, onDelete }) => (
          <ColorDisplay
            key={asset.id}
            asset={asset}
            clientId={clientId}
            queryClient={queryClient}
            onDelete={onDelete}
          />
        )}
        renderEmptyState={({ type, clientId, queryClient, description }) => (
          <AssetEmptyState
            description={description}
            icon={Palette}
            type={type}
            clientId={clientId}
            queryClient={queryClient}
            uploadComponent={
              <ColorUpload
                type={type}
                clientId={clientId}
                queryClient={queryClient}
              />
            }
          />
        )}
      />
    </div>
  );
}