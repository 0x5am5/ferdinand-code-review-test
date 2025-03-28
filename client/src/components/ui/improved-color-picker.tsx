import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ImprovedColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove the # if present
  hex = hex.replace(/^#/, '');
  
  // Validate hex format
  if (!/^([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(hex)) {
    return { r: 0, g: 0, b: 0 };
  }
  
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
    
    r = isNaN(r) ? 0 : r;
    g = isNaN(g) ? 0 : g;
    b = isNaN(b) ? 0 : b;
  } catch (error) {
    return { r: 0, g: 0, b: 0 };
  }
  
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

// Convert HSV to RGB
function hsvToRgb(h: number, s: number, v: number): { r: number, g: number, b: number } {
  h = h % 360;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));
  
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  
  let r = 0, g = 0, b = 0;
  
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

// Convert RGB to HSV
function rgbToHsv(r: number, g: number, b: number): { h: number, s: number, v: number } {
  r = r / 255;
  g = g / 255;
  b = b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  
  if (max === min) {
    h = 0;
  } else {
    if (max === r) {
      h = 60 * ((g - b) / d + (g < b ? 6 : 0));
    } else if (max === g) {
      h = 60 * ((b - r) / d + 2);
    } else if (max === b) {
      h = 60 * ((r - g) / d + 4);
    }
  }
  
  return { h, s, v };
}

export function ImprovedColorPicker({ value, onChange, className }: ImprovedColorPickerProps) {
  // Ensure we have a valid hex color
  const initialValue = typeof value === 'string' && value.startsWith("#") 
    ? value 
    : "#000000";
  
  const [hexValue, setHexValue] = useState(initialValue);
  const [inputHexValue, setInputHexValue] = useState(initialValue.substring(1));
  
  // RGB values
  const { r, g, b } = hexToRgb(hexValue);
  
  // HSV values
  const [hsv, setHsv] = useState(rgbToHsv(r, g, b));
  const [hue, setHue] = useState(hsv.h);
  
  // Alpha/opacity value (0-100%)
  const [alpha, setAlpha] = useState(100);
  
  // References for canvas and color picker area
  const colorAreaRef = useRef<HTMLDivElement>(null);
  const colorSliderRef = useRef<HTMLDivElement>(null);
  const alphaSliderRef = useRef<HTMLDivElement>(null);
  
  // Set initial color on mount and when value prop changes
  useEffect(() => {
    const safeValue = (typeof value === 'string' && value.startsWith("#")) 
      ? value 
      : "#000000";
    
    if (safeValue !== hexValue) {
      setHexValue(safeValue);
      setInputHexValue(safeValue.substring(1));
      
      const { r, g, b } = hexToRgb(safeValue);
      const newHsv = rgbToHsv(r, g, b);
      setHsv(newHsv);
      setHue(newHsv.h);
    }
  }, [value, hexValue]);
  
  // Handle color area click/drag
  const handleColorAreaInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const { width, height, left, top } = colorAreaRef.current!.getBoundingClientRect();
    
    // Get the coordinates - handle both mouse and touch events
    let clientX, clientY;
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Calculate saturation and value from the position
    const x = Math.max(0, Math.min(width, clientX - left));
    const y = Math.max(0, Math.min(height, clientY - top));
    
    const s = x / width;
    const v = 1 - (y / height);
    
    // Create a new HSV object and convert to RGB
    const newHsv = { h: hue, s, v };
    setHsv(newHsv);
    
    const { r, g, b } = hsvToRgb(hue, s, v);
    const newHex = rgbToHex(r, g, b);
    
    setHexValue(newHex);
    setInputHexValue(newHex.substring(1));
    onChange(newHex);
  };
  
  // Handle color slider (hue) interaction
  const handleHueSliderInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const { width, left } = colorSliderRef.current!.getBoundingClientRect();
    
    // Get the coordinates - handle both mouse and touch events
    let clientX;
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
    } else {
      // Mouse event
      clientX = e.clientX;
    }
    
    // Calculate hue from the position
    const x = Math.max(0, Math.min(width, clientX - left));
    const newHue = (x / width) * 360;
    
    setHue(newHue);
    
    // Apply the new hue to current saturation and value
    const { s, v } = hsv;
    const { r, g, b } = hsvToRgb(newHue, s, v);
    const newHex = rgbToHex(r, g, b);
    
    setHexValue(newHex);
    setInputHexValue(newHex.substring(1));
    onChange(newHex);
  };
  
  // For Alpha slider interaction
  const handleAlphaSliderInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const { width, left } = alphaSliderRef.current!.getBoundingClientRect();
    
    // Get the x coordinate
    let clientX;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    
    // Calculate alpha from position
    const x = Math.max(0, Math.min(width, clientX - left));
    const newAlpha = Math.round((x / width) * 100);
    
    setAlpha(newAlpha);
  };
  
  // Handle hex input change
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // Remove # if present
    if (newValue.startsWith('#')) {
      newValue = newValue.substring(1);
    }
    
    // Update the input field value
    setInputHexValue(newValue);
    
    // Only update actual color if it's a valid hex
    if (/^([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(newValue)) {
      const fullHex = `#${newValue}`;
      setHexValue(fullHex);
      
      const { r, g, b } = hexToRgb(fullHex);
      const newHsv = rgbToHsv(r, g, b);
      setHsv(newHsv);
      setHue(newHsv.h);
      
      onChange(fullHex);
    }
  };
  
  // Generate the background color for the hue slider
  const hueGradient = `linear-gradient(to right, 
    rgb(255, 0, 0), rgb(255, 255, 0), rgb(0, 255, 0), 
    rgb(0, 255, 255), rgb(0, 0, 255), rgb(255, 0, 255), rgb(255, 0, 0))`;
  
  // Generate the background for the color area
  const colorAreaBg = `linear-gradient(to bottom, rgba(0, 0, 0, 0), rgb(0, 0, 0)), 
    linear-gradient(to right, rgb(255, 255, 255), hsl(${hue}, 100%, 50%))`;
  
  // Generate alpha slider background
  const alphaGradient = `linear-gradient(to right, transparent, ${hexValue})`;
  
  // Set up event handlers for mouse and touch events
  useEffect(() => {
    const colorArea = colorAreaRef.current;
    const hueSlider = colorSliderRef.current;
    const alphaSlider = alphaSliderRef.current;
    
    // Color area handlers
    const handleColorMouseMove = (e: MouseEvent) => {
      if (e.buttons !== 1) return; // Only when primary mouse button is pressed
      handleColorAreaInteraction(e as unknown as React.MouseEvent);
    };
    
    const handleColorTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleColorAreaInteraction(e as unknown as React.TouchEvent);
    };
    
    // Hue slider handlers
    const handleHueMouseMove = (e: MouseEvent) => {
      if (e.buttons !== 1) return;
      handleHueSliderInteraction(e as unknown as React.MouseEvent);
    };
    
    const handleHueTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleHueSliderInteraction(e as unknown as React.TouchEvent);
    };
    
    // Alpha slider handlers
    const handleAlphaMouseMove = (e: MouseEvent) => {
      if (e.buttons !== 1) return;
      handleAlphaSliderInteraction(e as unknown as React.MouseEvent);
    };
    
    const handleAlphaTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleAlphaSliderInteraction(e as unknown as React.TouchEvent);
    };
    
    // Add event listeners
    if (colorArea) {
      colorArea.addEventListener('mousemove', handleColorMouseMove);
      colorArea.addEventListener('touchmove', handleColorTouchMove);
    }
    
    if (hueSlider) {
      hueSlider.addEventListener('mousemove', handleHueMouseMove);
      hueSlider.addEventListener('touchmove', handleHueTouchMove);
    }
    
    if (alphaSlider) {
      alphaSlider.addEventListener('mousemove', handleAlphaMouseMove);
      alphaSlider.addEventListener('touchmove', handleAlphaTouchMove);
    }
    
    // Clean up
    return () => {
      if (colorArea) {
        colorArea.removeEventListener('mousemove', handleColorMouseMove);
        colorArea.removeEventListener('touchmove', handleColorTouchMove);
      }
      
      if (hueSlider) {
        hueSlider.removeEventListener('mousemove', handleHueMouseMove);
        hueSlider.removeEventListener('touchmove', handleHueTouchMove);
      }
      
      if (alphaSlider) {
        alphaSlider.removeEventListener('mousemove', handleAlphaMouseMove);
        alphaSlider.removeEventListener('touchmove', handleAlphaTouchMove);
      }
    };
  }, [hexValue, hue, hsv]);
  
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
      <PopoverContent className="w-72">
        <div className="grid gap-4">
          {/* Color area with saturation/value */}
          <div 
            ref={colorAreaRef}
            className="relative w-full h-44 rounded-md cursor-crosshair"
            style={{
              background: colorAreaBg,
              backgroundBlendMode: 'multiply'
            }}
            onMouseDown={handleColorAreaInteraction}
            onTouchStart={handleColorAreaInteraction}
          >
            {/* Indicator dot */}
            <div 
              className="absolute w-3 h-3 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ 
                left: `${hsv.s * 100}%`, 
                top: `${(1 - hsv.v) * 100}%`,
                boxShadow: '0 0 2px rgba(0,0,0,0.5)'
              }}
            />
          </div>
          
          {/* Hue slider */}
          <div 
            ref={colorSliderRef}
            className="relative w-full h-6 rounded-md cursor-pointer"
            style={{ background: hueGradient }}
            onMouseDown={handleHueSliderInteraction}
            onTouchStart={handleHueSliderInteraction}
          >
            {/* Hue indicator */}
            <div 
              className="absolute w-3 h-6 border-2 border-white rounded-sm transform -translate-x-1/2 pointer-events-none"
              style={{ 
                left: `${(hue / 360) * 100}%`,
                boxShadow: '0 0 2px rgba(0,0,0,0.5)'
              }}
            />
          </div>
          
          {/* Alpha slider */}
          <div 
            ref={alphaSliderRef}
            className="relative w-full h-6 rounded-md cursor-pointer bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVQ4T2N89uzZfwY8QFJSEp80wzAYMMOABYb/eMAIyyfa/YNhwAJl0HAUBYPKBQA+OQRYxJUoKgAAAABJRU5ErkJggg==')]"
            style={{ backgroundSize: '10px 10px' }}
            onMouseDown={handleAlphaSliderInteraction}
            onTouchStart={handleAlphaSliderInteraction}
          >
            <div 
              className="absolute inset-0 w-full h-full rounded-md"
              style={{ background: alphaGradient }}
            />
            
            {/* Alpha indicator */}
            <div 
              className="absolute w-3 h-6 border-2 border-white rounded-sm transform -translate-x-1/2 pointer-events-none"
              style={{ 
                left: `${alpha}%`,
                boxShadow: '0 0 2px rgba(0,0,0,0.5)'
              }}
            />
          </div>
          
          {/* Color inputs */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Select defaultValue="hex">
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hex">Hex</SelectItem>
                  <SelectItem value="rgb">RGB</SelectItem>
                  <SelectItem value="hsl">HSL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <div className="flex">
                <span className="flex items-center justify-center bg-muted px-2 h-8 rounded-l-md border border-r-0">
                  #
                </span>
                <Input
                  value={inputHexValue}
                  onChange={handleHexInputChange}
                  className="h-8 rounded-l-none"
                  maxLength={6}
                />
              </div>
            </div>
            
            <div>
              <div className="flex h-8 items-center justify-center border rounded-md px-2">
                {alpha}%
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}