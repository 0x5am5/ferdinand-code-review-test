import type {
  BrandAsset,
  IndividualBodyStyle,
  IndividualHeaderStyle,
  TypeScale,
  TypeStyle,
} from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TypeScalePreview } from "./type-scale-preview";

type BrandColor = {
  id: string;
  name: string;
  value: string;
  role?: string | null;
  displayName: string;
  category: string;
  type: string;
  percentage?: number;
};

type ProcessedFont = {
  id: number;
  name: string;
  fontFamily: string;
  source: string;
  weights: string[];
  styles: string[];
};

type FontWeight = {
  value: string;
  label: string;
};

interface TypeScaleManagerProps {
  clientId: number;
}

// Default type scale values
const DEFAULT_TYPE_SCALE = {
  name: "Brand Type Scale",
  unit: "px" as const,
  baseSize: 16,
  scaleRatio: 1250, // 1.25 * 1000
  bodyFontFamily: "",
  bodyFontWeight: "400",
  bodyLetterSpacing: 0,
  bodyColor: "#000000",
  headerFontFamily: "",
  headerFontWeight: "700",
  headerLetterSpacing: 0,
  headerColor: "#000000",
  responsiveSizes: {
    mobile: { baseSize: 14, scaleRatio: 1.125 },
    tablet: { baseSize: 15, scaleRatio: 1.2 },
    desktop: { baseSize: 16, scaleRatio: 1.25 },
  },
  typeStyles: [
    {
      level: "h1",
      name: "Heading 1",
      size: 4,
      fontWeight: "700",
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h2",
      name: "Heading 2",
      size: 3,
      fontWeight: "600",
      lineHeight: 1.3,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h3",
      name: "Heading 3",
      size: 2,
      fontWeight: "600",
      lineHeight: 1.4,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h4",
      name: "Heading 4",
      size: 1,
      fontWeight: "500",
      lineHeight: 1.4,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h5",
      name: "Heading 5",
      size: 0,
      fontWeight: "500",
      lineHeight: 1.5,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h6",
      name: "Heading 6",
      size: 0,
      fontWeight: "500",
      lineHeight: 1.5,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "body-large",
      name: "Body Large",
      size: 0.5,
      fontWeight: "400",
      lineHeight: 1.6,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "body",
      name: "Body Text",
      size: 0,
      fontWeight: "400",
      lineHeight: 1.6,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "body-small",
      name: "Body Small",
      size: -0.5,
      fontWeight: "400",
      lineHeight: 1.5,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "caption",
      name: "Caption",
      size: -1,
      fontWeight: "400",
      lineHeight: 1.4,
      letterSpacing: 0,
      color: "#666666",
    },
    {
      level: "quote",
      name: "Quote",
      size: 1,
      fontWeight: "400",
      lineHeight: 1.6,
      letterSpacing: 0,
      color: "#000000",
      fontStyle: "italic",
    },
    {
      level: "code",
      name: "Code",
      size: -0.5,
      fontWeight: "400",
      lineHeight: 1.4,
      letterSpacing: 0,
      color: "#000000",
    },
  ],
};

