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
export const defaultTheme: DesignSystem = {
  theme: {
    variant: 'professional',
    primary: '#0099ff',
    appearance: 'light',
    radius: 0.5,
    animation: 'smooth',
  },
  typography: {
    primary: 'system-ui, sans-serif',
    heading: 'system-ui, sans-serif',
  },
  colors: {
    primary: '#0099ff',
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
    ring: '#0099ff',
  },
};

// Define event types
type ThemeChangeEvent = 'theme-update' | 'draft-update';

// Subscribers function type
type ThemeChangeSubscriber = (theme: DesignSystem) => void;

// Theme Manager Class
class ThemeManager {
  private currentTheme: DesignSystem;
  private draftTheme: DesignSystem | null = null;
  private subscribers: Map<ThemeChangeEvent, Set<ThemeChangeSubscriber>> = new Map();
  private lastAppliedTheme: string | null = null;

  constructor(initialTheme: DesignSystem = defaultTheme) {
    this.currentTheme = { ...initialTheme };
    this.draftTheme = null;
    this.subscribers.set('theme-update', new Set());
    this.subscribers.set('draft-update', new Set());
    this.init();
  }

  // Initialize from API and apply theme
  async init() {
    try {
      console.log('Initializing ThemeManager...');
      const response = await fetch('/api/design-system');
      if (response.ok) {
        const data = await response.json();
        console.log('Theme settings loaded from API');
        this.currentTheme = data;
        this.draftTheme = { ...data };
      } else {
        console.log('API returned non-200 status, using default theme');
        this.draftTheme = { ...this.currentTheme };
      }
    } catch (error) {
      console.log('Error encountered, falling back to default theme');
      this.draftTheme = { ...this.currentTheme };
    } finally {
      console.log('Theme initialization complete');
      this.applyTheme();
    }
  }

  // Subscribe to theme events
  subscribe(event: ThemeChangeEvent, callback: ThemeChangeSubscriber) {
    const subscribers = this.subscribers.get(event) || new Set();
    subscribers.add(callback);
    this.subscribers.set(event, subscribers);
    
    // Immediately call with current state
    if (event === 'theme-update') {
      callback(this.currentTheme);
    } else if (event === 'draft-update' && this.draftTheme) {
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
  private notify(event: ThemeChangeEvent, theme: DesignSystem) {
    const subscribers = this.subscribers.get(event);
    if (subscribers) {
      subscribers.forEach(callback => callback(theme));
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
      console.log('Updating draft theme:', newTheme);
      
      // Deep merge the changes into the draft theme
      if (newTheme.theme) {
        this.draftTheme.theme = { 
          ...this.draftTheme.theme, 
          ...newTheme.theme 
        };
        
        // If variant or primary has changed, update colors based on variant
        if (newTheme.theme.variant || newTheme.theme.primary) {
          const variantColors = this.generateVariantColors(
            newTheme.theme.primary || this.draftTheme.theme.primary,
            newTheme.theme.variant || this.draftTheme.theme.variant
          );
          
          this.draftTheme.colors = {
            ...this.draftTheme.colors,
            ...variantColors
          };
        }
      }
      
      // Merge typography changes
      if (newTheme.typography) {
        this.draftTheme.typography = {
          ...this.draftTheme.typography,
          ...newTheme.typography
        };
      }
      
      // Merge custom color changes (these will override variant-based colors)
      if (newTheme.colors) {
        this.draftTheme.colors = {
          ...this.draftTheme.colors,
          ...newTheme.colors
        };
      }
      
      // Apply extended typography settings
      if (newTheme.typography_extended) {
        this.draftTheme.typography_extended = {
          ...(this.draftTheme.typography_extended || {}),
          ...newTheme.typography_extended
        };
      }
      
      // Apply raw tokens
      if (newTheme.raw_tokens) {
        this.draftTheme.raw_tokens = this.draftTheme.raw_tokens || {};
        
        // Apply unit settings
        if (newTheme.raw_tokens.default_unit) {
          this.draftTheme.raw_tokens.default_unit = newTheme.raw_tokens.default_unit;
        }
        
        // Apply color tokens
        if (newTheme.raw_tokens.colors) {
          this.draftTheme.raw_tokens.colors = this.draftTheme.raw_tokens.colors || {};
          
          // Brand colors
          if (newTheme.raw_tokens.colors.brand) {
            this.draftTheme.raw_tokens.colors.brand = {
              ...(this.draftTheme.raw_tokens.colors.brand || {}),
              ...newTheme.raw_tokens.colors.brand
            };
          }
          
          // Neutral colors
          if (newTheme.raw_tokens.colors.neutral) {
            this.draftTheme.raw_tokens.colors.neutral = {
              ...(this.draftTheme.raw_tokens.colors.neutral || {}),
              ...newTheme.raw_tokens.colors.neutral
            };
          }
          
          // Interactive colors
          if (newTheme.raw_tokens.colors.interactive) {
            this.draftTheme.raw_tokens.colors.interactive = {
              ...(this.draftTheme.raw_tokens.colors.interactive || {}),
              ...newTheme.raw_tokens.colors.interactive
            };
          }
        }
        
        // Apply spacing tokens
        if (newTheme.raw_tokens.spacing) {
          this.draftTheme.raw_tokens.spacing = {
            ...(this.draftTheme.raw_tokens.spacing || {}),
            ...newTheme.raw_tokens.spacing
          };
        }
        
        // Apply radius tokens
        if (newTheme.raw_tokens.radius) {
          this.draftTheme.raw_tokens.radius = {
            ...(this.draftTheme.raw_tokens.radius || {}),
            ...newTheme.raw_tokens.radius
          };
        }
        
        // Apply transition tokens
        if (newTheme.raw_tokens.transition) {
          this.draftTheme.raw_tokens.transition = {
            ...(this.draftTheme.raw_tokens.transition || {}),
            ...newTheme.raw_tokens.transition
          };
        }
        
        // Apply border tokens
        if (newTheme.raw_tokens.border) {
          this.draftTheme.raw_tokens.border = {
            ...(this.draftTheme.raw_tokens.border || {}),
            ...newTheme.raw_tokens.border
          };
        }
      }
      
      // Notify subscribers of the draft change
      this.notify('draft-update', this.draftTheme);
      
      // Apply the draft theme to the DOM
      this.applyTheme();
      
    } catch (error) {
      console.error('Error updating draft theme:', error);
    }
  }

  // Apply draft changes to the current theme and send to the API
  async applyDraftChanges() {
    if (!this.draftTheme) return;
    
    try {
      console.log('Applying draft changes to theme');
      
      // Send update to the API
      const response = await fetch('/api/design-system', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.draftTheme),
      });

      if (!response.ok) {
        throw new Error('Failed to update theme settings');
      }
      
      // Update the current theme with draft values
      this.currentTheme = { ...this.draftTheme };
      
      // Notify subscribers
      this.notify('theme-update', this.currentTheme);
      
      return true;
    } catch (error) {
      console.error('Error applying draft changes:', error);
      return false;
    }
  }

