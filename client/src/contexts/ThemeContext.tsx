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
    background: '#f0f1f2',
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

// Define the context interface
export interface ThemeContextType {
  designSystem: DesignSystem;
  draftDesignSystem: DesignSystem | null;
  updateDesignSystem: (newTheme: Partial<DesignSystem>) => Promise<void>;
  updateDraftDesignSystem: (newTheme: Partial<DesignSystem>) => void;
  applyDraftChanges: () => Promise<void>;
  isLoading: boolean;
}

// Create the context with default values
export const ThemeContext = createContext<ThemeContextType>({
  designSystem: defaultTheme,
  draftDesignSystem: null,
  updateDesignSystem: async () => {},
  updateDraftDesignSystem: () => {},
  applyDraftChanges: async () => {},
  isLoading: true
});

// Export the provider component separately for React Fast Refresh compatibility
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [designSystem, setDesignSystem] = useState<DesignSystem>(defaultTheme);
  const [draftDesignSystem, setDraftDesignSystem] = useState<DesignSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme settings from the API
  useEffect(() => {
    console.log('Initializing ThemeContext...');
    const fetchThemeSettings = async () => {
      try {
        console.log('Fetching theme settings from API...');
        const response = await fetch('/api/design-system');
        if (!response.ok) {
          console.log('API returned non-200 status, using default theme');
          throw new Error('Failed to fetch theme settings');
        }
        const data = await response.json();
        console.log('Theme settings loaded from API');
        setDesignSystem(data);
        // Initialize draft with the same data
        setDraftDesignSystem(data);
      } catch (error) {
        console.log('Error encountered, falling back to default theme');
        // Keep using default theme if we can't load from API
        setDraftDesignSystem(defaultTheme);
      } finally {
        console.log('Theme initialization complete');
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

  // Store a memoized version of the active design system to prevent unnecessary re-renders
  const activeDesignSystemRef = React.useRef<string | null>(null);
  
  // We use a single useEffect to apply theme changes to the DOM when needed
  useEffect(() => {
    // Don't do anything while data is loading
    if (isLoading) return;
    
    // Apply initial theme once when loading completes
    applyThemeToDom();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, 
      // Using JSON.stringify instead of individual dependencies to prevent over-rendering
      // while still catching all relevant changes
      JSON.stringify(designSystem?.theme), 
      JSON.stringify(designSystem?.typography),
      JSON.stringify(designSystem?.colors?.primary),
      JSON.stringify(draftDesignSystem?.theme),
      JSON.stringify(draftDesignSystem?.typography),
      JSON.stringify(draftDesignSystem?.colors?.primary)
  ]);
  
  // Extract theme application logic to a separate function to avoid duplicated code
  const applyThemeToDom = () => {
    // Get the active design system (draft takes precedence)
    const activeSystem = draftDesignSystem || designSystem;
    if (!activeSystem) return;
    
    // Create a snapshot of the theme values that affect styling
    const themeSnapshot = {
      primary: activeSystem.theme.primary,
      radius: activeSystem.theme.radius,
      appearance: activeSystem.theme.appearance,
      primaryFont: activeSystem.typography.primary,
      headingFont: activeSystem.typography.heading,
      variant: activeSystem.theme.variant,
      animation: activeSystem.theme.animation,
      background: activeSystem.colors.background,
      foreground: activeSystem.colors.foreground,
      card: activeSystem.colors.card,
      accent: activeSystem.colors.accent,
      border: activeSystem.colors.border,
      ring: activeSystem.colors.ring
    };
    
    // Convert to JSON for reliable deep comparison
    const snapshotJson = JSON.stringify(themeSnapshot);
    
    // Skip DOM updates if nothing has changed
    if (snapshotJson === activeDesignSystemRef.current) return;
    
    // Log changes and update our reference value
    console.log('Applying theme changes to DOM');
    activeDesignSystemRef.current = snapshotJson;
    
    // Create a reference to document.documentElement
    const root = document.documentElement;
    
    // Apply only critical theme settings
    try {
      // Apply border radius
      root.style.setProperty('--radius', `${activeSystem.theme.radius}rem`);
      
      // Apply primary color
      if (activeSystem.theme.primary) {
        if (activeSystem.theme.primary.startsWith('#')) {
          root.style.setProperty('--primary', hexToHSL(activeSystem.theme.primary));
        } else if (activeSystem.theme.primary.startsWith('hsl(')) {
          const hslMatch = activeSystem.theme.primary.match(/hsl\(([^)]+)\)/);
          if (hslMatch && hslMatch[1]) {
            root.style.setProperty('--primary', hslMatch[1]);
          }
        }
      }
      
      // Apply dark/light mode
      if (activeSystem.theme.appearance === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      
      // Apply typography
      if (activeSystem.typography.primary) {
        root.style.setProperty('--font-sans', activeSystem.typography.primary);
      }
      if (activeSystem.typography.heading) {
        root.style.setProperty('--font-heading', activeSystem.typography.heading);
      }
      
      // Apply theme colors
      const colors = activeSystem.colors;
      if (colors) {
        Object.entries(colors).forEach(([key, value]) => {
          if (typeof value === 'string') {
            try {
              if (value.startsWith('#')) {
                root.style.setProperty(`--${key}`, hexToHSL(value));
              } else if (value.startsWith('hsl(')) {
                const hslMatch = value.match(/hsl\(([^)]+)\)/);
                if (hslMatch && hslMatch[1]) {
                  root.style.setProperty(`--${key}`, hslMatch[1]);
                }
              } else {
                root.style.setProperty(`--${key}`, value);
              }
            } catch (err) {
              console.error(`Error setting color property --${key}:`, err);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error applying theme:", error);
    }
  };

  // Function to update theme settings (and persist to API)
  const updateDesignSystem = async (newTheme: Partial<DesignSystem>) => {
    try {
      // Create a clean deep copy to avoid reference issues
      const cleanNewTheme = JSON.parse(JSON.stringify(newTheme));
      
      // Update local state immediately for responsive UI, using functional update pattern
      setDesignSystem(prev => {
        // Create a new object to avoid mutation
        const updatedDesignSystem = { ...prev };
        
        // Carefully merge the new theme properties
        if (cleanNewTheme.theme) {
          updatedDesignSystem.theme = { ...updatedDesignSystem.theme, ...cleanNewTheme.theme };
        }
        
        if (cleanNewTheme.colors) {
          updatedDesignSystem.colors = { ...updatedDesignSystem.colors, ...cleanNewTheme.colors };
        }
        
        if (cleanNewTheme.typography) {
          updatedDesignSystem.typography = { ...updatedDesignSystem.typography, ...cleanNewTheme.typography };
        }
        
        if (cleanNewTheme.typography_extended) {
          updatedDesignSystem.typography_extended = { 
            ...(updatedDesignSystem.typography_extended || {}),
            ...cleanNewTheme.typography_extended
          };
        }
        
        if (cleanNewTheme.raw_tokens) {
          updatedDesignSystem.raw_tokens = updatedDesignSystem.raw_tokens || {};
          
          // Handle default_unit
          if (cleanNewTheme.raw_tokens.default_unit) {
            updatedDesignSystem.raw_tokens.default_unit = cleanNewTheme.raw_tokens.default_unit;
          }
          
          // Handle colors with nested structure
          if (cleanNewTheme.raw_tokens.colors) {
            updatedDesignSystem.raw_tokens.colors = updatedDesignSystem.raw_tokens.colors || {};
            
            if (cleanNewTheme.raw_tokens.colors.brand) {
              updatedDesignSystem.raw_tokens.colors.brand = { 
                ...(updatedDesignSystem.raw_tokens.colors.brand || {}),
                ...cleanNewTheme.raw_tokens.colors.brand
              };
            }
            
            if (cleanNewTheme.raw_tokens.colors.neutral) {
              updatedDesignSystem.raw_tokens.colors.neutral = { 
                ...(updatedDesignSystem.raw_tokens.colors.neutral || {}),
                ...cleanNewTheme.raw_tokens.colors.neutral
              };
            }
            
            if (cleanNewTheme.raw_tokens.colors.interactive) {
              updatedDesignSystem.raw_tokens.colors.interactive = { 
                ...(updatedDesignSystem.raw_tokens.colors.interactive || {}),
                ...cleanNewTheme.raw_tokens.colors.interactive
              };
            }
          }
          
          // Handle other token types
          ['spacing', 'radius', 'transition', 'border'].forEach(tokenType => {
            // Type-safe handling of token types
            if (tokenType === 'spacing' && cleanNewTheme.raw_tokens?.spacing) {
              updatedDesignSystem.raw_tokens = {
                ...(updatedDesignSystem.raw_tokens || {}),
                spacing: {
                  ...(updatedDesignSystem.raw_tokens?.spacing || {}),
                  ...cleanNewTheme.raw_tokens.spacing
                }
              };
            } else if (tokenType === 'radius' && cleanNewTheme.raw_tokens?.radius) {
              updatedDesignSystem.raw_tokens = {
                ...(updatedDesignSystem.raw_tokens || {}),
                radius: {
                  ...(updatedDesignSystem.raw_tokens?.radius || {}),
                  ...cleanNewTheme.raw_tokens.radius
                }
              };
            } else if (tokenType === 'transition' && cleanNewTheme.raw_tokens?.transition) {
              updatedDesignSystem.raw_tokens = {
                ...(updatedDesignSystem.raw_tokens || {}),
                transition: {
                  ...(updatedDesignSystem.raw_tokens?.transition || {}),
                  ...cleanNewTheme.raw_tokens.transition
                }
              };
            } else if (tokenType === 'border' && cleanNewTheme.raw_tokens?.border) {
              updatedDesignSystem.raw_tokens = {
                ...(updatedDesignSystem.raw_tokens || {}),
                border: {
                  ...(updatedDesignSystem.raw_tokens?.border || {}),
                  ...cleanNewTheme.raw_tokens.border
                }
              };
            }
          });
        }
        
        return updatedDesignSystem;
      });

      // Also update draft state to stay in sync, but only if it exists
      if (draftDesignSystem) {
        // Use functional update to ensure we're working with the latest state
        setDraftDesignSystem(prevDraft => {
          if (!prevDraft) return null;
          
          // Create a deep copy of the previous draft
          const draftUpdatedDesignSystem = JSON.parse(JSON.stringify(prevDraft));
          
          // Apply the same changes to draft
          if (cleanNewTheme.theme) {
            draftUpdatedDesignSystem.theme = { ...draftUpdatedDesignSystem.theme, ...cleanNewTheme.theme };
          }
          
          if (cleanNewTheme.colors) {
            draftUpdatedDesignSystem.colors = { ...draftUpdatedDesignSystem.colors, ...cleanNewTheme.colors };
          }
          
          if (cleanNewTheme.typography) {
            draftUpdatedDesignSystem.typography = { ...draftUpdatedDesignSystem.typography, ...cleanNewTheme.typography };
          }
          
          if (cleanNewTheme.typography_extended) {
            draftUpdatedDesignSystem.typography_extended = { 
              ...(draftUpdatedDesignSystem.typography_extended || {}),
              ...cleanNewTheme.typography_extended
            };
          }
          
          // Handle raw tokens for draft
          if (cleanNewTheme.raw_tokens) {
            // Ensure raw_tokens exists
            draftUpdatedDesignSystem.raw_tokens = draftUpdatedDesignSystem.raw_tokens || {};
            
            // Handle default_unit
            if (cleanNewTheme.raw_tokens.default_unit) {
              draftUpdatedDesignSystem.raw_tokens.default_unit = cleanNewTheme.raw_tokens.default_unit;
            }
            
            // Handle colors for draft
            if (cleanNewTheme.raw_tokens.colors) {
              draftUpdatedDesignSystem.raw_tokens.colors = draftUpdatedDesignSystem.raw_tokens.colors || {};
              
              // Handle color categories for draft
              if (cleanNewTheme.raw_tokens.colors.brand) {
                draftUpdatedDesignSystem.raw_tokens.colors.brand = {
                  ...(draftUpdatedDesignSystem.raw_tokens.colors.brand || {}),
                  ...cleanNewTheme.raw_tokens.colors.brand
                };
              }
              
              if (cleanNewTheme.raw_tokens.colors.neutral) {
                draftUpdatedDesignSystem.raw_tokens.colors.neutral = {
                  ...(draftUpdatedDesignSystem.raw_tokens.colors.neutral || {}),
                  ...cleanNewTheme.raw_tokens.colors.neutral
                };
              }
              
              if (cleanNewTheme.raw_tokens.colors.interactive) {
                draftUpdatedDesignSystem.raw_tokens.colors.interactive = {
                  ...(draftUpdatedDesignSystem.raw_tokens.colors.interactive || {}),
                  ...cleanNewTheme.raw_tokens.colors.interactive
                };
              }
            }
            
            // Handle other tokens for draft
            ['spacing', 'radius', 'transition', 'border'].forEach(key => {
              if (cleanNewTheme.raw_tokens[key]) {
                draftUpdatedDesignSystem.raw_tokens[key] = {
                  ...(draftUpdatedDesignSystem.raw_tokens[key] || {}),
                  ...cleanNewTheme.raw_tokens[key]
                };
              }
            });
          }
          
          return draftUpdatedDesignSystem;
        });
      }

      // Send update to the API
      const response = await fetch('/api/design-system', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanNewTheme),
      });

      if (!response.ok) throw new Error('Failed to update theme settings');
    } catch (error) {
      console.error('Error updating theme settings:', error);
      // Could add error handling/rollback here
    }
  };

  // Function to update draft design system (for live preview, without API calls)
  const updateDraftDesignSystem = (newTheme: Partial<DesignSystem>) => {
    try {
      // Create a clean copy of the theme to avoid reference issues
      const cleanNewTheme = JSON.parse(JSON.stringify(newTheme));
      
      // Use functional update to ensure we work with the latest state
      setDraftDesignSystem(prevDraft => {
        // Get the current system to work with (draft or main)
        const currentSystem = prevDraft || designSystem;
        if (!currentSystem) return null;
        
        // Create a deep copy to avoid mutations
        const updatedSystem = JSON.parse(JSON.stringify(currentSystem));
        
        // Merge theme properties
        if (cleanNewTheme.theme) {
          updatedSystem.theme = { 
            ...updatedSystem.theme, 
            ...cleanNewTheme.theme 
          };
        }
        
        // Merge colors
        if (cleanNewTheme.colors) {
          updatedSystem.colors = { 
            ...updatedSystem.colors, 
            ...cleanNewTheme.colors 
          };
        }
        
        // Merge typography
        if (cleanNewTheme.typography) {
          updatedSystem.typography = { 
            ...updatedSystem.typography, 
            ...cleanNewTheme.typography 
          };
        }
        
        // Merge extended typography
        if (cleanNewTheme.typography_extended) {
          updatedSystem.typography_extended = { 
            ...(updatedSystem.typography_extended || {}), 
            ...cleanNewTheme.typography_extended 
          };
        }
        
        // Handle raw tokens
        if (cleanNewTheme.raw_tokens) {
          // Ensure raw_tokens exists
          updatedSystem.raw_tokens = updatedSystem.raw_tokens || {};
          
          // Unit
          if (cleanNewTheme.raw_tokens.default_unit) {
            updatedSystem.raw_tokens.default_unit = cleanNewTheme.raw_tokens.default_unit;
          }
          
          // Handle nested color tokens
          if (cleanNewTheme.raw_tokens.colors) {
            updatedSystem.raw_tokens.colors = updatedSystem.raw_tokens.colors || {};
            
            // Brand colors
            if (cleanNewTheme.raw_tokens.colors.brand) {
              updatedSystem.raw_tokens.colors.brand = {
                ...(updatedSystem.raw_tokens.colors.brand || {}),
                ...cleanNewTheme.raw_tokens.colors.brand
              };
            }
            
            // Neutral colors
            if (cleanNewTheme.raw_tokens.colors.neutral) {
              updatedSystem.raw_tokens.colors.neutral = {
                ...(updatedSystem.raw_tokens.colors.neutral || {}),
                ...cleanNewTheme.raw_tokens.colors.neutral
              };
            }
            
            // Interactive colors
            if (cleanNewTheme.raw_tokens.colors.interactive) {
              updatedSystem.raw_tokens.colors.interactive = {
                ...(updatedSystem.raw_tokens.colors.interactive || {}),
                ...cleanNewTheme.raw_tokens.colors.interactive
              };
            }
          }
          
          // Spacing tokens
          if (cleanNewTheme.raw_tokens.spacing) {
            updatedSystem.raw_tokens.spacing = {
              ...(updatedSystem.raw_tokens.spacing || {}),
              ...cleanNewTheme.raw_tokens.spacing
            };
          }
          
          // Radius tokens
          if (cleanNewTheme.raw_tokens.radius) {
            updatedSystem.raw_tokens.radius = {
              ...(updatedSystem.raw_tokens.radius || {}),
              ...cleanNewTheme.raw_tokens.radius
            };
          }
          
          // Transition tokens
          if (cleanNewTheme.raw_tokens.transition) {
            updatedSystem.raw_tokens.transition = {
              ...(updatedSystem.raw_tokens.transition || {}),
              ...cleanNewTheme.raw_tokens.transition
            };
          }
          
          // Border tokens
          if (cleanNewTheme.raw_tokens.border) {
            updatedSystem.raw_tokens.border = {
              ...(updatedSystem.raw_tokens.border || {}),
              ...cleanNewTheme.raw_tokens.border
            };
          }
        }
        
        return updatedSystem;
      });
    } catch (error) {
      console.error('Error updating draft theme:', error);
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

// Export it in a way that's compatible with React Fast Refresh
export function useTheme() {
  return useContext(ThemeContext);
}