import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Save, Download, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TypeScalePreview } from "./type-scale-preview";
import type { TypeScale, IndividualHeaderStyle } from "@shared/schema";

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
    desktop: { baseSize: 16, scaleRatio: 1.25 }
  },
  typeStyles: [
    { level: "h1", name: "Heading 1", size: 4, fontWeight: "700", lineHeight: 1.2, letterSpacing: 0, color: "#000000" },
    { level: "h2", name: "Heading 2", size: 3, fontWeight: "600", lineHeight: 1.3, letterSpacing: 0, color: "#000000" },
    { level: "h3", name: "Heading 3", size: 2, fontWeight: "600", lineHeight: 1.4, letterSpacing: 0, color: "#000000" },
    { level: "h4", name: "Heading 4", size: 1, fontWeight: "500", lineHeight: 1.4, letterSpacing: 0, color: "#000000" },
    { level: "h5", name: "Heading 5", size: 0, fontWeight: "500", lineHeight: 1.5, letterSpacing: 0, color: "#000000" },
    { level: "h6", name: "Heading 6", size: 0, fontWeight: "500", lineHeight: 1.5, letterSpacing: 0, color: "#000000" },
    { level: "body", name: "Body Text", size: 0, fontWeight: "400", lineHeight: 1.6, letterSpacing: 0, color: "#000000" },
    { level: "small", name: "Small Text", size: -1, fontWeight: "400", lineHeight: 1.5, letterSpacing: 0, color: "#666666" }
  ]
};

