import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Trash2, Edit, Palette, Copy, Check, Info } from "lucide-react";
import { Color } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { convertColor, formatColorForCopy, getPantoneValue, setPantoneValue, ColorFormats } from "@/lib/color-utils";

export function ColorCard({ color, onEdit, onDelete, onUpdate, clientId }: ColorCardProps) {
  const [isShadesOpen, setIsShadesOpen] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [pantoneValue, setPantoneValueState] = useState('');
  const [colorFormats, setColorFormats] = useState<ColorFormats | null>(null);

  useEffect(() => {
    if (color.shades && color.shades.length > 0) {
      setShades(color.shades.map(shade => ({
        name: shade.name,
        hex: shade.hex,
        colorId: shade.id
      })));
    }

    // Load Pantone value and convert colors when component mounts
    const savedPantone = getPantoneValue(color.id.toString());
    setPantoneValueState(savedPantone);

    const formats = convertColor(color.hex, savedPantone);
    setColorFormats(formats);
  }, [color.shades, color.hex, color.id]);

  const [shades, setShades] = useState<
    { name: string; hex: string; colorId: number }[]
  >([]);

  const toggleShades = () => {
    if (isInfoPanelOpen) {
      setIsInfoPanelOpen(false);
    }
    setIsShadesOpen(!isShadesOpen);
  };

  const toggleInfoPanel = () => {
    if (isShadesOpen) {
      setIsShadesOpen(false);
    }
    setIsInfoPanelOpen(!isInfoPanelOpen);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const copyColorFormat = async (format: 'rgb' | 'hsl' | 'cmyk' | 'hex' | 'pantone') => {
    if (!colorFormats) return;

    const formattedValue = formatColorForCopy(format, colorFormats);
    if (formattedValue) {
      await copyToClipboard(formattedValue, `${color.id}-${format}`);
    }
  };

  const handlePantoneChange = (value: string) => {
    setPantoneValueState(value);
    setPantoneValue(color.id.toString(), value);

    // Update color formats with new pantone value
    if (colorFormats) {
      setColorFormats({ ...colorFormats, pantone: value });
    }
  };

  return (
    <Card className="bg-zinc-900 text-zinc-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">{color.name}</CardTitle>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-white/20"
                  onClick={toggleInfoPanel}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>More Color Info</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-white/20"
                  onClick={toggleShades}
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show color shades</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-white/20"
                  onClick={onEdit}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit color</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-red-500/20"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete color</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-md border bg-zinc-800/50 px-4 py-3 font-mono text-sm">
          <div className="flex items-center justify-between">
            Color
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-white/20"
                    onClick={() => copyToClipboard(color.hex, color.id.toString())}
                  >
                    {copiedStates[color.id.toString()] ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy color</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="h-16 rounded-md bg-white" style={{ backgroundColor: color.hex }} />
          {color.hex}
        </div>

        {/* Shades Panel */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isShadesOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="pt-4 border-t border-white/20">
            <div className="space-y-2">
              {shades.map((shade, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-6 h-6 rounded border border-white/20" 
                      style={{ backgroundColor: shade.hex }}
                    />
                    <span className="text-sm text-white">{shade.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70 font-mono">{shade.hex}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-white/20"
                      onClick={() => copyToClipboard(shade.hex, `shade-${shade.colorId}`)}
                    >
                      {copiedStates[`shade-${shade.colorId}`] ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isInfoPanelOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="pt-4 border-t border-white/20">
            {colorFormats && (
              <div className="space-y-3">
                {/* RGB */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium w-16">RGB</span>
                  <button
                    onClick={() => copyColorFormat('rgb')}
                    className="flex-1 flex items-center justify-between px-2 py-1 rounded hover:bg-white/10 transition-colors group"
                  >
                    <span className="text-sm text-white/90 font-mono">
                      {colorFormats.rgb.r}, {colorFormats.rgb.g}, {colorFormats.rgb.b}
                    </span>
                    {copiedStates[`${color.id}-rgb`] ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </div>

                {/* HSL */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium w-16">HSL</span>
                  <button
                    onClick={() => copyColorFormat('hsl')}
                    className="flex-1 flex items-center justify-between px-2 py-1 rounded hover:bg-white/10 transition-colors group"
                  >
                    <span className="text-sm text-white/90 font-mono">
                      {colorFormats.hsl.h}°, {colorFormats.hsl.s}%, {colorFormats.hsl.l}%
                    </span>
                    {copiedStates[`${color.id}-hsl`] ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </div>

                {/* CMYK */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium w-16">CMYK</span>
                  <button
                    onClick={() => copyColorFormat('cmyk')}
                    className="flex-1 flex items-center justify-between px-2 py-1 rounded hover:bg-white/10 transition-colors group"
                  >
                    <span className="text-sm text-white/90 font-mono">
                      {colorFormats.cmyk.c}, {colorFormats.cmyk.m}, {colorFormats.cmyk.y}, {colorFormats.cmyk.k}
                    </span>
                    {copiedStates[`${color.id}-cmyk`] ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </div>

                {/* Pantone */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium w-16">Pantone</span>
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={pantoneValue}
                      onChange={(e) => handlePantoneChange(e.target.value)}
                      placeholder="Enter Pantone code"
                      className="flex-1 h-7 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-white/20"
                      onClick={() => copyColorFormat('pantone')}
                      disabled={!pantoneValue}
                    >
                      {copiedStates[`${color.id}-pantone`] ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ColorCardProps {
  color: Color;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (color: Color) => void;
  clientId: string;
}