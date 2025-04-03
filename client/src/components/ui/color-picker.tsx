import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

// Convert RGB to HSV (Hue, Saturation, Value)
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
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

  return { h: h * 360, s: s * 100, v: v * 100 };
}

// Convert HSV to RGB
function hsvToRgb(h: number, s: number, v: number) {
  h /= 360;
  s /= 100;
  v /= 100;

  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  // Safe initialization handling both string and null/undefined cases
  const initialValue = typeof value === 'string' && value ? (value.startsWith("#") ? value : "#000000") : "#000000";
  const [hexValue, setHexValue] = useState(initialValue);
  const { r, g, b } = hexToRgb(initialValue.replace(/^#/, ''));
  const [red, setRed] = useState(r);
  const [green, setGreen] = useState(g);
  const [blue, setBlue] = useState(b);
  
  // Convert to HSV for color spectrum and saturation strip
  const { h, s, v } = rgbToHsv(r, g, b);
  const [hue, setHue] = useState(h);
  const [saturation, setSaturation] = useState(s);
  const [brightness, setBrightness] = useState(v);
  
  // Reference for the color spectrum area
  const spectrumRef = useRef<HTMLDivElement>(null);
  
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
        
        // Update HSV values
        const { h, s, v } = rgbToHsv(r, g, b);
        setHue(h);
        setSaturation(s);
        setBrightness(v);
      } catch (error) {
        // In case of invalid hex, use default black
        setRed(0);
        setGreen(0);
        setBlue(0);
        setHue(0);
        setSaturation(0);
        setBrightness(0);
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
      
      // Update HSV values
      const { h, s, v } = rgbToHsv(r, g, b);
      setHue(h);
      setSaturation(s);
      setBrightness(v);
      
      onChange(newHex);
    }
  };
  
  const handleSpectrumClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!spectrumRef.current) return;
    
    const rect = spectrumRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate hue and saturation as percentages
    const newSaturation = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const newBrightness = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
    
    setSaturation(newSaturation);
    setBrightness(newBrightness);
    
    // Convert HSV to RGB
    const { r, g, b } = hsvToRgb(hue, newSaturation, newBrightness);
    setRed(r);
    setGreen(g);
    setBlue(b);
    
    // Update hex value
    const newHex = rgbToHex(r, g, b);
    setHexValue(newHex);
    onChange(newHex);
  };
  
  const handleHueChange = (value: number[]) => {
    const newHue = value[0];
    setHue(newHue);
    
    // Convert HSV to RGB
    const { r, g, b } = hsvToRgb(newHue, saturation, brightness);
    setRed(r);
    setGreen(g);
    setBlue(b);
    
    // Update hex value
    const newHex = rgbToHex(r, g, b);
    setHexValue(newHex);
    onChange(newHex);
  };
  
  const handleOpacityChange = (value: number[]) => {
    // For future implementation of opacity/alpha channel
    // Currently we just show the slider for visual consistency with the example
  };
  
  // Get the background for the spectrum based on current hue
  const getSpectrumBackground = () => {
    const pureColor = hsvToRgb(hue, 100, 100);
    return `linear-gradient(to right, white, rgb(${pureColor.r}, ${pureColor.g}, ${pureColor.b})), 
            linear-gradient(to bottom, rgba(0,0,0,0), black)`;
  };
  
  // Create a background for the hue slider that shows the spectrum of hues
  const hueGradient = "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";
  
  // Create a checkerboard pattern for the opacity slider background
  const opacityBackground = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAGUlEQVQYV2M4gwH+YwCGIasIUwhT25BVBADtzYNYrHvv4gAAAABJRU5ErkJggg==')";
  
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
          {/* Color spectrum */}
          <div 
            ref={spectrumRef}
            className="relative w-full h-40 rounded-md cursor-crosshair"
            style={{ 
              background: getSpectrumBackground(),
              backgroundBlendMode: "multiply"
            }}
            onClick={handleSpectrumClick}
          >
            {/* Indicator dot for current selection */}
            <div 
              className="absolute w-4 h-4 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ 
                left: `${saturation}%`, 
                top: `${100 - brightness}%`,
                backgroundColor: hexValue,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.3)"
              }}
            />
          </div>
          
          {/* Hue slider */}
          <div className="space-y-1.5">
            <Slider
              className="h-4 rounded-md"
              min={0}
              max={360}
              step={1}
              value={[hue]}
              onValueChange={handleHueChange}
              style={{ 
                background: hueGradient,
              }}
            />
          </div>
          
          {/* Opacity slider (visual only for now) */}
          <div className="space-y-1.5">
            <Slider
              className="h-4 rounded-md"
              min={0}
              max={100}
              step={1}
              value={[100]}
              onValueChange={handleOpacityChange}
              style={{ 
                background: opacityBackground,
              }}
            />
          </div>
          
          {/* Color value inputs */}
          <div className="grid grid-cols-4 gap-2 items-center">
            <Select defaultValue="hex">
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">Hex</SelectItem>
                <SelectItem value="rgb">RGB</SelectItem>
                <SelectItem value="hsl">HSL</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="col-span-2">
              <Input
                value={hexValue.substring(1)}
                onChange={(e) => handleHexChange({ target: { value: `#${e.target.value}` } } as React.ChangeEvent<HTMLInputElement>)}
                className="h-8"
              />
            </div>
            
            <div>
              <Input
                value="100%"
                className="h-8"
                readOnly
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}