export function TypeScaleManager({ clientId }: TypeScaleManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentScale, setCurrentScale] = useState<TypeScale | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeHeaderCustomizations, setActiveHeaderCustomizations] = useState<Set<string>>(new Set());

  const { data: typeScales = [], isLoading } = useQuery({
    queryKey: ["/api/clients", clientId, "type-scales"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/type-scales`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch type scales');
      return response.json();
    },
  });

  // Fetch brand fonts for this client from brand assets
  const { data: brandAssets = [] } = useQuery({
    queryKey: ["/api/clients", clientId, "assets"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/assets`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Extract and parse font assets
  const brandFonts = brandAssets
    .filter((asset: any) => asset.category === "font")
    .map((asset: any) => {
      try {
        const fontData = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
        return {
          id: asset.id,
          name: asset.name,
          fontFamily: fontData.sourceData?.fontFamily || asset.name,
          source: fontData.source || 'google',
          weights: fontData.weights || ['400'],
          styles: fontData.styles || ['normal']
        };
      } catch (error) {
        console.error("Error parsing font asset:", error);
        return null;
      }
    })
    .filter(Boolean);

  // Initialize with existing scale or create new one
  const defaultFontFamily = brandFonts.length === 1 ? brandFonts[0].fontFamily : undefined;
  const activeScale = currentScale || (typeScales[0] || {
    ...DEFAULT_TYPE_SCALE,
    id: undefined,
    clientId,
    baseSize: 16, // Ensure base size is in pixels, not rem
    bodyFontFamily: defaultFontFamily || DEFAULT_TYPE_SCALE.bodyFontFamily,
    headerFontFamily: defaultFontFamily || DEFAULT_TYPE_SCALE.headerFontFamily,
  });

  const saveTypeScaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id 
        ? `/api/type-scales/${data.id}` 
        : `/api/clients/${clientId}/type-scales`;
      const method = data.id ? "PATCH" : "POST";
      
      // Transform data to match schema expectations
      const transformedData = {
        ...data,
        // Ensure scaleRatio is stored as integer (ratio * 1000)
        scaleRatio: Math.round((data.scaleRatio || 1250)),
        // Ensure customRatio is stored as integer if provided
        customRatio: data.customRatio ? Math.round(data.customRatio) : undefined,
        // Ensure letter spacing is stored as integer (em * 1000)
        bodyLetterSpacing: Math.round((data.bodyLetterSpacing || 0)),
        headerLetterSpacing: Math.round((data.headerLetterSpacing || 0)),
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
        headerColor: data.headerColor || "#000000"
      };
      
      console.log("Saving type scale with data:", transformedData);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transformedData),
        credentials: 'include',
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
        throw new Error(`Failed to save type scale: ${errorData.error || errorText}`);
      }
      return response.json();
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
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save type scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteTypeScaleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/type-scales/${id}`, {
        method: "DELETE",
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete type scale');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Type scale deleted",
        description: "The type scale has been deleted successfully.",
      });
      setCurrentScale(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", clientId, "type-scales"],
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async ({ format }: { format: "css" | "scss" }) => {
      if (!activeScale.id) throw new Error('Please save the type scale before exporting');
      const response = await fetch(`/api/type-scales/${activeScale.id}/export/${format}`, {
        method: "POST",
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to export type scale');
      return response.json();
    },
    onSuccess: (data, variables) => {
      const blob = new Blob([data.content], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const updateScale = (updates: Partial<any>) => {
    setCurrentScale(prev => ({ ...activeScale, ...updates }));
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

  const updateIndividualHeaderStyle = (headerLevel: string, styleUpdates: Partial<IndividualHeaderStyle>) => {
    const currentIndividualStyles = activeScale.individualHeaderStyles || {};
    const updatedStyles = {
      ...currentIndividualStyles,
      [headerLevel]: {
        ...currentIndividualStyles[headerLevel as keyof typeof currentIndividualStyles],
        ...styleUpdates
      }
    };
    updateScale({ individualHeaderStyles: updatedStyles });
  };

  const resetIndividualHeaderStyle = (headerLevel: string, property: keyof IndividualHeaderStyle) => {
    const currentIndividualStyles = activeScale.individualHeaderStyles || {};
    const headerStyle = currentIndividualStyles[headerLevel as keyof typeof currentIndividualStyles];
    if (headerStyle) {
      const updatedHeaderStyle = { ...headerStyle };
      delete updatedHeaderStyle[property];
      
      const updatedStyles = {
        ...currentIndividualStyles,
        [headerLevel]: updatedHeaderStyle
      };
      updateScale({ individualHeaderStyles: updatedStyles });
    }
  };

  const handleSave = () => {
    saveTypeScaleMutation.mutate(activeScale);
  };

  const handleDelete = () => {
    if (activeScale.id && confirm("Are you sure you want to delete this type scale?")) {
      deleteTypeScaleMutation.mutate(activeScale.id);
    }
  };

  const handleNewScale = () => {
    setCurrentScale({
      ...DEFAULT_TYPE_SCALE,
      id: undefined,
      clientId,
      name: `Type Scale ${typeScales.length + 1}`
    });
    setIsEditing(true);
  };

  const generateCodePreview = (format: "css" | "scss") => {
    const styles = activeScale.typeStyles || DEFAULT_TYPE_SCALE.typeStyles;
    const baseSize = activeScale.baseSize || 16;
    const ratio = (activeScale.scaleRatio || 1250) / 1000;
    const unit = activeScale.unit || "px";

    const calculateSize = (level: number) => {
      return Math.round(baseSize * Math.pow(ratio, level) * 100) / 100;
    };

    if (format === "scss") {
      let scss = `// Type Scale Variables\n`;
      scss += `$base-font-size: ${baseSize}${unit};\n`;
      scss += `$type-scale-ratio: ${ratio};\n\n`;
      
      styles.forEach((style: any) => {
        const size = calculateSize(style.size);
        scss += `$${style.level}-size: ${size}${unit};\n`;
      });
      
      scss += `\n// Type Scale Mixins\n`;
      styles.forEach((style: any) => {
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
      
      styles.forEach((style: any) => {
        const size = calculateSize(style.size);
        css += `  --${style.level}-size: ${size}${unit};\n`;
      });
      css += `}\n\n`;
      
      styles.forEach((style: any) => {
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
            <p className="text-sm text-muted-foreground">
              Create and manage consistent typography scales for your brand.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {activeScale.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleteTypeScaleMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button onClick={handleNewScale}>
              <Plus className="mr-2 h-4 w-4" />
              New Scale
            </Button>
          </div>
        </div>
      </div>

      <div className="asset-display">
        <div className="asset-display__info">
            <div className="space-y-6">
              {/* Scale Settings */}
              <div>
                <h4 className="text-base font-semibold mb-4">Scale Settings</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="scale-name">Name</Label>
                    <Input
                      id="scale-name"
                      value={activeScale.name || ""}
                      onChange={(e) => updateScale({ name: e.target.value })}
                      placeholder="Type scale name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="base-size">Base Size</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="base-size"
                        type="number"
                        value={activeScale.baseSize || 16}
                        onChange={(e) => updateScale({ baseSize: parseInt(e.target.value) || 16 })}
                        className="flex-1"
                      />
                      <Select
                        value={activeScale.unit || "px"}
                        onValueChange={(value) => updateScale({ unit: value })}
                      >
                        <SelectTrigger className="w-20">
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
                    <Label>Scale Ratio: {((activeScale.scaleRatio || 1250) / 1000).toFixed(3)}</Label>
                    <Slider
                      value={[(activeScale.scaleRatio || 1250)]}
                      onValueChange={([value]) => updateScale({ scaleRatio: value })}
                      min={1000}
                      max={2000}
                      step={10}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1.000</span>
                      <span>2.000</span>
                    </div>
                  </div>

                  {isEditing && (
                    <Button
                      onClick={handleSave}
                      disabled={saveTypeScaleMutation.isPending}
                      className="w-full"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>

              {/* Body Type Styles Section */}
              <div>
                <h4 className="text-base font-semibold mb-4">Body Type Styles</h4>
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
                        onValueChange={(value) => updateScale({ bodyFontFamily: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a font family" />
                        </SelectTrigger>
                        <SelectContent>
                          {brandFonts.map((font: any) => (
                            <SelectItem key={font.id} value={font.fontFamily}>
                              {font.fontFamily}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-muted-foreground p-2 border rounded">
                        No brand fonts defined. Add fonts in the typography section above.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body-font-weight">Font Weight</Label>
                    <Select
                      value={activeScale.bodyFontWeight || "400"}
                      onValueChange={(value) => updateScale({ bodyFontWeight: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100 - Thin</SelectItem>
                        <SelectItem value="200">200 - Extra Light</SelectItem>
                        <SelectItem value="300">300 - Light</SelectItem>
                        <SelectItem value="400">400 - Regular</SelectItem>
                        <SelectItem value="500">500 - Medium</SelectItem>
                        <SelectItem value="600">600 - Semi Bold</SelectItem>
                        <SelectItem value="700">700 - Bold</SelectItem>
                        <SelectItem value="800">800 - Extra Bold</SelectItem>
                        <SelectItem value="900">900 - Black</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body-letter-spacing">Letter Spacing (em)</Label>
                    <Input
                      id="body-letter-spacing"
                      type="number"
                      step="0.01"
                      value={activeScale.bodyLetterSpacing || 0}
                      onChange={(e) => updateScale({ bodyLetterSpacing: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body-color">Color</Label>
                    <Input
                      id="body-color"
                      type="color"
                      value={activeScale.bodyColor || "#000000"}
                      onChange={(e) => updateScale({ bodyColor: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Header Type Styles Section */}
              <div>
                <h4 className="text-base font-semibold mb-4">Header Type Styles</h4>
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
                        onValueChange={(value) => updateScale({ headerFontFamily: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a font family" />
                        </SelectTrigger>
                        <SelectContent>
                          {brandFonts.map((font: any) => (
                            <SelectItem key={font.id} value={font.fontFamily}>
                              {font.fontFamily}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-muted-foreground p-2 border rounded">
                        No brand fonts defined. Add fonts in the typography section above.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="header-font-weight">Font Weight</Label>
                    <Select
                      value={activeScale.headerFontWeight || "700"}
                      onValueChange={(value) => updateScale({ headerFontWeight: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100 - Thin</SelectItem>
                        <SelectItem value="200">200 - Extra Light</SelectItem>
                        <SelectItem value="300">300 - Light</SelectItem>
                        <SelectItem value="400">400 - Regular</SelectItem>
                        <SelectItem value="500">500 - Medium</SelectItem>
                        <SelectItem value="600">600 - Semi Bold</SelectItem>
                        <SelectItem value="700">700 - Bold</SelectItem>
                        <SelectItem value="800">800 - Extra Bold</SelectItem>
                        <SelectItem value="900">900 - Black</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="header-letter-spacing">Letter Spacing (em)</Label>
                    <Input
                      id="header-letter-spacing"
                      type="number"
                      step="0.01"
                      value={activeScale.headerLetterSpacing || 0}
                      onChange={(e) => updateScale({ headerLetterSpacing: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="header-color">Color</Label>
                    <Input
                      id="header-color"
                      type="color"
                      value={activeScale.headerColor || "#000000"}
                      onChange={(e) => updateScale({ headerColor: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <h5 className="text-sm font-medium mb-3">Custom Header Styling</h5>
                  <p className="text-xs text-muted-foreground mb-4">
                    Click header chips below to customize individual header levels
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((headerLevel) => (
                      <button
                        key={headerLevel}
                        onClick={() => toggleHeaderCustomization(headerLevel)}
                        className={`
                          px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200
                          ${activeHeaderCustomizations.has(headerLevel)
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background text-foreground border-border hover:bg-muted'
                          }
                        `}
                      >
                        {headerLevel.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Individual Header Customization Panels */}
                  {Array.from(activeHeaderCustomizations).map((headerLevel) => {
                    const headerStyle = activeScale.individualHeaderStyles?.[headerLevel as keyof typeof activeScale.individualHeaderStyles];
                    return (
                      <div key={headerLevel} className="border rounded-lg p-4 mb-4 bg-muted/20">
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
                              <Label htmlFor={`${headerLevel}-font-family`}>Font Family</Label>
                              {headerStyle?.fontFamily && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resetIndividualHeaderStyle(headerLevel, 'fontFamily')}
                                  className="text-xs h-6 px-2"
                                >
                                  Reset
                                </Button>
                              )}
                            </div>
                            {brandFonts.length === 1 ? (
                              <div className="text-sm p-2 bg-muted rounded">
                                {brandFonts[0].fontFamily} {headerStyle?.fontFamily && headerStyle.fontFamily !== brandFonts[0].fontFamily ? `→ ${headerStyle.fontFamily}` : ''}
                              </div>
                            ) : brandFonts.length > 1 ? (
                              <Select
                                value={headerStyle?.fontFamily || ""}
                                onValueChange={(value) => updateIndividualHeaderStyle(headerLevel, { fontFamily: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Inherits: ${activeScale.headerFontFamily || 'Default'}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {brandFonts.map((font: any) => (
                                    <SelectItem key={font.id} value={font.fontFamily}>
                                      {font.fontFamily}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-sm text-muted-foreground p-2 border rounded">
                                No brand fonts defined. Add fonts in the typography section above.
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${headerLevel}-font-weight`}>Font Weight</Label>
                              {headerStyle?.fontWeight && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resetIndividualHeaderStyle(headerLevel, 'fontWeight')}
                                  className="text-xs h-6 px-2"
                                >
                                  Reset
                                </Button>
                              )}
                            </div>
                            <Select
                              value={headerStyle?.fontWeight || ""}
                              onValueChange={(value) => updateIndividualHeaderStyle(headerLevel, { fontWeight: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Inherits: ${activeScale.headerFontWeight || '700'}`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="100">100 - Thin</SelectItem>
                                <SelectItem value="200">200 - Extra Light</SelectItem>
                                <SelectItem value="300">300 - Light</SelectItem>
                                <SelectItem value="400">400 - Regular</SelectItem>
                                <SelectItem value="500">500 - Medium</SelectItem>
                                <SelectItem value="600">600 - Semi Bold</SelectItem>
                                <SelectItem value="700">700 - Bold</SelectItem>
                                <SelectItem value="800">800 - Extra Bold</SelectItem>
                                <SelectItem value="900">900 - Black</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${headerLevel}-letter-spacing`}>Letter Spacing (em)</Label>
                              {headerStyle?.letterSpacing !== undefined && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resetIndividualHeaderStyle(headerLevel, 'letterSpacing')}
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
                              value={headerStyle?.letterSpacing !== undefined ? headerStyle.letterSpacing : ""}
                              onChange={(e) => updateIndividualHeaderStyle(headerLevel, { letterSpacing: parseFloat(e.target.value) || 0 })}
                              placeholder={`Inherits: ${activeScale.headerLetterSpacing || 0}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${headerLevel}-color`}>Color</Label>
                              {headerStyle?.color && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resetIndividualHeaderStyle(headerLevel, 'color')}
                                  className="text-xs h-6 px-2"
                                >
                                  Reset
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Input
                                id={`${headerLevel}-color`}
                                type="color"
                                value={headerStyle?.color || activeScale.headerColor || "#000000"}
                                onChange={(e) => updateIndividualHeaderStyle(headerLevel, { color: e.target.value })}
                                className="w-16 h-8"
                              />
                              <span className="text-xs text-muted-foreground">
                                {headerStyle?.color ? headerStyle.color : `Inherits: ${activeScale.headerColor || '#000000'}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>
        </div>
        
        <div className="asset-display__preview">
          <div className="lg:col-span-3">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-semibold">Type Scale Preview</h4>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportMutation.mutate({ format: "css" })}
                    disabled={!activeScale.id || exportMutation.isPending}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    CSS
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportMutation.mutate({ format: "scss" })}
                    disabled={!activeScale.id || exportMutation.isPending}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    SCSS
                  </Button>
                </div>
              </div>
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="mt-4">
                  <TypeScalePreview typeScale={activeScale} />
                </TabsContent>
                <TabsContent value="code" className="mt-4">
                  <Tabs defaultValue="css" className="w-full">
                    <TabsList>
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