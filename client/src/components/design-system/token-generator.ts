// Token generator for converting raw design tokens to semantic design tokens

export interface RawTokens {
  typography: {
    fontSizeBase: number;
    lineHeightBase: number;
    typeScaleBase: number;
    letterSpacingBase: number;
    fontFamily1Base: string;
    fontFamily2Base: string;
    fontFamilyMonoBase: string;
  };
  colors: {
    brandPrimaryBase: string;
    brandSecondaryBase: string;
    neutralBase: string;
    interactiveSuccessBase: string;
    interactiveWarningBase: string;
    interactiveErrorBase: string;
    interactiveInfoBase: string;
  };
  spacing: {
    spacingUnitBase: number;
    spacingScaleBase: number;
  };
  borders: {
    borderWidthBase: number;
    borderRadiusBase: number;
  };
  components: {
    button: {
      primaryBackgroundColor: string;
      primaryTextColor: string;
      secondaryBackgroundColor: string;
      secondaryTextColor: string;
      borderRadius: string;
    };
    input: {
      backgroundColor: string;
      borderColor: string;
      textColor: string;
      borderRadius: string;
    };
    card: {
      backgroundColor: string;
      borderColor: string;
      borderRadius: string;
    };
  };
}

export interface SemanticTokens {
  typography: {
    fontFamilyHeading: string;
    fontFamilyBody: string;
    fontFamilyMono: string;
    fontSizeH1: string;
    fontSizeH2: string;
    fontSizeH3: string;
    fontSizeBody: string;
    fontSizeSmall: string;
    lineHeightHeading: number;
    lineHeightBody: number;
    letterSpacingTight: string;
    letterSpacingNormal: string;
    letterSpacingLoose: string;
  };
  colors: {
    // Brand colors with variations
    brandPrimary: string;
    brandPrimaryLight: string;
    brandPrimaryXLight: string;
    brandPrimaryDark: string;
    brandPrimaryXDark: string;
    brandSecondary: string;
    brandSecondaryLight: string;
    brandSecondaryXLight: string;
    brandSecondaryDark: string;
    brandSecondaryXDark: string;

    // Neutral scale (0-10)
    neutral0: string;
    neutral1: string;
    neutral2: string;
    neutral3: string;
    neutral4: string;
    neutral5: string;
    neutral6: string;
    neutral7: string;
    neutral8: string;
    neutral9: string;
    neutral10: string;

    // Semantic text colors
    textHeading: string;
    textBody: string;
    textMuted: string;
    textLink: string;

    // Background colors
    backgroundPage: string;
    backgroundSurface: string;
    backgroundOverlay: string;

    // Interactive colors
    successLight: string;
    success: string;
    successDark: string;
    warningLight: string;
    warning: string;
    warningDark: string;
    errorLight: string;
    error: string;
    errorDark: string;
    infoLight: string;
    info: string;
    infoDark: string;

    // Button colors
    buttonPrimaryBg: string;
    buttonPrimaryText: string;
    buttonSecondaryBg: string;
    buttonSecondaryText: string;
  };
  spacing: {
    xs: string;
    s: string;
    m: string;
    l: string;
    xl: string;
    xxl: string;
  };
  borders: {
    widthThin: string;
    widthThick: string;
    radiusSmall: string;
    radiusButton: string;
    radiusCard: string;
    radiusLarge: string;
  };
  shadows: {
    elevationCard: string;
    elevationModal: string;
    elevationButtonHover: string;
  };
  transitions: {
    fast: string;
    medium: string;
    slow: string;
    button: string;
  };
}

// Helper functions for color manipulation
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

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function lightenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amount = Math.round(2.55 * percent);
  const newR = Math.min(255, r + amount);
  const newG = Math.min(255, g + amount);
  const newB = Math.min(255, b + amount);
  return rgbToHex(newR, newG, newB);
}

function darkenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amount = Math.round(2.55 * percent);
  const newR = Math.max(0, r - amount);
  const newG = Math.max(0, g - amount);
  const newB = Math.max(0, b - amount);
  return rgbToHex(newR, newG, newB);
}