  // Reset draft changes
  resetDraftChanges() {
    if (this.currentTheme) {
      this.draftTheme = { ...this.currentTheme };
      this.notify('draft-update', this.draftTheme);
      this.applyTheme();
    }
  }

  // Apply theme to DOM
  applyTheme() {
    // Use the draft theme if available, otherwise use current theme
    const activeTheme = this.draftTheme || this.currentTheme;
    if (!activeTheme) return;
    
    // Create a snapshot for comparison to prevent unnecessary updates
    const snapshot = JSON.stringify({
      primary: activeTheme.theme.primary,
      variant: activeTheme.theme.variant,
      appearance: activeTheme.theme.appearance,
      radius: activeTheme.theme.radius,
      animation: activeTheme.theme.animation,
      typography: activeTheme.typography
    });
    
    // If nothing changed, exit early
    if (snapshot === this.lastAppliedTheme) return;
    
    console.log('Applying theme changes to DOM');
    this.lastAppliedTheme = snapshot;
    
    // Get reference to document root
    const root = document.documentElement;
    
    try {
      // Apply border radius
      root.style.setProperty('--radius', `${activeTheme.theme.radius}rem`);
      
      // Apply animation settings
      const animationSettings = {
        'none': '0s',
        'minimal': '0.1s',
        'smooth': '0.2s',
        'bounce': '0.3s'
      };
      root.style.setProperty('--transition', animationSettings[activeTheme.theme.animation] || '0.2s');
      
      // Apply primary color and variants
      if (activeTheme.theme.primary) {
        const primaryHsl = this.hexToHSL(activeTheme.theme.primary);
        root.style.setProperty('--primary', primaryHsl.hslString);
        
        // Add primary light variant
        root.style.setProperty(
          '--primary-light', 
          `${primaryHsl.h} ${Math.min(100, primaryHsl.s + 10)}% ${Math.min(100, primaryHsl.l + 15)}%`
        );
        
        // Add contrast text color for primary
        root.style.setProperty(
          '--primary-foreground', 
          primaryHsl.l > 60 ? '240 10% 3.9%' : '0 0% 98%'
        );
        
        // Apply dark/light mode
        if (activeTheme.theme.appearance === 'dark') {
          root.classList.add('dark');
          
          // Apply dark mode overrides
          root.style.setProperty('--background', '240 10% 3.9%');
          root.style.setProperty('--foreground', '0 0% 98%');
          root.style.setProperty('--card', '240 10% 3.9%');
          root.style.setProperty('--card-foreground', '0 0% 98%');
          root.style.setProperty('--muted', '240 3.7% 15.9%');
          root.style.setProperty('--muted-foreground', '240 5% 64.9%');
        } else {
          root.classList.remove('dark');
          
          // Apply variant-specific colors
          Object.entries(activeTheme.colors).forEach(([key, value]) => {
            this.setCssColorProperty(`--${key}`, value);
          });
        }
      }
      
      // Apply typography
      if (activeTheme.typography.primary) {
        root.style.setProperty('--font-sans', activeTheme.typography.primary);
      }
      if (activeTheme.typography.heading) {
        root.style.setProperty('--font-heading', activeTheme.typography.heading);
      }
      
    } catch (error) {
      console.error('Error applying theme to DOM:', error);
    }
  }

