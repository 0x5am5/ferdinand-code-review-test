/**
 * Design System Mapper
 * 
 * This utility converts design system objects into SCSS variables
 * and CSS custom properties that can be used throughout the application.
 */

export interface DesignSystem {
  theme: {
    variant: 'professional' | 'tint' | 'vibrant';
    primary: string;
    appearance: 'light' | 'dark' | 'system';
    radius: number;
    animation: string;
  };
  typography: {
    primary: string;
    heading: string;
  };
  colors: {
    primary: string;
    background: string;
    foreground: string;
    muted: string;
    'muted-foreground': string;
    card: string;
    'card-foreground': string;
    accent: string;
    'accent-foreground': string;
    destructive: string;
    'destructive-foreground': string;
    border: string;
    ring: string;
  };
}

/**
 * Converts a hex color to HSL format
 * @param hex Hex color string (e.g., "#FF0000")
 * @returns Object with h, s, l values
 */
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove the hash if it exists
  hex = hex.replace(/^#/, '');

  // Parse the r, g, b values
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  // Find the minimum and maximum values to calculate the lightness
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  // Only calculate hue and saturation if the color isn't grayscale
  if (max !== min) {
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

  // Convert to proper CSS HSL format
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return { h, s, l };
}

/**
 * Formats a color as an SCSS variable declaration
 * @param color Hex color
 * @param varName Name of the SCSS variable
 * @returns SCSS variable declaration string
 */
function colorToScssVar(color: string, varName: string): string {
  const hsl = hexToHSL(color);
  return `$${varName}: hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%);\n`;
}

/**
 * Generates core SCSS variables from a design system object
 * @param designSystem Design system configuration
 * @returns SCSS variables as a string
 */
export function generateCoreScssVariables(designSystem: DesignSystem): string {
  let scss = "// Core variables generated from design system\n\n";
  
  // Generate color variables
  scss += "// Brand colors\n";
  scss += colorToScssVar(designSystem.colors.primary, "color-brand-primary-base");
  
  // Generate a lighter and darker shade of the primary color
  const primaryHSL = hexToHSL(designSystem.colors.primary);
  const lighterPrimary = `hsl(${primaryHSL.h}, ${Math.min(primaryHSL.s + 10, 100)}%, ${Math.min(primaryHSL.l + 15, 95)}%)`;
  const darkerPrimary = `hsl(${primaryHSL.h}, ${Math.min(primaryHSL.s + 5, 100)}%, ${Math.max(primaryHSL.l - 15, 10)}%)`;
  
  scss += `$color-brand-primary-light1: ${lighterPrimary};\n`;
  scss += `$color-brand-primary-dark1: ${darkerPrimary};\n\n`;
  
  // Neutral colors
  scss += "// Neutral colors\n";
  scss += colorToScssVar(designSystem.colors.background, "color-neutral-background");
  scss += colorToScssVar(designSystem.colors.foreground, "color-neutral-foreground");
  scss += colorToScssVar(designSystem.colors.muted, "color-neutral-muted");
  scss += colorToScssVar(designSystem.colors["muted-foreground"], "color-neutral-muted-foreground");
  scss += colorToScssVar(designSystem.colors.border, "color-neutral-border");
  scss += "\n";
  
  // Component colors
  scss += "// Component colors\n";
  scss += colorToScssVar(designSystem.colors.card, "color-component-card");
  scss += colorToScssVar(designSystem.colors["card-foreground"], "color-component-card-foreground");
  scss += colorToScssVar(designSystem.colors.accent, "color-component-accent");
  scss += colorToScssVar(designSystem.colors["accent-foreground"], "color-component-accent-foreground");
  scss += colorToScssVar(designSystem.colors.destructive, "color-component-destructive");
  scss += colorToScssVar(designSystem.colors["destructive-foreground"], "color-component-destructive-foreground");
  scss += colorToScssVar(designSystem.colors.ring, "color-component-ring");
  scss += "\n";
  
  // Typography
  scss += "// Typography\n";
  scss += `$font-family-primary: ${designSystem.typography.primary};\n`;
  scss += `$font-family-heading: ${designSystem.typography.heading};\n\n`;
  
  // Border radius
  scss += "// Border radius\n";
  scss += `$border-radius-base: ${designSystem.theme.radius}px;\n`;
  scss += `$border-radius-small: ${Math.max(designSystem.theme.radius - 2, 0)}px;\n`;
  scss += `$border-radius-large: ${designSystem.theme.radius + 4}px;\n\n`;
  
  // Animation
  scss += "// Animation\n";
  scss += `$animation-default: ${designSystem.theme.animation};\n`;
  
  return scss;
}

/**
 * Converts a design system to CSS variables for direct application to elements
 * @param designSystem Design system configuration 
 * @returns CSS variables as a string
 */
export function designSystemToCssVariables(designSystem: DesignSystem): string {
  const hslColor = (color: string) => {
    const { h, s, l } = hexToHSL(color);
    return `${h} ${s}% ${l}%`;
  };

  return `
    --color-primary: ${hslColor(designSystem.colors.primary)};
    --color-background: ${hslColor(designSystem.colors.background)};
    --color-foreground: ${hslColor(designSystem.colors.foreground)};
    --color-muted: ${hslColor(designSystem.colors.muted)};
    --color-muted-foreground: ${hslColor(designSystem.colors["muted-foreground"])};
    --color-card: ${hslColor(designSystem.colors.card)};
    --color-card-foreground: ${hslColor(designSystem.colors["card-foreground"])};
    --color-accent: ${hslColor(designSystem.colors.accent)};
    --color-accent-foreground: ${hslColor(designSystem.colors["accent-foreground"])};
    --color-destructive: ${hslColor(designSystem.colors.destructive)};
    --color-destructive-foreground: ${hslColor(designSystem.colors["destructive-foreground"])};
    --color-border: ${hslColor(designSystem.colors.border)};
    --color-ring: ${hslColor(designSystem.colors.ring)};
    --font-family-primary: ${designSystem.typography.primary};
    --font-family-heading: ${designSystem.typography.heading};
    --border-radius: ${designSystem.theme.radius}px;
    --animation: ${designSystem.theme.animation};
  `;
}

/**
 * Applies a design system directly to an HTML element via inline styles
 * @param element HTML element to style
 * @param designSystem Design system to apply
 */
export function applyDesignSystemToElement(
  element: HTMLElement, 
  designSystem: DesignSystem
): void {
  element.style.cssText += designSystemToCssVariables(designSystem);
}