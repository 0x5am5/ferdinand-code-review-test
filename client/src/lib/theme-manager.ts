// theme-manager.ts
// A simpler approach to theme management that doesn't rely on React context

// Define types for the design system
export interface DesignSystem {
  raw_tokens?: {
    default_unit?: string;
    spacing?: Record<string, number | string>;
    radius?: Record<string, number | string>;
    transition?: Record<string, string | number>;
    border?: Record<string, string | number>;
    colors?: {
      brand?: Record<string, string>;
      neutral?: Record<string, string>;
      interactive?: Record<string, string>;
    };
  };
  theme: {
    variant: "professional" | "tint" | "vibrant";
    primary: string;
    secondary?: string;
    tertiary?: string;
    appearance: "light" | "dark" | "system";
    radius: number;
    animation: "none" | "minimal" | "smooth" | "bounce";
  };
  typography: {
    primary: string;
    heading: string;
  };
  colors: {
    // Basic colors
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

    // Material Design System Colors
    // Primary color variants
    "primary-tint-1"?: string; // 80% lighter
    "primary-tint-2"?: string; // 90% lighter
    "primary-shade-1"?: string; // 80% darker
    "primary-shade-2"?: string; // 90% darker
    "primary-container"?: string; // Container variant
    "on-primary"?: string; // Text/icons on primary
    "on-primary-container"?: string; // Text/icons on primary container

    // Secondary color variants (if secondary color exists)
    secondary?: string;
    "secondary-tint-1"?: string;
    "secondary-tint-2"?: string;
    "secondary-shade-1"?: string;
    "secondary-shade-2"?: string;
    "secondary-container"?: string;
    "on-secondary"?: string;
    "on-secondary-container"?: string;

    // Tertiary color variants (if tertiary color exists)
    tertiary?: string;
    "tertiary-tint-1"?: string;
    "tertiary-tint-2"?: string;
    "tertiary-shade-1"?: string;
    "tertiary-shade-2"?: string;
    "tertiary-container"?: string;
    "on-tertiary"?: string;
    "on-tertiary-container"?: string;

    // Neutral palette (11 shades from light to dark)
    "neutral-0"?: string; // Lightest - white
    "neutral-10"?: string;
    "neutral-20"?: string;
    "neutral-30"?: string;
    "neutral-40"?: string;
    "neutral-50"?: string; // Middle gray
    "neutral-60"?: string;
    "neutral-70"?: string;
    "neutral-80"?: string;
    "neutral-90"?: string;
    "neutral-100"?: string; // Darkest - black

    // Interactive/System colors
    error?: string;
    "error-container"?: string;
    "on-error"?: string;
    "on-error-container"?: string;

    success?: string;
    "success-container"?: string;
    "on-success"?: string;
    "on-success-container"?: string;

    warning?: string;
    "warning-container"?: string;
    "on-warning"?: string;
    "on-warning-container"?: string;

    // Dark mode specific colors
    "dark-background"?: string;
    "dark-surface"?: string;
    "dark-on-surface"?: string;
  };
  typography_extended?: {
    font_family_base?: string;
    font_family_secondary?: string;
    font_family_mono?: string;
    font_size_base?: number;
    font_scale_ratio?: number;
    line_height_ratio?: number;
    font_weight_light?: number;
    font_weight_regular?: number;
    font_weight_medium?: number;
    font_weight_bold?: number;
    line_height_tight?: number;
    line_height_default?: number;
    line_height_loose?: number;
  };
}

// Default theme settings
export const defaultTheme: DesignSystem = {
  theme: {
    variant: "professional",
    primary: "#0099ff",
    appearance: "light",
    radius: 0.5,
    animation: "smooth",
  },
  typography: {
    primary: "system-ui, sans-serif",
    heading: "system-ui, sans-serif",
  },
  colors: {
    primary: "#0099ff",
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
    ring: "#0099ff",
  },
};

// Define event types
type ThemeChangeEvent = "theme-update" | "draft-update";

// Subscribers function type
type ThemeChangeSubscriber = (theme: DesignSystem | null) => void;

