import React, { createContext, useContext, useEffect, useState } from 'react';

// Define the theme structure to match what we're using in design-builder.tsx
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
    variant: 'professional' | 'tint' | 'vibrant';
    primary: string;
    appearance: 'light' | 'dark' | 'system';
    radius: number;
    animation: 'none' | 'minimal' | 'smooth' | 'bounce';
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
const defaultTheme: DesignSystem = {
  raw_tokens: {
    default_unit: 'rem',
    spacing: {
      spacing_xs: 0.25,
      spacing_sm: 0.5,
      spacing_md: 1,
      spacing_lg: 1.5,
      spacing_xl: 2,
      spacing_xxl: 3,
      spacing_xxxl: 4
    },
    radius: {
      radius_none: 0,
      radius_sm: 2,
      radius_md: 4,
      radius_lg: 8,
      radius_xl: 16,
      radius_full: 9999
    },
    transition: {
      transition_duration_fast: 150,
      transition_duration_base: 300,
      transition_duration_slow: 500,
      transition_ease_in: 'ease-in',
      transition_ease_out: 'ease-out',
      transition_ease_in_out: 'ease-in-out',
      transition_linear: 'linear'
    },
    border: {
      border_width_hairline: 1,
      border_width_thin: 2,
      border_width_medium: 4,
      border_width_thick: 8,
      border_style_solid: 'solid',
      border_style_dashed: 'dashed',
      border_style_dotted: 'dotted',
      border_style_double: 'double'
    },
    colors: {
      brand: {
        primary_base: 'blue',
        secondary_base: 'red',
        tertiary_base: 'green'
      },
      neutral: {
        neutral_0: '#ffffff',
        neutral_100: '#f8f9fa',
        neutral_200: '#e9ecef',
        neutral_300: '#dee2e6',
        neutral_400: '#ced4da',
        neutral_500: '#adb5bd',
        neutral_600: '#6c757d',
        neutral_700: '#495057',
        neutral_800: '#343a40',
        neutral_900: '#212529'
      },
      interactive: {
        success_base: '#28a745',
        warning_base: '#ffc107',
        error_base: '#dc3545',
        link_base: '#007bff'
      }
    }
  },
  theme: {
    variant: 'professional',
    primary: 'hsl(205, 100%, 50%)',
    appearance: 'light',
    radius: 0.5,
    animation: 'smooth'
  },
  typography: {
    primary: 'roc-grotesk',
    heading: 'ivypresto-display'
  },
  colors: {
    primary: 'hsl(205, 100%, 50%)',
    background: '#ffffff',
    foreground: '#000000',
    muted: '#f1f5f9',
    'muted-foreground': '#64748b',
    card: '#ffffff',
    'card-foreground': '#000000',
    accent: '#f1f5f9',
    'accent-foreground': '#0f172a',
    destructive: '#ef4444',
    'destructive-foreground': '#ffffff',
    border: '#e2e8f0',
    ring: 'hsl(205, 100%, 50%)'
  },
  typography_extended: {
    font_family_base: 'Inter, sans-serif',
    font_family_secondary: 'Inter, sans-serif',
    font_family_mono: 'Courier New, monospace',
    font_size_base: 1,
    font_scale_ratio: 1.333,
    line_height_ratio: 1.6,
    font_weight_light: 300,
    font_weight_regular: 400,
    font_weight_medium: 500,
    font_weight_bold: 700,
    line_height_tight: 1.2,
    line_height_default: 1.6,
    line_height_loose: 1.8
  }
};

