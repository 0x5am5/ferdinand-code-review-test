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
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import "../../styles/components/color-picker-popover.scss";
import type { BrandAsset } from "@shared/schema";
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

// Define types for color data structure
type ColorData = {
  hex: string;
  rgb?: string;
  hsl?: string;
  cmyk?: string;
  pantone?: string;
};

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
import { AssetSection } from "./logo-manager/asset-section";

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
  color: ColorBrandAsset;
  onEdit: (color: ColorBrandAsset) => void;
  onDelete: (id: number) => void;
  onGenerate?: () => void;
  neutralColorsCount?: number;
  onUpdate?: (
    colorId: number,
    updates: { hex: string; rgb?: string; hsl?: string; cmyk?: string },
  ) => void;
  clientId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hexInputId = useId();
  const [showTints, setShowTints] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [pantoneValue, setPantoneValue] = useState("");
  const [copiedFormats, setCopiedFormats] = useState<Record<string, boolean>>(
    {},
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
      data: ColorAssetData;
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
        },
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
        },
      );

      // Return a context object with the snapshotted value
      return { previousAssets };
    },
    onError: (err, _newData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(
        [`/api/clients/${clientId}/assets`],
        context?.previousAssets,
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
  const [tempColor, setTempColor] = useState(
    color.data.colors[0]?.hex || "#000000",
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(color.name);
  const [activeTab, setActiveTab] = useState<"color" | "gradient">("color");
  const [gradientType, setGradientType] = useState<"linear" | "radial">(
    "linear",
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
    setTempColor(color.data.colors[0]?.hex || "#000000");
    setIsEditing(true);

    // Load existing gradient data if available
    if (color.data?.gradient) {
      setActiveTab("gradient");
      setGradientType(color.data.gradient.type || "linear");
      setGradientStops(
        color.data.gradient.stops || [
          { color: "#D9D9D9", position: 0 },
          { color: "#737373", position: 100 },
        ],
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
        },
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
            hex:
              gradientStops[0]?.color || color.data.colors[0]?.hex || "#000000",
            rgb:
              hexToRgb(
                gradientStops[0]?.color ||
                  color.data.colors[0]?.hex ||
                  "#000000",
              ) || "",
            hsl:
              hexToHsl(
                gradientStops[0]?.color ||
                  color.data.colors[0]?.hex ||
                  "#000000",
              ) || "",
            cmyk:
              hexToCmyk(
                gradientStops[0]?.color ||
                  color.data.colors[0]?.hex ||
                  "#000000",
              ) || "",
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
                hex:
                  gradientStops[0]?.color ||
                  color.data.colors[0]?.hex ||
                  "#000000",
                rgb:
                  hexToRgb(
                    gradientStops[0]?.color ||
                      color.data.colors[0]?.hex ||
                      "#000000",
                  ) || "",
                hsl:
                  hexToHsl(
                    gradientStops[0]?.color ||
                      color.data.colors[0]?.hex ||
                      "#000000",
                  ) || "",
                cmyk: hexToCmyk(color.data.colors[0]?.hex || "#000000") || "",
              });
            }
          },
        },
      );
    }

    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setTempColor(color.data.colors[0]?.hex || "#000000");
    setIsEditing(false);
    if (onUpdate) {
      // Revert to original color
      const updates = {
        hex: color.data.colors[0]?.hex || "#000000",
        rgb: hexToRgb(color.data.colors[0]?.hex || "#000000") || undefined,
        hsl: hexToHsl(color.data.colors[0]?.hex || "#000000") || undefined,
        cmyk: hexToCmyk(color.data.colors[0]?.hex || "#000000") || undefined,
      };
      onUpdate(color.id, updates);
    }
  };

  // Generate tints and shades and handle gradient display
  const displayHex = isEditing
    ? tempColor
    : color.data.colors[0]?.hex || "#000000";
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
        }, ${color.data.gradient.stops.map((stop: { color: string; position: number }) => `${stop.color} ${stop.position}%`).join(", ")})`,
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
            <button
              type="button"
              className="color-chip--title cursor-pointer font-semibold hover:opacity-80 transition-opacity bg-transparent border-none p-0 text-left"
              style={{
                color:
                  parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                    ? "#000"
                    : "#fff",
              }}
              onClick={handleNameEdit}
              title="Click to edit name"
            >
              {color.name}
            </button>
          )}
          <button
            type="button"
            className="text-xs font-mono cursor-pointer hover:bg-black/10 hover:bg-white/10 rounded px-1 py-0.5 transition-colors bg-transparent border-none"
            style={{
              color:
                parseInt(displayHex.replace("#", ""), 16) > 0xffffff / 2
                  ? "#000"
                  : "#fff",
            }}
            onClick={handleStartEdit}
            title="Click to edit color"
          >
            {displayHex}
          </button>
        </div>

        <div className="color-chip__controls" style={{ position: "relative" }}>
          {color.data.category === "neutral" &&
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
          {color.data.category !== "neutral" &&
            color.data.type !== "gradient" && (
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
            onClick={() => copyHex(color.data.colors[0]?.hex || "#000000")}
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
                  <label htmlFor={hexInputId}>Hex:</label>
                  <input
                    id={hexInputId}
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
                <button
                  type="button"
                  className="color-picker-popover__gradient-preview"
                  style={{
                    background: `linear-gradient(to right, ${gradientStops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")})`,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const position = Math.round(
                      ((e.clientX - rect.left) / rect.width) * 100,
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
                  aria-label="Click to add gradient stops"
                >
                  {/* Color Stop Handles */}
                  {gradientStops.map((stop, index) => (
                    <div
                      key={`${stop.color}-${stop.position}-${index}`}
                      role="slider"
                      tabIndex={0}
                      aria-label={`Gradient stop at ${stop.position}%`}
                      aria-valuenow={stop.position}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="gradient-stop-handle"
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
                          if (!rect) return;
                          const newPosition = Math.max(
                            0,
                            Math.min(
                              100,
                              ((moveEvent.clientX - rect.left) / rect.width) *
                                100,
                            ),
                          );

                          const newStops = [...gradientStops];
                          newStops[index].position = Math.round(newPosition);
                          setGradientStops(newStops);
                        };

                        const handleMouseUp = () => {
                          document.removeEventListener(
                            "mousemove",
                            handleMouseMove,
                          );
                          document.removeEventListener(
                            "mouseup",
                            handleMouseUp,
                          );
                        };

                        document.addEventListener("mousemove", handleMouseMove);
                        document.addEventListener("mouseup", handleMouseUp);
                      }}
                    />
                  ))}
                </button>

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
                                  ...gradientStops.map((s) => s.position),
                                ) + 20,
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
                      key={`stop-${stop.position}-${stop.color}-${index}`}
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
                              Math.min(100, parseInt(e.target.value, 10) || 0),
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
                        style={{ backgroundColor: stop.color }}
                        onClick={() => {
                          const colorInput = document.querySelector(
                            `input[data-stop-index="${index}"]`,
                          ) as HTMLInputElement;
                          if (colorInput) colorInput.click();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            const colorInput = document.querySelector(
                              `input[data-stop-index="${index}"]`,
                            ) as HTMLInputElement;
                            if (colorInput) colorInput.click();
                          }
                        }}
                        aria-label={`Change gradient stop color: ${stop.color}`}
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
                            Math.min(255, parseInt(e.target.value, 10) || 0),
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
                              gradientStops.filter((_, i) => i !== index),
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
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 bg-black/20 group-hover:opacity-100 transition-opacity">
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
            className="absolute top-0 right-0 w-[40%] h-full bg-white/95 backdrop-blur-sm border-l border-gray-200 p-4 flex flex-col"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="space-y-3">
              {/* RGB */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium w-16">RGB</span>
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
                        2000,
                      );
                      toast({
                        title: "Copied!",
                        description: `${rgb} has been copied to your clipboard.`,
                      });
                    }
                  }}
                  className="flex-1 flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 transition-colors group"
                >
                  <span className="text-sm font-mono">
                    {(() => {
                      const rgb = hexToRgb(displayHex);
                      return rgb
                        ? rgb.replace("rgb(", "").replace(")", "")
                        : "";
                    })()}
                  </span>
                  {copiedFormats[`${color.id}-rgb`] ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>

              {/* HSL */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium w-16">HSL</span>
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
                        2000,
                      );
                      toast({
                        title: "Copied!",
                        description: `${hsl} has been copied to your clipboard.`,
                      });
                    }
                  }}
                  className="flex-1 flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 transition-colors group"
                >
                  <span className="text-sm font-mono">
                    {(() => {
                      const hsl = hexToHsl(displayHex);
                      return hsl
                        ? hsl.replace("hsl(", "").replace(")", "")
                        : "";
                    })()}
                  </span>
                  {copiedFormats[`${color.id}-hsl`] ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>

              {/* CMYK */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium w-16">CMYK</span>
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
                        2000,
                      );
                      toast({
                        title: "Copied!",
                        description: `${cmyk} has been copied to your clipboard.`,
                      });
                    }
                  }}
                  className="flex-1 flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 transition-colors group"
                >
                  <span className="text-sm font-mono">
                    {(() => {
                      const cmyk = hexToCmyk(displayHex);
                      return cmyk
                        ? cmyk.replace("cmyk(", "").replace(")", "")
                        : "";
                    })()}
                  </span>
                  {copiedFormats[`${color.id}-cmyk`] ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>

              {/* Pantone */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium w-16">Pantone</span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={pantoneValue}
                    onChange={(e) => handlePantoneChange(e.target.value)}
                    placeholder="Enter Pantone code"
                    className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          2000,
                        );
                        toast({
                          title: "Copied!",
                          description: `${pantoneValue} has been copied to your clipboard.`,
                        });
                      }
                    }}
                    disabled={!pantoneValue}
                    className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  >
                    {copiedFormats[`${color.id}-pantone`] ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-gray-500" />
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

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number = 0;
  let s: number;
  const l: number = (max + min) / 2;

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

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const k = 1 - Math.max(r, g, b);
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

function _generateNeutralPalette(baseGrey: string) {
  // Generate 10 shades from white to black
  const tints = generateTintsAndShades(baseGrey, [90, 80, 70, 60, 50]).tints;
  const shades = generateTintsAndShades(baseGrey, [40, 30, 20, 10, 5]).shades;
  return [...tints, baseGrey, ...shades];
}

function _generateContainerColors(baseColor: string) {
  // Updated to use 60% for both lighter and darker values
  const { tints, shades } = generateTintsAndShades(baseColor, [60], [60]);
  return {
    container: tints[0],
    onContainer: shades[0],
  };
}

// Extract hue and saturation from brand colors for neutral generation
function extractBrandColorProperties(
  brandColors: ColorData[],
  baseGreyHex: string | null = null,
  regenerationCount = 0,
) {
  let baseHue = 0;
  let baseSaturation = 0.02;

  // If we have a base grey, use its properties as the foundation
  if (baseGreyHex) {
    const baseGreyHsl = hexToHslValues(baseGreyHex);
    if (baseGreyHsl) {
      baseHue = baseGreyHsl.h;
      baseSaturation = Math.max(baseGreyHsl.s, 0.02); // Use base grey saturation but ensure minimum
    }
  } else if (brandColors.length > 0) {
    // Fallback to brand colors if no base grey
    let totalHue = 0;
    let maxSaturation = 0;
    let validColors = 0;

    brandColors.forEach((color) => {
      const hsl = hexToHslValues(color.hex);
      if (hsl) {
        totalHue += hsl.h;
        maxSaturation = Math.max(maxSaturation, hsl.s);
        validColors++;
      }
    });

    baseHue = validColors > 0 ? totalHue / validColors : 0;
    // Increased max saturation for more character
    baseSaturation = Math.min(maxSaturation * 0.15, 0.07); // Max 7% saturation for neutrals
  }

  // Add variation each time regenerate is clicked
  const variations = [
    { hueShift: 0, saturationMultiplier: 1, lightnessShift: 0 }, // Original
    { hueShift: 15, saturationMultiplier: 0.8, lightnessShift: 3 }, // Warmer, lighter
    { hueShift: -15, saturationMultiplier: 0.8, lightnessShift: -3 }, // Cooler, darker
    { hueShift: 25, saturationMultiplier: 0.6, lightnessShift: 5 }, // Much warmer, much lighter
    { hueShift: -25, saturationMultiplier: 0.6, lightnessShift: -5 }, // Much cooler, much darker
    { hueShift: 0, saturationMultiplier: 0.4, lightnessShift: 0 }, // Nearly grayscale
  ];

  const variation = variations[regenerationCount % variations.length];

  const adjustedHue = (baseHue + variation.hueShift + 360) % 360;
  const adjustedSaturation = Math.min(
    baseSaturation * variation.saturationMultiplier,
    0.07,
  );

  return {
    hue: adjustedHue,
    maxSaturation: adjustedSaturation,
    lightnessShift: variation.lightnessShift,
  };
}

// Convert hex to HSL values (returns object with h, s, l)
function hexToHslValues(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number = 0;
  let s: number;
  const l: number = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
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

  return { h: h * 360, s, l };
}

// Convert HSL to hex
function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Check if a brand color matches a specific color family
function isColorFamily(
  hex: string,
  family: "green" | "yellow" | "red" | "blue",
): boolean {
  const hsl = hexToHslValues(hex);
  if (!hsl) return false;

  const hue = hsl.h * 360;

  switch (family) {
    case "green":
      return hue >= 90 && hue <= 170;
    case "yellow":
      return hue >= 30 && hue <= 80;
    case "red":
      return (hue >= 0 && hue <= 25) || (hue >= 340 && hue <= 360);
    case "blue":
      return hue >= 190 && hue <= 260;
    default:
      return false;
  }
}

// Generate interactive colors based on brand colors
function generateInteractiveColors(brandColors: ColorData[]) {
  // First, check if any brand colors match our target families
  const existingGreen = brandColors.find((color) =>
    isColorFamily(color.hex, "green"),
  );
  const existingYellow = brandColors.find((color) =>
    isColorFamily(color.hex, "yellow"),
  );
  const existingRed = brandColors.find((color) =>
    isColorFamily(color.hex, "red"),
  );
  const existingBlue = brandColors.find((color) =>
    isColorFamily(color.hex, "blue"),
  );

  // Extract average saturation and lightness from brand colors
  let avgSaturation = 0.7;
  let avgLightness = 0.5;

  if (brandColors.length > 0) {
    let totalSat = 0;
    let totalLight = 0;
    let validColors = 0;

    brandColors.forEach((color) => {
      const hsl = hexToHslValues(color.hex);
      if (hsl) {
        totalSat += hsl.s;
        totalLight += hsl.l;
        validColors++;
      }
    });

    if (validColors > 0) {
      avgSaturation = Math.min(totalSat / validColors + 0.1, 0.85);
      avgLightness = Math.max(0.45, Math.min(totalLight / validColors, 0.6));
    }
  }

  // Color specifications in the correct order: Success, Warning, Error, Link
  const colorSpecs = [
    {
      name: "Success",
      existing: existingGreen,
      hue: 145,
      saturation: avgSaturation,
      lightness: avgLightness,
    },
    {
      name: "Warning",
      existing: existingYellow,
      hue: 40,
      saturation: avgSaturation,
      lightness: avgLightness,
    },
    {
      name: "Error",
      existing: existingRed,
      hue: 0,
      saturation: avgSaturation,
      lightness: avgLightness,
    },
    {
      name: "Link",
      existing: existingBlue,
      hue: 220,
      saturation: avgSaturation,
      lightness: avgLightness,
    },
  ];

  return colorSpecs.map((spec) => {
    // Use existing brand color if available, otherwise generate new one
    const hex = spec.existing
      ? spec.existing.hex
      : hslToHex(spec.hue, spec.saturation * 100, spec.lightness * 100);

    return {
      name: spec.name,
      hex: hex,
      category: "interactive" as const,
    };
  });
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
  const [editingColor, setEditingColor] = useState<ColorBrandAsset | null>(
    null,
  );
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
      existingColors: Array<ColorData & { brightness: number }>,
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

  const updateColor = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      category: string;
      data: ColorAssetData;
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
        },
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
        },
      );

      // Return a context object with the snapshotted value
      return { previousAssets };
    },
    onError: (err, _newData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(
        [`/api/clients/${clientId}/assets`],
        context?.previousAssets,
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
    updates: { hex: string; rgb?: string; hsl?: string; cmyk?: string },
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
        error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  };

  const transformedColors = colors
    .filter((asset) => asset.category === "color")
    .map(parseColorAsset)
    .filter((color): color is ColorBrandAsset => color !== null);

  const brandColorsData = transformedColors.filter(
    (c) => c.data.category === "brand",
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
    (c) => c.data.category === "interactive",
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
      brandColorsForGeneration,
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
      (color) => !/^Grey \d+$/.test(color.name),
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
                  hex: color.data.colors[0]?.hex || "#000000",
                  rgb: color.data.colors[0]?.rgb,
                  cmyk: color.data.colors[0]?.cmyk,
                  pantone: color.data.colors[0]?.pantone,
                },
              ],
              tints: generateTintsAndShades(
                color.data.colors[0]?.hex || "#000000",
              ).tints.map((hex, i) => ({
                percentage: [60, 40, 20][i],
                hex,
              })),
              shades: generateTintsAndShades(
                color.data.colors[0]?.hex || "#000000",
              ).shades.map((hex, i) => ({
                percentage: [20, 40, 60][i],
                hex,
              })),
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
      (color) => !/^Grey \d+$/.test(color.name),
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
      regenerationCount,
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
        Math.min(98, baseLightness + lightnessShift),
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
      (shade) => !existingGeneratedShades.includes(shade.level),
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

    // Convert brandColorsData to ColorData format for the purpose of filtering
    const brandColors = brandColorsData.map((asset) => ({
      hex: asset.data.colors[0]?.hex || "#000000",
      rgb: asset.data.colors[0]?.rgb,
      hsl: asset.data.colors[0]?.hsl,
      cmyk: asset.data.colors[0]?.cmyk,
      pantone: asset.data.colors[0]?.pantone,
      // Adding category property to match the expected structure for filtering
      category: asset.data.category,
      name: asset.name,
    }));

    // For brand colors, we should use colors with category "brand"
    const filteredBrandColors = brandColors.filter(
      (color) => color.category === "brand",
    );

    // This part of the logic seems incomplete or redundant if the UI handles
    // the `isAddingColor` state and form reset correctly.
    // If `handleAddBrandColor` is meant to directly trigger the creation of a default color,
    // that mutation should be called here.
    // For now, assuming the UI handles the addition flow.
  };

  const handleColorChange = (
    _key: string,
    _value: string,
    _isBaseColor = false,
  ) => {
    //  Updated color change handling to dynamically generate container and neutral colors
    const updatedDesignSystem = designSystem || [];

    // Only call these if the props are provided
    if (updateDraftDesignSystem) {
      updateDraftDesignSystem(updatedDesignSystem);
    }

    if (addToHistory) {
      addToHistory(updatedDesignSystem);
    }
  };

  if (!user) return null;

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
      <div className="space-y-8">
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
                <span className="text-sm font-medium text-muted-foreground/70">Generate Brand Colors</span>
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
                <span className="text-sm font-medium text-muted-foreground/70">Add Color</span>
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
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                >
                  <Plus className="h-8 w-8 text-muted-foreground/70" />
                  <span className="text-sm font-medium text-muted-foreground/70">
                    Add Color
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
            <div className="space-y-4 w-full">
              <Button
                onClick={handleGenerateGreyShades}
                variant="outline"
                className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                disabled={createColor.isPending}
              >
                <Palette className="h-8 w-8 text-muted-foreground/70" />
                <span className="text-sm font-medium text-muted-foreground/70">
                  {createColor.isPending ? "Generating..." : "Generate Neutral Colors"}
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
                variant="outline"
                className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 w-full h-[120px] transition-colors bg-muted/5 hover:bg-muted/10"
                disabled={createColor.isPending}
              >
                <Palette className="h-8 w-8 text-muted-foreground/70" />
                <span className="text-sm font-medium text-muted-foreground/70">
                  {createColor.isPending ? "Generating..." : "Generate Interactive Colors"}
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
  updateDraftDesignSystem?: (colors: BrandAsset[]) => void; // Made optional
  addToHistory?: (designSystem: BrandAsset[]) => void; // Made optional
  designSystem?: BrandAsset[]; // Made optional
}

// ColorData interface already defined at top of file

// Color category descriptions
const colorDescriptions = {
  brand:
    "Primary colors that define the brand identity and should be used consistently across all materials.",
  neutral:
    "Supporting colors for backgrounds, text, and UI elements that provide balance to the color system.",
  interactive:
    "Colors used for buttons, links, and interactive elements to guide user actions.",
};

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