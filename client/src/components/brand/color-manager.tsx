import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Edit2,
  Info,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import "../../styles/components/color-picker-popover.scss";
import { zodResolver } from "@hookform/resolvers/zod";
import { type BrandAsset, UserRole } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type ColorData, colorDescriptions } from "@/types/color";
import {
  extractBrandColorProperties,
  generateContainerColors,
  generateInteractiveColors,
  generateNeutralPalette,
  generateTintsAndShades,
  hexToCmyk,
  hexToHsl,
  hexToRgb,
  hslToHex,
} from "@/utils/color-utils";
import { AssetSection } from "./asset-section";
import { ColorChip } from "./ColorChip";

// ColorCard component for the color manager
function ColorCard({
  color,
  onEdit: _onEdit,
  onDelete,
  onGenerate,
  neutralColorsCount,
  onUpdate,
  clientId,
}: {
  color: BrandAsset;
  onEdit: (color: BrandAsset) => void;
  onDelete: (id: number) => void;
  onGenerate?: () => void;
  neutralColorsCount?: number;
  onUpdate?: (
    colorId: number,
    updates: { hex: string; rgb?: string; hsl?: string; cmyk?: string }
  ) => void;
  clientId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTints, setShowTints] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [pantoneValue, setPantoneValue] = useState("");
  const [copiedFormats, setCopiedFormats] = useState<Record<string, boolean>>(
    {}
  );

  // Load saved Pantone value on mount
  useEffect(() => {
    const savedPantone = localStorage.getItem(`pantone-${color.id}`);
    if (savedPantone) {
      setPantoneValue(savedPantone);
    }
  }, [color.id]);

  // Save Pantone value when it changes
  const handlePantoneChange = (value: string) => {
    setPantoneValue(value);
    localStorage.setItem(`pantone-${color.id}`, value);
  };

  // Add updateColor mutation to ColorCard component
  const updateColor = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      category: string;
      data: unknown;
    }) => {
      const response = await fetch(
        `/api/clients/${clientId}/assets/${data.id}`,
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
        queryKey: [`/api/clients/${clientId}/assets`],
      });

      // Snapshot the previous value
      const previousAssets = queryClient.getQueryData([
        `/api/clients/${clientId}/assets`,
      ]);

      // Optimistically update the cache
      queryClient.setQueryData(
        [`/api/clients/${clientId}/assets`],
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
        [`/api/clients/${clientId}/assets`],
        context?.previousAssets
      );

      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Color updated!",
        description: `${color.name} has been updated successfully.`,
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
      });
    },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempColor, setTempColor] = useState(color.hex);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(color.name);
  const [activeTab, setActiveTab] = useState<"color" | "gradient">("color");
  const [gradientType, setGradientType] = useState<"linear" | "radial">(
    "linear"
  );
  const [gradientStops, setGradientStops] = useState([
    { color: "#D9D9D9", position: 0 },
    { color: "#737373", position: 100 },
  ]);

  const _handleColorAreaClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    // Simple color calculation for responsive color picker
    const hue = 200; // Default blue
    const saturation = Math.round(x * 100);
    const lightness = Math.round((1 - y) * 100);

    // Convert HSL to hex
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    };

    const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    setTempColor(hexColor);
  };

  const _handleHueSliderClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const hue = Math.round(x * 360);

    // Simple hue change
    const hexColor = `hsl(${hue}, 80%, 60%)`;
    // Convert to actual hex - simplified version
    const tempDiv = document.createElement("div");
    tempDiv.style.color = hexColor;
    document.body.appendChild(tempDiv);
    const computedColor = getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);

    // Extract RGB values and convert to hex
    const rgb = computedColor.match(/\d+/g);
    if (rgb) {
      const hex = `#${parseInt(rgb[0], 10).toString(16).padStart(2, "0")}${parseInt(rgb[1], 10).toString(16).padStart(2, "0")}${parseInt(rgb[2], 10).toString(16).padStart(2, "0")}`;
      setTempColor(hex);
    }
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
      setTempColor(value);
    }
  };

  // Color picker state
  const [_hue, _setHue] = useState(0);
  const [_saturation, _setSaturation] = useState(100);
  const [_brightness, _setBrightness] = useState(50);
  const _spectrumRef = useRef<HTMLDivElement>(null);
  const [_isDragging, _setIsDragging] = useState(false);

  const copyHex = (hexValue: string) => {
    navigator.clipboard.writeText(hexValue);
    toast({
      title: "Copied!",
      description: `${hexValue} has been copied to your clipboard.`,
    });
  };

  const _handleColorChange = (newHex: string) => {
    setTempColor(newHex);
    // Only update the visual display, don't save to database until Save is clicked
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
    setTempName(color.name);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (tempName.trim() !== color.name && tempName.trim() !== "") {
      // Update the color name using the updateColor mutation
      if (color.id) {
        const currentData =
          typeof color.data === "string" ? JSON.parse(color.data) : color.data;
        updateColor.mutate({
          id: color.id,
          name: tempName.trim(),
          category: "color",
          data: currentData,
        });
      }
    } else {
      setTempName(color.name); // Reset if empty or unchanged
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur(); // Trigger blur to save
    } else if (e.key === "Escape") {
      setTempName(color.name);
      setIsEditingName(false);
    }
  };

  const handleStartEdit = () => {
    setTempColor(color.hex);
    setIsEditing(true);

    // Load existing gradient data if available
    if (color.data?.gradient) {
      setActiveTab("gradient");
      setGradientType(color.data.gradient.type || "linear");
      setGradientStops(
        color.data.gradient.stops || [
          { color: "#D9D9D9", position: 0 },
          { color: "#737373", position: 100 },
        ]
      );
    } else {
      setActiveTab("color");
    }
  };

  const _handleEditColor = (colorToEdit: ColorData) => {
    setTempColor(colorToEdit.hex);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const currentData =
      typeof color.data === "string" ? JSON.parse(color.data) : color.data;

    if (activeTab === "color") {
      // Save solid color
      const newData = {
        type: "solid",
        category: currentData?.category || "brand",
        colors: [
          {
            hex: tempColor,
            rgb: hexToRgb(tempColor) || "",
            hsl: hexToHsl(tempColor) || "",
            cmyk: hexToCmyk(tempColor) || "",
          },
        ],
        // Remove gradient data when switching to solid
        ...(currentData?.tints && { tints: currentData.tints }),
        ...(currentData?.shades && { shades: currentData.shades }),
      };

      updateColor.mutate(
        {
          id: color.id,
          name: color.name,
          category: "color",
          data: newData,
        },
        {
          onSuccess: () => {
            // Update local color data immediately
            if (onUpdate) {
              onUpdate(color.id, {
                hex: tempColor,
                rgb: hexToRgb(tempColor) || "",
                hsl: hexToHsl(tempColor) || "",
                cmyk: hexToCmyk(tempColor) || "",
              });
            }
          },
        }
      );
    } else if (activeTab === "gradient") {
      // Save gradient data
      const gradientData = {
        type: gradientType,
        stops: gradientStops.sort((a, b) => a.position - b.position),
      };

      const newData = {
        type: "gradient",
        category: currentData?.category || "brand",
        colors: [
          {
            hex: gradientStops[0]?.color || color.hex,
            rgb: hexToRgb(gradientStops[0]?.color || color.hex) || "",
            hsl: hexToHsl(gradientStops[0]?.color || color.hex) || "",
            cmyk: hexToCmyk(color.hex) || "",
          },
        ],
        gradient: gradientData,
        ...(currentData?.tints && { tints: currentData.tints }),
        ...(currentData?.shades && { shades: currentData.shades }),
      };

      updateColor.mutate(
        {
          id: color.id,
          name: color.name,
          category: "color",
          data: newData,
        },
        {
          onSuccess: () => {
            // Update local color data immediately
            if (onUpdate) {
              onUpdate(color.id, {
                hex: gradientStops[0]?.color || color.hex,
                rgb: hexToRgb(gradientStops[0]?.color || color.hex) || "",
                hsl: hexToHsl(gradientStops[0]?.color || color.hex) || "",
                cmyk: hexToCmyk(color.hex) || "",
              });
            }
          },
        }
      );
    }

    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setTempColor(color.hex);
    setIsEditing(false);
    if (onUpdate) {
      // Revert to original color
      const updates = {
        hex: color.hex,
        rgb: hexToRgb(color.hex) || undefined,
        hsl: hexToHsl(color.hex) || undefined,
        cmyk: hexToCmyk(color.hex) || undefined,
      };
      onUpdate(color.id, updates);
    }
  };

  // Generate tints and shades and handle gradient display
  const displayHex = isEditing ? tempColor : color.hex;
  const { tints, shades } = generateTintsAndShades(displayHex);

  // Create real-time gradient display
  const getDisplayStyle = () => {
    if (isEditing && activeTab === "gradient") {
      // Show live gradient while editing
      return {
        background: `${gradientType === "radial" ? "radial" : "linear"}-gradient(${
          gradientType === "radial" ? "circle" : "to right"
        }, ${gradientStops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")})`,
      };
    } else if (color.data?.gradient) {
      // Show saved gradient
      return {
        background: `${color.data.gradient.type === "radial" ? "radial" : "linear"}-gradient(${
          color.data.gradient.type === "radial" ? "circle" : "to right"
        }, ${(color.data as { gradient: { stops: { color: string; position: number }[] } }).gradient.stops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")})`,
      };
    } else {
      // Show solid color
      return { backgroundColor: displayHex };
    }
  };

  return (
    <div className="color-chip-container relative">
      <motion.div
        className="color-chip"
        style={getDisplayStyle()}
        animate={{
          width: showTints ? "60%" : "100%",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="color-chip__info">
          {isEditingName ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="color-chip--title bg-transparent border-none outline-none w-full"
              style={{
                color:
                  parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                    ? "#000"
                    : "#fff",
              }}
            />
          ) : (
            <h5
              className="color-chip--title cursor-pointer font-semibold hover:opacity-80 transition-opacity"
              style={{
                color:
                  parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                    ? "#000"
                    : "#fff",
              }}
              onClick={handleNameEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleNameEdit();
                }
              }}
              title="Click to edit name"
            >
              {color.name}
            </h5>
          )}
          <p
            className="text-xs font-mono cursor-pointer hover:bg-black/10 hover:bg-white/10 rounded px-1 py-0.5 transition-colors"
            style={{
              color:
                parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                  ? "#000"
                  : "#fff",
            }}
            onClick={handleStartEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleStartEdit();
              }
            }}
            title="Click to edit color"
          >
            {displayHex}
          </p>
        </div>

        <div className="color-chip__controls" style={{ position: "relative" }}>
          {color.category === "neutral" &&
            onGenerate &&
            !/^Grey \d+$/.test(color.name) && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 p-2 ${parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2 ? "" : "dark-bg"}`}
                onClick={onGenerate}
                title={
                  neutralColorsCount && neutralColorsCount >= 11
                    ? "Re-generate grey shades"
                    : "Generate grey shades"
                }
              >
                <RotateCcw
                  className="h-6 w-6"
                  style={{
                    color:
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#000"
                        : "#fff",
                  }}
                />
              </Button>
            )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 p-2 ${parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2 ? "" : "dark-bg"}`}
                  onClick={() => {
                    if (showTints) setShowTints(false);
                    setIsInfoPanelOpen(!isInfoPanelOpen);
                  }}
                >
                  <Info
                    className="h-6 w-6"
                    style={{
                      color:
                        parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                          ? "#000"
                          : "#fff",
                    }}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>More Color Info</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {color.category !== "neutral" && color.data.type !== "gradient" && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 p-2 ${parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2 ? "" : "dark-bg"}`}
              onClick={() => setShowTints(!showTints)}
              title={showTints ? "Hide tints/shades" : "Show tints/shades"}
            >
              <Palette
                className="h-6 w-6"
                style={{
                  color:
                    parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                      ? "#000"
                      : "#fff",
                }}
              />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 p-2 ${parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2 ? "" : "dark-bg"}`}
            onClick={() => copyHex(color.hex)}
          >
            <Copy
              className="h-6 w-6"
              style={{
                color:
                  parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                    ? "#000"
                    : "#fff",
              }}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 p-2 ${parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2 ? "" : "dark-bg"}`}
            onClick={handleStartEdit}
          >
            <Edit2
              className="h-6 w-6"
              style={{
                color:
                  parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                    ? "#000"
                    : "#fff",
              }}
            />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 p-2 ${parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2 ? "" : "dark-bg"}`}
              >
                <Trash2
                  className="h-6 w-6"
                  style={{
                    color:
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#000"
                        : "#fff",
                  }}
                />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Color</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{color.name}"? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(color.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </motion.div>

      {/* Color Picker Popover - Outside color-chip to prevent opacity issues */}
      {isEditing && (
        <div
          className="color-picker-popover"
          style={{
            zIndex: 1000,
          }}
        >
          <div className="color-picker-popover__header">
            <h4>Edit Color</h4>
            <button
              type="button"
              className="color-picker-popover__close-button"
              onClick={handleCancelEdit}
            >
              <X />
            </button>
          </div>

          {/* Tabs */}
          <div className="color-picker-popover__tabs">
            <button
              type="button"
              className={`color-picker-popover__tab ${activeTab === "color" ? "active" : ""}`}
              onClick={() => setActiveTab("color")}
            >
              Color
            </button>
            <button
              type="button"
              className={`color-picker-popover__tab ${activeTab === "gradient" ? "active" : ""}`}
              onClick={() => setActiveTab("gradient")}
            >
              Gradient
            </button>
          </div>

          <div className="color-picker-popover__content">
            {activeTab === "color" ? (
              <>
                {/* Native Color Picker Input */}
                <div className="color-picker-popover__color-section">
                  <input
                    type="color"
                    value={tempColor}
                    onChange={(e) => setTempColor(e.target.value)}
                    className="color-picker-popover__color-input"
                  />
                </div>

                {/* Hex input */}
                <div className="color-picker-popover__hex-input">
                  <label htmlFor={`hex-input-${color.id}`}>Hex:</label>
                  <input
                    id={`hex-input-${color.id}`}
                    type="text"
                    value={tempColor}
                    onChange={handleHexInputChange}
                    placeholder="#000000"
                  />
                </div>
              </>
            ) : (
              <div className="color-picker-popover__gradient-section">
                {/* Gradient Type Selector */}
                <div className="color-picker-popover__gradient-type">
                  <select
                    value={gradientType}
                    onChange={(e) =>
                      setGradientType(e.target.value as "linear" | "radial")
                    }
                    className="gradient-type-select"
                  >
                    <option value="linear">Linear</option>
                    <option value="radial">Radial</option>
                  </select>
                </div>

                {/* Gradient Preview Bar */}
                <div
                  className="color-picker-popover__gradient-preview"
                  role="slider"
                  tabIndex={0}
                  aria-label="Gradient preview - click to add color stops"
                  aria-valuenow={gradientStops.length}
                  aria-valuemin={0}
                  aria-valuemax={10}
                  style={{
                    background: `linear-gradient(to right, ${gradientStops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")})`,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const position = Math.round(
                      ((e.clientX - rect.left) / rect.width) * 100
                    );
                    const newColor =
                      gradientStops.length > 0
                        ? gradientStops[0].color
                        : "#000000";
                    setGradientStops([
                      ...gradientStops,
                      { color: newColor, position },
                    ]);
                  }}
                >
                  {/* Color Stop Handles */}
                  {gradientStops.map((stop, index) => (
                    <button
                      key={`stop-handle-${stop.position}-${stop.color}-${index}`}
                      className="gradient-stop-handle"
                      type="button"
                      tabIndex={0}
                      aria-label={`Color stop ${index + 1} at ${stop.position}% - drag to move`}
                      style={{
                        left: `${stop.position}%`,
                        backgroundColor: stop.color,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();

                        const _startPosition = stop.position;
                        const rect =
                          e.currentTarget.parentElement?.getBoundingClientRect();

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const newPosition = Math.max(
                            0,
                            Math.min(
                              100,
                              ((moveEvent.clientX - rect.left) / rect.width) *
                                100
                            )
                          );

                          const newStops = [...gradientStops];
                          newStops[index].position = Math.round(newPosition);
                          setGradientStops(newStops);
                        };

                        const handleMouseUp = () => {
                          document.removeEventListener(
                            "mousemove",
                            handleMouseMove
                          );
                          document.removeEventListener(
                            "mouseup",
                            handleMouseUp
                          );
                        };

                        document.addEventListener("mousemove", handleMouseMove);
                        document.addEventListener("mouseup", handleMouseUp);
                      }}
                    />
                  ))}
                </div>

                {/* Stops Section */}
                <div className="color-picker-popover__gradient-stops">
                  <div className="gradient-stops-header">
                    <span>Stops</span>
                    <button
                      type="button"
                      className="add-stop-button"
                      onClick={() => {
                        const newPosition =
                          gradientStops.length > 0
                            ? Math.min(
                                100,
                                Math.max(
                                  ...gradientStops.map((s) => s.position)
                                ) + 20
                              )
                            : 50;
                        setGradientStops([
                          ...gradientStops,
                          { color: "#000000", position: newPosition },
                        ]);
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Individual Stop Controls */}
                  {gradientStops.map((stop, index) => (
                    <div
                      key={`stop-control-${stop.position}-${stop.color}-${index}`}
                      className="gradient-stop-control"
                    >
                      <div className="stop-position">
                        <input
                          type="number"
                          value={stop.position}
                          onChange={(e) => {
                            const newStops = [...gradientStops];
                            newStops[index].position = Math.max(
                              0,
                              Math.min(100, parseInt(e.target.value, 10) || 0)
                            );
                            setGradientStops(newStops);
                          }}
                          min="0"
                          max="100"
                        />
                        <span>%</span>
                      </div>

                      <button
                        type="button"
                        className="stop-color-preview"
                        aria-label={`Change color for stop ${index + 1}`}
                        style={{ backgroundColor: stop.color }}
                        onClick={() => {
                          const colorInput = document.querySelector(
                            `input[data-stop-index="${index}"]`
                          ) as HTMLInputElement;
                          if (colorInput) colorInput.click();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            const colorInput = document.querySelector(
                              `input[data-stop-index="${index}"]`
                            ) as HTMLInputElement;
                            if (colorInput) colorInput.click();
                          }
                        }}
                      />

                      <input
                        type="color"
                        value={stop.color}
                        onChange={(e) => {
                          const newStops = [...gradientStops];
                          newStops[index].color = e.target.value;
                          setGradientStops(newStops);
                        }}
                        className="stop-color-input"
                        data-stop-index={index}
                      />

                      <input
                        type="number"
                        value={parseInt(stop.color.substring(1, 3), 16)}
                        onChange={(e) => {
                          const newStops = [...gradientStops];
                          const hex = Math.max(
                            0,
                            Math.min(255, parseInt(e.target.value, 10) || 0)
                          )
                            .toString(16)
                            .padStart(2, "0");
                          newStops[index].color =
                            `#${hex}${stop.color.substring(3)}`;
                          setGradientStops(newStops);
                        }}
                        min="0"
                        max="255"
                        className="color-value-input"
                      />

                      {gradientStops.length > 2 && (
                        <button
                          type="button"
                          className="remove-stop-button"
                          onClick={() => {
                            setGradientStops(
                              gradientStops.filter((_, i) => i !== index)
                            );
                          }}
                        >
                          −
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Save button with icon - left aligned */}
          <div className="color-picker-popover__actions">
            <button
              type="button"
              className="color-picker-popover__save-button"
              onClick={handleSaveEdit}
            >
              <Check />
              Save
            </button>
          </div>
        </div>
      )}

      {/* Tints and Shades Panel */}
      <AnimatePresence>
        {showTints && (
          <motion.div
            className="absolute top-0 right-0 w-[40%] h-full flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {/* Tints Row (Lighter) */}
            <div className="flex h-1/2">
              {tints.map((tint, _index) => (
                <motion.div
                  key={`tint-${tint}`}
                  className="flex-1 relative group cursor-pointer"
                  style={{ backgroundColor: tint }}
                  onClick={() => copyHex(tint)}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 bg-black/20 group-hover:opacity-100 transition-opacity">
                    <Copy className="h-3 w-3 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Shades Row (Darker) */}
            <div className="flex h-1/2">
              {shades.map((shade, _index) => (
                <motion.div
                  key={`shade-${shade}`}
                  className="flex-1 relative group cursor-pointer"
                  style={{ backgroundColor: shade }}
                  onClick={() => copyHex(shade)}
                >
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0```text
 bg-black/20 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3 w-3 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color Information Panel */}
      <AnimatePresence>
        {isInfoPanelOpen && (
          <motion.div
            className="absolute top-0 right-0 w-[50%] h-full backdrop-blur-sm border-l p-2 flex flex-col"
            style={{
              backgroundColor: `${displayHex}E6`, // 90% opacity of the color
              borderLeftColor:
                parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                  ? "#00000020"
                  : "#ffffff20",
            }}
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Close Button */}
            <div className="flex justify-end mb-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 absolute top-5 left-[-50px] hover:bg-black/10 hover:bg-white/10"
                onClick={() => setIsInfoPanelOpen(false)}
                style={{
                  color:
                    parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                      ? "#000"
                      : "#fff",
                }}
              >
                <X className="h-7 w-7" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* RGB */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium w-16"
                  style={{
                    color:
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#000"
                        : "#fff",
                  }}
                >
                  RGB
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const rgb = hexToRgb(displayHex);
                    if (rgb) {
                      navigator.clipboard.writeText(rgb);
                      setCopiedFormats((prev) => ({
                        ...prev,
                        [`${color.id}-rgb`]: true,
                      }));
                      setTimeout(
                        () =>
                          setCopiedFormats((prev) => ({
                            ...prev,
                            [`${color.id}-rgb`]: false,
                          })),
                        2000
                      );
                      toast({
                        title: "Copied!",
                        description: `${rgb} has been copied to your clipboard.`,
                      });
                    }
                  }}
                  className="flex-1 flex items-center justify-between px-2 py-1 rounded transition-colors group"
                  style={{
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#00000010"
                        : "#ffffff10";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    className="text-xs font-mono"
                    style={{
                      color:
                        parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                          ? "#000"
                          : "#fff",
                    }}
                  >
                    {(() => {
                      const rgb = hexToRgb(displayHex);
                      return rgb
                        ? rgb.replace("rgb(", "").replace(")", "")
                        : "";
                    })()}
                  </span>
                  {copiedFormats[`${color.id}-rgb`] ? (
                    <Check
                      className="h-3 w-3"
                      style={{
                        color:
                          parseInt(displayHex.replace("#", ""), 16) >
                          0xffffff / 2
                            ? "#22c55e"
                            : "#4ade80",
                      }}
                    />
                  ) : (
                    <Copy
                      className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        color:
                          parseInt(displayHex.replace("#", ""), 16) >
                          0xffffff / 2
                            ? "#00000080"
                            : "#ffffff80",
                      }}
                    />
                  )}
                </button>
              </div>

              {/* HSL */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium w-16"
                  style={{
                    color:
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#000"
                        : "#fff",
                  }}
                >
                  HSL
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const hsl = hexToHsl(displayHex);
                    if (hsl) {
                      navigator.clipboard.writeText(hsl);
                      setCopiedFormats((prev) => ({
                        ...prev,
                        [`${color.id}-hsl`]: true,
                      }));
                      setTimeout(
                        () =>
                          setCopiedFormats((prev) => ({
                            ...prev,
                            [`${color.id}-hsl`]: false,
                          })),
                        2000
                      );
                      toast({
                        title: "Copied!",
                        description: `${hsl} has been copied to your clipboard.`,
                      });
                    }
                  }}
                  className="flex-1 flex items-center justify-between px-2 py-1 rounded transition-colors group"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#00000010"
                        : "#ffffff10";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    className="text-xs font-mono"
                    style={{
                      color:
                        parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                          ? "#000"
                          : "#fff",
                    }}
                  >
                    {(() => {
                      const hsl = hexToHsl(displayHex);
                      return hsl
                        ? hsl.replace("hsl(", "").replace(")", "")
                        : "";
                    })()}
                  </span>
                  {copiedFormats[`${color.id}-hsl`] ? (
                    <Check
                      className="h-3 w-3"
                      style={{
                        color:
                          parseInt(displayHex.replace("#", ""), 16) >
                          0xffffff / 2
                            ? "#22c55e"
                            : "#4ade80",
                      }}
                    />
                  ) : (
                    <Copy
                      className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        color:
                          parseInt(displayHex.replace("#", ""), 16) >
                          0xffffff / 2
                            ? "#00000080"
                            : "#ffffff80",
                      }}
                    />
                  )}
                </button>
              </div>

              {/* CMYK */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium w-16"
                  style={{
                    color:
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#000"
                        : "#fff",
                  }}
                >
                  CMYK
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const cmyk = hexToCmyk(displayHex);
                    if (cmyk) {
                      navigator.clipboard.writeText(cmyk);
                      setCopiedFormats((prev) => ({
                        ...prev,
                        [`${color.id}-cmyk`]: true,
                      }));
                      setTimeout(
                        () =>
                          setCopiedFormats((prev) => ({
                            ...prev,
                            [`${color.id}-cmyk`]: false,
                          })),
                        2000
                      );
                      toast({
                        title: "Copied!",
                        description: `${cmyk} has been copied to your clipboard.`,
                      });
                    }
                  }}
                  className="flex-1 flex items-center justify-between px-2 py-1 rounded transition-colors group"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#00000010"
                        : "#ffffff10";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    className="text-xs font-mono"
                    style={{
                      color:
                        parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                          ? "#000"
                          : "#fff",
                    }}
                  >
                    {(() => {
                      const cmyk = hexToCmyk(displayHex);
                      return cmyk
                        ? cmyk.replace("cmyk(", "").replace(")", "")
                        : "";
                    })()}
                  </span>
                  {copiedFormats[`${color.id}-cmyk`] ? (
                    <Check
                      className="h-3 w-3"
                      style={{
                        color:
                          parseInt(displayHex.replace("#", ""), 16) >
                          0xffffff / 2
                            ? "#22c55e"
                            : "#4ade80",
                      }}
                    />
                  ) : (
                    <Copy
                      className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        color:
                          parseInt(displayHex.replace("#", ""), 16) >
                          0xffffff / 2
                            ? "#00000080"
                            : "#ffffff80",
                      }}
                    />
                  )}
                </button>
              </div>

              {/* Pantone */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium w-16"
                  style={{
                    color:
                      parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                        ? "#000"
                        : "#fff",
                  }}
                >
                  Pantone
                </span>
                <div className="flex flex-1 pl-2 items-center gap-2">
                  <input
                    type="text"
                    value={pantoneValue}
                    onChange={(e) => handlePantoneChange(e.target.value)}
                    placeholder="PMS1234"
                    className="px-2 text-xs py-1 w-full text-sm rounded focus:outline-none focus:ring-1"
                    style={{
                      backgroundColor:
                        parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                          ? "#ffffff20"
                          : "#00000020",
                      border: `1px solid ${parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2 ? "#00000040" : "#ffffff40"}`,
                      color:
                        parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                          ? "#000"
                          : "#fff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (pantoneValue) {
                        navigator.clipboard.writeText(pantoneValue);
                        setCopiedFormats((prev) => ({
                          ...prev,
                          [`${color.id}-pantone`]: true,
                        }));
                        setTimeout(
                          () =>
                            setCopiedFormats((prev) => ({
                              ...prev,
                              [`${color.id}-pantone`]: false,
                            })),
                          2000
                        );
                        toast({
                          title: "Copied!",
                          description: `${pantoneValue} has been copied to your clipboard.`,
                        });
                      }
                    }}
                    disabled={!pantoneValue}
                    className="p-1 rounded transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (pantoneValue) {
                        e.currentTarget.style.backgroundColor =
                          parseInt(displayHex.replace("#", ""), 16) >
                          0xffffff / 2
                            ? "#00000010"
                            : "#ffffff10";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {copiedFormats[`${color.id}-pantone`] ? (
                      <Check
                        className="h-3 w-3"
                        style={{
                          color:
                            parseInt(displayHex.replace("#", ""), 16) >
                            0xffffff / 2
                              ? "#22c55e"
                              : "#4ade80",
                        }}
                      />
                    ) : (
                      <Copy
                        className="h-3 w-3"
                        style={{
                          color:
                            parseInt(displayHex.replace("#", ""), 16) >
                            0xffffff / 2
                              ? "#00000080"
                              : "#ffffff80",
                        }}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Utility functions are now imported from color-utils.ts
// ColorBlock and ColorChip components are now imported from separate files

function _ColorSection({
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {colors.map((color) => (
              <ColorChip
                key={color.id || `color-${color.hex}-${color.name}`}
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
  const [regenerationCount, setRegenerationCount] = useState(0);
  // We don't need an extra state since colors are derived from props

  // Color utility functions
  const _ColorUtils = {
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
    generateGreyShades(
      existingColors: Array<ColorData & { brightness: number }>
    ) {
      const existingLevels = existingColors.map((c) => c.brightness);
      const newShades: Array<{ level: number; hex: string }> = [];

      // Generate shades for missing levels (1-11)
      for (let i = 1; i <= 11; i++) {
        if (!existingLevels.includes(i)) {
          // Calculate brightness percentage (0-100)
          const brightness = ((i - 1) / 10) * 100;

          // Generate hex color
          const value = Math.round((brightness / 100) * 255);
          const hex = `#${value.toString(16).padStart(2, "0")}${value.toString(16).padStart(2, "0")}${value.toString(16).padStart(2, "0")}`;

          newShades.push({ level: i, hex: hex.toUpperCase() });
        }
      }

      return newShades;
    },
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
        `/api/clients/${clientId}/assets${editingColor?.id ? `/${editingColor.id}` : ""}`,
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
        }
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

  const updateColor = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      category: string;
      data: unknown;
    }) => {
      const response = await fetch(
        `/api/clients/${clientId}/assets/${data.id}`,
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
        queryKey: [`/api/clients/${clientId}/assets`],
      });

      // Snapshot the previous value
      const previousAssets = queryClient.getQueryData([
        `/api/clients/${clientId}/assets`,
      ]);

      // Optimistically update the cache
      queryClient.setQueryData(
        [`/api/clients/${clientId}/assets`],
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
        [`/api/clients/${clientId}/assets`],
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
        queryKey: [`/api/clients/${clientId}/assets`],
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
        // Preserve the full data object including gradient information
        data: data,
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
    (c) => c.category === "brand"
  );

  // Sort neutral colors: manual (base grey) first, then generated shades from light to dark (Grey 11 to Grey 1)
  const neutralColorsData = transformedColors
    .filter((c) => c.category === "neutral")
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
    (c) => c.category === "interactive"
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

  const handleGenerateInteractiveColors = () => {
    // Generate the four interactive colors based on brand colors
    const interactiveColors = generateInteractiveColors(brandColorsData);

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
    manualColors.forEach((color, _index) => {
      if (color.name !== "Base grey" && color.id) {
        // Update the existing color to "Base grey"
        fetch(`/api/clients/${clientId}/assets/${color.id}`, {
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
                  hex: color.hex,
                  rgb: color.rgb,
                  cmyk: color.cmyk,
                  pantone: color.pantone,
                },
              ],
              tints: generateTintsAndShades(color.hex).tints.map((hex, i) => ({
                percentage: [60, 40, 20][i],
                hex,
              })),
              shades: generateTintsAndShades(color.hex).shades.map(
                (hex, i) => ({
                  percentage: [20, 40, 60][i],
                  hex,
                })
              ),
            },
          }),
        }).then(() => {
          queryClient.invalidateQueries({
            queryKey: [`/api/clients/${clientId}/assets`],
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
    const baseGreyHex = baseGreyColor?.hex || null;

    // Extract hue and base saturation from base grey or brand colors with variation
    const { hue, maxSaturation, lightnessShift } = extractBrandColorProperties(
      brandColorsData,
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

      // Apply parabolic formula: saturation = maxSaturation * (1 - 4 * Math.pow(normalizedLightness - 0.5, 2));
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

  const _handleAddBrandColor = (name: string, hex: string) => {
    const colorKey = name.toLowerCase().replace(/\s+/g, "-");
    handleColorChange(colorKey, hex, true);

    // We're not managing an internal color state anymore
    // The colors will be updated through the API and the component will re-render
  };

  const handleColorChange = (
    key: string,
    value: string,
    isBaseColor = false
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
    <div className="color-manager">
      {" "}
      <div className="manager__header ">
        <div>
          <h1>Color System</h1>
          <p className="text-muted-foreground">
            Manage and use the official color palette for this brand
          </p>
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
            <div className="flex flex-col gap-2 w-full">
              <Button
                onClick={handleGenerateGreyShades}
                variant="outline"
                className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/10 hover:border-muted-foreground/25 w-full h-[120px] transition-colors bg-muted/5"
              >
                <RotateCcw className="h-12 w-12 text-muted-foreground/50" />
                <span className="text-muted-foreground/50">Generate</span>
              </Button>

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
                <span className="text-muted-foreground/50">Add Color</span>
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
            <div className="asset-display__info">{colorDescriptions.brand}</div>
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

              <div className="flex flex-col gap-2">
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
                  <span className="text-muted-foreground/50">
                    Add New Color
                  </span>
                </Button>
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
                  onGenerate={handleGenerateGreyShades}
                  neutralColorsCount={neutralColorsData.length}
                  onUpdate={handleUpdateColor}
                  clientId={clientId}
                />
              ))}

              {/* Only show Add New Color button if there are fewer than 11 neutral colors */}
              {neutralColorsData.length < 11 && (
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

        <AssetSection
          title="Interactive Colors"
          description={colorDescriptions.interactive}
          isEmpty={interactiveColorsData.length === 0}
          sectionType="interactive-colors"
          uploadComponent={
            <div className="space-y-4 w-full">
              <Button
                onClick={handleGenerateInteractiveColors}
                variant="default"
                className="flex flex-col items-center justify-center gap-2 p-6 w-full h-[120px] transition-colors"
                disabled={createColor.isPending}
              >
                <Palette className="h-4 w-4" />
                {createColor.isPending ? "Generating..." : "Generate Colors"}
              </Button>
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
              {colorDescriptions.neutral}
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
  updateDraftDesignSystem?: (colors: unknown) => void; // Made optional
  addToHistory?: (designSystem: unknown) => void; // Made optional
  designSystem?: unknown; // Made optional
}

// ColorData interface and colorDescriptions are now imported from types/color.ts

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