type ThemeContextType = {
  designSystem: DesignSystem;
  draftDesignSystem: DesignSystem | null;
  updateDesignSystem: (newTheme: Partial<DesignSystem>) => void;
  updateDraftDesignSystem: (newTheme: Partial<DesignSystem>) => void;
  applyDraftChanges: () => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  designSystem: defaultTheme,
  draftDesignSystem: null,
  updateDesignSystem: () => {},
  updateDraftDesignSystem: () => {},
  applyDraftChanges: () => {},
  isLoading: true
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [designSystem, setDesignSystem] = useState<DesignSystem>(defaultTheme);
  const [draftDesignSystem, setDraftDesignSystem] = useState<DesignSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme settings from the API
  useEffect(() => {
    const fetchThemeSettings = async () => {
      try {
        const response = await fetch('/api/design-system');
        if (!response.ok) throw new Error('Failed to fetch theme settings');
        const data = await response.json();
        setDesignSystem(data);
        // Initialize draft with the same data
        setDraftDesignSystem(data);
      } catch (error) {
        console.error('Error loading theme settings:', error);
        // Keep using default theme if we can't load from API
        setDraftDesignSystem(defaultTheme);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThemeSettings();
  }, []);

  // Function to convert hex color to HSL format
  const hexToHSL = (hex: string) => {
    // Remove the # if present
    hex = hex.replace(/^#/, '');

    // Convert from hex to RGB
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;

    // Find max and min values
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }

      h = Math.round(h * 60);
    }

    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
  };

  // Check if a string is a hex color
  const isHexColor = (color: string) => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  // Apply the theme CSS variables to the document root
  useEffect(() => {
    if (isLoading) return;

    // Use draft system for preview if available, otherwise use the main design system
    const activeSystem = draftDesignSystem || designSystem;
    const root = document.documentElement;

    // Apply border radius
    root.style.setProperty('--radius', `${activeSystem.theme.radius}rem`);

    // Apply colors
    Object.entries(activeSystem.colors).forEach(([key, value]) => {
      // Convert hex colors to HSL for better compatibility with shadcn-ui
      if (isHexColor(value)) {
        // If the color is in hex format, convert it to HSL
        root.style.setProperty(`--${key}`, hexToHSL(value));
      } else if (value.startsWith('hsl(')) {
        // If it's already in HSL format, extract the values without nesting
        // Extract the HSL values (h, s, l) from "hsl(205, 100%, 50%)" format
        const hslMatch = value.match(/hsl\(([^)]+)\)/);
        if (hslMatch && hslMatch[1]) {
          root.style.setProperty(`--${key}`, hslMatch[1]);
        } else {
          root.style.setProperty(`--${key}`, value);
        }
      } else {
        root.style.setProperty(`--${key}`, value);
      }
    });

    // Make sure primary color is set properly
    if (activeSystem.theme.primary) {
      if (isHexColor(activeSystem.theme.primary)) {
        // If primary is in hex format, convert it to HSL
        root.style.setProperty('--primary', hexToHSL(activeSystem.theme.primary));
      } else if (activeSystem.theme.primary.startsWith('hsl(')) {
        // If it's already in HSL format, extract the values without nesting
        const hslMatch = activeSystem.theme.primary.match(/hsl\(([^)]+)\)/);
        if (hslMatch && hslMatch[1]) {
          root.style.setProperty('--primary', hslMatch[1]);
        } else {
          root.style.setProperty('--primary', activeSystem.theme.primary);
        }
      } else {
        root.style.setProperty('--primary', activeSystem.theme.primary);
      }
    }

    // Apply animation settings
    let animationSpeed = '0s';
    switch (activeSystem.theme.animation) {
      case 'none':
        animationSpeed = '0s';
        break;
      case 'minimal':
        animationSpeed = '0.1s';
        break;
      case 'smooth':
        animationSpeed = '0.2s';
        break;
      case 'bounce':
        animationSpeed = '0.3s';
        break;
    }
    root.style.setProperty('--transition', animationSpeed);

    // Apply typography
    if (activeSystem.typography.primary) {
      root.style.setProperty('--font-sans', activeSystem.typography.primary);
    }
    if (activeSystem.typography.heading) {
      root.style.setProperty('--font-heading', activeSystem.typography.heading);
    }

    // Apply heading scale if available in typography settings
    const typographySettings = localStorage.getItem('typographySettings');
    if (typographySettings) {
      const settings = JSON.parse(typographySettings);
      if (settings.headingScale) {
        const baseHeadingSize = 2.5; // Base size for h1 in rem
        const scale = settings.headingScale;
        root.style.setProperty('--heading-1-size', `${baseHeadingSize * scale}rem`);
        root.style.setProperty('--heading-2-size', `${(baseHeadingSize * 0.8) * scale}rem`);
        root.style.setProperty('--heading-3-size', `${(baseHeadingSize * 0.6) * scale}rem`);
      }
    }

    // Apply extended typography settings if available
    if (activeSystem.typography_extended) {
      Object.entries(activeSystem.typography_extended).forEach(([key, value]) => {
        // Convert from snake_case to kebab-case for CSS variables
        const cssVarName = key.replace(/_/g, '-');
        root.style.setProperty(`--${cssVarName}`, String(value));
      });
    }

    // Apply raw tokens if available
    if (activeSystem.raw_tokens) {
      // Apply default unit
      if (activeSystem.raw_tokens.default_unit) {
        root.style.setProperty('--default-unit', activeSystem.raw_tokens.default_unit);
      }

      // Apply spacing tokens
      if (activeSystem.raw_tokens.spacing) {
        Object.entries(activeSystem.raw_tokens.spacing).forEach(([key, value]) => {
          // Transform from naming like "spacing_xs" to CSS variable naming "spacing-xs"
          const cssVarName = key.replace(/_/g, '-');
          const defaultUnit = activeSystem.raw_tokens?.default_unit || 'rem';
          root.style.setProperty(`--${cssVarName}`, `${value}${defaultUnit}`);
        });
      }

      // Apply radius tokens
      if (activeSystem.raw_tokens.radius) {
        Object.entries(activeSystem.raw_tokens.radius).forEach(([key, value]) => {
          const cssVarName = key.replace(/_/g, '-');
          root.style.setProperty(`--${cssVarName}`, `${value}px`);
        });
      }

      // Apply transition tokens
      if (activeSystem.raw_tokens.transition) {
        Object.entries(activeSystem.raw_tokens.transition).forEach(([key, value]) => {
          const cssVarName = key.replace(/_/g, '-');
          if (typeof value === 'number') {
            root.style.setProperty(`--${cssVarName}`, `${value}ms`);
          } else {
            root.style.setProperty(`--${cssVarName}`, String(value));
          }
        });
      }

      // Apply border tokens
      if (activeSystem.raw_tokens.border) {
        Object.entries(activeSystem.raw_tokens.border).forEach(([key, value]) => {
          const cssVarName = key.replace(/_/g, '-');
          root.style.setProperty(`--${cssVarName}`, String(value));
        });
      }

      // Apply raw color tokens
      if (activeSystem.raw_tokens.colors) {
        if (activeSystem.raw_tokens.colors.brand) {
          Object.entries(activeSystem.raw_tokens.colors.brand).forEach(([key, value]) => {
            const cssVarName = `color-brand-${key.replace(/_/g, '-')}`;
            root.style.setProperty(`--${cssVarName}`, value);
          });
        }

        if (activeSystem.raw_tokens.colors.neutral) {
          Object.entries(activeSystem.raw_tokens.colors.neutral).forEach(([key, value]) => {
            const cssVarName = `color-neutral-${key.replace(/_/g, '-')}`;
            root.style.setProperty(`--${cssVarName}`, value);
          });
        }

        if (activeSystem.raw_tokens.colors.interactive) {
          Object.entries(activeSystem.raw_tokens.colors.interactive).forEach(([key, value]) => {
            const cssVarName = `color-interactive-${key.replace(/_/g, '-')}`;
            root.style.setProperty(`--${cssVarName}`, value);
          });
        }
      }
    }

    // Apply appearance (light/dark mode)
    if (activeSystem.theme.appearance === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    console.log('Theme applied:', activeSystem);
  }, [designSystem, draftDesignSystem, isLoading]);

  // Function to update theme settings (and persist to API)
  const updateDesignSystem = async (newTheme: Partial<DesignSystem>) => {
    // Update local state immediately for responsive UI
    setDesignSystem(prev => ({ ...prev, ...newTheme }));

    // Also update draft state to stay in sync
    if (draftDesignSystem) {
      setDraftDesignSystem({ ...draftDesignSystem, ...newTheme } as DesignSystem);
    }

    // Send update to the API
    try {
      const response = await fetch('/api/design-system', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTheme),
      });

      if (!response.ok) throw new Error('Failed to update theme settings');
    } catch (error) {
      console.error('Error updating theme settings:', error);
      // Could add error handling/rollback here
    }
  };

  // Function to update draft design system (for live preview)
  const updateDraftDesignSystem = (newTheme: Partial<DesignSystem>) => {
    if (draftDesignSystem) {
      setDraftDesignSystem({ ...draftDesignSystem, ...newTheme } as DesignSystem);
    }
  };

  // Function to apply draft changes to the actual design system
  const applyDraftChanges = async () => {
    if (draftDesignSystem) {
      // Apply draft changes to the main design system
      await updateDesignSystem(draftDesignSystem);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      designSystem, 
      draftDesignSystem, 
      updateDesignSystem, 
      updateDraftDesignSystem,
      applyDraftChanges,
      isLoading 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);