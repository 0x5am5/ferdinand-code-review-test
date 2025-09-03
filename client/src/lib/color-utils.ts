export interface ColorFormats {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  cmyk: { c: number; m: number; y: number; k: number };
  pantone: string;
}

/**
 * Convert HEX color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Parse RGB values
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  return { r, g, b };
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

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

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert RGB to CMYK
 */
export function rgbToCmyk(
  r: number,
  g: number,
  b: number
): { c: number; m: number; y: number; k: number } {
  // Normalize RGB values
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  // Calculate K (black)
  const k = 1 - Math.max(rNorm, gNorm, bNorm);

  // Calculate CMY
  const c = k === 1 ? 0 : (1 - rNorm - k) / (1 - k);
  const m = k === 1 ? 0 : (1 - gNorm - k) / (1 - k);
  const y = k === 1 ? 0 : (1 - bNorm - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

/**
 * Convert HEX color to all formats
 */
export function convertColor(hex: string, pantone = ""): ColorFormats {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);

  return {
    hex,
    rgb,
    hsl,
    cmyk,
    pantone,
  };
}

/**
 * Format color values for copying
 */
export function formatColorForCopy(
  format: "rgb" | "hsl" | "cmyk" | "hex" | "pantone",
  colorFormats: ColorFormats
): string {
  switch (format) {
    case "rgb":
      return `rgb(${colorFormats.rgb.r}, ${colorFormats.rgb.g}, ${colorFormats.rgb.b})`;
    case "hsl":
      return `hsl(${colorFormats.hsl.h}°, ${colorFormats.hsl.s}%, ${colorFormats.hsl.l}%)`;
    case "cmyk":
      return `cmyk(${colorFormats.cmyk.c}%, ${colorFormats.cmyk.m}%, ${colorFormats.cmyk.y}%, ${colorFormats.cmyk.k}%)`;
    case "hex":
      return colorFormats.hex;
    case "pantone":
      return colorFormats.pantone || "";
    default:
      return "";
  }
}

/**
 * Get/Set Pantone values from localStorage
 */
export function getPantoneValue(colorId: string): string {
  try {
    const pantoneData = localStorage.getItem("pantone-values");
    if (pantoneData) {
      const parsed = JSON.parse(pantoneData);
      return parsed[colorId] || "";
    }
  } catch (error: unknown) {
    console.warn("Error reading Pantone values from localStorage:", error);
  }
  return "";
}

export function setPantoneValue(colorId: string, pantone: string): void {
  try {
    const pantoneData = localStorage.getItem("pantone-values");
    const parsed = pantoneData ? JSON.parse(pantoneData) : {};
    parsed[colorId] = pantone;
    localStorage.setItem("pantone-values", JSON.stringify(parsed));
  } catch (error: unknown) {
    console.warn("Error saving Pantone value to localStorage:", error);
  }
}
