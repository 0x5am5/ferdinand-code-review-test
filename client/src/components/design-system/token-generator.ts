// Token generation utilities for semantic tokens from raw tokens
import chroma from "chroma-js";

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
}

export interface SemanticTokens {
  typography: {
    fontFamilyHeading: string;
    fontFamilyBody: string;
    fontFamilyCode: string;
    fontSizeH1: string;
    fontSizeH2: string;
    fontSizeH3: string;
    fontSizeH4: string;
    fontSizeH5: string;
    fontSizeH6: string;
    fontSizeBody: string;
    fontSizeCaption: string;
    fontSizeCode: string;
    lineHeightHeading: number;
    lineHeightBody: number;
    lineHeightCaption: number;
    lineHeightCode: number;
    fontWeightHeading: number;
    fontWeightBody: number;
    fontWeightCaption: number;
    fontWeightCode: number;
    letterSpacingHeading: number;
    letterSpacingBody: number;
    letterSpacingCaption: number;
    letterSpacingCode: number;
  };
  colors: {
    // Neutral scale (11 shades)
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

    // Brand variations
    brandPrimaryXLight: string;
    brandPrimaryLight: string;
    brandPrimary: string;
    brandPrimaryDark: string;
    brandPrimaryXDark: string;

    brandSecondaryXLight: string;
    brandSecondaryLight: string;
    brandSecondary: string;
    brandSecondaryDark: string;
    brandSecondaryXDark: string;

    // Interactive variations
    successLight: string;
    successDark: string;
    warningLight: string;
    warningDark: string;
    errorLight: string;
    errorDark: string;
    infoLight: string;
    infoDark: string;

    // Semantic color mappings
    textHeading: string;
    textBody: string;
    textMuted: string;
    textInverted: string;
    textLink: string;
    textLinkHover: string;
    textError: string;
    textSuccess: string;

    backgroundPage: string;
    backgroundSurface: string;
    backgroundMuted: string;
    backgroundOverlay: string;
    backgroundInverted: string;

    borderDefault: string;
    borderMuted: string;
    borderActive: string;
    borderError: string;
    borderSuccess: string;

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
    xxxl: string;
    xxxxl: string;

    // Semantic spacing
    paddingBody: string;
    paddingSection: string;
    paddingCard: string;
    paddingButton: string;
    marginHeading: string;
    marginParagraph: string;
    gapUI: string;
  };
  borders: {
    radiusXs: string;
    radiusS: string;
    radiusM: string;
    radiusL: string;
    radiusXl: string;

    // Semantic borders
    input: string;
    button: string;
    card: string;
    radiusButton: string;
    radiusInput: string;
    radiusCard: string;
  };
  shadows: {
    elevation0: string;
    elevation1: string;
    elevation2: string;
    elevation3: string;
    elevation4: string;
    elevation5: string;

    // Semantic shadows
    elevationCard: string;
    elevationModal: string;
    elevationButtonHover: string;
  };
  transitions: {
    ui: string;
    button: string;
    input: string;
  };
}

