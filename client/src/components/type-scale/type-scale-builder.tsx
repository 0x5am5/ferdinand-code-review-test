import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Code, Download, Eye, Plus, Save } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { TypeStyleEditor } from "./type-style-editor";

interface TypeScale {
  id: number;
  clientId: number;
  name: string;
  unit: "px" | "rem" | "em";
  baseSize: number;
  scaleRatio: number;
  customRatio?: number;
  responsiveSizes: {
    mobile: { baseSize: number; scaleRatio: number };
    tablet: { baseSize: number; scaleRatio: number };
    desktop: { baseSize: number; scaleRatio: number };
  };
  typeStyles: TypeStyle[];
  exports: Export[];
  createdAt: string;
  updatedAt: string;
}

interface TypeStyle {
  level: string;
  name: string;
  size: number;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  backgroundColor?: string;
  textDecoration?: string;
  fontStyle?: string;
}

interface Export {
  format: "css" | "scss" | "figma" | "adobe";
  content: string;
  fileName: string;
  exportedAt: string;
}

const SCALE_RATIOS = {
  "Major Second": 1.125,
  "Minor Third": 1.2,
  "Major Third": 1.25,
  "Perfect Fourth": 1.333,
  "Augmented Fourth": 1.414,
  "Perfect Fifth": 1.5,
  "Golden Ratio": 1.618,
  "Major Sixth": 1.667,
  "Minor Seventh": 1.778,
  "Major Seventh": 1.875,
  Octave: 2,
  Custom: 0,
};

