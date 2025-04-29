import type { Express } from "express";
import { storage } from "../storage";
import * as fs from "fs";
import { UserRole } from "@shared/schema";

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
}