export function generateSemanticTokens(rawTokens: RawTokens): SemanticTokens {
  const { typography, colors, spacing, borders } = rawTokens;

  // Generate typography semantic tokens
  const typographyTokens = {
    fontFamilyHeading: typography.fontFamily1Base,
    fontFamilyBody: typography.fontFamily2Base,
    fontFamilyCode: typography.fontFamilyMonoBase,

    fontSizeH1: `${typography.fontSizeBase * typography.typeScaleBase ** 3}rem`,
    fontSizeH2: `${typography.fontSizeBase * typography.typeScaleBase ** 2}rem`,
    fontSizeH3: `${typography.fontSizeBase * typography.typeScaleBase}rem`,
    fontSizeH4: `${typography.fontSizeBase}rem`,
    fontSizeH5: `${typography.fontSizeBase / typography.typeScaleBase}rem`,
    fontSizeH6: `${typography.fontSizeBase / typography.typeScaleBase ** 2}rem`,
    fontSizeBody: `${typography.fontSizeBase}rem`,
    fontSizeCaption: `${typography.fontSizeBase / typography.typeScaleBase ** 2}rem`,
    fontSizeCode: `${typography.fontSizeBase / typography.typeScaleBase}rem`,

    lineHeightHeading: typography.lineHeightBase * 1.2,
    lineHeightBody: typography.lineHeightBase,
    lineHeightCaption: typography.lineHeightBase * 0.9,
    lineHeightCode: typography.lineHeightBase * 0.9,

    fontWeightHeading: 700,
    fontWeightBody: 400,
    fontWeightCaption: 500,
    fontWeightCode: 400,

    letterSpacingHeading: typography.letterSpacingBase * 0.8,
    letterSpacingBody: typography.letterSpacingBase,
    letterSpacingCaption: typography.letterSpacingBase * 1.2,
    letterSpacingCode: typography.letterSpacingBase,
  };

  // Generate neutral color scale (11 shades)
  const neutralScale = generateNeutralScale(colors.neutralBase);

  // Generate brand color variations
  const brandPrimaryVariations = generateColorVariations(
    colors.brandPrimaryBase
  );
  const brandSecondaryVariations = generateColorVariations(
    colors.brandSecondaryBase
  );

  // Generate interactive color variations
  const successVariations = generateColorVariations(
    colors.interactiveSuccessBase
  );
  const warningVariations = generateColorVariations(
    colors.interactiveWarningBase
  );
  const errorVariations = generateColorVariations(colors.interactiveErrorBase);
  const infoVariations = generateColorVariations(colors.interactiveInfoBase);

  const colorTokens = {
    // Neutral scale
    neutral0: neutralScale[0],
    neutral1: neutralScale[1],
    neutral2: neutralScale[2],
    neutral3: neutralScale[3],
    neutral4: neutralScale[4],
    neutral5: neutralScale[5],
    neutral6: neutralScale[6],
    neutral7: neutralScale[7],
    neutral8: neutralScale[8],
    neutral9: neutralScale[9],
    neutral10: neutralScale[10],

    // Brand variations
    brandPrimaryXLight: brandPrimaryVariations.xLight,
    brandPrimaryLight: brandPrimaryVariations.light,
    brandPrimary: colors.brandPrimaryBase,
    brandPrimaryDark: brandPrimaryVariations.dark,
    brandPrimaryXDark: brandPrimaryVariations.xDark,

    brandSecondaryXLight: brandSecondaryVariations.xLight,
    brandSecondaryLight: brandSecondaryVariations.light,
    brandSecondary: colors.brandSecondaryBase,
    brandSecondaryDark: brandSecondaryVariations.dark,
    brandSecondaryXDark: brandSecondaryVariations.xDark,

    // Interactive variations
    successLight: successVariations.light,
    successDark: successVariations.dark,
    warningLight: warningVariations.light,
    warningDark: warningVariations.dark,
    errorLight: errorVariations.light,
    errorDark: errorVariations.dark,
    infoLight: infoVariations.light,
    infoDark: infoVariations.dark,

    // Semantic color mappings
    textHeading: colors.brandSecondaryBase,
    textBody: neutralScale[9],
    textMuted: neutralScale[5],
    textInverted: "#ffffff",
    textLink: colors.brandPrimaryBase,
    textLinkHover: brandPrimaryVariations.dark,
    textError: errorVariations.dark,
    textSuccess: successVariations.dark,

    backgroundPage: neutralScale[0],
    backgroundSurface: neutralScale[1],
    backgroundMuted: neutralScale[2],
    backgroundOverlay: "rgba(0, 0, 0, 0.6)",
    backgroundInverted: brandPrimaryVariations.dark,

    borderDefault: "rgba(0, 0, 0, 0.1)",
    borderMuted: neutralScale[3],
    borderActive: colors.brandPrimaryBase,
    borderError: errorVariations.dark,
    borderSuccess: successVariations.dark,

    buttonPrimaryBg: colors.brandPrimaryBase,
    buttonPrimaryText: "#ffffff",
    buttonSecondaryBg: neutralScale[2],
    buttonSecondaryText: colors.brandSecondaryBase,
  };

  // Generate spacing semantic tokens
  const spacingTokens = {
    xs: `${spacing.spacingUnitBase / spacing.spacingScaleBase ** 2}rem`,
    s: `${spacing.spacingUnitBase / spacing.spacingScaleBase}rem`,
    m: `${spacing.spacingUnitBase}rem`,
    l: `${spacing.spacingUnitBase * spacing.spacingScaleBase}rem`,
    xl: `${spacing.spacingUnitBase * spacing.spacingScaleBase ** 2}rem`,
    xxl: `${spacing.spacingUnitBase * spacing.spacingScaleBase ** 3}rem`,
    xxxl: `${spacing.spacingUnitBase * spacing.spacingScaleBase ** 4}rem`,
    xxxxl: `${spacing.spacingUnitBase * spacing.spacingScaleBase ** 5}rem`,

    // Semantic spacing
    paddingBody: `${spacing.spacingUnitBase}rem`,
    paddingSection: `${spacing.spacingUnitBase * spacing.spacingScaleBase ** 2}rem`,
    paddingCard: `${spacing.spacingUnitBase * spacing.spacingScaleBase}rem`,
    paddingButton: `${spacing.spacingUnitBase / spacing.spacingScaleBase}rem ${spacing.spacingUnitBase}rem`,
    marginHeading: `${spacing.spacingUnitBase * spacing.spacingScaleBase}rem 0 ${spacing.spacingUnitBase}rem 0`,
    marginParagraph: `${spacing.spacingUnitBase}rem 0`,
    gapUI: `${spacing.spacingUnitBase / spacing.spacingScaleBase}rem`,
  };

  // Generate border semantic tokens
  const borderTokens = {
    radiusXs: `${borders.borderRadiusBase * 0.25}px`,
    radiusS: `${borders.borderRadiusBase * 0.5}px`,
    radiusM: `${borders.borderRadiusBase}px`,
    radiusL: `${borders.borderRadiusBase * 1.5}px`,
    radiusXl: `${borders.borderRadiusBase * 2}px`,

    // Semantic borders
    input: `${borders.borderWidthBase}px solid rgba(0, 0, 0, 0.1)`,
    button: `${borders.borderWidthBase}px solid rgba(0, 0, 0, 0.1)`,
    card: `${borders.borderWidthBase}px solid rgba(0, 0, 0, 0.1)`,
    radiusButton: `${borders.borderRadiusBase * 0.5}px`,
    radiusInput: `${borders.borderRadiusBase * 0.5}px`,
    radiusCard: `${borders.borderRadiusBase}px`,
  };

  // Generate shadow tokens
  const shadowTokens = {
    elevation0: "none",
    elevation1: "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
    elevation2: "0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)",
    elevation3:
      "0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)",
    elevation4:
      "0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22)",
    elevation5:
      "0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22)",

    // Semantic shadows
    elevationCard:
      "0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)",
    elevationModal:
      "0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22)",
    elevationButtonHover:
      "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
  };

  // Generate transition tokens
  const transitionTokens = {
    ui: "all 200ms ease-in-out",
    button: "background-color 200ms ease-in-out",
    input: "border-color 200ms ease-in-out",
  };

  return {
    typography: typographyTokens,
    colors: colorTokens,
    spacing: spacingTokens,
    borders: borderTokens,
    shadows: shadowTokens,
    transitions: transitionTokens,
  };
}