  // Helper method to check if a string is a hex color
  private isHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  // Helper method to convert hex to HSL
  private hexToHSL(hex: string): { h: number; s: number; l: number; hslString: string } {
    // Remove the # if present
    hex = hex.replace(/^#/, '');

    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

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

    return { h, s, l, hslString: `${h} ${s}% ${l}%` };
  }

  // Helper to generate tints
  private generateTint(hex: string, amount: number): string {
    if (!this.isHexColor(hex)) return hex;
    
    const { h, s, l } = this.hexToHSL(hex);
    // Increase lightness by the percentage amount (0-100)
    const newL = Math.min(100, l + ((100 - l) * amount / 100));
    return `hsl(${h}, ${s}%, ${newL}%)`;
  }

  // Helper to generate shades
  private generateShade(hex: string, amount: number): string {
    if (!this.isHexColor(hex)) return hex;
    
    const { h, s, l } = this.hexToHSL(hex);
    // Decrease lightness by the percentage amount (0-100)
    const newL = Math.max(0, l - (l * amount / 100));
    return `hsl(${h}, ${s}%, ${newL}%)`;
  }

  // Generate variant-specific colors based on primary color
  private generateVariantColors(
    primaryColor: string, 
    variant: 'professional' | 'tint' | 'vibrant'
  ): Record<string, string> {
    // Ensure we have a valid hex color
    if (!this.isHexColor(primaryColor)) {
      primaryColor = '#0099ff'; // Default fallback color
    }
    
    // Extract color components
    const { h, s, l } = this.hexToHSL(primaryColor);
    
    // Create base theme colors that will be common across all variants
    let colors: Record<string, string> = {
      primary: primaryColor,
      ring: primaryColor,
    };
    
    // Apply variant-specific transformations
    switch (variant) {
      case 'professional':
        // Professional: Subtle, low-saturation, corporate look
        colors = {
          ...colors,
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
        };
        break;
        
      case 'tint':
        // Tint: Subtle colorization of UI elements with the primary color
        colors = {
          ...colors,
          background: `hsl(${h}, 20%, 98%)`,
          foreground: `hsl(${h}, 90%, 10%)`,
          muted: `hsl(${h}, 10%, 95%)`,
          'muted-foreground': `hsl(${h}, 30%, 40%)`,
          card: `hsl(${h}, 5%, 100%)`,
          'card-foreground': `hsl(${h}, 80%, 10%)`,
          accent: `hsl(${h}, 15%, 92%)`,
          'accent-foreground': `hsl(${h}, 80%, 10%)`,
          destructive: '#ef4444',
          'destructive-foreground': '#ffffff',
          border: `hsl(${h}, 15%, 92%)`,
        };
        break;
        
      case 'vibrant':
        // Vibrant: High contrast, saturated colors
        colors = {
          ...colors,
          background: `hsl(${h}, 10%, 95%)`,
          foreground: `hsl(${h}, 95%, 15%)`,
          muted: `hsl(${h}, 20%, 90%)`,
          'muted-foreground': `hsl(${h}, 60%, 30%)`,
          card: `#ffffff`,
          'card-foreground': `hsl(${h}, 90%, 10%)`,
          accent: `hsl(${h}, 80%, 90%)`,
          'accent-foreground': `hsl(${h}, 90%, 10%)`,
          destructive: '#ff4444',
          'destructive-foreground': '#ffffff',
          border: `hsl(${h}, 30%, 85%)`,
        };
        break;
    }
    
    return colors;
  }

  // Helper to apply CSS color variables
  private setCssColorProperty(property: string, value: string): void {
    const root = document.documentElement;
    
    try {
      if (value.startsWith('#')) {
        const result = this.hexToHSL(value);
        root.style.setProperty(property, result.hslString);
      } else if (value.startsWith('hsl(')) {
        const hslMatch = value.match(/hsl\(([^)]+)\)/);
        if (hslMatch && hslMatch[1]) {
          root.style.setProperty(property, hslMatch[1]);
        }
      } else {
        root.style.setProperty(property, value);
      }
    } catch (err) {
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
    updateDraftTheme: (theme: Partial<DesignSystem>) => themeManager.updateDraftTheme(theme),
    applyDraftChanges: () => themeManager.applyDraftChanges(),
    resetDraftChanges: () => themeManager.resetDraftChanges()
  };
}