function parseHslToRgb(hsl: string): { r: number; g: number; b: number } {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return { r: 128, g: 128, b: 128 };

  const h = parseInt(match[1], 10) / 360;
  const s = parseInt(match[2], 10) / 100;
  const l = parseInt(match[3], 10) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function generateNeutralScale(neutralBase: string): Record<string, string> {
  let baseRgb: { r: number; g: number; b: number };

  if (neutralBase.startsWith("hsl")) {
    baseRgb = parseHslToRgb(neutralBase);
  } else {
    baseRgb = hexToRgb(neutralBase);
  }

  const baseHex = rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b);

  return {
    neutral0: "#ffffff",
    neutral1: lightenColor(baseHex, 45),
    neutral2: lightenColor(baseHex, 40),
    neutral3: lightenColor(baseHex, 30),
    neutral4: lightenColor(baseHex, 20),
    neutral5: baseHex,
    neutral6: darkenColor(baseHex, 10),
    neutral7: darkenColor(baseHex, 20),
    neutral8: darkenColor(baseHex, 30),
    neutral9: darkenColor(baseHex, 40),
    neutral10: "#000000",
  };
}

export function generateSemanticTokens(rawTokens: RawTokens): SemanticTokens {
  // Typography calculations
  const typeScale = rawTokens.typography.typeScaleBase;
  const baseFontSize = rawTokens.typography.fontSizeBase;

  const fontSizeH1 = `${baseFontSize * typeScale ** 3}rem`;
  const fontSizeH2 = `${baseFontSize * typeScale ** 2}rem`;
  const fontSizeH3 = `${baseFontSize * typeScale}rem`;
  const fontSizeBody = `${baseFontSize}rem`;
  const fontSizeSmall = `${baseFontSize * 0.875}rem`;

  // Spacing calculations
  const spaceBase = rawTokens.spacing.spacingUnitBase;
  const spaceScale = rawTokens.spacing.spacingScaleBase;

  // Color calculations
  const neutralScale = generateNeutralScale(rawTokens.colors.neutralBase);

  const brandPrimaryVariations = {
    brandPrimary: rawTokens.colors.brandPrimaryBase,
    brandPrimaryXLight: lightenColor(rawTokens.colors.brandPrimaryBase, 30),
    brandPrimaryLight: lightenColor(rawTokens.colors.brandPrimaryBase, 15),
    brandPrimaryDark: darkenColor(rawTokens.colors.brandPrimaryBase, 15),
    brandPrimaryXDark: darkenColor(rawTokens.colors.brandPrimaryBase, 30),
  };

  const brandSecondaryVariations = {
    brandSecondary: rawTokens.colors.brandSecondaryBase,
    brandSecondaryXLight: lightenColor(rawTokens.colors.brandSecondaryBase, 30),
    brandSecondaryLight: lightenColor(rawTokens.colors.brandSecondaryBase, 15),
    brandSecondaryDark: darkenColor(rawTokens.colors.brandSecondaryBase, 15),
    brandSecondaryXDark: darkenColor(rawTokens.colors.brandSecondaryBase, 30),
  };

  const interactiveVariations = {
    successLight: lightenColor(rawTokens.colors.interactiveSuccessBase, 15),
    success: rawTokens.colors.interactiveSuccessBase,
    successDark: darkenColor(rawTokens.colors.interactiveSuccessBase, 15),
    warningLight: lightenColor(rawTokens.colors.interactiveWarningBase, 15),
    warning: rawTokens.colors.interactiveWarningBase,
    warningDark: darkenColor(rawTokens.colors.interactiveWarningBase, 15),
    errorLight: lightenColor(rawTokens.colors.interactiveErrorBase, 15),
    error: rawTokens.colors.interactiveErrorBase,
    errorDark: darkenColor(rawTokens.colors.interactiveErrorBase, 15),
    infoLight: lightenColor(rawTokens.colors.interactiveInfoBase, 15),
    info: rawTokens.colors.interactiveInfoBase,
    infoDark: darkenColor(rawTokens.colors.interactiveInfoBase, 15),
  };

  const colors = {
    // Brand primary variations
    brandPrimary: brandPrimaryVariations.brandPrimary,
    brandPrimaryLight: brandPrimaryVariations.brandPrimaryLight,
    brandPrimaryXLight: brandPrimaryVariations.brandPrimaryXLight,
    brandPrimaryDark: brandPrimaryVariations.brandPrimaryDark,
    brandPrimaryXDark: brandPrimaryVariations.brandPrimaryXDark,
    // Brand secondary variations
    brandSecondary: brandSecondaryVariations.brandSecondary,
    brandSecondaryLight: brandSecondaryVariations.brandSecondaryLight,
    brandSecondaryXLight: brandSecondaryVariations.brandSecondaryXLight,
    brandSecondaryDark: brandSecondaryVariations.brandSecondaryDark,
    brandSecondaryXDark: brandSecondaryVariations.brandSecondaryXDark,
    // Neutral scale explicitly
    neutral0: neutralScale.neutral0,
    neutral1: neutralScale.neutral1,
    neutral2: neutralScale.neutral2,
    neutral3: neutralScale.neutral3,
    neutral4: neutralScale.neutral4,
    neutral5: neutralScale.neutral5,
    neutral6: neutralScale.neutral6,
    neutral7: neutralScale.neutral7,
    neutral8: neutralScale.neutral8,
    neutral9: neutralScale.neutral9,
    neutral10: neutralScale.neutral10,
    // Interactive variations
    successLight: interactiveVariations.successLight,
    success: interactiveVariations.success,
    successDark: interactiveVariations.successDark,
    warningLight: interactiveVariations.warningLight,
    warning: interactiveVariations.warning,
    warningDark: interactiveVariations.warningDark,
    errorLight: interactiveVariations.errorLight,
    error: interactiveVariations.error,
    errorDark: interactiveVariations.errorDark,
    infoLight: interactiveVariations.infoLight,
    info: interactiveVariations.info,
    infoDark: interactiveVariations.infoDark,

    // Semantic text colors
    textHeading: neutralScale.neutral9,
    textBody: neutralScale.neutral7,
    textMuted: neutralScale.neutral5,
    textLink: rawTokens.colors.brandPrimaryBase,

    // Background colors
    backgroundPage: neutralScale.neutral0,
    backgroundSurface: "#ffffff",
    backgroundOverlay: "rgba(0, 0, 0, 0.5)",

    // Button colors (resolved from component tokens)
    buttonPrimaryBg:
      rawTokens.components.button.primaryBackgroundColor === "brandPrimaryBase"
        ? rawTokens.colors.brandPrimaryBase
        : rawTokens.components.button.primaryBackgroundColor,
    buttonPrimaryText: rawTokens.components.button.primaryTextColor,
    buttonSecondaryBg: rawTokens.components.button.secondaryBackgroundColor,
    buttonSecondaryText:
      rawTokens.components.button.secondaryTextColor === "brandPrimaryBase"
        ? rawTokens.colors.brandPrimaryBase
        : rawTokens.components.button.secondaryTextColor,
  };

  return {
    typography: {
      fontFamilyHeading: rawTokens.typography.fontFamily1Base,
      fontFamilyBody: rawTokens.typography.fontFamily2Base,
      fontFamilyMono: rawTokens.typography.fontFamilyMonoBase,
      fontSizeH1,
      fontSizeH2,
      fontSizeH3,
      fontSizeBody,
      fontSizeSmall,
      lineHeightHeading: rawTokens.typography.lineHeightBase * 0.9,
      lineHeightBody: rawTokens.typography.lineHeightBase,
      letterSpacingTight: `${rawTokens.typography.letterSpacingBase - 0.025}em`,
      letterSpacingNormal: `${rawTokens.typography.letterSpacingBase}em`,
      letterSpacingLoose: `${rawTokens.typography.letterSpacingBase + 0.025}em`,
    },
    colors,
    spacing: {
      xs: `${spaceBase * 0.25}rem`,
      s: `${spaceBase * 0.5}rem`,
      m: `${spaceBase}rem`,
      l: `${spaceBase * spaceScale}rem`,
      xl: `${spaceBase * spaceScale ** 2}rem`,
      xxl: `${spaceBase * spaceScale ** 3}rem`,
    },
    borders: {
      widthThin: `${rawTokens.borders.borderWidthBase}px`,
      widthThick: `${rawTokens.borders.borderWidthBase * 2}px`,
      radiusSmall: `${rawTokens.borders.borderRadiusBase * 0.5}px`,
      radiusButton: `${rawTokens.borders.borderRadiusBase}px`,
      radiusCard: `${rawTokens.borders.borderRadiusBase * 1.5}px`,
      radiusLarge: `${rawTokens.borders.borderRadiusBase * 2}px`,
    },
    shadows: {
      elevationCard:
        "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
      elevationModal:
        "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
      elevationButtonHover: "0 2px 4px rgba(0, 0, 0, 0.1)",
    },
    transitions: {
      fast: "150ms ease-in-out",
      medium: "250ms ease-in-out",
      slow: "500ms ease-in-out",
      button: "200ms ease-in-out",
    },
  };
}
