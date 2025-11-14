// Color utility functions for converting colors between different formats

export interface ColorFormats {
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  cmyk: { c: number; m: number; y: number; k: number };
  hex: string;
  pantone?: string;
}

// Color data structure for brand assets
export type ColorData = {
  hex: string;
  rgb?: string;
  hsl?: string;
  cmyk?: string;
  pantone?: string;
};

// Convert hex to RGB (internal use - returns object)
function hexToRgbObject(hex: string): { r: number; g: number; b: number } {
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
  const rgb = hexToRgbObject(hex);
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
  const rgb = hexToRgbObject(backgroundColor);
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

  // WCAG recommends 4.5:1 contrast ratio for normal text
  // Luminance threshold of 0.5 roughly corresponds to this
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

// Color conversion utilities (string format output)
export function hexToRgb(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgb(${r}, ${g}, ${b})`;
}

// Internal helper: Convert hex to HSL values
function parseHexToHslValues(
  hex: string
): { h: number; s: number; l: number } | null {
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

  return { h: h * 360, s, l };
}

export function hexToHsl(hex: string): string | null {
  const hsl = parseHexToHslValues(hex);
  if (!hsl) return null;

  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
}

export function hexToCmyk(hex: string): string | null {
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

export function generateTintsAndShades(
  hex: string,
  tintPercents = [60, 40, 20],
  shadePercents = [20, 40, 60]
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

// Convert hex to HSL values (returns object with h, s, l)
export function hexToHslValues(
  hex: string
): { h: number; s: number; l: number } | null {
  return parseHexToHslValues(hex);
}

// Convert HSL to hex
export function hslToHex(h: number, s: number, l: number): string {
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
export function isColorFamily(
  hex: string,
  family: "green" | "yellow" | "red" | "blue"
): boolean {
  const hsl = hexToHslValues(hex);
  if (!hsl) return false;

  const hue = hsl.h;

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

// Check if a color is light (for determining text contrast)
export function isLightColor(hex: string): boolean {
  const cleanHex = hex.replace("#", "");
  return parseInt(cleanHex, 16) > 0xffffff / 2;
}

// Extract hue and saturation from brand colors for neutral generation
export function extractBrandColorProperties(
  brandColors: ColorData[],
  baseGreyHex: string | null = null,
  regenerationCount = 0
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
    0.07
  );

  return {
    hue: adjustedHue,
    maxSaturation: adjustedSaturation,
    lightnessShift: variation.lightnessShift,
  };
}

// Generate interactive colors based on brand colors
export function generateInteractiveColors(brandColors: ColorData[]) {
  // First, check if any brand colors match our target families
  const existingGreen = brandColors.find((color) =>
    isColorFamily(color.hex, "green")
  );
  const existingYellow = brandColors.find((color) =>
    isColorFamily(color.hex, "yellow")
  );
  const existingRed = brandColors.find((color) =>
    isColorFamily(color.hex, "red")
  );
  const existingBlue = brandColors.find((color) =>
    isColorFamily(color.hex, "blue")
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
