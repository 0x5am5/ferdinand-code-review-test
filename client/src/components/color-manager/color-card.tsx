import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Edit2,
  Info,
  Palette,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useId, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import "../../styles/components/color-picker-popover.scss";
import type { BrandAsset } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissionAction, Resource } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import {
  generateTintsAndShades,
  hexToCmyk,
  hexToHsl,
  hexToRgb,
} from "@/lib/color-utils";

type GradientData = {
  type: "linear" | "radial";
  stops: { color: string; position: number }[];
};

type ColorAssetData = {
  type: "solid" | "gradient";
  category: "brand" | "neutral" | "interactive";
  colors: Array<{
    hex: string;
    rgb?: string;
    hsl?: string;
    cmyk?: string;
    pantone?: string;
  }>;
  gradient?: GradientData;
  tints?: Array<{ percentage: number; hex: string }>;
  shades?: Array<{ percentage: number; hex: string }>;
};

type ColorBrandAsset = BrandAsset & {
  data: ColorAssetData;
};

// ColorCard component for the color manager
export function ColorCard({
  color,
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
    updates: { hex: string; rgb?: string; hsl?: string; cmyk?: string }
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
    onSuccess: () => {
      toast({
        title: "Color updated!",
        description: `${color.name} has been updated successfully.`,
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });
    },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempColor, setTempColor] = useState(
    color.data.colors[0]?.hex || "#000000"
  );
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

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
      setTempColor(value);
    }
  };

  // Color picker state
  const copyHex = (hexValue: string) => {
    navigator.clipboard.writeText(hexValue);
    toast({
      title: "Copied!",
      description: `${hexValue} has been copied to your clipboard.`,
    });
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
        ]
      );
    } else {
      setActiveTab("color");
    }
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
            hex:
              gradientStops[0]?.color || color.data.colors[0]?.hex || "#000000",
            rgb:
              hexToRgb(
                gradientStops[0]?.color ||
                  color.data.colors[0]?.hex ||
                  "#000000"
              ) || "",
            hsl:
              hexToHsl(
                gradientStops[0]?.color ||
                  color.data.colors[0]?.hex ||
                  "#000000"
              ) || "",
            cmyk:
              hexToCmyk(
                gradientStops[0]?.color ||
                  color.data.colors[0]?.hex ||
                  "#000000"
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
                      "#000000"
                  ) || "",
                hsl:
                  hexToHsl(
                    gradientStops[0]?.color ||
                      color.data.colors[0]?.hex ||
                      "#000000"
                  ) || "",
                cmyk: hexToCmyk(color.data.colors[0]?.hex || "#000000") || "",
              });
            }
          },
        }
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
              <PermissionGate
                action={PermissionAction.CREATE}
                resource={Resource.BRAND_ASSETS}
              >
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
              </PermissionGate>
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
          <PermissionGate
            action={PermissionAction.UPDATE}
            resource={Resource.BRAND_ASSETS}
          >
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
          </PermissionGate>
          <PermissionGate
            action={PermissionAction.DELETE}
            resource={Resource.BRAND_ASSETS}
          >
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
          </PermissionGate>
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

                        const rect =
                          e.currentTarget.parentElement?.getBoundingClientRect();

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          if (!rect) return;
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
              {tints.map((tint) => (
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
              {shades.map((shade) => (
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
                        2000
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
                        2000
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
                        2000
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
                          2000
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
