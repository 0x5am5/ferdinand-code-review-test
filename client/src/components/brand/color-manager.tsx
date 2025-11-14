import type { BrandAsset } from "@shared/schema";
import { UserRole } from "@shared/schema";
import { Palette, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ColorData type is now imported from @/lib/color-utils

type GradientData = {
  type: "linear" | "radial";
  stops: { color: string; position: number }[];
};

type TintShadeData = {
  percentage: number;
  hex: string;
};

type ColorAssetData = {
  type: "solid" | "gradient";
  category: "brand" | "neutral" | "interactive";
  colors: ColorData[];
  gradient?: GradientData;
  tints?: TintShadeData[];
  shades?: TintShadeData[];
};

type ColorBrandAsset = BrandAsset & {
  data: ColorAssetData;
};

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  type ColorData,
  extractBrandColorProperties,
  generateInteractiveColors,
  generateTintsAndShades,
  hexToCmyk,
  hexToRgb,
  hslToHex,
} from "@/lib/color-utils";
import { ColorCard } from "../color-manager/color-card";
import { AssetSection } from "./logo-manager/asset-section";

// Color category descriptions
const colorDescriptions = {
  brand:
    "Primary colors that define the brand identity and should be used consistently across all materials.",
  neutral:
    "Supporting colors for backgrounds, text, and UI elements that provide balance to the color system.",
  interactive:
    "Colors used for buttons, links, and interactive elements to guide user actions.",
};

// Color conversion utilities are now imported from @/lib/color-utils

