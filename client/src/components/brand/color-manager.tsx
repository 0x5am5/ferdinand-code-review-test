import { Plus, Edit2, Trash2, Check, Copy, RotateCcw, Download } from "lucide-react";
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
import { BrandAsset } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
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

function generateTintsAndShades(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const tints = [60, 40, 20].map(percent => {
    const tintR = r + ((255 - r) * percent) / 100;
    const tintG = g + ((255 - g) * percent) / 100;
    const tintB = b + ((255 - b) * percent) / 100;
    return `#${Math.round(tintR).toString(16).padStart(2, '0')}${Math.round(tintG).toString(16).padStart(2, '0')}${Math.round(tintB).toString(16).padStart(2, '0')}`;
  });

  const shades = [20, 40, 60].map(percent => {
    const shadeR = r * (1 - percent / 100);
    const shadeG = g * (1 - percent / 100);
    const shadeB = b * (1 - percent / 100);
    return `#${Math.round(shadeR).toString(16).padStart(2, '0')}${Math.round(shadeG).toString(16).padStart(2, '0')}${Math.round(shadeB).toString(16).padStart(2, '0')}`;
  });

  return { tints, shades };
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
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className="relative cursor-pointer group"
      onClick={handleClick}
    >
      <div
        className="rounded-md transition-all duration-200 group-hover:ring-2 ring-primary/20"
        style={{ backgroundColor: hex, height: onClick ? '8rem' : '1.5rem' }}
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

function ColorChip({ color, onEdit, onDelete }: {
  color: ColorData;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { tints, shades } = generateTintsAndShades(color.hex);
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState({
    name: color.name,
    hex: color.hex,
  });

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
                Are you sure you want to delete this color? This action cannot be undone.
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

      {/* Color content */}
      <div className="p-4">
        {isEditing ? (
          <form onSubmit={handleQuickEdit} className="space-y-2">
            <Input
              value={editValue.name}
              onChange={(e) => setEditValue(prev => ({ ...prev, name: e.target.value }))}
              className="font-medium"
              autoFocus
            />
            <Input
              value={editValue.hex}
              onChange={(e) => setEditValue(prev => ({ ...prev, hex: e.target.value }))}
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
            <ColorBlock
              hex={color.hex}
              onClick={() => handleCopy(color.hex)}
            />
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

function ColorSection({ title, colors = [], onAddColor, deleteColor, onEditColor }: {
  title: string;
  colors: ColorData[];
  onAddColor: () => void;
  deleteColor: (colorId: number) => void;
  onEditColor: (color: ColorData) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Button variant="outline" size="icon" onClick={onAddColor}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {colors.length > 0 ? (
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <div className="flex w-max space-x-4 p-4">
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
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground p-8 text-center">
          <p className="text-muted-foreground">No colors added yet</p>
        </div>
      )}
    </div>
  );
}

export function ColorManager({ clientId, colors }: ColorManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'brand' | 'neutral' | 'interactive'>('brand');
  const [editingColor, setEditingColor] = useState<ColorData | null>(null);

  const form = useForm<ColorFormData>({
    resolver: zodResolver(colorFormSchema),
    defaultValues: {
      name: '',
      hex: '#000000',
      type: 'solid',
    },
  });

  const createColor = useMutation({
    mutationFn: async (data: ColorFormData) => {
      const payload = {
        name: data.name,
        category: 'color',
        clientId,
        data: {
          type: data.type,
          category: selectedCategory,
          colors: [{
            hex: data.hex,
            rgb: data.rgb,
            cmyk: data.cmyk,
            pantone: data.pantone,
          }],
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

      const response = await fetch(`/api/clients/${clientId}/assets${editingColor?.id ? `/${editingColor.id}` : ''}`, {
        method: editingColor ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save color");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`]
      });
      toast({
        title: "Success",
        description: editingColor ? "Color updated successfully" : "Color added successfully",
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

  const parseColorAsset = (asset: BrandAsset): ColorData | null => {
    try {
      const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
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
      console.error('Error parsing color asset:', error);
      return null;
    }
  };

  const transformedColors = colors
    .filter(asset => asset.category === 'color')
    .map(parseColorAsset)
    .filter((color): color is ColorData => color !== null);

  const brandColors = transformedColors.filter(c => c.category === 'brand');
  const neutralColors = transformedColors.filter(c => c.category === 'neutral');
  const interactiveColors = transformedColors.filter(c => c.category === 'interactive');

  const handleEditColor = (color: ColorData) => {
    setEditingColor(color);
    setSelectedCategory(color.category);
    form.reset({
      name: color.name,
      hex: color.hex,
      rgb: color.rgb,
      cmyk: color.cmyk,
      pantone: color.pantone,
      type: 'solid',
    });
    setIsAddingColor(true);
  };

  const handleHexChange = (hex: string) => {
    if (hex.match(/^#[0-9A-F]{6}$/i)) {
      // Auto-generate name if not set
      if (!form.getValues('name')) {
        form.setValue('name', `Color ${hex.toUpperCase()}`);
      }

      // Auto-calculate other color formats
      const rgb = hexToRgb(hex);
      const cmyk = hexToCmyk(hex);

      if (rgb) form.setValue('rgb', rgb);
      if (cmyk) form.setValue('cmyk', cmyk);
      if (!form.getValues('pantone')) {
        form.setValue('pantone', ''); // Clear pantone as it can't be auto-calculated
      }
    }
  };

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
            setSelectedCategory('brand');
            setEditingColor(null);
            form.reset();
            setIsAddingColor(true);
          }}
          deleteColor={deleteColor.mutate}
          onEditColor={handleEditColor}
        />

        <ColorSection
          title="Neutral Colors"
          colors={neutralColors}
          onAddColor={() => {
            setSelectedCategory('neutral');
            setEditingColor(null);
            form.reset();
            setIsAddingColor(true);
          }}
          deleteColor={deleteColor.mutate}
          onEditColor={handleEditColor}
        />

        <ColorSection
          title="Interactive Colors"
          colors={interactiveColors}
          onAddColor={() => {
            setSelectedCategory('interactive');
            setEditingColor(null);
            form.reset();
            setIsAddingColor(true);
          }}
          deleteColor={deleteColor.mutate}
          onEditColor={handleEditColor}
        />
      </div>

      <Dialog open={isAddingColor} onOpenChange={setIsAddingColor}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingColor ? 'Edit Color' : 'Add New Color'}</DialogTitle>
            <DialogDescription>
              {editingColor
                ? 'Edit the color details below.'
                : 'Add a new color to your brand system. You can specify various color formats and create gradients.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createColor.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
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
                <Button
                  type="submit"
                  disabled={createColor.isPending}
                >
                  {createColor.isPending ? "Saving..." : editingColor ? "Save Changes" : "Add Color"}
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
}

interface ColorData {
  id?: number;
  hex: string;
  rgb?: string;
  hsl?: string;
  cmyk?: string;
  pantone?: string;
  name: string;
  category: 'brand' | 'neutral' | 'interactive';
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