// Theme Manager Class
class ThemeManager {
  private currentTheme: DesignSystem;
  private draftTheme: DesignSystem | null = null;
  private subscribers: Map<ThemeChangeEvent, Set<ThemeChangeSubscriber>> =
    new Map();
  private lastAppliedTheme: string | null = null;

  constructor(initialTheme: DesignSystem = defaultTheme) {
    this.currentTheme = { ...initialTheme };
    this.draftTheme = null;
    this.subscribers.set("theme-update", new Set());
    this.subscribers.set("draft-update", new Set());
    this.init();
  }

  // Initialize from API and apply theme
  async init() {
    try {
      console.log("Initializing ThemeManager...");
      const response = await fetch("/api/design-system");
      if (response.ok) {
        const data = await response.json();
        console.log("Theme settings loaded from API");
        this.currentTheme = data;
        this.draftTheme = { ...data };
      } else {
        console.log("API returned non-200 status, using default theme");
        this.draftTheme = { ...this.currentTheme };
      }
    } catch {
      console.log("Error encountered, falling back to default theme");
      this.draftTheme = { ...this.currentTheme };
    } finally {
      console.log("Theme initialization complete");
      this.applyTheme();
    }
  }

  // Subscribe to theme events
  subscribe(event: ThemeChangeEvent, callback: ThemeChangeSubscriber) {
    const subscribers = this.subscribers.get(event) || new Set();
    subscribers.add(callback);
    this.subscribers.set(event, subscribers);

    // Immediately call with current state
    if (event === "theme-update") {
      callback(this.currentTheme);
    } else if (event === "draft-update" && this.draftTheme) {
      callback(this.draftTheme);
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(event);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  // Notify subscribers of changes
  private notify(event: ThemeChangeEvent, theme: DesignSystem | null) {
    const subscribers = this.subscribers.get(event);
    if (subscribers) {
      subscribers.forEach((callback) => {
        callback(theme);
      });
    }
  }

  // Get the current theme
  getTheme(): DesignSystem {
    return { ...this.currentTheme };
  }

  // Get the draft theme
  getDraftTheme(): DesignSystem | null {
    return this.draftTheme ? { ...this.draftTheme } : null;
  }

  // Update draft theme
  updateDraftTheme(newTheme: Partial<DesignSystem>) {
    if (!this.draftTheme) {
      this.draftTheme = { ...this.currentTheme };
    }

    try {
      console.log("Updating draft theme");

      // Deep merge the changes into the draft theme
      if (newTheme.theme) {
        this.draftTheme.theme = {
          ...this.draftTheme.theme,
          ...newTheme.theme,
        };

        // If variant or primary has changed, update colors based on variant
        if (newTheme.theme.variant || newTheme.theme.primary) {
          const variantColors = this.generateVariantColors(
            newTheme.theme.primary || this.draftTheme.theme.primary,
            newTheme.theme.variant || this.draftTheme.theme.variant
          );

          this.draftTheme.colors = {
            ...this.draftTheme.colors,
            ...variantColors,
          };
        }
      }

      // Merge typography changes
      if (newTheme.typography) {
        this.draftTheme.typography = {
          ...this.draftTheme.typography,
          ...newTheme.typography,
        };
      }

      // Merge custom color changes (these will override variant-based colors)
      if (newTheme.colors) {
        this.draftTheme.colors = {
          ...this.draftTheme.colors,
          ...newTheme.colors,
        };
      }

      // Apply extended typography settings
      if (newTheme.typography_extended) {
        this.draftTheme.typography_extended = {
          ...(this.draftTheme.typography_extended || {}),
          ...newTheme.typography_extended,
        };
      }

      // Apply raw tokens
      if (newTheme.raw_tokens) {
        this.draftTheme.raw_tokens = this.draftTheme.raw_tokens || {};

        // Apply unit settings
        if (newTheme.raw_tokens.default_unit) {
          this.draftTheme.raw_tokens.default_unit =
            newTheme.raw_tokens.default_unit;
        }

        // Apply color tokens
        if (newTheme.raw_tokens.colors) {
          this.draftTheme.raw_tokens.colors =
            this.draftTheme.raw_tokens.colors || {};

          // Brand colors
          if (newTheme.raw_tokens.colors.brand) {
            this.draftTheme.raw_tokens.colors.brand = {
              ...(this.draftTheme.raw_tokens.colors.brand || {}),
              ...newTheme.raw_tokens.colors.brand,
            };
          }

          // Neutral colors
          if (newTheme.raw_tokens.colors.neutral) {
            this.draftTheme.raw_tokens.colors.neutral = {
              ...(this.draftTheme.raw_tokens.colors.neutral || {}),
              ...newTheme.raw_tokens.colors.neutral,
            };
          }

          // Interactive colors
          if (newTheme.raw_tokens.colors.interactive) {
            this.draftTheme.raw_tokens.colors.interactive = {
              ...(this.draftTheme.raw_tokens.colors.interactive || {}),
              ...newTheme.raw_tokens.colors.interactive,
            };
          }
        }

        // Apply spacing tokens
        if (newTheme.raw_tokens.spacing) {
          this.draftTheme.raw_tokens.spacing = {
            ...(this.draftTheme.raw_tokens.spacing || {}),
            ...newTheme.raw_tokens.spacing,
          };
        }

        // Apply radius tokens
        if (newTheme.raw_tokens.radius) {
          this.draftTheme.raw_tokens.radius = {
            ...(this.draftTheme.raw_tokens.radius || {}),
            ...newTheme.raw_tokens.radius,
          };
        }

        // Apply transition tokens
        if (newTheme.raw_tokens.transition) {
          this.draftTheme.raw_tokens.transition = {
            ...(this.draftTheme.raw_tokens.transition || {}),
            ...newTheme.raw_tokens.transition,
          };
        }

        // Apply border tokens
        if (newTheme.raw_tokens.border) {
          this.draftTheme.raw_tokens.border = {
            ...(this.draftTheme.raw_tokens.border || {}),
            ...newTheme.raw_tokens.border,
          };
        }
      }

      // Notify subscribers of the draft change
      // We're removing the direct applyTheme call to break the circular dependency
      // The React hook will handle applying the theme to the DOM via its useEffect
      this.notify("draft-update", this.draftTheme);
    } catch (error: unknown) {
      console.error("Error updating draft theme:", error);
    }
  }

  // Apply draft changes to the current theme and send to the API
  async applyDraftChanges() {
    if (!this.draftTheme) return;

    try {
      console.log("Applying draft changes to theme");

      // Send update to the API
      const response = await fetch("/api/design-system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.draftTheme),
      });

      if (!response.ok) {
        throw new Error("Failed to update theme settings");
      }

      // Update the current theme with draft values
      this.currentTheme = { ...this.draftTheme };

      // Notify subscribers
      this.notify("theme-update", this.currentTheme);

      return true;
    } catch (error: unknown) {
      console.error("Error applying draft changes:", error);
      return false;
    }
  }

  // Reset draft changes
  resetDraftChanges() {
    if (this.currentTheme) {
      this.draftTheme = { ...this.currentTheme };
      // Only notify subscribers, the React hook will handle the DOM updates
      this.notify("draft-update", this.draftTheme);
    }
  }

  // Clear draft changes completely (set to null)
  clearDraft() {
    this.draftTheme = null;
    // Notify subscribers so the theme reverts to the saved theme
    this.notify("draft-update", null);
  }

  // Variable to store the timeout ID for debouncing
  private applyThemeTimeout: NodeJS.Timeout | null = null;

  // Apply theme to DOM with debounce to prevent maximum update depth issues
  applyTheme() {
    // Clear any pending timeout
    if (this.applyThemeTimeout) {
      clearTimeout(this.applyThemeTimeout);
    }

    // Debounce the theme application by 50ms
    this.applyThemeTimeout = setTimeout(() => {
      // Use the draft theme if available, otherwise use current theme
      const activeTheme = this.draftTheme || this.currentTheme;
      if (!activeTheme) return;

      // Create a snapshot for comparison to prevent unnecessary updates
      const snapshot = JSON.stringify({
        primary: activeTheme.theme.primary,
        secondary: activeTheme.theme.secondary,
        tertiary: activeTheme.theme.tertiary,
        variant: activeTheme.theme.variant,
        appearance: activeTheme.theme.appearance,
        radius: activeTheme.theme.radius,
        animation: activeTheme.theme.animation,
        typography: activeTheme.typography,
      });

      // If nothing changed, exit early
      if (snapshot === this.lastAppliedTheme) return;

      console.log("Applying theme changes to DOM");
      this.lastAppliedTheme = snapshot;

      // Get reference to document root
      const root = document.documentElement;

      try {
        // Apply border radius
        root.style.setProperty("--radius", `${activeTheme.theme.radius}rem`);

        // Apply animation settings
        const animationSettings = {
          none: "0s",
          minimal: "0.1s",
          smooth: "0.2s",
          bounce: "0.3s",
        };

        const animationValue = activeTheme.theme
          .animation as keyof typeof animationSettings;
        root.style.setProperty(
          "--transition",
          animationSettings[animationValue] || "0.2s"
        );

        // Apply primary color and variants
        if (activeTheme.theme.primary) {
          // Apply the Material Design color system
          // Convert primary color to HSL
          const primaryHsl = this.hexToHSL(activeTheme.theme.primary);

          // Apply the primary color
          root.style.setProperty("--primary", primaryHsl.hslString);

          // Apply primary tints and shades
          if (activeTheme.colors["primary-tint-1"]) {
            this.setCssColorProperty(
              "--primary-tint-1",
              activeTheme.colors["primary-tint-1"]
            );
          }

          if (activeTheme.colors["primary-tint-2"]) {
            this.setCssColorProperty(
              "--primary-tint-2",
              activeTheme.colors["primary-tint-2"]
            );
          }

          if (activeTheme.colors["primary-shade-1"]) {
            this.setCssColorProperty(
              "--primary-shade-1",
              activeTheme.colors["primary-shade-1"]
            );
          }

          if (activeTheme.colors["primary-shade-2"]) {
            this.setCssColorProperty(
              "--primary-shade-2",
              activeTheme.colors["primary-shade-2"]
            );
          }

          // Apply container and on-color variants
          if (activeTheme.colors["primary-container"]) {
            this.setCssColorProperty(
              "--primary-container",
              activeTheme.colors["primary-container"]
            );
          }

          if (activeTheme.colors["on-primary"]) {
            this.setCssColorProperty(
              "--on-primary",
              activeTheme.colors["on-primary"]
            );
          }

          if (activeTheme.colors["on-primary-container"]) {
            this.setCssColorProperty(
              "--on-primary-container",
              activeTheme.colors["on-primary-container"]
            );
          }

          // Apply secondary color and variants if they exist
          if (activeTheme.theme.secondary) {
            // Convert secondary color to HSL
            const secondaryHsl = this.hexToHSL(activeTheme.theme.secondary);
            root.style.setProperty("--secondary", secondaryHsl.hslString);

            // Apply secondary variants
            if (activeTheme.colors["secondary-tint-1"]) {
              this.setCssColorProperty(
                "--secondary-tint-1",
                activeTheme.colors["secondary-tint-1"]
              );
            }

            if (activeTheme.colors["secondary-tint-2"]) {
              this.setCssColorProperty(
                "--secondary-tint-2",
                activeTheme.colors["secondary-tint-2"]
              );
            }

            if (activeTheme.colors["secondary-shade-1"]) {
              this.setCssColorProperty(
                "--secondary-shade-1",
                activeTheme.colors["secondary-shade-1"]
              );
            }

            if (activeTheme.colors["secondary-shade-2"]) {
              this.setCssColorProperty(
                "--secondary-shade-2",
                activeTheme.colors["secondary-shade-2"]
              );
            }

            // Apply secondary container and on-color variants
            if (activeTheme.colors["secondary-container"]) {
              this.setCssColorProperty(
                "--secondary-container",
                activeTheme.colors["secondary-container"]
              );
            }

            if (activeTheme.colors["on-secondary"]) {
              this.setCssColorProperty(
                "--on-secondary",
                activeTheme.colors["on-secondary"]
              );
            }

            if (activeTheme.colors["on-secondary-container"]) {
              this.setCssColorProperty(
                "--on-secondary-container",
                activeTheme.colors["on-secondary-container"]
              );
            }
          }

          // Apply tertiary color and variants if they exist
          if (activeTheme.theme.tertiary) {
            // Convert tertiary color to HSL
            const tertiaryHsl = this.hexToHSL(activeTheme.theme.tertiary);
            root.style.setProperty("--tertiary", tertiaryHsl.hslString);

            // Apply tertiary variants
            if (activeTheme.colors["tertiary-tint-1"]) {
              this.setCssColorProperty(
                "--tertiary-tint-1",
                activeTheme.colors["tertiary-tint-1"]
              );
            }

            if (activeTheme.colors["tertiary-tint-2"]) {
              this.setCssColorProperty(
                "--tertiary-tint-2",
                activeTheme.colors["tertiary-tint-2"]
              );
            }

            if (activeTheme.colors["tertiary-shade-1"]) {
              this.setCssColorProperty(
                "--tertiary-shade-1",
                activeTheme.colors["tertiary-shade-1"]
              );
            }

            if (activeTheme.colors["tertiary-shade-2"]) {
              this.setCssColorProperty(
                "--tertiary-shade-2",
                activeTheme.colors["tertiary-shade-2"]
              );
            }

            // Apply tertiary container and on-color variants
            if (activeTheme.colors["tertiary-container"]) {
              this.setCssColorProperty(
                "--tertiary-container",
                activeTheme.colors["tertiary-container"]
              );
            }

            if (activeTheme.colors["on-tertiary"]) {
              this.setCssColorProperty(
                "--on-tertiary",
                activeTheme.colors["on-tertiary"]
              );
            }

            if (activeTheme.colors["on-tertiary-container"]) {
              this.setCssColorProperty(
                "--on-tertiary-container",
                activeTheme.colors["on-tertiary-container"]
              );
            }
          }

          // Apply neutral palette
          for (let i = 0; i <= 100; i += 10) {
            const neutralKey = `neutral-${i}` as keyof DesignSystem["colors"];
            if (activeTheme.colors[neutralKey]) {
              this.setCssColorProperty(
                `--${neutralKey}`,
                activeTheme.colors[neutralKey] as string
              );
            }
          }

          // Apply interactive system colors
          // Error colors
          if (activeTheme.colors.error) {
            this.setCssColorProperty("--error", activeTheme.colors.error);
          }

          if (activeTheme.colors["error-container"]) {
            this.setCssColorProperty(
              "--error-container",
              activeTheme.colors["error-container"]
            );
          }

          if (activeTheme.colors["on-error"]) {
            this.setCssColorProperty(
              "--on-error",
              activeTheme.colors["on-error"]
            );
          }

          if (activeTheme.colors["on-error-container"]) {
            this.setCssColorProperty(
              "--on-error-container",
              activeTheme.colors["on-error-container"]
            );
          }

          // Success colors
          if (activeTheme.colors.success) {
            this.setCssColorProperty("--success", activeTheme.colors.success);
          }

          if (activeTheme.colors["success-container"]) {
            this.setCssColorProperty(
              "--success-container",
              activeTheme.colors["success-container"]
            );
          }

          if (activeTheme.colors["on-success"]) {
            this.setCssColorProperty(
              "--on-success",
              activeTheme.colors["on-success"]
            );
          }

          if (activeTheme.colors["on-success-container"]) {
            this.setCssColorProperty(
              "--on-success-container",
              activeTheme.colors["on-success-container"]
            );
          }

          // Warning colors
          if (activeTheme.colors.warning) {
            this.setCssColorProperty("--warning", activeTheme.colors.warning);
          }

          if (activeTheme.colors["warning-container"]) {
            this.setCssColorProperty(
              "--warning-container",
              activeTheme.colors["warning-container"]
            );
          }

          if (activeTheme.colors["on-warning"]) {
            this.setCssColorProperty(
              "--on-warning",
              activeTheme.colors["on-warning"]
            );
          }

          if (activeTheme.colors["on-warning-container"]) {
            this.setCssColorProperty(
              "--on-warning-container",
              activeTheme.colors["on-warning-container"]
            );
          }

          // Apply dark/light mode
          if (activeTheme.theme.appearance === "dark") {
            root.classList.add("dark");

            // Apply dark mode colors
            if (activeTheme.colors["dark-background"]) {
              this.setCssColorProperty(
                "--background",
                activeTheme.colors["dark-background"]
              );
            } else {
              // Default dark mode if custom colors not set
              root.style.setProperty("--background", "240 10% 3.9%");
            }

            if (activeTheme.colors["dark-surface"]) {
              this.setCssColorProperty(
                "--card",
                activeTheme.colors["dark-surface"]
              );
            } else {
              root.style.setProperty("--card", "240 10% 3.9%");
            }

            if (activeTheme.colors["dark-on-surface"]) {
              this.setCssColorProperty(
                "--foreground",
                activeTheme.colors["dark-on-surface"]
              );
              this.setCssColorProperty(
                "--card-foreground",
                activeTheme.colors["dark-on-surface"]
              );
            } else {
              root.style.setProperty("--foreground", "0 0% 98%");
              root.style.setProperty("--card-foreground", "0 0% 98%");
            }

            // Default dark mode styles if not specifically set
            if (!activeTheme.colors.muted) {
              root.style.setProperty("--muted", "240 3.7% 15.9%");
            }

            if (!activeTheme.colors["muted-foreground"]) {
              root.style.setProperty("--muted-foreground", "240 5% 64.9%");
            }
          } else {
            root.classList.remove("dark");

            // Apply all colors from the theme when in light mode
            Object.entries(activeTheme.colors).forEach(([key, value]) => {
              if (typeof value === "string" && !key.startsWith("dark-")) {
                this.setCssColorProperty(`--${key}`, value);
              }
            });
          }
        }

        // Apply typography
        if (activeTheme.typography.primary) {
          root.style.setProperty("--font-sans", activeTheme.typography.primary);
        }
        if (activeTheme.typography.heading) {
          root.style.setProperty(
            "--font-heading",
            activeTheme.typography.heading
          );
        }
      } catch (error: unknown) {
        console.error("Error applying theme to DOM:", error);
      }
    }, 50);
  }

  // Helper method to check if a string is a hex color
  private isHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  // Helper method to convert hex to HSL
  private hexToHSL(hex: string): {
    h: number;
    s: number;
    l: number;
    hslString: string;
  } {
    // Remove the # if present
    hex = hex.replace(/^#/, "");

    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    // Convert from hex to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Find max and min values
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    let h = 0,
      s = 0,
      l = (max + min) / 2;

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

      h = Math.round(h * 60);
    }

    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return { h, s, l, hslString: `${h} ${s}% ${l}%` };
  }

  // Helper to generate tints
  private generateTint(hex: string, amount: number): string {
    if (!this.isHexColor(hex)) return hex;

    const { h, s, l } = this.hexToHSL(hex);
    // Increase lightness by the percentage amount (0-100)
    const newL = Math.min(100, l + ((100 - l) * amount) / 100);
    return `hsl(${h}, ${s}%, ${newL}%)`;
  }

  // Helper to generate shades
  private generateShade(hex: string, amount: number): string {
    if (!this.isHexColor(hex)) return hex;

    const { h, s, l } = this.hexToHSL(hex);
    // Decrease lightness by the percentage amount (0-100)
    const newL = Math.max(0, l - (l * amount) / 100);
    return `hsl(${h}, ${s}%, ${newL}%)`;
  }

  // Generate variant-specific colors based on primary color and Material Design principles
  private generateVariantColors(
    primaryColor: string,
    variant: "professional" | "tint" | "vibrant"
  ): Record<string, string> {
    // Ensure we have a valid hex color
    if (!this.isHexColor(primaryColor)) {
      primaryColor = "#0099ff"; // Default fallback color
    }

    // Extract color components
    const { h, s, l } = this.hexToHSL(primaryColor);

    // Generate base result with primary color
    let colors: Record<string, string> = {
      primary: primaryColor,
      ring: primaryColor,
    };

    // Generate primary color variants according to Material Design principles
    colors["primary-tint-1"] = this.generateTint(primaryColor, 0.8); // 80% lighter
    colors["primary-tint-2"] = this.generateTint(primaryColor, 0.9); // 90% lighter
    colors["primary-shade-1"] = this.generateShade(primaryColor, 0.8); // 80% darker
    colors["primary-shade-2"] = this.generateShade(primaryColor, 0.9); // 90% darker

    // Generate on-color variants for text/icons
    colors["on-primary"] = l > 60 ? "#000000" : "#ffffff";

    // Generate primary container colors
    // For container variants, we use a more desaturated, lighter version of the primary
    colors["primary-container"] =
      `hsl(${h}, ${Math.max(10, s * 0.5)}%, ${Math.min(95, l * 1.3)}%)`;
    colors["on-primary-container"] = l > 70 ? "#000000" : primaryColor;

    // Generate neutral palette (11 shades from white to black)
    const neutralHue = h; // Use the same hue as primary but very desaturated
    const neutralSaturation = Math.min(s * 0.1, 5); // Very desaturated

    for (let i = 0; i <= 100; i += 10) {
      // Neutral-0 is white, Neutral-100 is black
      const neutralLightness = 100 - i;
      colors[`neutral-${i}`] =
        `hsl(${neutralHue}, ${neutralSaturation}%, ${neutralLightness}%)`;
    }

    // Set up error system colors
    const errorHue = 0; // Red
    colors.error = `hsl(${errorHue}, 90%, 60%)`;
    colors["error-container"] = `hsl(${errorHue}, 80%, 90%)`;
    colors["on-error"] = "#ffffff";
    colors["on-error-container"] = `hsl(${errorHue}, 90%, 30%)`;

    // Set up success system colors
    const successHue = 120; // Green
    colors.success = `hsl(${successHue}, 70%, 40%)`;
    colors["success-container"] = `hsl(${successHue}, 60%, 90%)`;
    colors["on-success"] = "#ffffff";
    colors["on-success-container"] = `hsl(${successHue}, 70%, 20%)`;

    // Set up warning system colors
    const warningHue = 40; // Orange/Yellow
    colors.warning = `hsl(${warningHue}, 90%, 50%)`;
    colors["warning-container"] = `hsl(${warningHue}, 90%, 90%)`;
    colors["on-warning"] = "#000000";
    colors["on-warning-container"] = `hsl(${warningHue}, 90%, 30%)`;

    // Apply variant-specific styles
    switch (variant) {
      case "professional":
        // Professional: Subtle, low-saturation, corporate look with Material Design principles
        colors = {
          ...colors,
          background: "#ffffff",
          foreground: "#000000",
          muted: colors["neutral-10"],
          "muted-foreground": colors["neutral-60"],
          card: "#ffffff",
          "card-foreground": "#000000",
          accent: colors["primary-tint-1"],
          "accent-foreground": "#0f172a",
          destructive: colors.error,
          "destructive-foreground": colors["on-error"],
          border: colors["neutral-20"],

          // Dark mode specific colors
          "dark-background": colors["neutral-90"],
          "dark-surface": colors["neutral-80"],
          "dark-on-surface": colors["neutral-20"],
        };
        break;

      case "tint":
        // Tint: Subtle colorization of UI elements with the primary color
        // with Material Design principles for color harmony
        colors = {
          ...colors,
          background: `hsl(${h}, 20%, 98%)`,
          foreground: `hsl(${h}, 90%, 10%)`,
          muted: `hsl(${h}, 10%, 95%)`,
          "muted-foreground": `hsl(${h}, 30%, 40%)`,
          card: `hsl(${h}, 5%, 100%)`,
          "card-foreground": `hsl(${h}, 80%, 10%)`,
          accent: colors["primary-tint-2"],
          "accent-foreground": `hsl(${h}, 80%, 10%)`,
          destructive: colors.error,
          "destructive-foreground": colors["on-error"],
          border: `hsl(${h}, 15%, 92%)`,

          // Dark mode has slight color tints rather than pure gray
          "dark-background": `hsl(${h}, ${Math.min(s * 0.2, 10)}%, 10%)`,
          "dark-surface": `hsl(${h}, ${Math.min(s * 0.2, 10)}%, 15%)`,
          "dark-on-surface": `hsl(${h}, ${Math.min(s * 0.2, 10)}%, 90%)`,
        };
        break;

      case "vibrant": {
        // Vibrant: High contrast, saturated colors with Material Design color harmony
        // Create complementary color for accent (opposite on the color wheel)
        const complementaryHue = (h + 180) % 360;

        // Secondary and tertiary colors based on triadic color scheme
        const triadicHue1 = (h + 120) % 360;
        const triadicHue2 = (h + 240) % 360;

        colors.secondary = `hsl(${triadicHue1}, ${Math.min(s * 0.9, 70)}%, ${l}%)`;
        colors.tertiary = `hsl(${triadicHue2}, ${Math.min(s * 0.9, 70)}%, ${l}%)`;

        // Generate secondary and tertiary variants
        colors["secondary-tint-1"] = this.generateTint(colors.secondary, 0.8);
        colors["secondary-tint-2"] = this.generateTint(colors.secondary, 0.9);
        colors["secondary-shade-1"] = this.generateShade(colors.secondary, 0.8);
        colors["secondary-shade-2"] = this.generateShade(colors.secondary, 0.9);

        colors["tertiary-tint-1"] = this.generateTint(colors.tertiary, 0.9);
        colors["tertiary-tint-2"] = this.generateTint(colors.tertiary, 0.8);
        colors["tertiary-shade-1"] = this.generateShade(colors.tertiary, 0.8);
        colors["tertiary-shade-2"] = this.generateShade(colors.tertiary, 0.9);

        // Container variants
        colors["secondary-container"] =
          `hsl(${triadicHue1}, ${Math.max(10, s * 0.5)}%, ${Math.min(95, l * 1.3)}%)`;
        colors["on-secondary-container"] =
          l > 70 ? "#000000" : colors.secondary;

        colors["tertiary-container"] =
          `hsl(${triadicHue2}, ${Math.max(10, s * 0.5)}%, ${Math.min(95, l * 1.3)}%)`;
        colors["on-tertiary-container"] = l > 70 ? "#000000" : colors.tertiary;

        colors["on-secondary"] = l > 60 ? "#000000" : "#ffffff";
        colors["on-tertiary"] = l > 60 ? "#000000" : "#ffffff";

        colors = {
          ...colors,
          background: `hsl(${h}, 10%, 95%)`,
          foreground: `hsl(${h}, 95%, 15%)`,
          muted: `hsl(${h}, 20%, 90%)`,
          "muted-foreground": `hsl(${h}, 60%, 30%)`,
          card: `#ffffff`,
          "card-foreground": `hsl(${h}, 90%, 10%)`,
          accent: `hsl(${complementaryHue}, ${Math.min(s * 0.8, 70)}%, ${l}%)`,
          "accent-foreground": `hsl(${h}, 90%, 10%)`,
          destructive: colors.error,
          "destructive-foreground": colors["on-error"],
          border: `hsl(${h}, 30%, 85%)`,

          // Dark mode specific colors with vibrant accents
          "dark-background": colors["neutral-90"],
          "dark-surface": colors["neutral-80"],
          "dark-on-surface": colors["neutral-10"],
        };
        break;
      }
    }

    return colors;
  }

  // Helper to apply CSS color variables
  private setCssColorProperty(property: string, value: string): void {
    const root = document.documentElement;

    try {
      if (value.startsWith("#")) {
        const result = this.hexToHSL(value);
        root.style.setProperty(property, result.hslString);
      } else if (value.startsWith("hsl(")) {
        const hslMatch = value.match(/hsl\(([^)]+)\)/);
        if (hslMatch?.[1]) {
          root.style.setProperty(property, hslMatch[1]);
        }
      } else {
        root.style.setProperty(property, value);
      }
    } catch (err: unknown) {
      console.error(`Error setting color property ${property}:`, err);
    }
  }
}

// Create and export a singleton instance
export const themeManager = new ThemeManager();

// Export a hook to use the theme manager in React components
export function useThemeManager() {
  return {
    themeManager,
    currentTheme: themeManager.getTheme(),
    draftTheme: themeManager.getDraftTheme(),
    updateDraftTheme: (theme: Partial<DesignSystem>) =>
      themeManager.updateDraftTheme(theme),
    applyDraftChanges: () => themeManager.applyDraftChanges(),
    resetDraftChanges: () => themeManager.resetDraftChanges(),
  };
}
