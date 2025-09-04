import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

interface TypeStyleEditorProps {
  typeStyles: TypeStyle[];
  onUpdate: (typeStyles: TypeStyle[]) => void;
  calculateFontSize: (step: number) => string;
}

const FONT_WEIGHTS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

const TEXT_DECORATIONS = [
  { value: "none", label: "None" },
  { value: "underline", label: "Underline" },
  { value: "overline", label: "Overline" },
  { value: "line-through", label: "Line Through" },
];

const FONT_STYLES = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Italic" },
  { value: "oblique", label: "Oblique" },
];

export function TypeStyleEditor({
  typeStyles,
  onUpdate,
  calculateFontSize,
}: TypeStyleEditorProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (level: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedItems(newExpanded);
  };

  const updateTypeStyle = (index: number, updates: Partial<TypeStyle>) => {
    const newTypeStyles = [...typeStyles];
    newTypeStyles[index] = { ...newTypeStyles[index], ...updates };
    onUpdate(newTypeStyles);
  };

  const _getDefaultStyleForLevel = (level: string): Partial<TypeStyle> => {
    const defaults: Record<string, Partial<TypeStyle>> = {
      "body-large": { size: 0.5, fontWeight: "400", name: "Body Large" },
      "body-small": { size: -0.5, fontWeight: "400", name: "Body Small" },
      caption: { size: -1, fontWeight: "400", name: "Caption" },
      quote: { size: 1, fontWeight: "400", name: "Quote", fontStyle: "italic" },
      code: { size: -0.5, fontWeight: "400", name: "Code" },
    };
    return defaults[level] || {};
  };

  const addTypeStyle = () => {
    const newStyle: TypeStyle = {
      level: `custom-${typeStyles.length + 1}`,
      name: `Custom Style ${typeStyles.length + 1}`,
      size: 0,
      fontWeight: "400",
      lineHeight: 1.5,
      letterSpacing: 0,
      color: "#000000",
    };
    onUpdate([...typeStyles, newStyle]);
  };

  const removeTypeStyle = (index: number) => {
    const newTypeStyles = typeStyles.filter((_, i) => i !== index);
    onUpdate(newTypeStyles);
  };

  const getPreviewStyle = (style: TypeStyle) => ({
    fontSize: calculateFontSize(style.size),
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}px`,
    color: style.color,
    backgroundColor: style.backgroundColor || "transparent",
    textDecoration: style.textDecoration || "none",
    fontStyle: style.fontStyle || "normal",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Type Styles</h3>
        <Button onClick={addTypeStyle} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Style
        </Button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {typeStyles.map((style, index) => (
            <motion.div
              key={style.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="overflow-hidden">
                <Collapsible
                  open={expandedItems.has(style.level)}
                  onOpenChange={() => toggleExpanded(style.level)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="p-4 hover:bg-gray-50 cursor-pointer border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedItems.has(style.level) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Badge variant="outline">
                            {style.level.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{style.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {calculateFontSize(style.size)}
                          </Badge>
                          {typeStyles.length > 1 && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTypeStyle(index);
                              }}
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div
                          style={getPreviewStyle(style)}
                          className="truncate"
                        >
                          {style.name} - The quick brown fox jumps
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="p-4 pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`name-${index}`}>Style Name</Label>
                          <Input
                            id={`name-${index}`}
                            value={style.name}
                            onChange={(e) =>
                              updateTypeStyle(index, { name: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`level-${index}`}>Level</Label>
                          <Input
                            id={`level-${index}`}
                            value={style.level}
                            onChange={(e) =>
                              updateTypeStyle(index, { level: e.target.value })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`size-${index}`}>Size Step</Label>
                          <div className="space-y-2">
                            <Slider
                              value={[style.size]}
                              onValueChange={([value]) =>
                                updateTypeStyle(index, { size: value })
                              }
                              min={-6}
                              max={6}
                              step={1}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>-6</span>
                              <span className="font-medium">{style.size}</span>
                              <span>+6</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`weight-${index}`}>Font Weight</Label>
                          <Select
                            value={style.fontWeight}
                            onValueChange={(value) =>
                              updateTypeStyle(index, { fontWeight: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FONT_WEIGHTS.map((weight) => (
                                <SelectItem
                                  key={weight.value}
                                  value={weight.value}
                                >
                                  {weight.label} ({weight.value})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`lineHeight-${index}`}>
                            Line Height
                          </Label>
                          <div className="space-y-2">
                            <Slider
                              value={[style.lineHeight]}
                              onValueChange={([value]) =>
                                updateTypeStyle(index, { lineHeight: value })
                              }
                              min={0.8}
                              max={2.5}
                              step={0.1}
                              className="w-full"
                            />
                            <div className="text-center text-sm text-muted-foreground">
                              {style.lineHeight.toFixed(1)}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`letterSpacing-${index}`}>
                            Letter Spacing (px)
                          </Label>
                          <div className="space-y-2">
                            <Slider
                              value={[style.letterSpacing]}
                              onValueChange={([value]) =>
                                updateTypeStyle(index, { letterSpacing: value })
                              }
                              min={-2}
                              max={5}
                              step={0.1}
                              className="w-full"
                            />
                            <div className="text-center text-sm text-muted-foreground">
                              {style.letterSpacing.toFixed(1)}px
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`color-${index}`}>Text Color</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`color-${index}`}
                              type="color"
                              value={style.color}
                              onChange={(e) =>
                                updateTypeStyle(index, {
                                  color: e.target.value,
                                })
                              }
                              className="w-16 h-10 p-1 rounded"
                            />
                            <Input
                              value={style.color}
                              onChange={(e) =>
                                updateTypeStyle(index, {
                                  color: e.target.value,
                                })
                              }
                              placeholder="#000000"
                              className="flex-1"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`backgroundColor-${index}`}>
                            Background Color
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`backgroundColor-${index}`}
                              type="color"
                              value={style.backgroundColor || "#ffffff"}
                              onChange={(e) =>
                                updateTypeStyle(index, {
                                  backgroundColor: e.target.value,
                                })
                              }
                              className="w-16 h-10 p-1 rounded"
                            />
                            <Input
                              value={style.backgroundColor || ""}
                              onChange={(e) =>
                                updateTypeStyle(index, {
                                  backgroundColor: e.target.value,
                                })
                              }
                              placeholder="Transparent"
                              className="flex-1"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`decoration-${index}`}>
                            Text Decoration
                          </Label>
                          <Select
                            value={style.textDecoration || "none"}
                            onValueChange={(value) =>
                              updateTypeStyle(index, { textDecoration: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TEXT_DECORATIONS.map((decoration) => (
                                <SelectItem
                                  key={decoration.value}
                                  value={decoration.value}
                                >
                                  {decoration.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`fontStyle-${index}`}>
                            Font Style
                          </Label>
                          <Select
                            value={style.fontStyle || "normal"}
                            onValueChange={(value) =>
                              updateTypeStyle(index, { fontStyle: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FONT_STYLES.map((fontStyle) => (
                                <SelectItem
                                  key={fontStyle.value}
                                  value={fontStyle.value}
                                >
                                  {fontStyle.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <Label className="text-sm font-medium mb-2 block">
                          Preview
                        </Label>
                        <div
                          style={getPreviewStyle(style)}
                          className="transition-all duration-200"
                        >
                          {style.name} - The quick brown fox jumps over the lazy
                          dog. Typography is the art and technique of arranging
                          type to make written language legible, readable, and
                          appealing.
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