export function ColorManager({ clientId, colors }: ColorManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    "brand" | "neutral" | "interactive"
  >("brand");
  const [editingColor, setEditingColor] = useState<ColorBrandAsset | null>(
    null
  );
  const [regenerationCount, setRegenerationCount] = useState(0);
  // We don't need an extra state since colors are derived from props

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
          category: data.category || selectedCategory,
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
        `/api/clients/${clientId}/brand-assets${editingColor?.id ? `/${editingColor.id}` : ""}`,
        {
          method: editingColor ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save color");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
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
        `/api/clients/${clientId}/brand-assets/${colorId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete color");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
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

  const updateColor = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      category: string;
      data: ColorAssetData;
    }) => {
      const response = await fetch(
        `/api/clients/${clientId}/brand-assets/${data.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: data.name,
            category: data.category,
            data: data.data,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update color");
      }

      return await response.json();
    },
    onMutate: async (newData) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });

      // Snapshot the previous value
      const previousAssets = queryClient.getQueryData([
        `/api/clients/${clientId}/brand-assets`,
      ]);

      // Optimistically update the cache
      queryClient.setQueryData(
        [`/api/clients/${clientId}/brand-assets`],
        (old: BrandAsset[] | undefined) => {
          if (!old) return old;

          return old.map((asset: BrandAsset) => {
            if (asset.id === newData.id) {
              return {
                ...asset,
                name: newData.name,
                data: newData.data,
              };
            }
            return asset;
          });
        }
      );

      // Return a context object with the snapshotted value
      return { previousAssets };
    },
    onError: (err, _newData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(
        [`/api/clients/${clientId}/brand-assets`],
        context?.previousAssets
      );

      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });
    },
  });

  const handleUpdateColor = (
    colorId: number,
    updates: { hex: string; rgb?: string; hsl?: string; cmyk?: string }
  ) => {
    const currentColor = colors.find((c) => c.id === colorId);
    if (currentColor) {
      // Parse the current data to get the category and preserve other properties
      const currentData =
        typeof currentColor.data === "string"
          ? JSON.parse(currentColor.data)
          : currentColor.data;

      updateColor.mutate({
        id: colorId,
        name: currentColor.name,
        category: "color",
        data: {
          type: "solid",
          category: currentData.category || "brand", // Preserve the color category (brand/neutral/interactive)
          colors: [
            {
              hex: updates.hex,
              rgb: updates.rgb || "",
              hsl: updates.hsl || "",
              cmyk: updates.cmyk || "",
            },
          ],
          // Preserve tints and shades if they exist
          ...(currentData.tints && { tints: currentData.tints }),
          ...(currentData.shades && { shades: currentData.shades }),
        },
      });
    }
  };

  const parseColorAsset = (asset: BrandAsset): ColorBrandAsset | null => {
    try {
      const data =
        typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
      if (!data?.colors?.[0]) return null;

      return {
        ...asset,
        data: data,
      } as ColorBrandAsset;
    } catch (error: unknown) {
      console.error(
        "Error parsing color asset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return null;
    }
  };

  const transformedColors = colors
    .filter((asset) => asset.category === "color")
    .map(parseColorAsset)
    .filter((color): color is ColorBrandAsset => color !== null);

  const brandColorsData = transformedColors.filter(
    (c) => c.data.category === "brand"
  );

  // Sort neutral colors: manual (base grey) first, then generated shades from light to dark (Grey 11 to Grey 1)
  const neutralColorsData = transformedColors
    .filter((c) => c.data.category === "neutral")
    .sort((a, b) => {
      // Check if colors are generated grey shades (names like "Grey 1", "Grey 2", etc.)
      const isAGeneratedGrey = /^Grey \d+$/.test(a.name);
      const isBGeneratedGrey = /^Grey \d+$/.test(b.name);

      // Special handling for "Base grey" - always comes first
      if (a.name === "Base grey") return -1;
      if (b.name === "Base grey") return 1;

      // If one is generated and one isn't, manual colors come first
      if (isAGeneratedGrey && !isBGeneratedGrey) return 1;
      if (!isAGeneratedGrey && isBGeneratedGrey) return -1;

      // If both are generated greys, sort by number (Grey 11 first, Grey 1 last)
      if (isAGeneratedGrey && isBGeneratedGrey) {
        const numA = parseInt(a.name.match(/^Grey (\d+)$/)?.[1] || "0", 10);
        const numB = parseInt(b.name.match(/^Grey (\d+)$/)?.[1] || "0", 10);
        return numB - numA; // Higher numbers first (Grey 11, 10, 9... 2, 1)
      }

      // If both are manual, keep original order
      return 0;
    });

  const interactiveColorsData = transformedColors.filter(
    (c) => c.data.category === "interactive"
  );

  const handleEditColor = (color: ColorBrandAsset) => {
    setEditingColor(color);
    setSelectedCategory(color.data.category);
    form.reset({
      name: color.name,
      hex: color.data.colors[0]?.hex || "#000000",
      rgb: color.data.colors[0]?.rgb || "",
      cmyk: color.data.colors[0]?.cmyk || "",
      pantone: color.data.colors[0]?.pantone || "",
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

  const handleGenerateInteractiveColors = () => {
    // Convert ColorBrandAsset to ColorData for the utility function
    const brandColorsForGeneration = brandColorsData.map((asset) => ({
      hex: asset.data.colors[0]?.hex || "#000000",
      rgb: asset.data.colors[0]?.rgb,
      hsl: asset.data.colors[0]?.hsl,
      cmyk: asset.data.colors[0]?.cmyk,
      pantone: asset.data.colors[0]?.pantone,
    }));

    // Generate the four interactive colors based on brand colors
    const interactiveColors = generateInteractiveColors(
      brandColorsForGeneration
    );

    // Create each color using the existing createColor mutation
    interactiveColors.forEach((colorData) => {
      const payload = {
        name: colorData.name,
        hex: colorData.hex,
        type: "solid" as const,
        category: "interactive",
      };
      createColor.mutate(payload);
    });
  };

  const handleGenerateGreyShades = () => {
    // First, update any manually added neutral colors to "Base grey" if they don't have that name
    const manualColors = neutralColorsData.filter(
      (color) => !/^Grey \d+$/.test(color.name)
    );
    manualColors.forEach((color) => {
      if (color.name !== "Base grey" && color.id) {
        // Update the existing color to "Base grey"
        fetch(`/api/clients/${clientId}/brand-assets/${color.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Base grey",
            category: "color",
            clientId,
            data: {
              type: "solid",
              category: "neutral",
              colors: [
                {
                  hex: color.data.colors[0]?.hex || "#000000",
                  rgb: color.data.colors[0]?.rgb,
                  cmyk: color.data.colors[0]?.cmyk,
                  pantone: color.data.colors[0]?.pantone,
                },
              ],
              tints: generateTintsAndShades(
                color.data.colors[0]?.hex || "#000000"
              ).tints.map((hex, i) => ({
                percentage: [60, 40, 20][i],
                hex,
              })),
              shades: generateTintsAndShades(
                color.data.colors[0]?.hex || "#000000"
              ).shades.map((hex, i) => ({
                percentage: [20, 40, 60][i],
                hex,
              })),
            },
          }),
        }).then(() => {
          queryClient.invalidateQueries({
            queryKey: [`/api/clients/${clientId}/brand-assets`],
          });
        });
      }
    });

    // Increment regeneration counter for variation
    setRegenerationCount((prev) => prev + 1);

    // Find the base grey color to use as reference
    const baseGreyColor = neutralColorsData.find(
      (color) => !/^Grey \d+$/.test(color.name)
    );
    const baseGreyHex = baseGreyColor?.data.colors[0]?.hex || null;

    // Convert ColorBrandAsset to ColorData for the utility function
    const brandColorsForExtraction = brandColorsData.map((asset) => ({
      hex: asset.data.colors[0]?.hex || "#000000",
      rgb: asset.data.colors[0]?.rgb,
      hsl: asset.data.colors[0]?.hsl,
      cmyk: asset.data.colors[0]?.cmyk,
      pantone: asset.data.colors[0]?.pantone,
    }));

    // Extract hue and base saturation from base grey or brand colors with variation
    const { hue, maxSaturation, lightnessShift } = extractBrandColorProperties(
      brandColorsForExtraction,
      baseGreyHex,
      regenerationCount
    );

    // Generate all 11 shades using new parabolic algorithm
    const allShades = [];
    for (let level = 1; level <= 11; level++) {
      // Generate lightness values with midpoint shifted to Grey 5 for more lighter shades
      let baseLightness: number;
      if (level <= 5) {
        // Greys 1-5: 8% to 50% (compressed dark range)
        baseLightness = 8 + ((level - 1) / 4) * 42; // 8% to 50%
      } else {
        // Greys 6-11: 50% to 98% (expanded light range)
        baseLightness = 50 + ((level - 5) / 6) * 48; // 50% to 98%
      }
      const lightness = Math.max(
        8,
        Math.min(98, baseLightness + lightnessShift)
      ); // Apply variation with bounds

      // Apply parabolic formula: saturation = maxSaturation × (1 - 4 × (lightness - 0.5)²)
      const normalizedLightness = lightness / 100; // Convert to 0-1 range
      const saturation =
        maxSaturation * (1 - 4 * (normalizedLightness - 0.5) ** 2);

      // Convert HSL to hex
      const hex = hslToHex(hue, saturation * 100, lightness);
      allShades.push({ level, hex });
    }

    // Check which shades already exist and only create missing ones
    const existingGeneratedShades = neutralColorsData
      .filter((color) => /^Grey \d+$/.test(color.name))
      .map((color) => {
        const match = color.name.match(/^Grey (\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      });

    const missingShades = allShades.filter(
      (shade) => !existingGeneratedShades.includes(shade.level)
    );

    // Create missing shades
    missingShades.forEach((shade) => {
      const payload = {
        name: `Grey ${shade.level}`,
        hex: shade.hex,
        type: "solid" as const,
        category: "neutral",
      };
      createColor.mutate(payload);
    });
  };

  const handleAddBrandColor = (name?: string, hex?: string) => {
    // If name and hex are provided, it's for editing a specific color.
    // If not, it's for adding a new color.
    if (name && hex) {
      // This part is related to editing existing colors, which is handled by `handleEditColor`
      // The logic here might need refinement depending on how "Add Brand Color" is used in the UI.
      // For now, assuming this function is primarily for adding new colors or triggering the creation mutation.
    } else {
      // This branch is likely for adding a new brand color, potentially from a default or placeholder.
      // The `createColor.mutate` call below handles the actual creation.
    }

    // This part of the logic seems incomplete or redundant if the UI handles
    // the `isAddingColor` state and form reset correctly.
    // If `handleAddBrandColor` is meant to directly trigger the creation of a default color,
    // that mutation should be called here.
    // For now, assuming the UI handles the addition flow.
  };

  if (!user) return null;

  const canEditColors =
    user.role === UserRole.SUPER_ADMIN ||
    user.role === UserRole.EDITOR ||
    user.role === UserRole.ADMIN;
  const isGuest =
    user.role === UserRole.GUEST || user.role === UserRole.STANDARD;

  return (
    <div>
      {" "}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Color System</h1>
          <p className="text-muted-foreground mt-1">
            Manage and use the official color palette for this brand
          </p>
        </div>
      </div>
      <div className="space-y-8">
        {/* Hide empty brand colors section for guest users */}
        {!(isGuest && brandColorsData.length === 0) && (
          <AssetSection
            title="Brand Colors"
            description={colorDescriptions.brand}
            isEmpty={brandColorsData.length === 0}
            sectionType="brand-colors"
            uploadComponent={
              <div className="flex flex-col gap-2 w-full">
                <Button
                  onClick={() => handleAddBrandColor()}
                  variant="outline"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                >
                  <Palette className="h-8 w-8 text-muted-foreground/70" />
                  <span className="text-sm font-medium text-muted-foreground/70">
                    Generate Brand Colors
                  </span>
                </Button>

                <Button
                  onClick={() => {
                    setSelectedCategory("brand");
                    setEditingColor(null);
                    form.reset();
                    setIsAddingColor(true);
                  }}
                  variant="outline"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                >
                  <Plus className="h-8 w-8 text-muted-foreground/70" />
                  <span className="text-sm font-medium text-muted-foreground/70">
                    Add Color
                  </span>
                </Button>
              </div>
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
                    clientId={clientId}
                  />
                ))}

                {canEditColors && (
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => {
                        setSelectedCategory("brand");
                        setEditingColor(null);
                        form.reset();
                        setIsAddingColor(true);
                      }}
                      variant="outline"
                      className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                    >
                      <Plus className="h-8 w-8 text-muted-foreground/70" />
                      <span className="text-sm font-medium text-muted-foreground/70">
                        Add Color
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </AssetSection>
        )}

        {/* Hide empty neutral colors section for guest users */}
        {!(isGuest && neutralColorsData.length === 0) && (
          <AssetSection
            title="Neutral Colors"
            description={colorDescriptions.neutral}
            isEmpty={neutralColorsData.length === 0}
            sectionType="neutral-colors"
            uploadComponent={
              <div className="space-y-4 w-full">
                <Button
                  onClick={handleGenerateGreyShades}
                  variant="outline"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                  disabled={createColor.isPending}
                >
                  <Palette className="h-8 w-8 text-muted-foreground/70" />
                  <span className="text-sm font-medium text-muted-foreground/70">
                    {createColor.isPending
                      ? "Generating..."
                      : "Generate Neutral Colors"}
                  </span>
                </Button>
                <Button
                  onClick={() => {
                    setSelectedCategory("neutral");
                    setEditingColor(null);
                    form.reset();
                    setIsAddingColor(true);
                  }}
                  variant="outline"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                >
                  <Plus className="h-8 w-8 text-muted-foreground/70" />
                  <span className="text-sm font-medium text-muted-foreground/70">
                    Add Color
                  </span>
                </Button>
              </div>
            }
            emptyPlaceholder={
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Palette className="h-8 w-8" />
                </div>
                <p>No neutral colors yet</p>
                <p className="text-sm">
                  Contact an admin to add neutral colors
                </p>
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
                    onGenerate={handleGenerateGreyShades}
                    neutralColorsCount={neutralColorsData.length}
                    onUpdate={handleUpdateColor}
                    clientId={clientId}
                  />
                ))}

                {/* Only show Add New Color button if there are fewer than 11 neutral colors and user can edit */}
                {canEditColors && neutralColorsData.length < 11 && (
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
                      <span className="text-muted-foreground/50">
                        Add New Color
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </AssetSection>
        )}

        {/* Hide empty interactive colors section for guest users */}
        {!(isGuest && interactiveColorsData.length === 0) && (
          <AssetSection
            title="Interactive Colors"
            description={colorDescriptions.interactive}
            isEmpty={interactiveColorsData.length === 0}
            sectionType="interactive-colors"
            uploadComponent={
              <div className="space-y-4 w-full">
                <Button
                  onClick={handleGenerateInteractiveColors}
                  variant="outline"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                  disabled={createColor.isPending}
                >
                  <Palette className="h-8 w-8 text-muted-foreground/70" />
                  <span className="text-sm font-medium text-muted-foreground/70">
                    {createColor.isPending
                      ? "Generating..."
                      : "Generate Interactive Colors"}
                  </span>
                </Button>
                <Button
                  onClick={() => {
                    setSelectedCategory("interactive");
                    setEditingColor(null);
                    form.reset();
                    setIsAddingColor(true);
                  }}
                  variant="outline"
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                >
                  <Plus className="h-8 w-8 text-muted-foreground/70" />
                  <span className="text-sm font-medium text-muted-foreground/70">
                    Add Color
                  </span>
                </Button>
              </div>
            }
            emptyPlaceholder={
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Palette className="h-8 w-8" />
                </div>
                <p>No interactive colors yet</p>
                <p className="text-sm">
                  Contact an admin to add interactive colors
                </p>
              </div>
            }
          >
            <div className="asset-display">
              <div className="asset-display__info">
                {colorDescriptions.interactive}
              </div>
              <div className="asset-display__preview">
                {interactiveColorsData.map((color) => (
                  <ColorCard
                    key={color.id}
                    color={color}
                    onEdit={handleEditColor}
                    onDelete={deleteColor.mutate}
                    onUpdate={handleUpdateColor}
                    clientId={clientId}
                  />
                ))}
              </div>
            </div>
          </AssetSection>
        )}
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
  updateDraftDesignSystem?: (colors: BrandAsset[]) => void; // Made optional
  addToHistory?: (designSystem: BrandAsset[]) => void; // Made optional
  designSystem?: BrandAsset[]; // Made optional
}

// ColorData interface already defined at top of file
const colorFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  hex: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color code"),
  rgb: z.string().optional(),
  cmyk: z.string().optional(),
  pantone: z.string().optional(),
  type: z.enum(["solid", "gradient"]),
  category: z.string().optional(),
});

type ColorFormData = z.infer<typeof colorFormSchema>;
