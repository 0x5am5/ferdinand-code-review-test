import type { Express } from "express";
import { storage } from "../storage";
import * as fs from "fs";
import { UserRole } from "@shared/schema";
import chroma from 'chroma-js';

interface RawTokens {
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
  components?: {
    button?: {
      primaryBackgroundColor?: string;
      primaryTextColor?: string;
    };
    input?: {
      backgroundColor?: string;
      borderColor?: string;
    };
    card?: {
      backgroundColor?: string;
      borderColor?: string;
    };
  };
}

interface SemanticTokens {
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
    neutral0: string; neutral1: string; neutral2: string; neutral3: string; neutral4: string;
    neutral5: string; neutral6: string; neutral7: string; neutral8: string; neutral9: string; neutral10: string;
    brandPrimaryXLight: string; brandPrimaryLight: string; brandPrimary: string; brandPrimaryDark: string; brandPrimaryXDark: string;
    brandSecondaryXLight: string; brandSecondaryLight: string; brandSecondary: string; brandSecondaryDark: string; brandSecondaryXDark: string;
    successLight: string; successDark: string; warningLight: string; warningDark: string;
    errorLight: string; errorDark: string; infoLight: string; infoDark: string;
    textHeading: string; textBody: string; textMuted: string; textInverted: string;
    textLink: string; textLinkHover: string; textError: string; textSuccess: string;
    backgroundPage: string; backgroundSurface: string; backgroundMuted: string; backgroundOverlay: string; backgroundInverted: string;
    borderDefault: string; borderMuted: string; borderActive: string; borderError: string; borderSuccess: string;
    buttonPrimaryBg: string; buttonPrimaryText: string; buttonSecondaryBg: string; buttonSecondaryText: string;
  };
  spacing: {
    xs: string; s: string; m: string; l: string; xl: string; xxl: string; xxxl: string; xxxxl: string;
    paddingBody: string; paddingSection: string; paddingCard: string; paddingButton: string;
    marginHeading: string; marginParagraph: string; gapUI: string;
  };
  borders: {
    radiusXs: string; radiusS: string; radiusM: string; radiusL: string; radiusXl: string;
    input: string; button: string; card: string;
    radiusButton: string; radiusInput: string; radiusCard: string;
  };
  shadows: {
    elevation0: string; elevation1: string; elevation2: string; elevation3: string; elevation4: string; elevation5: string;
    elevationCard: string; elevationModal: string; elevationButtonHover: string;
  };
  transitions: {
    ui: string; button: string; input: string;
  };
}

interface DesignSystem {
  theme: {
    variant: "professional" | "tint" | "vibrant";
    primary: string;
    appearance: "light" | "dark" | "system";
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
    "muted-foreground": string;
    card: string;
    "card-foreground": string;
    accent: string;
    "accent-foreground": string;
    destructive: string;
    "destructive-foreground": string;
    border: string;
    ring: string;
  };
  raw_tokens?: RawTokens;
}

// Semantic token generation functions
function generateSemanticTokens(rawTokens: RawTokens): SemanticTokens {
  const { typography, colors, spacing, borders } = rawTokens;

  // Generate typography semantic tokens
  const typographyTokens = {
    fontFamilyHeading: typography.fontFamily1Base,
    fontFamilyBody: typography.fontFamily2Base,
    fontFamilyCode: typography.fontFamilyMonoBase,

    fontSizeH1: `${typography.fontSizeBase * Math.pow(typography.typeScaleBase, 3)}rem`,
    fontSizeH2: `${typography.fontSizeBase * Math.pow(typography.typeScaleBase, 2)}rem`,
    fontSizeH3: `${typography.fontSizeBase * typography.typeScaleBase}rem`,
    fontSizeH4: `${typography.fontSizeBase}rem`,
    fontSizeH5: `${typography.fontSizeBase / typography.typeScaleBase}rem`,
    fontSizeH6: `${typography.fontSizeBase / Math.pow(typography.typeScaleBase, 2)}rem`,
    fontSizeBody: `${typography.fontSizeBase}rem`,
    fontSizeCaption: `${typography.fontSizeBase / Math.pow(typography.typeScaleBase, 2)}rem`,
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
  const brandPrimaryVariations = generateColorVariations(colors.brandPrimaryBase);
  const brandSecondaryVariations = generateColorVariations(colors.brandSecondaryBase);

  // Generate interactive color variations
  const successVariations = generateColorVariations(colors.interactiveSuccessBase);
  const warningVariations = generateColorVariations(colors.interactiveWarningBase);
  const errorVariations = generateColorVariations(colors.interactiveErrorBase);
  const infoVariations = generateColorVariations(colors.interactiveInfoBase);

  const colorTokens = {
    // Neutral scale
    neutral0: neutralScale[0], neutral1: neutralScale[1], neutral2: neutralScale[2], 
    neutral3: neutralScale[3], neutral4: neutralScale[4], neutral5: neutralScale[5],
    neutral6: neutralScale[6], neutral7: neutralScale[7], neutral8: neutralScale[8], 
    neutral9: neutralScale[9], neutral10: neutralScale[10],

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
    textInverted: '#ffffff',
    textLink: colors.brandPrimaryBase,
    textLinkHover: brandPrimaryVariations.dark,
    textError: errorVariations.dark,
    textSuccess: successVariations.dark,

    backgroundPage: neutralScale[0],
    backgroundSurface: neutralScale[1],
    backgroundMuted: neutralScale[2],
    backgroundOverlay: 'rgba(0, 0, 0, 0.6)',
    backgroundInverted: brandPrimaryVariations.dark,

    borderDefault: 'rgba(0, 0, 0, 0.1)',
    borderMuted: neutralScale[3],
    borderActive: colors.brandPrimaryBase,
    borderError: errorVariations.dark,
    borderSuccess: successVariations.dark,

    buttonPrimaryBg: colors.brandPrimaryBase,
    buttonPrimaryText: '#ffffff',
    buttonSecondaryBg: neutralScale[2],
    buttonSecondaryText: colors.brandSecondaryBase,
  };

  // Generate spacing semantic tokens
  const spacingTokens = {
    xs: `${spacing.spacingUnitBase / Math.pow(spacing.spacingScaleBase, 2)}rem`,
    s: `${spacing.spacingUnitBase / spacing.spacingScaleBase}rem`,
    m: `${spacing.spacingUnitBase}rem`,
    l: `${spacing.spacingUnitBase * spacing.spacingScaleBase}rem`,
    xl: `${spacing.spacingUnitBase * Math.pow(spacing.spacingScaleBase, 2)}rem`,
    xxl: `${spacing.spacingUnitBase * Math.pow(spacing.spacingScaleBase, 3)}rem`,
    xxxl: `${spacing.spacingUnitBase * Math.pow(spacing.spacingScaleBase, 4)}rem`,
    xxxxl: `${spacing.spacingUnitBase * Math.pow(spacing.spacingScaleBase, 5)}rem`,

    // Semantic spacing
    paddingBody: `${spacing.spacingUnitBase}rem`,
    paddingSection: `${spacing.spacingUnitBase * Math.pow(spacing.spacingScaleBase, 2)}rem`,
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
    elevation0: 'none',
    elevation1: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
    elevation2: '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)',
    elevation3: '0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)',
    elevation4: '0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22)',
    elevation5: '0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22)',

    // Semantic shadows
    elevationCard: '0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)',
    elevationModal: '0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22)',
    elevationButtonHover: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
  };

  // Generate transition tokens
  const transitionTokens = {
    ui: 'all 200ms ease-in-out',
    button: 'background-color 200ms ease-in-out',
    input: 'border-color 200ms ease-in-out',
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
        '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da',
        '#adb5bd', '#6c757d', '#495057', '#343a40', '#212529', '#000000'
      ];
    }

    const [, h, s, l] = hslMatch;
    const hue = parseInt(h);
    const saturation = parseInt(s);

    // Generate 11 shades from light to dark
    const shades = [];
    for (let i = 0; i <= 10; i++) {
      const lightness = 100 - (i * 10); // 100%, 90%, 80%, ..., 0%
      shades.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }

    return shades;
  } catch (error) {
    console.error('Error generating neutral scale:', error);
    // Fallback to default gray scale
    return [
      '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da',
      '#adb5bd', '#6c757d', '#495057', '#343a40', '#212529', '#000000'
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
  } catch (error) {
    console.error('Error generating color variations for', baseColor, error);
    // Fallback variations
    return {
      xLight: baseColor,
      light: baseColor,
      dark: baseColor,
      xDark: baseColor,
    };
  }
}