export function TypeScaleManager({ clientId }: TypeScaleManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentScale, setCurrentScale] = useState<TypeScale | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { data: typeScales = [], isLoading } = useQuery({
    queryKey: ["/api/clients", clientId, "type-scales"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/type-scales`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch type scales");
      return response.json();
    },
  });

  // Fetch brand fonts for this client from brand assets
  const { data: brandAssets = [] } = useQuery({
    queryKey: ["/api/clients", clientId, "assets"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/assets`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Extract and parse font assets
  const brandFonts = (brandAssets as BrandAsset[])
    .filter((asset: BrandAsset) => asset.category === "font")
    .map((asset: BrandAsset) => {
      try {
        const fontData =
          typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
        return {
          id: asset.id,
          name: asset.name,
          fontFamily: fontData.sourceData?.fontFamily || asset.name,
          source: fontData.source || "google",
          weights: fontData.weights || ["400"],
          styles: fontData.styles || ["normal"],
        };
      } catch (error: unknown) {
        console.error(
          "Error parsing font asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return null;
      }
    })
    .filter((font): font is ProcessedFont => font !== null);

  // Extract and parse color assets - each asset contains multiple color variations
  const brandColors = (brandAssets as BrandAsset[])
    .filter((asset: BrandAsset) => asset.category === "color")
    .flatMap((asset: BrandAsset) => {
      try {
        const colorData =
          typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
        const colors: {
          id: string;
          name: string;
          value: string;
          role?: string | null;
          displayName: string;
          category: string;
          type: string;
          percentage?: number;
        }[] = [];

        // Add tints (lighter variations)
        if (colorData.tints && Array.isArray(colorData.tints)) {
          colorData.tints.forEach(
            (tint: { percentage: number; hex: string }, index: number) => {
              colors.push({
                id: `${asset.id}-tint-${index}`,
                name: asset.name,
                value: tint.hex,
                role: colorData.role || null,
                displayName: `${asset.name} Tint ${tint.percentage}%`,
                category: colorData.category || "color",
                type: "tint",
                percentage: tint.percentage,
              });
            }
          );
        }

        // Add main colors
        if (colorData.colors && Array.isArray(colorData.colors)) {
          colorData.colors.forEach(
            (
              color: {
                hex: string;
                rgb?: string;
                hsl?: string;
                cmyk?: string;
                pantone?: string;
              },
              index: number
            ) => {
              colors.push({
                id: `${asset.id}-main-${index}`,
                name: asset.name,
                value: color.hex,
                role: colorData.role || null,
                displayName: asset.name,
                category: colorData.category || "color",
                type: "main",
              });
            }
          );
        }

        // Add shades (darker variations)
        if (colorData.shades && Array.isArray(colorData.shades)) {
          colorData.shades.forEach(
            (shade: { percentage: number; hex: string }, index: number) => {
              colors.push({
                id: `${asset.id}-shade-${index}`,
                name: asset.name,
                value: shade.hex,
                role: colorData.role || null,
                displayName: `${asset.name} Shade ${shade.percentage}%`,
                category: colorData.category || "color",
                type: "shade",
                percentage: shade.percentage,
              });
            }
          );
        }

        return colors;
      } catch (error: unknown) {
        console.error(
          "Error parsing color asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return [];
      }
    })
    .filter(Boolean);

  // Color selector dropdown component for brand colors
  const ColorSelector = ({
    value,
    onChange,
    id,
    placeholder = "Select a color or enter hex",
  }: {
    value: string;
    onChange: (color: string) => void;
    id: string;
    placeholder?: string;
  }) => {
    const [open, setOpen] = useState(false);
    const [customHex, setCustomHex] = useState(value);

    // Sync state when value prop changes
    useEffect(() => {
      setCustomHex(value);
    }, [value]);

    const handleColorChange = (selectedColor: string) => {
      onChange(selectedColor);
      setCustomHex(selectedColor);
      setOpen(false);
    };

    const handleHexChange = (hex: string) => {
      setCustomHex(hex);
      onChange(hex);
    };

    // Find the selected brand color for display
    const selectedBrandColor = brandColors.find(
      (color: BrandColor) => color.value === value
    );

    return (
      <div className="space-y-3">
        {brandColors.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Brand Colors
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between h-10 px-3"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-gray-300"
                      style={{ backgroundColor: value }}
                    />
                    <span className="text-sm">
                      {selectedBrandColor
                        ? selectedBrandColor.displayName
                        : value}
                    </span>
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search colors..." />
                  <CommandList>
                    <CommandEmpty>No colors found.</CommandEmpty>
                    {(() => {
                      // Group colors by base name for better organization
                      const groupedColors = brandColors.reduce(
                        (
                          acc: Record<string, BrandColor[]>,
                          color: BrandColor
                        ) => {
                          if (!acc[color.name]) {
                            acc[color.name] = [];
                          }
                          acc[color.name].push(color);
                          return acc;
                        },
                        {}
                      );

                      return Object.entries(groupedColors).map(
                        ([baseName, colors]: [string, BrandColor[]]) => (
                          <CommandGroup key={baseName} heading={baseName}>
                            {(colors as BrandColor[])
                              .sort((a: BrandColor, b: BrandColor) => {
                                // Sort: tints first (high to low %), then main, then shades (low to high %)
                                if (a.type !== b.type) {
                                  const typeOrder = {
                                    tint: 0,
                                    main: 1,
                                    shade: 2,
                                  };
                                  return (
                                    typeOrder[
                                      a.type as keyof typeof typeOrder
                                    ] -
                                    typeOrder[b.type as keyof typeof typeOrder]
                                  );
                                }
                                if (a.type === "tint")
                                  return (
                                    (b.percentage || 0) - (a.percentage || 0)
                                  );
                                if (a.type === "shade")
                                  return (
                                    (a.percentage || 0) - (b.percentage || 0)
                                  );
                                return 0;
                              })
                              .map((color: BrandColor) => (
                                <CommandItem
                                  key={color.id}
                                  value={`${color.displayName} ${color.value}`}
                                  onSelect={() =>
                                    handleColorChange(color.value)
                                  }
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <div
                                    className="w-5 h-5 rounded border border-gray-300"
                                    style={{ backgroundColor: color.value }}
                                  />
                                  <div className="flex flex-col flex-1">
                                    <span className="text-sm">
                                      {color.displayName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {color.value}
                                      {color.category && ` • ${color.category}`}
                                    </span>
                                  </div>
                                  {value === color.value && (
                                    <Check className="ml-auto h-4 w-4" />
                                  )}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        )
                      );
                    })()}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={id} className="text-xs text-muted-foreground">
            {brandColors.length > 0 ? "Or Custom Color" : "Custom Color"}
          </Label>
          <div className="flex items-center space-x-2">
            <Input
              id={id}
              type="color"
              value={customHex}
              onChange={(e) => handleHexChange(e.target.value)}
              className="w-16 h-8"
            />
            <Input
              type="text"
              value={customHex}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        </div>
      </div>
    );
  };

  // brandFonts is already processed above

  // Get available font weights from brand fonts
  const getAvailableFontWeights = (fontFamily?: string) => {
    if (!fontFamily) {
      return [
        { value: "400", label: "400 - Regular" },
        { value: "500", label: "500 - Medium" },
        { value: "600", label: "600 - Semi Bold" },
        { value: "700", label: "700 - Bold" },
      ];
    }

    const font = brandFonts.find((f) => f.fontFamily === fontFamily);
    if (!font) {
      return [
        { value: "400", label: "400 - Regular" },
        { value: "500", label: "500 - Medium" },
        { value: "600", label: "600 - Semi Bold" },
        { value: "700", label: "700 - Bold" },
      ];
    }

    const weightLabels: Record<string, string> = {
      "100": "100 - Thin",
      "200": "200 - Extra Light",
      "300": "300 - Light",
      "400": "400 - Regular",
      "500": "500 - Medium",
      "600": "600 - Semi Bold",
      "700": "700 - Bold",
      "800": "800 - Extra Bold",
      "900": "900 - Black",
    };

    return font.weights
      .sort((a: string, b: string) => parseInt(a) - parseInt(b))
      .map((weight: string) => ({
        value: weight,
        label: weightLabels[weight] || `${weight}`,
      }));
  };

  // Initialize with existing scale or create new one
  const defaultFontFamily =
    brandFonts.length === 1 ? brandFonts[0].fontFamily : undefined;
  const activeScale =
    currentScale ||
    (typeScales.length > 0
      ? typeScales[0]
      : {
          ...DEFAULT_TYPE_SCALE,
          id: undefined,
          clientId,
          baseSize: 16, // Ensure base size is in pixels, not rem
          bodyFontFamily:
            defaultFontFamily || DEFAULT_TYPE_SCALE.bodyFontFamily,
          headerFontFamily:
            defaultFontFamily || DEFAULT_TYPE_SCALE.headerFontFamily,
          individualHeaderStyles: {},
          individualBodyStyles: {},
        });

  // Initialize currentScale if it's null and we have a scale to load
  useEffect(() => {
    if (!currentScale && typeScales.length > 0) {
      setCurrentScale(typeScales[0]);
    }
  }, [typeScales, currentScale]);

  // Initialize state after activeScale is defined
  const [activeHeaderCustomizations, setActiveHeaderCustomizations] = useState<
    Set<string>
  >(new Set());

  const [activeBodyCustomizations, setActiveBodyCustomizations] = useState<
    Set<string>
  >(new Set());

  // Update active customizations when currentScale changes (only when it actually changes)
  useEffect(() => {
    if (currentScale?.individualHeaderStyles) {
      setActiveHeaderCustomizations(
        new Set(Object.keys(currentScale.individualHeaderStyles))
      );
    } else {
      setActiveHeaderCustomizations(new Set());
    }
    if (currentScale?.individualBodyStyles) {
      setActiveBodyCustomizations(
        new Set(Object.keys(currentScale.individualBodyStyles))
      );
    } else {
      setActiveBodyCustomizations(new Set());
    }
  }, [
    currentScale?.id,
    currentScale?.individualHeaderStyles,
    currentScale?.individualBodyStyles,
  ]);

  const saveTypeScaleMutation = useMutation({
    mutationFn: async (data: TypeScale) => {
      const url = data.id
        ? `/api/type-scales/${data.id}`
        : `/api/clients/${clientId}/type-scales`;
      const method = data.id ? "PATCH" : "POST";

      // Transform data to match schema expectations
      const transformedData = {
        ...data,
        // Ensure scaleRatio is stored as integer (ratio * 1000)
        scaleRatio: Math.round(data.scaleRatio || 1250),
        // Ensure customRatio is stored as integer if provided
        customRatio: data.customRatio
          ? Math.round(data.customRatio)
          : undefined,
        // Ensure letter spacing is stored as integer (em * 1000)
        bodyLetterSpacing: Math.round(data.bodyLetterSpacing || 0),
        headerLetterSpacing: Math.round(data.headerLetterSpacing || 0),
        // Ensure all required fields are present
        clientId: data.clientId || clientId,
        name: data.name || "Brand Type Scale",
        unit: data.unit || "px",
        baseSize: data.baseSize || 16,
        bodyFontFamily: data.bodyFontFamily || "",
        bodyFontWeight: data.bodyFontWeight || "400",
        bodyColor: data.bodyColor || "#000000",
        headerFontFamily: data.headerFontFamily || "",
        headerFontWeight: data.headerFontWeight || "700",
        headerColor: data.headerColor || "#000000",
      };

      console.log("Saving type scale with data:", transformedData);
      console.log("Current activeScale state:", activeScale);
      console.log("Current currentScale state:", currentScale);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transformedData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Save error response:", errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(
          `Failed to save type scale: ${errorData.error || errorText}`
        );
      }

      const result = await response.json();
      console.log("Save response:", result);
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Type scale saved",
        description: "Your type scale has been saved successfully.",
      });
      setCurrentScale(data);
      setIsEditing(false);
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", clientId, "type-scales"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message || "Failed to save type scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateScale = (updates: Partial<TypeScale>) => {
    const newScale = currentScale
      ? { ...currentScale, ...updates }
      : { ...activeScale, ...updates };
    console.log("Updating scale with:", updates, "New scale:", newScale);
    setCurrentScale(newScale);
    setIsEditing(true);
  };

  const toggleHeaderCustomization = (headerLevel: string) => {
    const newActiveHeaders = new Set(activeHeaderCustomizations);
    if (newActiveHeaders.has(headerLevel)) {
      newActiveHeaders.delete(headerLevel);
      // Remove the individual styling when deactivating
      const individualStyles = { ...activeScale.individualHeaderStyles };
      delete individualStyles[headerLevel as keyof typeof individualStyles];
      updateScale({ individualHeaderStyles: individualStyles });
    } else {
      newActiveHeaders.add(headerLevel);
    }
    setActiveHeaderCustomizations(newActiveHeaders);
  };

  const toggleBodyCustomization = (bodyLevel: string) => {
    const newActiveCustomizations = new Set(activeBodyCustomizations);
    if (newActiveCustomizations.has(bodyLevel)) {
      newActiveCustomizations.delete(bodyLevel);
      // Remove the style from the scale
      const updatedIndividualStyles = { ...activeScale.individualBodyStyles };
      delete updatedIndividualStyles[bodyLevel];
      updateScale({ individualBodyStyles: updatedIndividualStyles });
    } else {
      newActiveCustomizations.add(bodyLevel);
      // Add default style
      const updatedIndividualStyles = {
        ...activeScale.individualBodyStyles,
        [bodyLevel]: {},
      };
      updateScale({ individualBodyStyles: updatedIndividualStyles });
    }
    setActiveBodyCustomizations(newActiveCustomizations);
  };

  const updateIndividualHeaderStyle = (
    headerLevel: string,
    styleUpdates: Partial<IndividualHeaderStyle>
  ) => {
    const currentIndividualStyles = activeScale.individualHeaderStyles || {};
    const updatedStyles = {
      ...currentIndividualStyles,
      [headerLevel]: {
        ...currentIndividualStyles[
          headerLevel as keyof typeof currentIndividualStyles
        ],
        ...styleUpdates,
      },
    };
    updateScale({ individualHeaderStyles: updatedStyles });
  };

  const resetIndividualHeaderStyle = (
    headerLevel: string,
    property: keyof IndividualHeaderStyle
  ) => {
    const currentIndividualStyles = activeScale.individualHeaderStyles || {};
    const headerStyle =
      currentIndividualStyles[
        headerLevel as keyof typeof currentIndividualStyles
      ];
    if (headerStyle) {
      const updatedHeaderStyle = { ...headerStyle };
      delete updatedHeaderStyle[property];

      const updatedStyles = {
        ...currentIndividualStyles,
        [headerLevel]: updatedHeaderStyle,
      };
      updateScale({ individualHeaderStyles: updatedStyles });
    }
  };

  const updateIndividualBodyStyle = (
    bodyLevel: string,
    styleUpdates: Partial<IndividualBodyStyle>
  ) => {
    const currentIndividualStyles = activeScale.individualBodyStyles || {};
    const updatedStyles = {
      ...currentIndividualStyles,
      [bodyLevel]: {
        ...currentIndividualStyles[
          bodyLevel as keyof typeof currentIndividualStyles
        ],
        ...styleUpdates,
      },
    };

    updateScale({ individualBodyStyles: updatedStyles });
  };

  const resetIndividualBodyStyle = (
    bodyLevel: string,
    property: keyof IndividualBodyStyle
  ) => {
    const currentIndividualStyles = activeScale.individualBodyStyles || {};
    const bodyStyle =
      currentIndividualStyles[
        bodyLevel as keyof typeof currentIndividualStyles
      ];
    if (bodyStyle) {
      const updatedBodyStyle = { ...bodyStyle };
      delete updatedBodyStyle[property];

      const updatedStyles = {
        ...currentIndividualStyles,
        [bodyLevel]: updatedBodyStyle,
      };
      updateScale({ individualBodyStyles: updatedStyles });
    }
  };

  const handleSave = () => {
    const scaleToSave = currentScale || activeScale;
    saveTypeScaleMutation.mutate(scaleToSave);
  };

  const generateCodePreview = (format: "css" | "scss") => {
    const styles = activeScale.typeStyles || DEFAULT_TYPE_SCALE.typeStyles;
    const baseSize = activeScale.baseSize || 16;
    const ratio = (activeScale.scaleRatio || 1250) / 1000;
    const unit = activeScale.unit || "px";

    const calculateSize = (level: number) => {
      return Math.round(baseSize * ratio ** level * 100) / 100;
    };

    if (format === "scss") {
      let scss = `// Type Scale Variables\n`;
      scss += `$base-font-size: ${baseSize}${unit};\n`;
      scss += `$type-scale-ratio: ${ratio};\n\n`;

      styles.forEach((style: TypeStyle) => {
        const size = calculateSize(style.size);
        scss += `$${style.level}-size: ${size}${unit};\n`;
      });

      scss += `\n// Type Scale Mixins\n`;
      styles.forEach((style: TypeStyle) => {
        const size = calculateSize(style.size);
        scss += `@mixin ${style.level} {\n`;
        scss += `  font-size: ${size}${unit};\n`;
        scss += `  font-weight: ${style.fontWeight};\n`;
        scss += `  line-height: ${style.lineHeight};\n`;
        scss += `  letter-spacing: ${style.letterSpacing}em;\n`;
        scss += `  color: ${style.color};\n`;
        scss += `}\n\n`;
      });

      return scss;
    } else {
      let css = `/* Type Scale CSS */\n`;
      css += `:root {\n`;
      css += `  --base-font-size: ${baseSize}${unit};\n`;
      css += `  --type-scale-ratio: ${ratio};\n`;

      styles.forEach((style: TypeStyle) => {
        const size = calculateSize(style.size);
        css += `  --${style.level}-size: ${size}${unit};\n`;
      });
      css += `}\n\n`;

      styles.forEach((style: TypeStyle) => {
        const size = calculateSize(style.size);
        css += `.${style.level} {\n`;
        css += `  font-size: ${size}${unit};\n`;
        css += `  font-weight: ${style.fontWeight};\n`;
        css += `  line-height: ${style.lineHeight};\n`;
        css += `  letter-spacing: ${style.letterSpacing}em;\n`;
        css += `  color: ${style.color};\n`;
        css += `}\n\n`;
      });

      return css;
    }
  };

  if (isLoading) {
    return <div>Loading type scales...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="asset-section__header flex justify-between">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Type Scale</h3>
          </div>
        </div>
        {isEditing && (
          <Button
            onClick={handleSave}
            disabled={saveTypeScaleMutation.isPending}
            className="min-w-[160px] h-10 text-sm font-medium"
          >
            {saveTypeScaleMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                SAVE CHANGES
              </>
            )}
          </Button>
        )}
      </div>

      <div className="asset-display">
        <div className="asset-display__info relative">
          <div className="space-y-6">
            {/* Scale Settings */}
            <div>
              <p className="mb-8">
                Create and manage consistent typography scales for your brand.
              </p>

              <h4 className="text-base font-semibold mb-4">Scale Settings</h4>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scale-name">Scale Name</Label>
                  <Input
                    id="scale-name"
                    value={activeScale.name || "Brand Type Scale"}
                    onChange={(e) => updateScale({ name: e.target.value })}
                    placeholder="Enter scale name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base-size">Base Size</Label>
                    <Input
                      id="base-size"
                      type="number"
                      value={activeScale.baseSize || 16}
                      onChange={(e) =>
                        updateScale({
                          baseSize: parseInt(e.target.value) || 16,
                        })
                      }
                      min="8"
                      max="72"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={activeScale.unit || "px"}
                      onValueChange={(value: "px" | "rem" | "em") =>
                        updateScale({ unit: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="px">px</SelectItem>
                        <SelectItem value="rem">rem</SelectItem>
                        <SelectItem value="em">em</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scale-ratio">
                    Scale Ratio:{" "}
                    {((activeScale.scaleRatio || 1250) / 1000).toFixed(3)}
                  </Label>
                  <Slider
                    value={[activeScale.scaleRatio || 1250]}
                    onValueChange={([value]) =>
                      updateScale({ scaleRatio: value })
                    }
                    min={1000}
                    max={2000}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1.000</span>
                    <span>2.000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Body Type Styles Section */}
            <div>
              <h4 className="font-semibold mb-4">Body Type Styles</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="body-font-family">Font Family</Label>
                  {brandFonts.length === 1 ? (
                    <div className="text-sm p-2 bg-muted rounded">
                      {brandFonts[0].fontFamily}
                    </div>
                  ) : brandFonts.length > 1 ? (
                    <Select
                      value={activeScale.bodyFontFamily || ""}
                      onValueChange={(value) =>
                        updateScale({ bodyFontFamily: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a font family" />
                      </SelectTrigger>
                      <SelectContent>
                        {brandFonts.map((font: ProcessedFont) => (
                          <SelectItem key={font.id} value={font.fontFamily}>
                            {font.fontFamily}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground p-2 border rounded">
                      No brand fonts defined. Add fonts in the typography
                      section above.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body-font-weight">Font Weight</Label>
                  <Select
                    value={activeScale.bodyFontWeight || "400"}
                    onValueChange={(value) =>
                      updateScale({ bodyFontWeight: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableFontWeights(activeScale.bodyFontFamily).map(
                        (weight: FontWeight) => (
                          <SelectItem key={weight.value} value={weight.value}>
                            {weight.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body-color">Color</Label>
                  <ColorSelector
                    id="body-color"
                    value={activeScale.bodyColor || "#000000"}
                    onChange={(color) => updateScale({ bodyColor: color })}
                    placeholder="#000000"
                  />
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem
                    value="advanced-styles"
                    className="border-none"
                  >
                    <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 px-0">
                      Advanced Styles
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="body-letter-spacing">
                          Letter Spacing (em)
                        </Label>
                        <Input
                          id="body-letter-spacing"
                          type="number"
                          step="0.01"
                          value={activeScale.bodyLetterSpacing || 0}
                          onChange={(e) =>
                            updateScale({
                              bodyLetterSpacing:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="body-text-transform">
                          Text Transform
                        </Label>
                        <Select
                          value={activeScale.bodyTextTransform || "none"}
                          onValueChange={(
                            value:
                              | "none"
                              | "uppercase"
                              | "lowercase"
                              | "capitalize"
                          ) => updateScale({ bodyTextTransform: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="uppercase">Uppercase</SelectItem>
                            <SelectItem value="lowercase">Lowercase</SelectItem>
                            <SelectItem value="capitalize">
                              Capitalize
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="body-font-style">Font Style</Label>
                        <Select
                          value={activeScale.bodyFontStyle || "normal"}
                          onValueChange={(
                            value: "normal" | "italic" | "oblique"
                          ) => updateScale({ bodyFontStyle: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="italic">Italic</SelectItem>
                            <SelectItem value="oblique">Oblique</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="body-text-decoration">
                          Text Decoration
                        </Label>
                        <Select
                          value={activeScale.bodyTextDecoration || "none"}
                          onValueChange={(
                            value:
                              | "none"
                              | "underline"
                              | "overline"
                              | "line-through"
                          ) => updateScale({ bodyTextDecoration: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="underline">Underline</SelectItem>
                            <SelectItem value="overline">Overline</SelectItem>
                            <SelectItem value="line-through">
                              Line Through
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Custom Body Styling Section - NEW */}
              <div className="mt-6">
                <h5 className="text-sm font-medium mb-3">
                  Custom Body Styling
                </h5>
                <p className="text-xs text-muted-foreground mb-4">
                  Click body type chips below to customize individual body
                  elements
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    "body-large",
                    "body",
                    "body-small",
                    "caption",
                    "quote",
                    "code",
                  ].map((bodyLevel) => (
                    <button
                      key={bodyLevel}
                      onClick={() => toggleBodyCustomization(bodyLevel)}
                      className={`
                          px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200
                          ${
                            activeBodyCustomizations.has(bodyLevel)
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-foreground border-border hover:bg-muted"
                          }
                        `}
                    >
                      {bodyLevel.toUpperCase().replace("-", " ")}
                    </button>
                  ))}
                </div>

                {/* Individual Body Customization Panels */}
                {Array.from(activeBodyCustomizations).map((bodyLevel) => {
                  const bodyStyle =
                    activeScale.individualBodyStyles?.[
                      bodyLevel as keyof typeof activeScale.individualBodyStyles
                    ];
                  return (
                    <div
                      key={bodyLevel}
                      className="border rounded-lg p-4 mb-4 bg-muted/20"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h6 className="text-sm font-medium">
                          {bodyLevel.toUpperCase().replace("-", " ")} Custom
                          Styling
                        </h6>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleBodyCustomization(bodyLevel)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${bodyLevel}-font-family`}>
                              Font Family
                            </Label>
                            {bodyStyle?.fontFamily && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetIndividualBodyStyle(
                                    bodyLevel,
                                    "fontFamily"
                                  )
                                }
                                className="text-xs h-6 px-2"
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                          {brandFonts.length === 1 ? (
                            <div className="text-sm p-2 bg-muted rounded">
                              {brandFonts[0].fontFamily}{" "}
                              {bodyStyle?.fontFamily &&
                              bodyStyle.fontFamily !== brandFonts[0].fontFamily
                                ? `→ ${bodyStyle.fontFamily}`
                                : ""}
                            </div>
                          ) : brandFonts.length > 1 ? (
                            <Select
                              value={bodyStyle?.fontFamily || ""}
                              onValueChange={(value) =>
                                updateIndividualBodyStyle(bodyLevel, {
                                  fontFamily: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={`Inherits: ${activeScale.bodyFontFamily || "Default"}`}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {brandFonts.map((font: ProcessedFont) => (
                                  <SelectItem
                                    key={font.id}
                                    value={font.fontFamily}
                                  >
                                    {font.fontFamily}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm text-muted-foreground p-2 border rounded">
                              No brand fonts defined. Add fonts in the
                              typography section above.
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${bodyLevel}-font-weight`}>
                              Font Weight
                            </Label>
                            {bodyStyle?.fontWeight && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetIndividualBodyStyle(
                                    bodyLevel,
                                    "fontWeight"
                                  )
                                }
                                className="text-xs h-6 px-2"
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                          <Select
                            value={bodyStyle?.fontWeight || ""}
                            onValueChange={(value) =>
                              updateIndividualBodyStyle(bodyLevel, {
                                fontWeight: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={`Inherits: ${activeScale.bodyFontWeight || "400"}`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableFontWeights(
                                bodyStyle?.fontFamily ||
                                  activeScale.bodyFontFamily
                              ).map((weight: FontWeight) => (
                                <SelectItem
                                  key={weight.value}
                                  value={weight.value}
                                >
                                  {weight.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${bodyLevel}-font-size`}>
                              Font Size (px)
                            </Label>
                            {bodyStyle?.fontSize && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetIndividualBodyStyle(
                                    bodyLevel,
                                    "fontSize"
                                  )
                                }
                                className="text-xs h-6 px-2"
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                          <Input
                            id={`${bodyLevel}-font-size`}
                            type="number"
                            min="8"
                            max="200"
                            value={
                              bodyStyle?.fontSize
                                ? parseFloat(
                                    bodyStyle.fontSize.replace("px", "")
                                  )
                                : ""
                            }
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value) {
                                updateIndividualBodyStyle(bodyLevel, {
                                  fontSize: `${value}px`,
                                });
                              } else {
                                resetIndividualBodyStyle(bodyLevel, "fontSize");
                              }
                            }}
                            placeholder={`Inherits: ${(() => {
                              const baseSize = activeScale.baseSize || 16;
                              let size: number;

                              switch (bodyLevel) {
                                case "body-large":
                                  size = baseSize * 1.125;
                                  break;
                                case "body":
                                  size = baseSize;
                                  break;
                                case "body-small":
                                  size = baseSize * 0.875;
                                  break;
                                case "caption":
                                  size = baseSize * 0.75;
                                  break;
                                case "quote":
                                  size = baseSize * 1.25;
                                  break;
                                case "code":
                                  size = baseSize * 0.875;
                                  break;
                                default:
                                  size = baseSize;
                              }

                              return `${Math.round(size * 100) / 100}px`;
                            })()}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${bodyLevel}-color`}>Color</Label>
                            {bodyStyle?.color && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetIndividualBodyStyle(bodyLevel, "color")
                                }
                                className="text-xs h-6 px-2"
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                          <ColorSelector
                            id={`${bodyLevel}-color`}
                            value={
                              bodyStyle?.color ||
                              activeScale.bodyColor ||
                              "#000000"
                            }
                            onChange={(color) =>
                              updateIndividualBodyStyle(bodyLevel, { color })
                            }
                            placeholder={`Inherits: ${activeScale.bodyColor || "#000000"}`}
                          />
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem
                            value="advanced-styles"
                            className="border-none"
                          >
                            <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 px-0">
                              Advanced Styles
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label
                                    htmlFor={`${bodyLevel}-letter-spacing`}
                                  >
                                    Letter Spacing (em)
                                  </Label>
                                  {bodyStyle?.letterSpacing !== undefined && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        resetIndividualBodyStyle(
                                          bodyLevel,
                                          "letterSpacing"
                                        )
                                      }
                                      className="text-xs h-6 px-2"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                                <Input
                                  id={`${bodyLevel}-letter-spacing`}
                                  type="number"
                                  step="0.01"
                                  value={
                                    bodyStyle?.letterSpacing !== undefined
                                      ? bodyStyle.letterSpacing
                                      : ""
                                  }
                                  onChange={(e) =>
                                    updateIndividualBodyStyle(bodyLevel, {
                                      letterSpacing:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder={`Inherits: ${activeScale.bodyLetterSpacing || 0}`}
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label
                                    htmlFor={`${bodyLevel}-text-transform`}
                                  >
                                    Text Transform
                                  </Label>
                                  {bodyStyle?.textTransform && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        resetIndividualBodyStyle(
                                          bodyLevel,
                                          "textTransform"
                                        )
                                      }
                                      className="text-xs h-6 px-2"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                                <Select
                                  value={bodyStyle?.textTransform || ""}
                                  onValueChange={(
                                    value:
                                      | "none"
                                      | "uppercase"
                                      | "lowercase"
                                      | "capitalize"
                                  ) =>
                                    updateIndividualBodyStyle(bodyLevel, {
                                      textTransform: value,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Inherits: None" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="uppercase">
                                      Uppercase
                                    </SelectItem>
                                    <SelectItem value="lowercase">
                                      Lowercase
                                    </SelectItem>
                                    <SelectItem value="capitalize">
                                      Capitalize
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label htmlFor={`${bodyLevel}-font-style`}>
                                    Font Style
                                  </Label>
                                  {bodyStyle?.fontStyle && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        resetIndividualBodyStyle(
                                          bodyLevel,
                                          "fontStyle"
                                        )
                                      }
                                      className="text-xs h-6 px-2"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                                <Select
                                  value={bodyStyle?.fontStyle || ""}
                                  onValueChange={(
                                    value: "normal" | "italic" | "oblique"
                                  ) =>
                                    updateIndividualBodyStyle(bodyLevel, {
                                      fontStyle: value,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Inherits: Normal" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="normal">
                                      Normal
                                    </SelectItem>
                                    <SelectItem value="italic">
                                      Italic
                                    </SelectItem>
                                    <SelectItem value="oblique">
                                      Oblique
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label
                                    htmlFor={`${bodyLevel}-text-decoration`}
                                  >
                                    Text Decoration
                                  </Label>
                                  {bodyStyle?.textDecoration && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        resetIndividualBodyStyle(
                                          bodyLevel,
                                          "textDecoration"
                                        )
                                      }
                                      className="text-xs h-6 px-2"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                                <Select
                                  value={bodyStyle?.textDecoration || ""}
                                  onValueChange={(
                                    value:
                                      | "none"
                                      | "underline"
                                      | "overline"
                                      | "line-through"
                                  ) =>
                                    updateIndividualBodyStyle(bodyLevel, {
                                      textDecoration: value,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Inherits: None" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="underline">
                                      Underline
                                    </SelectItem>
                                    <SelectItem value="overline">
                                      Overline
                                    </SelectItem>
                                    <SelectItem value="line-through">
                                      Line Through
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Header Type Styles Section */}
            <div>
              <h4 className="text-base font-semibold mb-4">
                Header Type Styles
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="header-font-family">Font Family</Label>
                  {brandFonts.length === 1 ? (
                    <div className="text-sm p-2 bg-muted rounded">
                      {brandFonts[0].fontFamily}
                    </div>
                  ) : brandFonts.length > 1 ? (
                    <Select
                      value={activeScale.headerFontFamily || ""}
                      onValueChange={(value) =>
                        updateScale({ headerFontFamily: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a font family" />
                      </SelectTrigger>
                      <SelectContent>
                        {brandFonts.map((font: ProcessedFont) => (
                          <SelectItem key={font.id} value={font.fontFamily}>
                            {font.fontFamily}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground p-2 border rounded">
                      No brand fonts defined. Add fonts in the typography
                      section above.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="header-font-weight">Font Weight</Label>
                  <Select
                    value={activeScale.headerFontWeight || "700"}
                    onValueChange={(value) =>
                      updateScale({ headerFontWeight: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableFontWeights(
                        activeScale.headerFontFamily
                      ).map((weight: FontWeight) => (
                        <SelectItem key={weight.value} value={weight.value}>
                          {weight.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="header-color">Color</Label>
                  <ColorSelector
                    id="header-color"
                    value={activeScale.headerColor || "#000000"}
                    onChange={(color) => updateScale({ headerColor: color })}
                    placeholder="#000000"
                  />
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem
                    value="advanced-styles"
                    className="border-none"
                  >
                    <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 px-0">
                      Advanced Styles
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="header-letter-spacing">
                          Letter Spacing (em)
                        </Label>
                        <Input
                          id="header-letter-spacing"
                          type="number"
                          step="0.01"
                          value={activeScale.headerLetterSpacing || 0}
                          onChange={(e) =>
                            updateScale({
                              headerLetterSpacing:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="header-text-transform">
                          Text Transform
                        </Label>
                        <Select
                          value={activeScale.headerTextTransform || "none"}
                          onValueChange={(
                            value:
                              | "none"
                              | "uppercase"
                              | "lowercase"
                              | "capitalize"
                          ) => updateScale({ headerTextTransform: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="uppercase">Uppercase</SelectItem>
                            <SelectItem value="lowercase">Lowercase</SelectItem>
                            <SelectItem value="capitalize">
                              Capitalize
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="header-font-style">Font Style</Label>
                        <Select
                          value={activeScale.headerFontStyle || "normal"}
                          onValueChange={(
                            value: "normal" | "italic" | "oblique"
                          ) => updateScale({ headerFontStyle: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="italic">Italic</SelectItem>
                            <SelectItem value="oblique">Oblique</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="header-text-decoration">
                          Text Decoration
                        </Label>
                        <Select
                          value={activeScale.headerTextDecoration || "none"}
                          onValueChange={(
                            value:
                              | "none"
                              | "underline"
                              | "overline"
                              | "line-through"
                          ) => updateScale({ headerTextDecoration: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="underline">Underline</SelectItem>
                            <SelectItem value="overline">Overline</SelectItem>
                            <SelectItem value="line-through">
                              Line Through
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <div className="mt-6">
                <h5 className="text-sm font-medium mb-3">
                  Custom Header Styling
                </h5>
                <p className="text-xs text-muted-foreground mb-4">
                  Click header chips below to customize individual header levels
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {["h1", "h2", "h3", "h4", "h5", "h6"].map((headerLevel) => (
                    <button
                      key={headerLevel}
                      onClick={() => toggleHeaderCustomization(headerLevel)}
                      className={`
                          px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200
                          ${
                            activeHeaderCustomizations.has(headerLevel)
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-foreground border-border hover:bg-muted"
                          }
                        `}
                    >
                      {headerLevel.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Individual Header Customization Panels */}
                {Array.from(activeHeaderCustomizations).map((headerLevel) => {
                  const headerStyle =
                    activeScale.individualHeaderStyles?.[
                      headerLevel as keyof typeof activeScale.individualHeaderStyles
                    ];
                  return (
                    <div
                      key={headerLevel}
                      className="border rounded-lg p-4 mb-4 bg-muted/20"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h6 className="text-sm font-medium">
                          {headerLevel.toUpperCase()} Custom Styling
                        </h6>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleHeaderCustomization(headerLevel)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${headerLevel}-font-family`}>
                              Font Family
                            </Label>
                            {headerStyle?.fontFamily && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetIndividualHeaderStyle(
                                    headerLevel,
                                    "fontFamily"
                                  )
                                }
                                className="text-xs h-6 px-2"
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                          {brandFonts.length === 1 ? (
                            <div className="text-sm p-2 bg-muted rounded">
                              {brandFonts[0].fontFamily}{" "}
                              {headerStyle?.fontFamily &&
                              headerStyle.fontFamily !==
                                brandFonts[0].fontFamily
                                ? `→ ${headerStyle.fontFamily}`
                                : ""}
                            </div>
                          ) : brandFonts.length > 1 ? (
                            <Select
                              value={headerStyle?.fontFamily || ""}
                              onValueChange={(value) =>
                                updateIndividualHeaderStyle(headerLevel, {
                                  fontFamily: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={`Inherits: ${activeScale.headerFontFamily || "Default"}`}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {brandFonts.map((font: ProcessedFont) => (
                                  <SelectItem
                                    key={font.id}
                                    value={font.fontFamily}
                                  >
                                    {font.fontFamily}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm text-muted-foreground p-2 border rounded">
                              No brand fonts defined. Add fonts in the
                              typography section above.
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${headerLevel}-font-weight`}>
                              Font Weight
                            </Label>
                            {headerStyle?.fontWeight && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetIndividualHeaderStyle(
                                    headerLevel,
                                    "fontWeight"
                                  )
                                }
                                className="text-xs h-6 px-2"
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                          <Select
                            value={headerStyle?.fontWeight || ""}
                            onValueChange={(value) =>
                              updateIndividualHeaderStyle(headerLevel, {
                                fontWeight: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={`Inherits: ${activeScale.headerFontWeight || "700"}`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableFontWeights(
                                headerStyle?.fontFamily ||
                                  activeScale.headerFontFamily
                              ).map((weight: FontWeight) => (
                                <SelectItem
                                  key={weight.value}
                                  value={weight.value}
                                >
                                  {weight.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${headerLevel}-font-size`}>
                              Font Size (px)
                            </Label>
                            {headerStyle?.fontSize && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetIndividualHeaderStyle(
                                    headerLevel,
                                    "fontSize"
                                  )
                                }
                                className="text-xs h-6 px-2"
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                          <Input
                            id={`${headerLevel}-font-size`}
                            type="number"
                            min="8"
                            max="200"
                            value={
                              headerStyle?.fontSize
                                ? parseFloat(
                                    headerStyle.fontSize.replace("px", "")
                                  )
                                : ""
                            }
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value) {
                                updateIndividualHeaderStyle(headerLevel, {
                                  fontSize: `${value}px`,
                                });
                              } else {
                                resetIndividualHeaderStyle(
                                  headerLevel,
                                  "fontSize"
                                );
                              }
                            }}
                            placeholder={`Inherits: ${(() => {
                              const baseSize = activeScale.baseSize || 16;
                              const ratio =
                                (activeScale.scaleRatio || 1250) / 1000;
                              let size: number;

                              switch (headerLevel) {
                                case "h6":
                                  size = baseSize * 0.8;
                                  break;
                                case "h5":
                                  size = baseSize;
                                  break;
                                case "h4":
                                  size = baseSize * ratio;
                                  break;
                                case "h3":
                                  size = baseSize * ratio * ratio;
                                  break;
                                case "h2":
                                  size = baseSize * ratio * ratio * ratio;
                                  break;
                                case "h1":
                                  size =
                                    baseSize * ratio * ratio * ratio * ratio;
                                  break;
                                default:
                                  size = baseSize;
                              }

                              return `${Math.round(size * 100) / 100}px`;
                            })()}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`${headerLevel}-color`}>
                              Color
                            </Label>
                            {headerStyle?.color && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  resetIndividualHeaderStyle(
                                    headerLevel,
                                    "color"
                                  )
                                }
                                className="text-xs h-6 px-2"
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                          <ColorSelector
                            id={`${headerLevel}-color`}
                            value={
                              headerStyle?.color ||
                              activeScale.headerColor ||
                              "#000000"
                            }
                            onChange={(color) =>
                              updateIndividualHeaderStyle(headerLevel, {
                                color,
                              })
                            }
                            placeholder={`Inherits: ${activeScale.headerColor || "#000000"}`}
                          />
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem
                            value="advanced-styles"
                            className="border-none"
                          >
                            <AccordionTrigger className="text-sm font-medium hover:no-underline py-2 px-0">
                              Advanced Styles
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label
                                    htmlFor={`${headerLevel}-letter-spacing`}
                                  >
                                    Letter Spacing (em)
                                  </Label>
                                  {headerStyle?.letterSpacing !== undefined && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        resetIndividualHeaderStyle(
                                          headerLevel,
                                          "letterSpacing"
                                        )
                                      }
                                      className="text-xs h-6 px-2"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                                <Input
                                  id={`${headerLevel}-letter-spacing`}
                                  type="number"
                                  step="0.01"
                                  value={
                                    headerStyle?.letterSpacing !== undefined
                                      ? headerStyle.letterSpacing
                                      : ""
                                  }
                                  onChange={(e) =>
                                    updateIndividualHeaderStyle(headerLevel, {
                                      letterSpacing:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder={`Inherits: ${activeScale.headerLetterSpacing || 0}`}
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label
                                    htmlFor={`${headerLevel}-text-transform`}
                                  >
                                    Text Transform
                                  </Label>
                                  {headerStyle?.textTransform && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        resetIndividualHeaderStyle(
                                          headerLevel,
                                          "textTransform"
                                        )
                                      }
                                      className="text-xs h-6 px-2"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                                <Select
                                  value={headerStyle?.textTransform || ""}
                                  onValueChange={(
                                    value:
                                      | "none"
                                      | "uppercase"
                                      | "lowercase"
                                      | "capitalize"
                                  ) =>
                                    updateIndividualHeaderStyle(headerLevel, {
                                      textTransform: value,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Inherits: None" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="uppercase">
                                      Uppercase
                                    </SelectItem>
                                    <SelectItem value="lowercase">
                                      Lowercase
                                    </SelectItem>
                                    <SelectItem value="capitalize">
                                      Capitalize
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label htmlFor={`${headerLevel}-font-style`}>
                                    Font Style
                                  </Label>
                                  {headerStyle?.fontStyle && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        resetIndividualHeaderStyle(
                                          headerLevel,
                                          "fontStyle"
                                        )
                                      }
                                      className="text-xs h-6 px-2"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                                <Select
                                  value={headerStyle?.fontStyle || ""}
                                  onValueChange={(
                                    value: "normal" | "italic" | "oblique"
                                  ) =>
                                    updateIndividualHeaderStyle(headerLevel, {
                                      fontStyle: value,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Inherits: Normal" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="normal">
                                      Normal
                                    </SelectItem>
                                    <SelectItem value="italic">
                                      Italic
                                    </SelectItem>
                                    <SelectItem value="oblique">
                                      Oblique
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label
                                    htmlFor={`${headerLevel}-text-decoration`}
                                  >
                                    Text Decoration
                                  </Label>
                                  {headerStyle?.textDecoration && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        resetIndividualHeaderStyle(
                                          headerLevel,
                                          "textDecoration"
                                        )
                                      }
                                      className="text-xs h-6 px-2"
                                    >
                                      Reset
                                    </Button>
                                  )}
                                </div>
                                <Select
                                  value={headerStyle?.textDecoration || ""}
                                  onValueChange={(
                                    value:
                                      | "none"
                                      | "underline"
                                      | "overline"
                                      | "line-through"
                                  ) =>
                                    updateIndividualHeaderStyle(headerLevel, {
                                      textDecoration: value,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Inherits: None" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="underline">
                                      Underline
                                    </SelectItem>
                                    <SelectItem value="overline">
                                      Overline
                                    </SelectItem>
                                    <SelectItem value="line-through">
                                      Line Through
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="asset-display__preview sticky">
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-semibold">Type Scale Preview</h4>
              </div>
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="mt-4">
                  <TypeScalePreview
                    typeScale={{
                      ...activeScale,
                      typeStyles:
                        activeScale.typeStyles || DEFAULT_TYPE_SCALE.typeStyles,
                      baseSize: activeScale.baseSize || 16,
                      scaleRatio: activeScale.scaleRatio || 1250,
                      unit: activeScale.unit || "px",
                    }}
                  />
                </TabsContent>
                <TabsContent value="code" className="mt-4">
                  <Tabs defaultValue="css" className="w-full relative">
                    <TabsList className="absolute top-0 right-0">
                      <TabsTrigger value="css">CSS</TabsTrigger>
                      <TabsTrigger value="scss">SCSS</TabsTrigger>
                    </TabsList>
                    <TabsContent value="css" className="mt-4">
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96">
                        <code>{generateCodePreview("css")}</code>
                      </pre>
                    </TabsContent>
                    <TabsContent value="scss" className="mt-4">
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96">
                        <code>{generateCodePreview("scss")}</code>
                      </pre>
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
