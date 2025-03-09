import { Plus, Edit2, Trash2, Download, Upload } from "lucide-react";
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
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
  category: typeof ColorCategory[keyof typeof ColorCategory];
}

// Form validation schema
const colorFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  hex: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color code"),
  rgb: z.string().optional(),
  cmyk: z.string().optional(),
  pantone: z.string().optional(),
  type: z.enum(["solid", "gradient"]),
});

type ColorFormData = z.infer<typeof colorFormSchema>;

// Default colors from the inspiration image
const DEFAULT_COLORS = {
  brand: [
    { hex: '#FF983B', name: 'Neon Carrot' },
    { hex: '#AA3A39', name: 'Medium Carmine' },
    { hex: '#FE4E4E', name: 'Sunset Orange' },
  ],
  neutral: Array.from({ length: 11 }, (_, i) => ({
    hex: `#${Math.floor((i * 255) / 10).toString(16).padStart(2, '0').repeat(3)}`,
    name: `Gray ${i * 10}`,
  })),
  interactive: [
    { hex: '#EE5397', name: 'Brilliant Rose' },
    { hex: '#634490', name: 'Affair' },
    { hex: '#3466A5', name: 'Azure' },
    { hex: '#00C4D4', name: "Robin's Egg Blue" },
  ],
};

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

function ColorSection({ title, colors = [], onAddColor, deleteColor }: {
  title: string;
  colors: ColorData[];
  onAddColor: () => void;
  deleteColor: (colorId: number) => void;
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
          {colors.map((color) => (
            <ColorChip
              key={`${color.hex}-${color.id || Math.random()}`}
              color={color}
              onEdit={() => {/* Edit will be implemented in next iteration */}}
              onDelete={() => color.id && deleteColor(color.id)}
            />
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
      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'color',
          name: data.name,
          data: {
            type: data.type,
            category: selectedCategory,
            colors: [{
              hex: data.hex,
              rgb: data.rgb,
              cmyk: data.cmyk,
              pantone: data.pantone,
            }],
          },
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

  // Parse the color assets into ColorData format
  const parseColorAsset = (asset: BrandAsset): ColorData | null => {
    try {
      const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
      if (!data?.colors?.[0]) {
        console.warn('Invalid color data structure:', data);
        return null;
      }

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
      console.error('Error parsing color asset:', error, asset);
      return null;
    }
  };

  // Filter and transform color assets
  const transformedColors = colors
    .filter(asset => asset.category === 'color')
    .map(parseColorAsset)
    .filter((color): color is ColorData => color !== null);

  console.log('Transformed colors:', transformedColors);

  // If no colors are provided, use the default colors
  const brandColors = transformedColors.length
    ? transformedColors.filter(c => c.category === 'brand')
    : DEFAULT_COLORS.brand.map(c => ({ ...c, category: 'brand' }));

  const neutralColors = transformedColors.length
    ? transformedColors.filter(c => c.category === 'neutral')
    : DEFAULT_COLORS.neutral.map(c => ({ ...c, category: 'neutral' }));

  const interactiveColors = transformedColors.length
    ? transformedColors.filter(c => c.category === 'interactive')
    : DEFAULT_COLORS.interactive.map(c => ({ ...c, category: 'interactive' }));

  const onSubmit = (data: ColorFormData) => {
    createColor.mutate({
      name: data.name,
      hex: data.hex,
      rgb: data.rgb,
      cmyk: data.cmyk,
      pantone: data.pantone,
      type: data.type
    });
  };

  // Auto-generate name from hex color
  const handleHexChange = (hex: string) => {
    if (!form.getValues('name') && hex.match(/^#[0-9A-F]{6}$/i)) {
      form.setValue('name', `Color ${hex.toUpperCase()}`);
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
            setIsAddingColor(true);
          }}
          deleteColor={deleteColor.mutate}
        />

        <ColorSection
          title="Neutral Colors"
          colors={neutralColors}
          onAddColor={() => {
            setSelectedCategory('neutral');
            setIsAddingColor(true);
          }}
          deleteColor={deleteColor.mutate}
        />

        <ColorSection
          title="Interactive Colors"
          colors={interactiveColors}
          onAddColor={() => {
            setSelectedCategory('interactive');
            setIsAddingColor(true);
          }}
          deleteColor={deleteColor.mutate}
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createColor.isPending}
                >
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