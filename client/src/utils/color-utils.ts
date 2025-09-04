// Color conversion utilities
export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgb(${r}, ${g}, ${b})`;
}

export function hexToHsl(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s,
    l = (max + min) / 2;

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

export function hexToCmyk(hex: string) {
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

export function generateNeutralPalette(baseGrey: string) {
  // Generate 10 shades from white to black
  const tints = generateTintsAndShades(baseGrey, [90, 80, 70, 60, 50]).tints;
  const shades = generateTintsAndShades(baseGrey, [40, 30, 20, 10, 5]).shades;
  return [...tints, baseGrey, ...shades];
}

export function generateContainerColors(baseColor: string) {
  // Updated to use 60% for both lighter and darker values
  const { tints, shades } = generateTintsAndShades(baseColor, [60], [60]);
  return {
    container: tints[0],
    onContainer: shades[0],
  };
}

// Convert hex to HSL values (returns object with h, s, l)
export function hexToHslValues(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s,
    l = (max + min) / 2;

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
export function hslToHex(h: number, s: number, l: number) {
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

// Extract hue and saturation from brand colors for neutral generation
export function extractBrandColorProperties(
  brandColors: { hex: string }[],
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
export function generateInteractiveColors(brandColors: { hex: string }[]) {
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
