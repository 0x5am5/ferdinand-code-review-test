import * as fs from "node:fs";
import type { Express } from "express";
import { z } from "zod";
import {
  UserRole,
  insertDesignSystemVersionSchema,
  insertDesignSystemChangeSchema,
  type DesignSystemVersion,
  type DesignSystemChange,
  type InsertDesignSystemVersion,
  type InsertDesignSystemChange
} from "@shared/schema";
import { storage } from "../storage";
// Import chroma for color manipulation
import chroma from "chroma-js";

// Types for token operations
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

interface TokenUpdate {
  clientId: number;
  rawTokens: RawTokens;
  versionName?: string;
  description?: string;
  source: 'manual_edit' | 'figma_pull' | 'figma_push' | 'api_update';
  figmaConnectionId?: number;
  syncLogId?: number;
}

// Semantic token generation (copied from existing design-system.ts)
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
    successLight: string;
    successDark: string;
    warningLight: string;
    warningDark: string;
    errorLight: string;
    errorDark: string;
    infoLight: string;
    infoDark: string;
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

// Generate semantic tokens from raw tokens
function generateSemanticTokens(rawTokens: RawTokens): SemanticTokens {
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
  const brandPrimaryVariations = generateColorVariations(colors.brandPrimaryBase);
  const brandSecondaryVariations = generateColorVariations(colors.brandSecondaryBase);

  // Generate interactive color variations
  const successVariations = generateColorVariations(colors.interactiveSuccessBase);
  const warningVariations = generateColorVariations(colors.interactiveWarningBase);
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
    elevation3: "0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)",
    elevation4: "0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22)",
    elevation5: "0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22)",

    // Semantic shadows
    elevationCard: "0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)",
    elevationModal: "0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22)",
    elevationButtonHover: "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
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
    const hue = parseInt(h, 10);
    const saturation = parseInt(s, 10);

    // Generate 11 shades from light to dark
    const shades = [];
    for (let i = 0; i <= 10; i++) {
      const lightness = 100 - i * 10; // 100%, 90%, 80%, ..., 0%
      shades.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }

    return shades;
  } catch (error: unknown) {
    console.error(
      "Error generating neutral scale:",
      error instanceof Error ? error.message : "Unknown error"
    );
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
    console.error(
      "Error generating color variations for",
      baseColor,
      error instanceof Error ? error.message : "Unknown error"
    );
    // Fallback variations
    return {
      xLight: baseColor,
      light: baseColor,
      dark: baseColor,
      xDark: baseColor,
    };
  }
}