export function registerDesignSystemRoutes(app: Express) {
  // Read the current theme.json file
  app.get("/api/design-system", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user to check permissions
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Allow access for viewers and above since this is just reading

      // Read the theme.json file from the project root
      const themeData = fs.readFileSync("./theme.json", "utf8");
      const parsedTheme = JSON.parse(themeData);

      // Default colors in case they're not in theme.json
      const defaultColors = {
        primary: parsedTheme.primary || "hsl(205, 100%, 50%)",
        background: "#ffffff",
        foreground: "#000000",
        muted: "#f1f5f9",
        "muted-foreground": "#64748b",
        card: "#ffffff",
        "card-foreground": "#000000",
        accent: "#f1f5f9",
        "accent-foreground": "#0f172a",
        destructive: "#ef4444",
        "destructive-foreground": "#ffffff",
        border: "#e2e8f0",
        ring: parsedTheme.primary || "hsl(205, 100%, 50%)",
      };

      // Construct design system object from theme.json and defaults
      // Create the design system response object
      const designSystem = {
        theme: {
          variant: parsedTheme.variant || "professional",
          primary: parsedTheme.primary || "hsl(205, 100%, 50%)",
          appearance: parsedTheme.appearance || "light",
          radius: parsedTheme.radius || 0.5,
          animation: parsedTheme.animation || "smooth",
        },
        typography: {
          primary: parsedTheme.font?.primary || "roc-grotesk",
          heading: parsedTheme.font?.heading || "ivypresto-display",
        },
        colors: parsedTheme.colors || defaultColors,
        // Include any extended typography settings from theme.json
        typography_extended: parsedTheme.typography_extended || {},
        // Include raw design tokens if they exist
        raw_tokens: parsedTheme.raw_tokens || {
          default_unit: "rem",
          spacing: {
            spacing_xs: 0.25,
            spacing_sm: 0.5,
            spacing_md: 1,
            spacing_lg: 1.5,
            spacing_xl: 2,
            spacing_xxl: 3,
            spacing_xxxl: 4,
          },
          radius: {
            radius_none: 0,
            radius_sm: 2,
            radius_md: 4,
            radius_lg: 8,
            radius_xl: 16,
            radius_full: 9999,
          },
          transition: {
            transition_duration_fast: 150,
            transition_duration_base: 300,
            transition_duration_slow: 500,
            transition_ease_in: "ease-in",
            transition_ease_out: "ease-out",
            transition_ease_in_out: "ease-in-out",
            transition_linear: "linear",
          },
          border: {
            border_width_hairline: 1,
            border_width_thin: 2,
            border_width_medium: 4,
            border_width_thick: 8,
            border_style_solid: "solid",
            border_style_dashed: "dashed",
            border_style_dotted: "dotted",
            border_style_double: "double",
          },
          colors: {
            brand: {
              primary_base: "blue",
              secondary_base: "red",
              tertiary_base: "green",
            },
            neutral: {
              neutral_0: "#ffffff",
              neutral_100: "#f8f9fa",
              neutral_200: "#e9ecef",
              neutral_300: "#dee2e6",
              neutral_400: "#ced4da",
              neutral_500: "#adb5bd",
              neutral_600: "#6c757d",
              neutral_700: "#495057",
              neutral_800: "#343a40",
              neutral_900: "#212529",
            },
            interactive: {
              success_base: "#28a745",
              warning_base: "#ffc107",
              error_base: "#dc3545",
              link_base: "#007bff",
            },
          },
        },
      } as DesignSystem & {
        typography_extended?: Record<string, string | number>;
      };

      res.json(designSystem);
    } catch (error) {
      console.error("Error fetching design system:", error);
      res.status(500).json({ message: "Error fetching design system" });
    }
  });

  // Update design system
  app.patch("/api/design-system", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user to check permissions
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only allow editors, admins and super admins to modify the design system
      if (
        ![UserRole.EDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(
          user.role,
        )
      ) {
        return res.status(403).json({
          message: "Insufficient permissions to modify design system",
        });
      }

      const { theme, typography, colors, raw_tokens } = req.body;

      // Update raw-tokens.scss if raw_tokens are provided
      if (raw_tokens) {
        let rawTokensContent = `// This file is auto-generated by the design builder\n\n`;

        // Add default unit first
        if (raw_tokens.default_unit) {
          rawTokensContent += `// Default Unit\n`;
          rawTokensContent += `$default-unit: ${raw_tokens.default_unit};\n\n`;
        } else {
          rawTokensContent += `// Default Unit\n`;
          rawTokensContent += `$default-unit: rem;\n\n`;
        }

        // Add spacing tokens
        if (raw_tokens.spacing) {
          rawTokensContent += `// Spacing Tokens\n`;
          Object.entries(raw_tokens.spacing).forEach(([key, value]) => {
            rawTokensContent += `$${key}: ${value}#{$default-unit};\n`;
          });
          rawTokensContent += `\n`;
        }

        // Add radius tokens
        if (raw_tokens.radius) {
          rawTokensContent += `// Border Radius Tokens\n`;
          Object.entries(raw_tokens.radius).forEach(([key, value]) => {
            rawTokensContent += `$${key}: ${value}px;\n`;
          });
          rawTokensContent += `\n`;
        }

        // Add transition tokens
        if (raw_tokens.transition) {
          rawTokensContent += `// Transition Tokens\n`;
          Object.entries(raw_tokens.transition).forEach(([key, value]) => {
            if (typeof value === "number") {
              rawTokensContent += `$${key}: ${value}ms;\n`;
            } else {
              rawTokensContent += `$${key}: ${value};\n`;
            }
          });
          rawTokensContent += `\n`;
        }

        // Add border tokens
        if (raw_tokens.border) {
          rawTokensContent += `// Border Tokens\n`;
          Object.entries(raw_tokens.border).forEach(([key, value]) => {
            if (key.includes("width")) {
              rawTokensContent += `$${key}: ${value}px;\n`;
            } else {
              rawTokensContent += `$${key}: ${value};\n`;
            }
          });
          rawTokensContent += `\n`;
        }

        // Add color tokens
        if (raw_tokens.colors) {
          rawTokensContent += `// Color Tokens\n`;

          if (raw_tokens.colors.brand) {
            rawTokensContent += `// Brand Colors\n`;
            Object.entries(raw_tokens.colors.brand).forEach(([key, value]) => {
              // Convert underscores to hyphens for variable names
              const formattedKey = key.replace(/_/g, "-");
              rawTokensContent += `$color-brand-${formattedKey}: ${value};\n`;
            });
            rawTokensContent += `\n`;
          }

          if (raw_tokens.colors.neutral) {
            rawTokensContent += `// Neutral Colors\n`;
            Object.entries(raw_tokens.colors.neutral).forEach(
              ([key, value]) => {
                // Convert underscores to hyphens for variable names
                const formattedKey = key.replace(/_/g, "-");
                rawTokensContent += `$color-neutral-${formattedKey}: ${value};\n`;
              },
            );
            rawTokensContent += `\n`;
          }

          if (raw_tokens.colors.interactive) {
            rawTokensContent += `// Interactive Colors\n`;
            Object.entries(raw_tokens.colors.interactive).forEach(
              ([key, value]) => {
                // Convert underscores to hyphens for variable names
                const formattedKey = key.replace(/_/g, "-");
                rawTokensContent += `$color-interactive-${formattedKey}: ${value};\n`;
              },
            );
            rawTokensContent += `\n`;
          }
        }

        fs.writeFileSync(
          "./client/src/styles/_raw-tokens.scss",
          rawTokensContent,
        );
      }

      // We need at least one section to update
      if (!theme && !typography && !colors && !raw_tokens) {
        return res.status(400).json({ message: "Invalid design system data" });
      }

      // Read existing theme.json to preserve any values not being updated
      let existingTheme: any = {};
      try {
        const themeData = fs.readFileSync("./theme.json", "utf8");
        existingTheme = JSON.parse(themeData);
      } catch (error) {
        console.error("Error reading existing theme.json:", error);
      }

      // Update the theme.json file
      const themeData = {
        ...existingTheme,
        variant: theme?.variant || existingTheme.variant || "professional",
        primary:
          theme?.primary || existingTheme.primary || "hsl(205, 100%, 50%)",
        appearance: theme?.appearance || existingTheme.appearance || "light",
        radius:
          theme?.radius !== undefined
            ? theme.radius
            : existingTheme.radius || 0.5,
        animation: theme?.animation || existingTheme.animation || "smooth",
        font: {
          primary:
            typography?.primary ||
            (existingTheme.font ? existingTheme.font.primary : "roc-grotesk"),
          heading:
            typography?.heading ||
            (existingTheme.font
              ? existingTheme.font.heading
              : "ivypresto-display"),
        },
        // Store color system values in theme.json
        colors: colors || existingTheme.colors || {},
        // Store raw tokens in theme.json
        raw_tokens: raw_tokens || existingTheme.raw_tokens || {},
      };

      fs.writeFileSync("./theme.json", JSON.stringify(themeData, null, 2));

      // Return the updated design system
      res.json(req.body);
    } catch (error) {
      console.error("Error updating design system:", error);
      res.status(500).json({ message: "Error updating design system" });
    }
  });

  // Extended typography settings route
  app.patch("/api/design-system/typography", async (req, res) => {
    try {
      // For development, we're temporarily removing authentication
      // In production, we'd want to check if user has admin rights

      const typographySettings = req.body;

      if (!typographySettings || Object.keys(typographySettings).length === 0) {
        return res
          .status(400)
          .json({ message: "No typography settings provided" });
      }

      // Read existing theme.json to get current settings
      let existingTheme: any = {};
      try {
        const themeData = fs.readFileSync("./theme.json", "utf8");
        existingTheme = JSON.parse(themeData);
      } catch (error) {
        console.error("Error reading existing theme.json:", error);
        return res
          .status(500)
          .json({ message: "Error reading theme configuration" });
      }

      // Add or update the typography_extended property in theme.json
      const updatedTheme = {
        ...existingTheme,
        typography_extended: {
          ...(existingTheme.typography_extended || {}),
          ...typographySettings,
        },
      };

      // Write updated theme back to theme.json
      fs.writeFileSync("./theme.json", JSON.stringify(updatedTheme, null, 2));

      // Return success response
      res.json({
        message: "Typography settings updated successfully",
        settings: updatedTheme.typography_extended,
      });
    } catch (error) {
      console.error("Error updating typography settings:", error);
      res.status(500).json({ message: "Error updating typography settings" });
    }
  });

  // Export design system as comprehensive CSS with semantic tokens
  app.get("/api/design-system/export/css/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Allow access for viewers and above
      if (!["super_admin", "admin", "editor", "viewer"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Read current theme.json
      const themeData = fs.readFileSync("./theme.json", "utf8");
      const theme = JSON.parse(themeData);
      const rawTokens = theme.raw_tokens;

      if (!rawTokens) {
        return res.status(400).json({ message: "No design tokens found. Please configure your design system first." });
      }

      // Generate semantic tokens
      const semanticTokens = generateSemanticTokens(rawTokens);

      // Generate comprehensive CSS with semantic tokens
      let css = `/* Design System - CSS Custom Properties */
/* Generated from Ferdinand Design System Builder */
/* Client ID: ${clientId} */
/* Generated at: ${new Date().toISOString()} */

:root {
  /* Raw Tokens - Typography */
  --font-size-base: ${rawTokens.typography.fontSizeBase}rem;
  --line-height-base: ${rawTokens.typography.lineHeightBase};
  --type-scale-base: ${rawTokens.typography.typeScaleBase};
  --letter-spacing-base: ${rawTokens.typography.letterSpacingBase}em;
  --font-family-1-base: '${rawTokens.typography.fontFamily1Base}';
  --font-family-2-base: '${rawTokens.typography.fontFamily2Base}';
  --font-family-mono-base: '${rawTokens.typography.fontFamilyMonoBase}';

  /* Raw Tokens - Colors */
  --brand-primary-base: ${rawTokens.colors.brandPrimaryBase};
  --brand-secondary-base: ${rawTokens.colors.brandSecondaryBase};
  --neutral-base: ${rawTokens.colors.neutralBase};
  --interactive-success-base: ${rawTokens.colors.interactiveSuccessBase};
  --interactive-warning-base: ${rawTokens.colors.interactiveWarningBase};
  --interactive-error-base: ${rawTokens.colors.interactiveErrorBase};
  --interactive-info-base: ${rawTokens.colors.interactiveInfoBase};

  /* Raw Tokens - Spacing */
  --spacing-unit-base: ${rawTokens.spacing.spacingUnitBase}rem;
  --spacing-scale-base: ${rawTokens.spacing.spacingScaleBase};

  /* Raw Tokens - Borders */
  --border-width-base: ${rawTokens.borders.borderWidthBase}px;
  --border-radius-base: ${rawTokens.borders.borderRadiusBase}px;

  /* Semantic Tokens - Typography */
  --font-family-heading: ${semanticTokens.typography.fontFamilyHeading};
  --font-family-body: ${semanticTokens.typography.fontFamilyBody};
  --font-family-code: ${semanticTokens.typography.fontFamilyCode};

  --font-size-h1: ${semanticTokens.typography.fontSizeH1};
  --font-size-h2: ${semanticTokens.typography.fontSizeH2};
  --font-size-h3: ${semanticTokens.typography.fontSizeH3};
  --font-size-h4: ${semanticTokens.typography.fontSizeH4};
  --font-size-h5: ${semanticTokens.typography.fontSizeH5};
  --font-size-h6: ${semanticTokens.typography.fontSizeH6};
  --font-size-body: ${semanticTokens.typography.fontSizeBody};
  --font-size-caption: ${semanticTokens.typography.fontSizeCaption};
  --font-size-code: ${semanticTokens.typography.fontSizeCode};

  --line-height-heading: ${semanticTokens.typography.lineHeightHeading};
  --line-height-body: ${semanticTokens.typography.lineHeightBody};
  --line-height-caption: ${semanticTokens.typography.lineHeightCaption};
  --line-height-code: ${semanticTokens.typography.lineHeightCode};

  --font-weight-heading: ${semanticTokens.typography.fontWeightHeading};
  --font-weight-body: ${semanticTokens.typography.fontWeightBody};
  --font-weight-caption: ${semanticTokens.typography.fontWeightCaption};
  --font-weight-code: ${semanticTokens.typography.fontWeightCode};

  --letter-spacing-heading: ${semanticTokens.typography.letterSpacingHeading}em;
  --letter-spacing-body: ${semanticTokens.typography.letterSpacingBody}em;
  --letter-spacing-caption: ${semanticTokens.typography.letterSpacingCaption}em;
  --letter-spacing-code: ${semanticTokens.typography.letterSpacingCode}em;

  /* Semantic Tokens - Colors (Neutral Scale) */
  --color-neutral-0: ${semanticTokens.colors.neutral0};
  --color-neutral-1: ${semanticTokens.colors.neutral1};
  --color-neutral-2: ${semanticTokens.colors.neutral2};
  --color-neutral-3: ${semanticTokens.colors.neutral3};
  --color-neutral-4: ${semanticTokens.colors.neutral4};
  --color-neutral-5: ${semanticTokens.colors.neutral5};
  --color-neutral-6: ${semanticTokens.colors.neutral6};
  --color-neutral-7: ${semanticTokens.colors.neutral7};
  --color-neutral-8: ${semanticTokens.colors.neutral8};
  --color-neutral-9: ${semanticTokens.colors.neutral9};
  --color-neutral-10: ${semanticTokens.colors.neutral10};

  /* Semantic Tokens - Brand Colors */
  --color-brand-primary-x-light: ${semanticTokens.colors.brandPrimaryXLight};
  --color-brand-primary-light: ${semanticTokens.colors.brandPrimaryLight};
  --color-brand-primary: ${semanticTokens.colors.brandPrimary};
  --color-brand-primary-dark: ${semanticTokens.colors.brandPrimaryDark};
  --color-brand-primary-x-dark: ${semanticTokens.colors.brandPrimaryXDark};

  --color-brand-secondary-x-light: ${semanticTokens.colors.brandSecondaryXLight};
  --color-brand-secondary-light: ${semanticTokens.colors.brandSecondaryLight};
  --color-brand-secondary: ${semanticTokens.colors.brandSecondary};
  --color-brand-secondary-dark: ${semanticTokens.colors.brandSecondaryDark};
  --color-brand-secondary-x-dark: ${semanticTokens.colors.brandSecondaryXDark};

  /* Semantic Tokens - Interactive Colors */
  --color-success-light: ${semanticTokens.colors.successLight};
  --color-success-dark: ${semanticTokens.colors.successDark};
  --color-warning-light: ${semanticTokens.colors.warningLight};
  --color-warning-dark: ${semanticTokens.colors.warningDark};
  --color-error-light: ${semanticTokens.colors.errorLight};
  --color-error-dark: ${semanticTokens.colors.errorDark};
  --color-info-light: ${semanticTokens.colors.infoLight};
  --color-info-dark: ${semanticTokens.colors.infoDark};

  /* Semantic Tokens - Text Colors */
  --color-text-heading: ${semanticTokens.colors.textHeading};
  --color-text-body: ${semanticTokens.colors.textBody};
  --color-text-muted: ${semanticTokens.colors.textMuted};
  --color-text-inverted: ${semanticTokens.colors.textInverted};
  --color-text-link: ${semanticTokens.colors.textLink};
  --color-text-link-hover: ${semanticTokens.colors.textLinkHover};
  --color-text-error: ${semanticTokens.colors.textError};
  --color-text-success: ${semanticTokens.colors.textSuccess};

  /* Semantic Tokens - Background Colors */
  --color-background-page: ${semanticTokens.colors.backgroundPage};
  --color-background-surface: ${semanticTokens.colors.backgroundSurface};
  --color-background-muted: ${semanticTokens.colors.backgroundMuted};
  --color-background-overlay: ${semanticTokens.colors.backgroundOverlay};
  --color-background-inverted: ${semanticTokens.colors.backgroundInverted};

  /* Semantic Tokens - Border Colors */
  --color-border-default: ${semanticTokens.colors.borderDefault};
  --color-border-muted: ${semanticTokens.colors.borderMuted};
  --color-border-active: ${semanticTokens.colors.borderActive};
  --color-border-error: ${semanticTokens.colors.borderError};
  --color-border-success: ${semanticTokens.colors.borderSuccess};

  /* Semantic Tokens - Button Colors */
  --color-button-primary-bg: ${semanticTokens.colors.buttonPrimaryBg};
  --color-button-primary-text: ${semanticTokens.colors.buttonPrimaryText};
  --color-button-secondary-bg: ${semanticTokens.colors.buttonSecondaryBg};
  --color-button-secondary-text: ${semanticTokens.colors.buttonSecondaryText};

  /* Semantic Tokens - Spacing */
  --spacing-xs: ${semanticTokens.spacing.xs};
  --spacing-s: ${semanticTokens.spacing.s};
  --spacing-m: ${semanticTokens.spacing.m};
  --spacing-l: ${semanticTokens.spacing.l};
  --spacing-xl: ${semanticTokens.spacing.xl};
  --spacing-xxl: ${semanticTokens.spacing.xxl};
  --spacing-xxxl: ${semanticTokens.spacing.xxxl};
  --spacing-xxxxl: ${semanticTokens.spacing.xxxxl};

  /* Semantic Tokens - Padding */
  --padding-body: ${semanticTokens.spacing.paddingBody};
  --padding-section: ${semanticTokens.spacing.paddingSection};
  --padding-card: ${semanticTokens.spacing.paddingCard};
  --padding-button: ${semanticTokens.spacing.paddingButton};

  /* Semantic Tokens - Margin */
  --margin-heading: ${semanticTokens.spacing.marginHeading};
  --margin-paragraph: ${semanticTokens.spacing.marginParagraph};

  /* Semantic Tokens - Gap */
  --gap-ui: ${semanticTokens.spacing.gapUI};

  /* Semantic Tokens - Border Radius */
  --border-radius-xs: ${semanticTokens.borders.radiusXs};
  --border-radius-s: ${semanticTokens.borders.radiusS};
  --border-radius-m: ${semanticTokens.borders.radiusM};
  --border-radius-l: ${semanticTokens.borders.radiusL};
  --border-radius-xl: ${semanticTokens.borders.radiusXl};

  /* Semantic Tokens - Component Border Radius */
  --border-radius-button: ${semanticTokens.borders.radiusButton};
  --border-radius-input: ${semanticTokens.borders.radiusInput};
  --border-radius-card: ${semanticTokens.borders.radiusCard};

  /* Semantic Tokens - Shadows */
  --shadow-elevation-0: ${semanticTokens.shadows.elevation0};
  --shadow-elevation-1: ${semanticTokens.shadows.elevation1};
  --shadow-elevation-2: ${semanticTokens.shadows.elevation2};
  --shadow-elevation-3: ${semanticTokens.shadows.elevation3};
  --shadow-elevation-4: ${semanticTokens.shadows.elevation4};
  --shadow-elevation-5: ${semanticTokens.shadows.elevation5};

  /* Semantic Tokens - Component Shadows */
  --shadow-card: ${semanticTokens.shadows.elevationCard};
  --shadow-modal: ${semanticTokens.shadows.elevationModal};
  --shadow-button-hover: ${semanticTokens.shadows.elevationButtonHover};

  /* Semantic Tokens - Transitions */
  --transition-ui: ${semanticTokens.transitions.ui};
  --transition-button: ${semanticTokens.transitions.button};
  --transition-input: ${semanticTokens.transitions.input};
}

/* Component Styles Using Semantic Tokens */

/* Typography */
body {
  font-family: var(--font-family-body);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--color-text-body);
  background-color: var(--color-background-page);
  letter-spacing: var(--letter-spacing-body);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-family-heading);
  font-weight: var(--font-weight-heading);
  line-height: var(--line-height-heading);
  color: var(--color-text-heading);
  letter-spacing: var(--letter-spacing-heading);
  margin: var(--margin-heading);
}

h1 { font-size: var(--font-size-h1); }
h2 { font-size: var(--font-size-h2); }
h3 { font-size: var(--font-size-h3); }
h4 { font-size: var(--font-size-h4); }
h5 { font-size: var(--font-size-h5); }
h6 { font-size: var(--font-size-h6); }

p {
  margin: var(--margin-paragraph);
  line-height: var(--line-height-body);
}

code, pre {
  font-family: var(--font-family-code);
  font-size: var(--font-size-code);
  line-height: var(--line-height-code);
}

/* Links */
a {
  color: var(--color-text-link);
  transition: var(--transition-ui);
}

a:hover {
  color: var(--color-text-link-hover);
}

/* Buttons */
.btn {
  font-family: var(--font-family-body);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-body);
  padding: var(--padding-button);
  border-radius: var(--border-radius-button);
  border: none;
  cursor: pointer;
  transition: var(--transition-button);
  display: inline-flex;
  align-items: center;
  gap: var(--gap-ui);
}

.btn-primary {
  background-color: var(--color-button-primary-bg);
  color: var(--color-button-primary-text);
}

.btn-primary:hover {
  box-shadow: var(--shadow-button-hover);
}

.btn-secondary {
  background-color: var(--color-button-secondary-bg);
  color: var(--color-button-secondary-text);
  border: 2px solid var(--color-border-active);
}

.btn-success {
  background-color: var(--color-success-dark);
  color: var(--color-text-inverted);
}

.btn-error {
  background-color: var(--color-error-dark);
  color: var(--color-text-inverted);
}

/* Form Elements */
.input, input[type="text"], input[type="email"], input[type="password"], textarea, select {
  font-family: var(--font-family-body);
  font-size: var(--font-size-body);
  padding: var(--spacing-s);
  border: 1px solid var(--color-border-default);
  border-radius: var(--border-radius-input);
  background-color: var(--color-background-surface);
  color: var(--color-text-body);
  transition: var(--transition-input);
}

.input:focus, input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--color-border-active);
  box-shadow: 0 0 0 2px var(--color-brand-primary-light);
}

.input.error, input.error, textarea.error {
  border-color: var(--color-border-error);
  color: var(--color-text-error);
}

/* Cards */
.card {
  background-color: var(--color-background-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--border-radius-card);
  padding: var(--padding-card);
  box-shadow: var(--shadow-card);
}

.card-header {
  margin-bottom: var(--spacing-m);
  padding-bottom: var(--spacing-s);
  border-bottom: 1px solid var(--color-border-muted);
}

.card-title {
  font-size: var(--font-size-h4);
  font-weight: var(--font-weight-heading);
  color: var(--color-text-heading);
  margin: 0;
}

/* Utility Classes */
.text-heading { color: var(--color-text-heading); }
.text-body { color: var(--color-text-body); }
.text-muted { color: var(--color-text-muted); }
.text-link { color: var(--color-text-link); }
.text-error { color: var(--color-text-error); }
.text-success { color: var(--color-text-success); }

.bg-page { background-color: var(--color-background-page); }
.bg-surface { background-color: var(--color-background-surface); }
.bg-muted { background-color: var(--color-background-muted); }

.border-default { border-color: var(--color-border-default); }
.border-active { border-color: var(--color-border-active); }
.border-error { border-color: var(--color-border-error); }
.border-success { border-color: var(--color-border-success); }

/* Spacing Utilities */
.p-xs { padding: var(--spacing-xs); }
.p-s { padding: var(--spacing-s); }
.p-m { padding: var(--spacing-m); }
.p-l { padding: var(--spacing-l); }
.p-xl { padding: var(--spacing-xl); }

.m-xs { margin: var(--spacing-xs); }
.m-s { margin: var(--spacing-s); }
.m-m { margin: var(--spacing-m); }
.m-l { margin: var(--spacing-l); }
.m-xl { margin: var(--spacing-xl); }

.gap-ui { gap: var(--gap-ui); }

/* Shadow Utilities */
.shadow-card { box-shadow: var(--shadow-card); }
.shadow-modal { box-shadow: var(--shadow-modal); }
.elevation-1 { box-shadow: var(--shadow-elevation-1); }
.elevation-2 { box-shadow: var(--shadow-elevation-2); }
.elevation-3 { box-shadow: var(--shadow-elevation-3); }

/* Border Radius Utilities */
.rounded-xs { border-radius: var(--border-radius-xs); }
.rounded-s { border-radius: var(--border-radius-s); }
.rounded-m { border-radius: var(--border-radius-m); }
.rounded-l { border-radius: var(--border-radius-l); }
.rounded-xl { border-radius: var(--border-radius-xl); }
`;

      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Content-Disposition', 'attachment; filename="design-system-complete.css"');
      res.send(css);
    } catch (error) {
      console.error("Error exporting CSS:", error);
      res.status(500).json({ message: "Error exporting CSS", error: error.message });
    }
  });

  // Export design system as comprehensive SCSS with semantic tokens
  app.get("/api/design-system/export/scss/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Allow access for viewers and above
      if (!["super_admin", "admin", "editor", "viewer"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Read current theme.json
      const themeData = fs.readFileSync("./theme.json", "utf8");
      const theme = JSON.parse(themeData);
      const rawTokens = theme.raw_tokens;

      if (!rawTokens) {
        return res.status(400).json({ message: "No design tokens found. Please configure your design system first." });
      }

      // Generate semantic tokens
      const semanticTokens = generateSemanticTokens(rawTokens);

      let scss = `// Design System - SCSS Variables
// Generated from Ferdinand Design System Builder
// Client ID: ${clientId}
// Generated at: ${new Date().toISOString()}

// Raw Tokens - Typography
$font-size-base: ${rawTokens.typography.fontSizeBase}rem;
$line-height-base: ${rawTokens.typography.lineHeightBase};
$type-scale-base: ${rawTokens.typography.typeScaleBase};
$letter-spacing-base: ${rawTokens.typography.letterSpacingBase}em;
$font-family-1-base: '${rawTokens.typography.fontFamily1Base}';
$font-family-2-base: '${rawTokens.typography.fontFamily2Base}';
$font-family-mono-base: '${rawTokens.typography.fontFamilyMonoBase}';

// Raw Tokens - Colors
$brand-primary-base: ${rawTokens.colors.brandPrimaryBase};
$brand-secondary-base: ${rawTokens.colors.brandSecondaryBase};
$neutral-base: ${rawTokens.colors.neutralBase};
$interactive-success-base: ${rawTokens.colors.interactiveSuccessBase};
$interactive-warning-base: ${rawTokens.colors.interactiveWarningBase};
$interactive-error-base: ${rawTokens.colors.interactiveErrorBase};
$interactive-info-base: ${rawTokens.colors.interactiveInfoBase};

// Raw Tokens - Spacing
$spacing-unit-base: ${rawTokens.spacing.spacingUnitBase}rem;
$spacing-scale-base: ${rawTokens.spacing.spacingScaleBase};

// Raw Tokens - Borders
$border-width-base: ${rawTokens.borders.borderWidthBase}px;
$border-radius-base: ${rawTokens.borders.borderRadiusBase}px;

// Semantic Tokens - Typography
$font-family-heading: ${semanticTokens.typography.fontFamilyHeading};
$font-family-body: ${semanticTokens.typography.fontFamilyBody};
$font-family-code: ${semanticTokens.typography.fontFamilyCode};

$font-size-h1: ${semanticTokens.typography.fontSizeH1};
$font-size-h2: ${semanticTokens.typography.fontSizeH2};
$font-size-h3: ${semanticTokens.typography.fontSizeH3};
$font-size-h4: ${semanticTokens.typography.fontSizeH4};
$font-size-h5: ${semanticTokens.typography.fontSizeH5};
$font-size-h6: ${semanticTokens.typography.fontSizeH6};
$font-size-body: ${semanticTokens.typography.fontSizeBody};
$font-size-caption: ${semanticTokens.typography.fontSizeCaption};
$font-size-code: ${semanticTokens.typography.fontSizeCode};

$line-height-heading: ${semanticTokens.typography.lineHeightHeading};
$line-height-body: ${semanticTokens.typography.lineHeightBody};
$line-height-caption: ${semanticTokens.typography.lineHeightCaption};
$line-height-code: ${semanticTokens.typography.lineHeightCode};

$font-weight-heading: ${semanticTokens.typography.fontWeightHeading};
$font-weight-body: ${semanticTokens.typography.fontWeightBody};
$font-weight-caption: ${semanticTokens.typography.fontWeightCaption};
$font-weight-code: ${semanticTokens.typography.fontWeightCode};

$letter-spacing-heading: ${semanticTokens.typography.letterSpacingHeading}em;
$letter-spacing-body: ${semanticTokens.typography.letterSpacingBody}em;
$letter-spacing-caption: ${semanticTokens.typography.letterSpacingCaption}em;
$letter-spacing-code: ${semanticTokens.typography.letterSpacingCode}em;

// Semantic Tokens - Colors (Neutral Scale)
$color-neutral-0: ${semanticTokens.colors.neutral0};
$color-neutral-1: ${semanticTokens.colors.neutral1};
$color-neutral-2: ${semanticTokens.colors.neutral2};
$color-neutral-3: ${semanticTokens.colors.neutral3};
$color-neutral-4: ${semanticTokens.colors.neutral4};
$color-neutral-5: ${semanticTokens.colors.neutral5};
$color-neutral-6: ${semanticTokens.colors.neutral6};
$color-neutral-7: ${semanticTokens.colors.neutral7};
$color-neutral-8: ${semanticTokens.colors.neutral8};
$color-neutral-9: ${semanticTokens.colors.neutral9};
$color-neutral-10: ${semanticTokens.colors.neutral10};

// Semantic Tokens - Brand Colors
$color-brand-primary-x-light: ${semanticTokens.colors.brandPrimaryXLight};
$color-brand-primary-light: ${semanticTokens.colors.brandPrimaryLight};
$color-brand-primary: ${semanticTokens.colors.brandPrimary};
$color-brand-primary-dark: ${semanticTokens.colors.brandPrimaryDark};
$color-brand-primary-x-dark: ${semanticTokens.colors.brandPrimaryXDark};

$color-brand-secondary-x-light: ${semanticTokens.colors.brandSecondaryXLight};
$color-brand-secondary-light: ${semanticTokens.colors.brandSecondaryLight};
$color-brand-secondary: ${semanticTokens.colors.brandSecondary};
$color-brand-secondary-dark: ${semanticTokens.colors.brandSecondaryDark};
$color-brand-secondary-x-dark: ${semanticTokens.colors.brandSecondaryXDark};

// Semantic Tokens - Interactive Colors
$color-success-light: ${semanticTokens.colors.successLight};
$color-success-dark: ${semanticTokens.colors.successDark};
$color-warning-light: ${semanticTokens.colors.warningLight};
$color-warning-dark: ${semanticTokens.colors.warningDark};
$color-error-light: ${semanticTokens.colors.errorLight};
$color-error-dark: ${semanticTokens.colors.errorDark};
$color-info-light: ${semanticTokens.colors.infoLight};
$color-info-dark: ${semanticTokens.colors.infoDark};

// Semantic Tokens - Text Colors
$color-text-heading: ${semanticTokens.colors.textHeading};
$color-text-body: ${semanticTokens.colors.textBody};
$color-text-muted: ${semanticTokens.colors.textMuted};
$color-text-inverted: ${semanticTokens.colors.textInverted};
$color-text-link: ${semanticTokens.colors.textLink};
$color-text-link-hover: ${semanticTokens.colors.textLinkHover};
$color-text-error: ${semanticTokens.colors.textError};
$color-text-success: ${semanticTokens.colors.textSuccess};

// Semantic Tokens - Background Colors
$color-background-page: ${semanticTokens.colors.backgroundPage};
$color-background-surface: ${semanticTokens.colors.backgroundSurface};
$color-background-muted: ${semanticTokens.colors.backgroundMuted};
$color-background-overlay: ${semanticTokens.colors.backgroundOverlay};
$color-background-inverted: ${semanticTokens.colors.backgroundInverted};

// Semantic Tokens - Border Colors
$color-border-default: ${semanticTokens.colors.borderDefault};
$color-border-muted: ${semanticTokens.colors.borderMuted};
$color-border-active: ${semanticTokens.colors.borderActive};
$color-border-error: ${semanticTokens.colors.borderError};
$color-border-success: ${semanticTokens.colors.borderSuccess};

// Semantic Tokens - Button Colors
$color-button-primary-bg: ${semanticTokens.colors.buttonPrimaryBg};
$color-button-primary-text: ${semanticTokens.colors.buttonPrimaryText};
$color-button-secondary-bg: ${semanticTokens.colors.buttonSecondaryBg};
$color-button-secondary-text: ${semanticTokens.colors.buttonSecondaryText};

// Semantic Tokens - Spacing
$spacing-xs: ${semanticTokens.spacing.xs};
$spacing-s: ${semanticTokens.spacing.s};
$spacing-m: ${semanticTokens.spacing.m};
$spacing-l: ${semanticTokens.spacing.l};
$spacing-xl: ${semanticTokens.spacing.xl};
$spacing-xxl: ${semanticTokens.spacing.xxl};
$spacing-xxxl: ${semanticTokens.spacing.xxxl};
$spacing-xxxxl: ${semanticTokens.spacing.xxxxl};

// Semantic Tokens - Padding
$padding-body: ${semanticTokens.spacing.paddingBody};
$padding-section: ${semanticTokens.spacing.paddingSection};
$padding-card: ${semanticTokens.spacing.paddingCard};
$padding-button: ${semanticTokens.spacing.paddingButton};

// Semantic Tokens - Margin
$margin-heading: ${semanticTokens.spacing.marginHeading};
$margin-paragraph: ${semanticTokens.spacing.marginParagraph};

// Semantic Tokens - Gap
$gap-ui: ${semanticTokens.spacing.gapUI};

// Semantic Tokens - Border Radius
$border-radius-xs: ${semanticTokens.borders.radiusXs};
$border-radius-s: ${semanticTokens.borders.radiusS};
$border-radius-m: ${semanticTokens.borders.radiusM};
$border-radius-l: ${semanticTokens.borders.radiusL};
$border-radius-xl: ${semanticTokens.borders.radiusXl};

// Semantic Tokens - Component Border Radius
$border-radius-button: ${semanticTokens.borders.radiusButton};
$border-radius-input: ${semanticTokens.borders.radiusInput};
$border-radius-card: ${semanticTokens.borders.radiusCard};

// Semantic Tokens - Shadows
$shadow-elevation-0: ${semanticTokens.shadows.elevation0};
$shadow-elevation-1: ${semanticTokens.shadows.elevation1};
$shadow-elevation-2: ${semanticTokens.shadows.elevation2};
$shadow-elevation-3: ${semanticTokens.shadows.elevation3};
$shadow-elevation-4: ${semanticTokens.shadows.elevation4};
$shadow-elevation-5: ${semanticTokens.shadows.elevation5};

// Semantic Tokens - Component Shadows
$shadow-card: ${semanticTokens.shadows.elevationCard};
$shadow-modal: ${semanticTokens.shadows.elevationModal};
$shadow-button-hover: ${semanticTokens.shadows.elevationButtonHover};

// Semantic Tokens - Transitions
$transition-ui: ${semanticTokens.transitions.ui};
$transition-button: ${semanticTokens.transitions.button};
$transition-input: ${semanticTokens.transitions.input};

// SCSS Mixins for Component Styling
@mixin heading-style {
  font-family: $font-family-heading;
  font-weight: $font-weight-heading;
  line-height: $line-height-heading;
  color: $color-text-heading;
  letter-spacing: $letter-spacing-heading;
  margin: $margin-heading;
}

@mixin body-text-style {
  font-family: $font-family-body;
  font-size: $font-size-body;
  font-weight: $font-weight-body;
  line-height: $line-height-body;
  color: $color-text-body;
  letter-spacing: $letter-spacing-body;
}

@mixin button-style {
  font-family: $font-family-body;
  font-size: $font-size-body;
  font-weight: $font-weight-body;
  padding: $padding-button;
  border-radius: $border-radius-button;
  border: none;
  cursor: pointer;
  transition: $transition-button;
  display: inline-flex;
  align-items: center;
  gap: $gap-ui;
}

@mixin button-primary {
  @include button-style;
  background-color: $color-button-primary-bg;
  color: $color-button-primary-text;

  &:hover {
    box-shadow: $shadow-button-hover;
  }
}

@mixin button-secondary {
  @include button-style;
  background-color: $color-button-secondary-bg;
  color: $color-button-secondary-text;
  border: 2px solid $color-border-active;
}

@mixin input-style {
  font-family: $font-family-body;
  font-size: $font-size-body;
  padding: $spacing-s;
  border: 1px solid $color-border-default;
  border-radius: $border-radius-input;
  background-color: $color-background-surface;
  color: $color-text-body;
  transition: $transition-input;

  &:focus {
    outline: none;
    border-color: $color-border-active;
    box-shadow: 0 0 0 2px $color-brand-primary-light;
  }
}

@mixin card-style {
  background-color: $color-background-surface;
  border: 1px solid $color-border-default;
  border-radius: $border-radius-card;
  padding: $padding-card;
  box-shadow: $shadow-card;
}

// Helper Functions
@function spacing($multiplier: 1) {
  @return $spacing-unit-base * $multiplier;
}

@function type-scale($steps: 0) {
  @return $font-size-base * pow($type-scale-base, $steps);
}

// Color Maps for Easy Access
$neutral-colors: (
  0: $color-neutral-0,
  1: $color-neutral-1,
  2: $color-neutral-2,
  3: $color-neutral-3,
  4: $color-neutral-4,
  5: $color-neutral-5,
  6: $color-neutral-6,
  7: $color-neutral-7,
  8: $color-neutral-8,
  9: $color-neutral-9,
  10: $color-neutral-10
);

$brand-primary-colors: (
  x-light: $color-brand-primary-x-light,
  light: $color-brand-primary-light,
  base: $color-brand-primary,
  dark: $color-brand-primary-dark,
  x-dark: $color-brand-primary-x-dark
);

$brand-secondary-colors: (
  x-light: $color-brand-secondary-x-light,
  light: $color-brand-secondary-light,
  base: $color-brand-secondary,
  dark: $color-brand-secondary-dark,
  x-dark: $color-brand-secondary-x-dark
);
`;

      res.setHeader('Content-Type', 'text/scss');
      res.setHeader('Content-Disposition', 'attachment; filename="design-system-complete.scss"');
      res.send(scss);
    } catch (error) {
      console.error("Error exporting SCSS:", error);
      res.status(500).json({ message: "Error exporting SCSS", error: error.message });
    }
  });

  // Export design system as comprehensive Tailwind config with semantic config with semantic tokens
  app.get("/api/design-system/export/tailwind/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Allow access for viewers and above
      if (!["super_admin", "admin", "editor", "viewer"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Read current theme.json
      const themeData = fs.readFileSync("./theme.json", "utf8");
      const theme = JSON.parse(themeData);
      const rawTokens = theme.raw_tokens;

      if (!rawTokens) {
        return res.status(400).json({ message: "No design tokens found. Please configure your design system first." });
      }

      // Generate semantic tokens
      const semanticTokens = generateSemanticTokens(rawTokens);

      const config = {
        // Tailwind CSS configuration with semantic tokens
        // Generated from Ferdinand Design System Builder
        // Client ID: clientId,
        // Generated at: new Date().toISOString(),
        theme: {
          extend: {
            // Typography
            fontFamily: {
              heading: [semanticTokens.typography.fontFamilyHeading],
              body: [semanticTokens.typography.fontFamilyBody],
              code: [semanticTokens.typography.fontFamilyCode],
              // Raw token aliases
              primary: [rawTokens.typography.fontFamily1Base],
              secondary: [rawTokens.typography.fontFamily2Base],
              mono: [rawTokens.typography.fontFamilyMonoBase],
            },
            fontSize: {
              // Semantic sizes
              'h1': semanticTokens.typography.fontSizeH1,
              'h2': semanticTokens.typography.fontSizeH2,
              'h3': semanticTokens.typography.fontSizeH3,
              'h4': semanticTokens.typography.fontSizeH4,
              'h5': semanticTokens.typography.fontSizeH5,
              'h6': semanticTokens.typography.fontSizeH6,
              'body': semanticTokens.typography.fontSizeBody,
              'caption': semanticTokens.typography.fontSizeCaption,
              'code': semanticTokens.typography.fontSizeCode,
              // Raw token aliases
              'base': `${rawTokens.typography.fontSizeBase}rem`,
            },
            lineHeight: {
              heading: semanticTokens.typography.lineHeightHeading,
              body: semanticTokens.typography.lineHeightBody,
              caption: semanticTokens.typography.lineHeightCaption,
              code: semanticTokens.typography.lineHeightCode,
            },
            fontWeight: {
              heading: semanticTokens.typography.fontWeightHeading,
              body: semanticTokens.typography.fontWeightBody,
              caption: semanticTokens.typography.fontWeightCaption,
              code: semanticTokens.typography.fontWeightCode,
            },
            letterSpacing: {
              heading: `${semanticTokens.typography.letterSpacingHeading}em`,
              body: `${semanticTokens.typography.letterSpacingBody}em`,
              caption: `${semanticTokens.typography.letterSpacingCaption}em`,
              code: `${semanticTokens.typography.letterSpacingCode}em`,
            },
            // Colors
            colors: {
              // Neutral scale
              neutral: {
                0: semanticTokens.colors.neutral0,
                1: semanticTokens.colors.neutral1,
                2: semanticTokens.colors.neutral2,
                3: semanticTokens.colors.neutral3,
                4: semanticTokens.colors.neutral4,
                5: semanticTokens.colors.neutral5,
                6: semanticTokens.colors.neutral6,
                7: semanticTokens.colors.neutral7,
                8: semanticTokens.colors.neutral8,
                9: semanticTokens.colors.neutral9,
                10: semanticTokens.colors.neutral10,
              },
              // Brand colors
              brand: {
                primary: {
                  'x-light': semanticTokens.colors.brandPrimaryXLight,
                  light: semanticTokens.colors.brandPrimaryLight,
                  DEFAULT: semanticTokens.colors.brandPrimary,
                  dark: semanticTokens.colors.brandPrimaryDark,
                  'x-dark': semanticTokens.colors.brandPrimaryXDark,
                },
                secondary: {
                  'x-light': semanticTokens.colors.brandSecondaryXLight,
                  light: semanticTokens.colors.brandSecondaryLight,
                  DEFAULT: semanticTokens.colors.brandSecondary,
                  dark: semanticTokens.colors.brandSecondaryDark,
                  'x-dark': semanticTokens.colors.brandSecondaryXDark,
                },
              },
              // Interactive colors
              success: {
                light: semanticTokens.colors.successLight,
                DEFAULT: rawTokens.colors.interactiveSuccessBase,
                dark: semanticTokens.colors.successDark,
              },
              warning: {
                light: semanticTokens.colors.warningLight,
                DEFAULT: rawTokens.colors.interactiveWarningBase,
                dark: semanticTokens.colors.warningDark,
              },
              error: {
                light: semanticTokens.colors.errorLight,
                DEFAULT: rawTokens.colors.interactiveErrorBase,
                dark: semanticTokens.colors.errorDark,
              },
              info: {
                light: semanticTokens.colors.infoLight,
                DEFAULT: rawTokens.colors.interactiveInfoBase,
                dark: semanticTokens.colors.infoDark,
              },
              // Text colors
              text: {
                heading: semanticTokens.colors.textHeading,
                body: semanticTokens.colors.textBody,
                muted: semanticTokens.colors.textMuted,
                inverted: semanticTokens.colors.textInverted,
                link: semanticTokens.colors.textLink,
                'link-hover': semanticTokens.colors.textLinkHover,
                error: semanticTokens.colors.textError,
                success: semanticTokens.colors.textSuccess,
              },
              // Background colors
              background: {
                page: semanticTokens.colors.backgroundPage,
                surface: semanticTokens.colors.backgroundSurface,
                muted: semanticTokens.colors.backgroundMuted,
                overlay: semanticTokens.colors.backgroundOverlay,
                inverted: semanticTokens.colors.backgroundInverted,
              },
              // Border colors
              border: {
                DEFAULT: semanticTokens.colors.borderDefault,
                muted: semanticTokens.colors.borderMuted,
                active: semanticTokens.colors.borderActive,
                error: semanticTokens.colors.borderError,
                success: semanticTokens.colors.borderSuccess,
              },
              // Button colors
              button: {
                primary: {
                  bg: semanticTokens.colors.buttonPrimaryBg,
                  text: semanticTokens.colors.buttonPrimaryText,
                },
                secondary: {
                  bg: semanticTokens.colors.buttonSecondaryBg,
                  text: semanticTokens.colors.buttonSecondaryText,
                },
              },
            },
            // Spacing
            spacing: {
              xs: semanticTokens.spacing.xs,
              s: semanticTokens.spacing.s,
              m: semanticTokens.spacing.m,
              l: semanticTokens.spacing.l,
              xl: semanticTokens.spacing.xl,
              xxl: semanticTokens.spacing.xxl,
              xxxl: semanticTokens.spacing.xxxl,
              xxxxl: semanticTokens.spacing.xxxxl,
            },
            // Padding
            padding: {
              body: semanticTokens.spacing.paddingBody,
              section: semanticTokens.spacing.paddingSection,
              card: semanticTokens.spacing.paddingCard,
              button: semanticTokens.spacing.paddingButton,
            },
            // Margin
            margin: {
              heading: semanticTokens.spacing.marginHeading,
              paragraph: semanticTokens.spacing.marginParagraph,
            },
            // Gap
            gap: {
              ui: semanticTokens.spacing.gapUI,
            },
            // Border radius
            borderRadius: {
              xs: semanticTokens.borders.radiusXs,
              s: semanticTokens.borders.radiusS,
              m: semanticTokens.borders.radiusM,
              l: semanticTokens.borders.radiusL,
              xl: semanticTokens.borders.radiusXl,
              // Component specific
              button: semanticTokens.borders.radiusButton,
              input: semanticTokens.borders.radiusInput,
              card: semanticTokens.borders.radiusCard,
              // Raw token aliases
              base: `${rawTokens.borders.borderRadiusBase}px`,
            },
            // Box shadow
            boxShadow: {
              'elevation-0': semanticTokens.shadows.elevation0,
              'elevation-1': semanticTokens.shadows.elevation1,
              'elevation-2': semanticTokens.shadows.elevation2,
              'elevation-3': semanticTokens.shadows.elevation3,
              'elevation-4': semanticTokens.shadows.elevation4,
              'elevation-5': semanticTokens.shadows.elevation5,
              // Component specific
              card: semanticTokens.shadows.elevationCard,
              modal: semanticTokens.shadows.elevationModal,
              'button-hover': semanticTokens.shadows.elevationButtonHover,
            },
            // Transitions
            transitionDuration: {
              ui: '200ms',
              button: '200ms',
              input: '200ms',
            },
            transitionTimingFunction: {
              ui: 'ease-in-out',
              button: 'ease-in-out',
              input: 'ease-in-out',
            },
          }
        },
        // Plugins for additional functionality
        plugins: [
          // Custom component classes
          function({ addComponents, theme }) {
            addComponents({
              '.btn': {
                fontFamily: theme('fontFamily.body'),
                fontSize: theme('fontSize.body'),
                fontWeight: theme('fontWeight.body'),
                padding: theme('padding.button'),
                borderRadius: theme('borderRadius.button'),
                border: 'none',
                cursor: 'pointer',
                transition: theme('transitionDuration.button') + ' ' + theme('transitionTimingFunction.button'),
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme('gap.ui'),
              },
              '.btn-primary': {
                backgroundColor: theme('colors.button.primary.bg'),
                color: theme('colors.button.primary.text'),
                '&:hover': {
                  boxShadow: theme('boxShadow.button-hover'),
                }
              },
              '.btn-secondary': {
                backgroundColor: theme('colors.button.secondary.bg'),
                color: theme('colors.button.secondary.text'),
                border: '2px solid ' + theme('colors.border.active'),
              },
              '.input': {
                fontFamily: theme('fontFamily.body'),
                fontSize: theme('fontSize.body'),
                padding: theme('spacing.s'),
                border: '1px solid ' + theme('colors.border.DEFAULT'),
                borderRadius: theme('borderRadius.input'),
                backgroundColor: theme('colors.background.surface'),
                color: theme('colors.text.body'),
                transition: theme('transitionDuration.input') + ' ' + theme('transitionTimingFunction.input'),
                '&:focus': {
                  outline: 'none',
                  borderColor: theme('colors.border.active'),
                  boxShadow: '0 0 0 2px ' + theme('colors.brand.primary.light'),
                }
              },
              '.card': {
                backgroundColor: theme('colors.background.surface'),
                border: '1px solid ' + theme('colors.border.DEFAULT'),
                borderRadius: theme('borderRadius.card'),
                padding: theme('padding.card'),
                boxShadow: theme('boxShadow.card'),
              },
              '.heading': {
                fontFamily: theme('fontFamily.heading'),
                fontWeight: theme('fontWeight.heading'),
                lineHeight: theme('lineHeight.heading'),
                color: theme('colors.text.heading'),
                letterSpacing: theme('letterSpacing.heading'),
                margin: theme('margin.heading'),
              },
              '.body-text': {
                fontFamily: theme('fontFamily.body'),
                fontSize: theme('fontSize.body'),
                fontWeight: theme('fontWeight.body'),
                lineHeight: theme('lineHeight.body'),
                color: theme('colors.text.body'),
                letterSpacing: theme('letterSpacing.body'),
              }
            })
          }
        ]
      };

      const configString = `/** @type {import('tailwindcss').Config} */
// Design System - Tailwind CSS Configuration
// Generated from Ferdinand Design System Builder
// Client ID: ${clientId}
// Generated at: ${new Date().toISOString()}

module.exports = ${JSON.stringify(config, null, 2)};

// Usage Examples:
// 
// Typography:
// <h1 className="font-heading text-h1 font-heading leading-heading tracking-heading text-text-heading">Heading</h1>
// <p className="body-text">Body text with semantic styling</p>
//
// Colors:
// <div className="bg-brand-primary text-white">Primary brand background</div>
// <div className="bg-neutral-1 text-neutral-9">Neutral background</div>
//
// Components:
// <button className="btn btn-primary">Primary Button</button>
// <input className="input" placeholder="Form input" />
// <div className="card">Card content</div>
//
// Spacing:
// <div className="p-m gap-ui">Medium padding with UI gap</div>
// <div className="m-heading">Heading margin</div>
//
// Shadows and Borders:
// <div className="shadow-card rounded-card">Card with shadows</div>
// <div className="shadow-elevation-2 rounded-m">Elevated content</div>
`;

      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Content-Disposition', 'attachment; filename="tailwind.config.js"');
      res.send(configString);
    } catch (error) {
      console.error("Error exporting Tailwind config:", error);
      res.status(500).json({ message: "Error exporting Tailwind config", error: (error as Error).message });
    }
  });
}