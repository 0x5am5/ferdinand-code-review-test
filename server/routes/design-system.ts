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

  // Export design system as CSS variables
  app.get("/api/design-system/export/css/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Read current theme.json
      const themeData = fs.readFileSync("./theme.json", "utf8");
      const theme = JSON.parse(themeData);
      const rawTokens = theme.raw_tokens || {};

      let css = `:root {\n`;
      
      // Typography variables
      if (rawTokens.typography) {
        const typo = rawTokens.typography;
        css += `  --font-size-base: ${typo.fontSizeBase || 1}rem;\n`;
        css += `  --line-height-base: ${typo.lineHeightBase || 1.4};\n`;
        css += `  --type-scale-base: ${typo.typeScaleBase || 1.4};\n`;
        css += `  --font-family-primary: '${typo.fontFamily1Base || 'Rock Grotesque'}';\n`;
        css += `  --font-family-secondary: '${typo.fontFamily2Base || 'Rock Grotesque Wide'}';\n`;
        css += `  --font-family-mono: '${typo.fontFamilyMonoBase || 'monospace'}';\n`;
      }
      
      // Color variables
      if (rawTokens.colors) {
        const colors = rawTokens.colors;
        css += `  --color-brand-primary: ${colors.brandPrimaryBase || '#0052CC'};\n`;
        css += `  --color-brand-secondary: ${colors.brandSecondaryBase || '#172B4D'};\n`;
        css += `  --color-success: ${colors.interactiveSuccessBase || '#28a745'};\n`;
        css += `  --color-warning: ${colors.interactiveWarningBase || '#ffc107'};\n`;
        css += `  --color-error: ${colors.interactiveErrorBase || '#dc3545'};\n`;
        css += `  --color-info: ${colors.interactiveInfoBase || '#17a2b8'};\n`;
      }
      
      // Spacing variables
      if (rawTokens.spacing) {
        const spacing = rawTokens.spacing;
        css += `  --spacing-unit-base: ${spacing.spacingUnitBase || 1}rem;\n`;
        css += `  --spacing-scale-base: ${spacing.spacingScaleBase || 1.5};\n`;
      }
      
      // Border variables
      if (rawTokens.borders) {
        const borders = rawTokens.borders;
        css += `  --border-width-base: ${borders.borderWidthBase || 1}px;\n`;
        css += `  --border-radius-base: ${borders.borderRadiusBase || 8}px;\n`;
      }
      
      css += `}\n`;

      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Content-Disposition', 'attachment; filename="design-tokens.css"');
      res.send(css);
    } catch (error) {
      console.error("Error exporting CSS:", error);
      res.status(500).json({ message: "Error exporting CSS" });
    }
  });

  // Export design system as SCSS variables
  app.get("/api/design-system/export/scss/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Read current theme.json
      const themeData = fs.readFileSync("./theme.json", "utf8");
      const theme = JSON.parse(themeData);
      const rawTokens = theme.raw_tokens || {};

      let scss = `// Design System Tokens - Generated by Ferdinand\n\n`;
      
      // Typography variables
      if (rawTokens.typography) {
        const typo = rawTokens.typography;
        scss += `$font-size-base: ${typo.fontSizeBase || 1}rem;\n`;
        scss += `$line-height-base: ${typo.lineHeightBase || 1.4};\n`;
        scss += `$type-scale-base: ${typo.typeScaleBase || 1.4};\n`;
        scss += `$font-family-primary: '${typo.fontFamily1Base || 'Rock Grotesque'}';\n`;
        scss += `$font-family-secondary: '${typo.fontFamily2Base || 'Rock Grotesque Wide'}';\n`;
        scss += `$font-family-mono: '${typo.fontFamilyMonoBase || 'monospace'}';\n\n`;
      }
      
      // Color variables
      if (rawTokens.colors) {
        const colors = rawTokens.colors;
        scss += `$color-brand-primary: ${colors.brandPrimaryBase || '#0052CC'};\n`;
        scss += `$color-brand-secondary: ${colors.brandSecondaryBase || '#172B4D'};\n`;
        scss += `$color-success: ${colors.interactiveSuccessBase || '#28a745'};\n`;
        scss += `$color-warning: ${colors.interactiveWarningBase || '#ffc107'};\n`;
        scss += `$color-error: ${colors.interactiveErrorBase || '#dc3545'};\n`;
        scss += `$color-info: ${colors.interactiveInfoBase || '#17a2b8'};\n\n`;
      }
      
      // Spacing variables
      if (rawTokens.spacing) {
        const spacing = rawTokens.spacing;
        scss += `$spacing-unit-base: ${spacing.spacingUnitBase || 1}rem;\n`;
        scss += `$spacing-scale-base: ${spacing.spacingScaleBase || 1.5};\n\n`;
      }
      
      // Border variables
      if (rawTokens.borders) {
        const borders = rawTokens.borders;
        scss += `$border-width-base: ${borders.borderWidthBase || 1}px;\n`;
        scss += `$border-radius-base: ${borders.borderRadiusBase || 8}px;\n`;
      }

      res.setHeader('Content-Type', 'text/scss');
      res.setHeader('Content-Disposition', 'attachment; filename="design-tokens.scss"');
      res.send(scss);
    } catch (error) {
      console.error("Error exporting SCSS:", error);
      res.status(500).json({ message: "Error exporting SCSS" });
    }
  });

  // Export design system as Tailwind config
  app.get("/api/design-system/export/tailwind/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Read current theme.json
      const themeData = fs.readFileSync("./theme.json", "utf8");
      const theme = JSON.parse(themeData);
      const rawTokens = theme.raw_tokens || {};

      const config = {
        theme: {
          extend: {
            fontFamily: {
              primary: [rawTokens.typography?.fontFamily1Base || 'Rock Grotesque'],
              secondary: [rawTokens.typography?.fontFamily2Base || 'Rock Grotesque Wide'],
              mono: [rawTokens.typography?.fontFamilyMonoBase || 'monospace'],
            },
            fontSize: {
              base: `${rawTokens.typography?.fontSizeBase || 1}rem`,
            },
            lineHeight: {
              base: rawTokens.typography?.lineHeightBase || 1.4,
            },
            colors: {
              brand: {
                primary: rawTokens.colors?.brandPrimaryBase || '#0052CC',
                secondary: rawTokens.colors?.brandSecondaryBase || '#172B4D',
              },
              success: rawTokens.colors?.interactiveSuccessBase || '#28a745',
              warning: rawTokens.colors?.interactiveWarningBase || '#ffc107',
              error: rawTokens.colors?.interactiveErrorBase || '#dc3545',
              info: rawTokens.colors?.interactiveInfoBase || '#17a2b8',
            },
            spacing: {
              'unit-base': `${rawTokens.spacing?.spacingUnitBase || 1}rem`,
            },
            borderRadius: {
              base: `${rawTokens.borders?.borderRadiusBase || 8}px`,
            },
            borderWidth: {
              base: `${rawTokens.borders?.borderWidthBase || 1}px`,
            },
          },
        },
      };

      const configString = `module.exports = ${JSON.stringify(config, null, 2)};`;
      
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Content-Disposition', 'attachment; filename="tailwind.config.js"');
      res.send(configString);
    } catch (error) {
      console.error("Error exporting Tailwind config:", error);
      res.status(500).json({ message: "Error exporting Tailwind config" });
    }
  });
}