// Utility function to generate changes between two token sets
function generateTokenChanges(
  oldTokens: RawTokens | null,
  newTokens: RawTokens,
  versionId: number,
  source: 'manual_edit' | 'figma_pull' | 'figma_push' | 'api_update'
): InsertDesignSystemChange[] {
  const changes: InsertDesignSystemChange[] = [];

  if (!oldTokens) {
    // First version - everything is created
    Object.entries(newTokens).forEach(([category, values]) => {
      if (typeof values === 'object' && values !== null) {
        Object.entries(values).forEach(([key, value]) => {
          changes.push({
            versionId,
            tokenType: category as 'color' | 'typography' | 'spacing' | 'border_radius' | 'shadow' | 'component',
            tokenPath: `${category}.${key}`,
            changeType: 'created',
            oldValue: null,
            newValue: value,
            changeSource: source,
          });
        });
      }
    });
    return changes;
  }

  // Compare old and new tokens
  const compareObjects = (
    oldObj: any,
    newObj: any,
    prefix: string,
    tokenType: string
  ) => {
    // Check for updates and creations
    Object.entries(newObj).forEach(([key, newValue]) => {
      const tokenPath = `${prefix}.${key}`;
      const oldValue = oldObj[key];

      if (oldValue === undefined) {
        // New token
        changes.push({
          versionId,
          tokenType: tokenType as 'color' | 'typography' | 'spacing' | 'border_radius' | 'shadow' | 'component',
          tokenPath,
          changeType: 'created',
          oldValue: null,
          newValue,
          changeSource: source,
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        // Updated token
        changes.push({
          versionId,
          tokenType: tokenType as 'color' | 'typography' | 'spacing' | 'border_radius' | 'shadow' | 'component',
          tokenPath,
          changeType: 'updated',
          oldValue,
          newValue,
          changeSource: source,
        });
      }
    });

    // Check for deletions
    Object.entries(oldObj).forEach(([key]) => {
      if (newObj[key] === undefined) {
        const tokenPath = `${prefix}.${key}`;
        changes.push({
          versionId,
          tokenType: tokenType as 'color' | 'typography' | 'spacing' | 'border_radius' | 'shadow' | 'component',
          tokenPath,
          changeType: 'deleted',
          oldValue: oldObj[key],
          newValue: null,
          changeSource: source,
        });
      }
    });
  };

  compareObjects(oldTokens.typography, newTokens.typography, 'typography', 'typography');
  compareObjects(oldTokens.colors, newTokens.colors, 'colors', 'color');
  compareObjects(oldTokens.spacing, newTokens.spacing, 'spacing', 'spacing');
  compareObjects(oldTokens.borders, newTokens.borders, 'borders', 'border_radius');

  if (oldTokens.components && newTokens.components) {
    compareObjects(oldTokens.components, newTokens.components, 'components', 'component');
  } else if (newTokens.components) {
    compareObjects({}, newTokens.components, 'components', 'component');
  } else if (oldTokens.components) {
    compareObjects(oldTokens.components, {}, 'components', 'component');
  }

  return changes;
}

// Auto-generate description from changes
function generateVersionDescription(changes: InsertDesignSystemChange[]): string {
  if (changes.length === 0) return "No changes";

  const created = changes.filter(c => c.changeType === 'created').length;
  const updated = changes.filter(c => c.changeType === 'updated').length;
  const deleted = changes.filter(c => c.changeType === 'deleted').length;

  const parts = [];
  if (created > 0) parts.push(`${created} token${created === 1 ? '' : 's'} created`);
  if (updated > 0) parts.push(`${updated} token${updated === 1 ? '' : 's'} updated`);
  if (deleted > 0) parts.push(`${deleted} token${deleted === 1 ? '' : 's'} deleted`);

  return parts.join(', ');
}

export function registerDesignTokenRoutes(app: Express) {
  // Get unified design tokens for a client
  app.get("/api/design-system/tokens/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const { version } = req.query;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check client access
      const client = await storage.getClient(parseInt(clientId, 10));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      let tokens: RawTokens;
      let currentVersion: DesignSystemVersion | null = null;

      if (version) {
        // Get specific version
        currentVersion = await storage.getDesignSystemVersion(parseInt(version as string, 10));
        if (!currentVersion || currentVersion.clientId !== parseInt(clientId, 10)) {
          return res.status(404).json({ message: "Version not found" });
        }
        tokens = currentVersion.rawTokens as RawTokens;
      } else {
        // Get current tokens from theme.json
        try {
          const themeData = fs.readFileSync("./theme.json", "utf8");
          const theme = JSON.parse(themeData);
          tokens = theme.raw_tokens || null;

          if (!tokens) {
            return res.status(404).json({ message: "No design tokens found" });
          }

          // Get latest version for metadata
          currentVersion = await storage.getLatestDesignSystemVersion(parseInt(clientId, 10));
        } catch (error) {
          return res.status(404).json({ message: "No design tokens found" });
        }
      }

      // Generate semantic tokens
      const semanticTokens = generateSemanticTokens(tokens);

      res.json({
        rawTokens: tokens,
        semanticTokens,
        version: currentVersion ? {
          id: currentVersion.id,
          versionName: currentVersion.versionName,
          description: currentVersion.description,
          createdAt: currentVersion.createdAt,
          userId: currentVersion.userId,
          isSnapshot: currentVersion.isSnapshot,
        } : null,
      });
    } catch (error: unknown) {
      console.error(
        "Error fetching design tokens:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching design tokens" });
    }
  });

  // Update design tokens with versioning
  app.post("/api/design-system/tokens", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only allow editors and above to update tokens
      if (
        user.role !== UserRole.EDITOR &&
        user.role !== UserRole.ADMIN &&
        user.role !== UserRole.SUPER_ADMIN
      ) {
        return res.status(403).json({
          message: "Insufficient permissions to update design tokens",
        });
      }

      const tokenUpdate: TokenUpdate = req.body;

      // Validate request
      if (!tokenUpdate.clientId || !tokenUpdate.rawTokens) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check client access
      const client = await storage.getClient(tokenUpdate.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get current tokens for comparison
      let currentTokens: RawTokens | null = null;
      try {
        const themeData = fs.readFileSync("./theme.json", "utf8");
        const theme = JSON.parse(themeData);
        currentTokens = theme.raw_tokens || null;
      } catch (error) {
        // No existing tokens
      }

      // Generate semantic tokens
      const semanticTokens = generateSemanticTokens(tokenUpdate.rawTokens);

      // Create version record
      const versionData: InsertDesignSystemVersion = {
        clientId: tokenUpdate.clientId,
        userId: req.session.userId,
        versionName: tokenUpdate.versionName,
        rawTokens: tokenUpdate.rawTokens,
        semanticTokens,
        figmaConnectionId: tokenUpdate.figmaConnectionId,
        syncLogId: tokenUpdate.syncLogId,
      };

      const version = await storage.createDesignSystemVersion(versionData);

      // Generate and store changes
      const changes = generateTokenChanges(
        currentTokens,
        tokenUpdate.rawTokens,
        version.id,
        tokenUpdate.source
      );

      // Set description if not provided
      if (!versionData.description) {
        versionData.description = generateVersionDescription(changes);
        await storage.updateDesignSystemVersion(version.id, {
          description: versionData.description,
          changesSummary: changes.map(c => ({
            type: c.tokenType,
            path: c.tokenPath,
            action: c.changeType,
            oldValue: c.oldValue,
            newValue: c.newValue,
          }))
        });
      }

      // Store individual changes
      for (const change of changes) {
        await storage.createDesignSystemChange(change);
      }

      // Update theme.json file
      let existingTheme = {};
      try {
        const themeData = fs.readFileSync("./theme.json", "utf8");
        existingTheme = JSON.parse(themeData);
      } catch (error) {
        // File doesn't exist, start fresh
      }

      const updatedTheme = {
        ...existingTheme,
        raw_tokens: tokenUpdate.rawTokens,
        semantic_tokens: semanticTokens,
      };

      fs.writeFileSync("./theme.json", JSON.stringify(updatedTheme, null, 2));

      // Touch client to update modification time
      await storage.touchClient(tokenUpdate.clientId);

      res.json({
        version: {
          id: version.id,
          versionName: version.versionName,
          description: versionData.description,
          createdAt: version.createdAt,
        },
        changesCount: changes.length,
        rawTokens: tokenUpdate.rawTokens,
        semanticTokens,
      });
    } catch (error: unknown) {
      console.error(
        "Error updating design tokens:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error updating design tokens" });
    }
  });

  // Get version history for a client
  app.get("/api/design-system/versions/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const { limit = "20", offset = "0" } = req.query;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check client access
      const client = await storage.getClient(parseInt(clientId, 10));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const versions = await storage.getDesignSystemVersions(
        parseInt(clientId, 10),
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      res.json(versions);
    } catch (error: unknown) {
      console.error(
        "Error fetching version history:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching version history" });
    }
  });

  // Get specific version details
  app.get("/api/design-system/versions/:clientId/:versionId", async (req, res) => {
    try {
      const { clientId, versionId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check client access
      const client = await storage.getClient(parseInt(clientId, 10));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const version = await storage.getDesignSystemVersion(parseInt(versionId, 10));
      if (!version || version.clientId !== parseInt(clientId, 10)) {
        return res.status(404).json({ message: "Version not found" });
      }

      const changes = await storage.getDesignSystemChanges(parseInt(versionId, 10));

      res.json({
        ...version,
        changes,
      });
    } catch (error: unknown) {
      console.error(
        "Error fetching version details:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching version details" });
    }
  });

  // Rollback to a specific version
  app.post("/api/design-system/rollback/:clientId/:versionId", async (req, res) => {
    try {
      const { clientId, versionId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only allow admins and super admins to rollback
      if (
        user.role !== UserRole.ADMIN &&
        user.role !== UserRole.SUPER_ADMIN
      ) {
        return res.status(403).json({
          message: "Insufficient permissions to rollback design tokens",
        });
      }

      // Check client access
      const client = await storage.getClient(parseInt(clientId, 10));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const targetVersion = await storage.getDesignSystemVersion(parseInt(versionId, 10));
      if (!targetVersion || targetVersion.clientId !== parseInt(clientId, 10)) {
        return res.status(404).json({ message: "Version not found" });
      }

      // Create new version with rollback data
      const rollbackVersion = await storage.createDesignSystemVersion({
        clientId: parseInt(clientId, 10),
        userId: req.session.userId,
        versionName: `Rollback to ${targetVersion.versionName || `version ${targetVersion.id}`}`,
        description: `Rolled back to version ${targetVersion.id} (${targetVersion.createdAt})`,
        rawTokens: targetVersion.rawTokens,
        semanticTokens: targetVersion.semanticTokens,
        parentVersionId: targetVersion.id,
      });

      // Update theme.json file
      let existingTheme = {};
      try {
        const themeData = fs.readFileSync("./theme.json", "utf8");
        existingTheme = JSON.parse(themeData);
      } catch (error) {
        // File doesn't exist, start fresh
      }

      const updatedTheme = {
        ...existingTheme,
        raw_tokens: targetVersion.rawTokens,
        semantic_tokens: targetVersion.semanticTokens,
      };

      fs.writeFileSync("./theme.json", JSON.stringify(updatedTheme, null, 2));

      // Touch client to update modification time
      await storage.touchClient(parseInt(clientId, 10));

      res.json({
        message: "Successfully rolled back design tokens",
        version: {
          id: rollbackVersion.id,
          versionName: rollbackVersion.versionName,
          description: rollbackVersion.description,
          createdAt: rollbackVersion.createdAt,
        },
        rolledBackTo: {
          id: targetVersion.id,
          versionName: targetVersion.versionName,
          createdAt: targetVersion.createdAt,
        },
      });
    } catch (error: unknown) {
      console.error(
        "Error rolling back design tokens:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error rolling back design tokens" });
    }
  });

  // Create manual snapshot
  app.post("/api/design-system/snapshot/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const { name, description } = req.body;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only allow editors and above to create snapshots
      if (
        user.role !== UserRole.EDITOR &&
        user.role !== UserRole.ADMIN &&
        user.role !== UserRole.SUPER_ADMIN
      ) {
        return res.status(403).json({
          message: "Insufficient permissions to create snapshots",
        });
      }

      // Check client access
      const client = await storage.getClient(parseInt(clientId, 10));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get current tokens
      let currentTokens: RawTokens;
      try {
        const themeData = fs.readFileSync("./theme.json", "utf8");
        const theme = JSON.parse(themeData);
        currentTokens = theme.raw_tokens;

        if (!currentTokens) {
          return res.status(404).json({ message: "No design tokens found" });
        }
      } catch (error) {
        return res.status(404).json({ message: "No design tokens found" });
      }

      // Generate semantic tokens
      const semanticTokens = generateSemanticTokens(currentTokens);

      // Create snapshot
      const snapshot = await storage.createDesignSystemVersion({
        clientId: parseInt(clientId, 10),
        userId: req.session.userId,
        versionName: name,
        description: description || `Manual snapshot created by ${user.name}`,
        rawTokens: currentTokens,
        semanticTokens,
        isSnapshot: true,
      });

      res.json({
        message: "Snapshot created successfully",
        snapshot: {
          id: snapshot.id,
          versionName: snapshot.versionName,
          description: snapshot.description,
          createdAt: snapshot.createdAt,
        },
      });
    } catch (error: unknown) {
      console.error(
        "Error creating snapshot:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error creating snapshot" });
    }
  });
}