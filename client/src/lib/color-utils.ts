// Color utility functions for converting colors between different formats

export interface ColorFormats {
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  cmyk: { c: number; m: number; y: number; k: number };
  hex: string;
  pantone?: string;
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

// Convert RGB to HSL
function rgbToHsl(
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

// Convert RGB to CMYK
function rgbToCmyk(
  r: number,
  g: number,
  b: number
): { c: number; m: number; y: number; k: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const k = 1 - Math.max(r, g, b);
  const c = k === 1 ? 0 : (1 - r - k) / (1 - k);
  const m = k === 1 ? 0 : (1 - g - k) / (1 - k);
  const y = k === 1 ? 0 : (1 - b - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

// Main conversion function
export function convertColor(hex: string, pantone?: string): ColorFormats {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);

  return {
    rgb,
    hsl,
    cmyk,
    hex: hex.toUpperCase(),
    pantone,
  };
}

// Format color for copying to clipboard
export function formatColorForCopy(
  format: "rgb" | "hsl" | "cmyk" | "hex" | "pantone",
  colorFormats: ColorFormats
): string | null {
  switch (format) {
    case "rgb":
      return `rgb(${colorFormats.rgb.r}, ${colorFormats.rgb.g}, ${colorFormats.rgb.b})`;
    case "hsl":
      return `hsl(${colorFormats.hsl.h}, ${colorFormats.hsl.s}%, ${colorFormats.hsl.l}%)`;
    case "cmyk":
      return `cmyk(${colorFormats.cmyk.c}%, ${colorFormats.cmyk.m}%, ${colorFormats.cmyk.y}%, ${colorFormats.cmyk.k}%)`;
    case "hex":
      return colorFormats.hex;
    case "pantone":
      return colorFormats.pantone || "";
    default:
      return null;
  }
}

// Pantone value storage (using localStorage for persistence)
export function getPantoneValue(colorId: string): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem(`pantone-${colorId}`) || "";
  }
  return "";
}

export function setPantoneValue(colorId: string, value: string): void {
  if (typeof window !== "undefined") {
    if (value) {
      localStorage.setItem(`pantone-${colorId}`, value);
    } else {
      localStorage.removeItem(`pantone-${colorId}`);
    }
  }
}

// Calculate relative luminance for WCAG contrast ratio
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : ((val + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Get contrasting text color (black or white) based on background color
export function getContrastingTextColor(backgroundColor: string): string {
  // Handle hsl() format
  if (backgroundColor.startsWith("hsl(")) {
    // For HSL from CSS variables, use a safe default
    // We'd need the actual computed value to calculate properly
    return "#000000"; // Default to black for light backgrounds
  }

  // Handle hex colors
  const rgb = hexToRgb(backgroundColor);
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

  // WCAG recommends 4.5:1 contrast ratio for normal text
  // Luminance threshold of 0.5 roughly corresponds to this
  return luminance > 0.5 ? "#000000" : "#ffffff";
}