function generateNeutralScale(neutralBase: string): string[] {
  try {
    // Parse HSL string like "hsl(0, 0%, 60%)"
    const hslMatch = neutralBase.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!hslMatch) {
      // Fallback to default gray scale
      return [
        "#ffffff",
        "#f8f9fa",
        "#e9ecef",
        "#dee2e6",
        "#ced4da",
        "#adb5bd",
        "#6c757d",
        "#495057",
        "#343a40",
        "#212529",
        "#000000",
      ];
    }

    const [, h, s] = hslMatch;
    const hue = parseInt(h);
    const saturation = parseInt(s);

    // Generate 11 shades from light to dark
    const shades = [];
    for (let i = 0; i <= 10; i++) {
      const lightness = 100 - i * 10; // 100%, 90%, 80%, ..., 0%
      shades.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }

    return shades;
  } catch (error: unknown) {
    console.error("Error generating neutral scale:", error);
    // Fallback to default gray scale
    return [
      "#ffffff",
      "#f8f9fa",
      "#e9ecef",
      "#dee2e6",
      "#ced4da",
      "#adb5bd",
      "#6c757d",
      "#495057",
      "#343a40",
      "#212529",
      "#000000",
    ];
  }
}

function generateColorVariations(baseColor: string): {
  xLight: string;
  light: string;
  dark: string;
  xDark: string;
} {
  try {
    const color = chroma(baseColor);
    return {
      xLight: color.brighten(3).hex(),
      light: color.brighten(1.5).hex(),
      dark: color.darken(1.5).hex(),
      xDark: color.darken(3).hex(),
    };
  } catch (error: unknown) {
    console.error("Error generating color variations for", baseColor, error);
    // Fallback variations
    return {
      xLight: baseColor,
      light: baseColor,
      dark: baseColor,
      xDark: baseColor,
    };
  }
}
