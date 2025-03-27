import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function hexToRgb(hex: string) {
  // Remove the # if present
  hex = hex.replace(/^#/, '');
  
  // Validate hex format
  if (!/^([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(hex)) {
    // Return black for invalid hex
    return { r: 0, g: 0, b: 0 };
  }
  
  // Parse the hex values to RGB
  let r = 0, g = 0, b = 0;
  
  try {
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    
    // Handle NaN values
    r = isNaN(r) ? 0 : r;
    g = isNaN(g) ? 0 : g;
    b = isNaN(b) ? 0 : b;
    
  } catch (error) {
    // Return black for any parsing errors
    return { r: 0, g: 0, b: 0 };
  }
  
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  // Safe initialization handling both string and null/undefined cases
  const initialValue = typeof value === 'string' && value ? (value.startsWith("#") ? value : "#000000") : "#000000";
  const [hexValue, setHexValue] = useState(initialValue);
  const { r, g, b } = hexToRgb(initialValue.replace(/^#/, ''));
  const [red, setRed] = useState(r);
  const [green, setGreen] = useState(g);
  const [blue, setBlue] = useState(b);
  
  useEffect(() => {
    // Ensure value is a string and has a valid format
    const safeValue = typeof value === 'string' ? value : '#000000';
    
    // Only update if the value has changed
    if (safeValue !== hexValue) {
      const formattedValue = safeValue.startsWith("#") ? safeValue : "#000000";
      setHexValue(formattedValue);
      
      try {
        const { r, g, b } = hexToRgb(formattedValue.replace(/^#/, ''));
        setRed(r);
        setGreen(g);
        setBlue(b);
      } catch (error) {
        // In case of invalid hex, use default black
        setRed(0);
        setGreen(0);
        setBlue(0);
      }
    }
  }, [value, hexValue]);
  
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newHex = e.target.value;
    
    // Add # if user started typing without it
    if (newHex.length > 0 && !newHex.startsWith('#')) {
      newHex = '#' + newHex;
    }
    
    // Always update the input field so user can type
    setHexValue(newHex);
    
    // Update RGB and call onChange if it's a valid hex
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(newHex)) {
      const { r, g, b } = hexToRgb(newHex.replace(/^#/, ''));
      setRed(r);
      setGreen(g);
      setBlue(b);
      onChange(newHex);
    }
  };
  
  const handleRgbChange = (color: "r" | "g" | "b", value: number[]) => {
    const newValue = value[0];
    
    if (color === "r") {
      setRed(newValue);
    } else if (color === "g") {
      setGreen(newValue);
    } else if (color === "b") {
      setBlue(newValue);
    }
    
    const newHex = rgbToHex(
      color === "r" ? newValue : red,
      color === "g" ? newValue : green,
      color === "b" ? newValue : blue
    );
    
    setHexValue(newHex);
    onChange(newHex);
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={cn("w-full justify-start text-left font-normal", className)}
        >
          <div className="flex items-center gap-2 w-full">
            <div 
              className="h-4 w-4 rounded-sm border" 
              style={{ backgroundColor: hexValue }} 
            />
            <span>{hexValue}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="grid gap-4">
          <div className="space-y-2">
            <div 
              className="w-full h-24 rounded-md" 
              style={{ backgroundColor: hexValue }} 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="hex">Hex</Label>
            <Input
              id="hex"
              value={hexValue}
              onChange={handleHexChange}
              className="h-8"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="r">Red ({red})</Label>
            <Slider
              id="r"
              min={0}
              max={255}
              step={1}
              defaultValue={[red]}
              onValueChange={(value) => handleRgbChange("r", value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="g">Green ({green})</Label>
            <Slider
              id="g" 
              min={0}
              max={255}
              step={1}
              defaultValue={[green]}
              onValueChange={(value) => handleRgbChange("g", value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="b">Blue ({blue})</Label>
            <Slider
              id="b"
              min={0}
              max={255}
              step={1}
              defaultValue={[blue]}
              onValueChange={(value) => handleRgbChange("b", value)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}