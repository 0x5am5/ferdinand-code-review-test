export interface ColorData {
  id?: number;
  hex: string;
  rgb?: string;
  hsl?: string;
  cmyk?: string;
  pantone?: string;
  name: string;
  category: "brand" | "neutral" | "interactive";
  data?: any; // Include data property to preserve gradient information
}

// Color category descriptions
export const colorDescriptions = {
  brand:
    "Primary colors that define the brand identity and should be used consistently across all materials.",
  neutral:
    "Supporting colors for backgrounds, text, and UI elements that provide balance to the color system.",
  interactive:
    "Colors used for buttons, links, and interactive elements to guide user actions.",
};