const DEFAULT_TYPE_STYLES: TypeStyle[] = [
  {
    level: "h1",
    name: "Heading 1",
    size: 3,
    fontWeight: "700",
    lineHeight: 1.2,
    letterSpacing: 0,
    color: "#000000",
  },
  {
    level: "h2",
    name: "Heading 2",
    size: 2,
    fontWeight: "600",
    lineHeight: 1.3,
    letterSpacing: 0,
    color: "#000000",
  },
  {
    level: "h3",
    name: "Heading 3",
    size: 1,
    fontWeight: "600",
    lineHeight: 1.4,
    letterSpacing: 0,
    color: "#000000",
  },
  {
    level: "h4",
    name: "Heading 4",
    size: 0,
    fontWeight: "500",
    lineHeight: 1.4,
    letterSpacing: 0,
    color: "#000000",
  },
  {
    level: "h5",
    name: "Heading 5",
    size: -1,
    fontWeight: "500",
    lineHeight: 1.5,
    letterSpacing: 0,
    color: "#000000",
  },
  {
    level: "h6",
    name: "Heading 6",
    size: -2,
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
];

interface TypeScaleBuilderProps {
  clientId: number;
  typeScale?: TypeScale;
  onSave?: (typeScale: TypeScale) => void;
  onCancel?: () => void;
}

export function TypeScaleBuilder({
  clientId,
  typeScale,
  onSave,
  onCancel,
}: TypeScaleBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(typeScale?.name || "New Type Scale");
  const [unit, setUnit] = useState<"px" | "rem" | "em">(
    typeScale?.unit || "rem"
  );
  const [baseSize, setBaseSize] = useState(typeScale?.baseSize || 16);
  const [selectedRatio, setSelectedRatio] = useState(() => {
    if (!typeScale) return "Major Third";
    const ratio = typeScale.scaleRatio / 1000;
    const ratioEntry = Object.entries(SCALE_RATIOS).find(
      ([_, value]) => Math.abs(value - ratio) < 0.001
    );
    return ratioEntry ? ratioEntry[0] : "Custom";
  });
  const [customRatio, setCustomRatio] = useState(
    typeScale?.customRatio ? typeScale.customRatio / 1000 : 1.25
  );
  const [typeStyles, setTypeStyles] = useState<TypeStyle[]>(
    typeScale?.typeStyles || DEFAULT_TYPE_STYLES
  );
  const [activeTab, setActiveTab] = useState("builder");

  const getCurrentRatio = () => {
    if (selectedRatio === "Custom") return customRatio;
    return SCALE_RATIOS[selectedRatio as keyof typeof SCALE_RATIOS];
  };

  const calculateFontSize = (step: number) => {
    const ratio = getCurrentRatio();
    const size = Math.round(baseSize * ratio ** step * 100) / 100;
    return `${size}${unit}`;
  };

  const createTypeScaleMutation = useMutation({
    mutationFn: async (data: TypeScale) => {
      const response = await fetch(`/api/clients/${clientId}/type-scales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create type scale");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Type scale created",
        description: "Your type scale has been created successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", clientId, "type-scales"],
      });
      onSave?.(data);
    },
    onError: (error: unknown) => {
      console.error(
        "Failed to create type scale",
        error instanceof Error ? error.message : "Unknown error"
      );

      toast({
        title: "Error",
        description: "Failed to create type scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTypeScaleMutation = useMutation({
    mutationFn: async (data: TypeScale) => {
      const response = await fetch(`/api/type-scales/${typeScale?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update type scale");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Type scale updated",
        description: "Your type scale has been updated successfully.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", clientId, "type-scales"],
      });
      onSave?.(data);
    },
    onError: (error: unknown) => {
      console.error(
        "Failed to update type scale",
        error instanceof Error ? error.message : "Unknown error"
      );

      toast({
        title: "Error",
        description: "Failed to update type scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async ({ format }: { format: "css" | "scss" }) => {
      const response = await fetch(
        `/api/type-scales/${typeScale?.id}/export/${format}`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to export type scale");
      return response.json();
    },
    onSuccess: (data, variables) => {
      const blob = new Blob([data.content], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `${variables.format.toUpperCase()} file downloaded successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Export failed",
        description: "Failed to export type scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const data = {
      name,
      unit,
      baseSize,
      scaleRatio: Math.round(getCurrentRatio() * 1000),
      customRatio:
        selectedRatio === "Custom" ? Math.round(customRatio * 1000) : undefined,
      responsiveSizes: {
        mobile: {
          baseSize: Math.round(baseSize * 0.875),
          scaleRatio: getCurrentRatio() * 0.9,
        },
        tablet: {
          baseSize: Math.round(baseSize * 0.9375),
          scaleRatio: getCurrentRatio() * 0.95,
        },
        desktop: { baseSize, scaleRatio: getCurrentRatio() },
      },
      typeStyles,
      exports: typeScale?.exports || [],
    };

    if (typeScale) {
      updateTypeScaleMutation.mutate(data);
    } else {
      createTypeScaleMutation.mutate(data);
    }
  };

  const handleExport = (format: "css" | "scss") => {
    if (!typeScale?.id) {
      toast({
        title: "Save first",
        description: "Please save your type scale before exporting.",
        variant: "destructive",
      });
      return;
    }
    exportMutation.mutate({ format });
  };

  function generatePreviewCSS() {
    const ratio = getCurrentRatio();
    let css = `/* ${name} Type Scale */\n\n`;
    css += `:root {\n`;
    css += `  --type-scale-base: ${baseSize}${unit};\n`;
    css += `  --type-scale-ratio: ${ratio};\n\n`;

    typeStyles.forEach((style) => {
      const size = calculateFontSize(style.size);
      css += `  --font-size-${style.level}: ${size};\n`;
    });

    css += `}\n\n`;

    typeStyles.forEach((style) => {
      css += `.text-${style.level} {\n`;
      css += `  font-size: var(--font-size-${style.level});\n`;
      css += `  font-weight: ${style.fontWeight};\n`;
      css += `  line-height: ${style.lineHeight};\n`;
      css += `  color: ${style.color};\n`;
      css += `}\n\n`;
    });

    return css;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Type Scale Builder</h2>
        <div className="flex gap-2">
          {typeScale && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("css")}
                disabled={exportMutation.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("scss")}
                disabled={exportMutation.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                Export SCSS
              </Button>
            </>
          )}
          <Button
            onClick={handleSave}
            disabled={
              createTypeScaleMutation.isPending ||
              updateTypeScaleMutation.isPending
            }
          >
            <Save className="h-4 w-4 mr-2" />
            {typeScale ? "Update" : "Save"}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="code" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Code Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Settings Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Scale Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Scale Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter scale name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseSize">Base Size</Label>
                    <Input
                      id="baseSize"
                      type="number"
                      value={baseSize}
                      onChange={(e) => setBaseSize(Number(e.target.value))}
                      min="8"
                      max="72"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={unit}
                      onValueChange={(value: "px" | "rem" | "em") =>
                        setUnit(value)
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
                  <Label htmlFor="ratio">Scale Ratio</Label>
                  <Select
                    value={selectedRatio}
                    onValueChange={setSelectedRatio}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCALE_RATIOS).map(([name, ratio]) => (
                        <SelectItem key={name} value={name}>
                          {name} {ratio > 0 && `(${ratio})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRatio === "Custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="customRatio">Custom Ratio</Label>
                    <div className="space-y-2">
                      <Slider
                        value={[customRatio]}
                        onValueChange={([value]) => setCustomRatio(value)}
                        min={1}
                        max={3}
                        step={0.001}
                        className="w-full"
                      />
                      <div className="text-sm text-muted-foreground text-center">
                        {customRatio.toFixed(3)}
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label>Preview Scale</Label>
                  <div className="space-y-1">
                    {[-2, -1, 0, 1, 2, 3].map((step) => (
                      <div key={step} className="flex justify-between text-sm">
                        <span>Step {step}:</span>
                        <Badge variant="outline">
                          {calculateFontSize(step)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Type Styles Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Type Styles</CardTitle>
              </CardHeader>
              <CardContent>
                <TypeStyleEditor
                  typeStyles={typeStyles}
                  onUpdate={setTypeStyles}
                  calculateFontSize={calculateFontSize}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <TypeScalePreview
            typeScale={{
              typeStyles,
              baseSize,
              scaleRatio: getCurrentRatio(),
              unit,
            }}
          />
        </TabsContent>

        <TabsContent value="code">
          <Card>
            <CardHeader>
              <CardTitle>Generated CSS</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                <code>{generatePreviewCSS()}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
