import React, { createContext, useContext, useEffect, useState } from 'react';

// Define the theme structure to match what we're using in design-builder.tsx
export interface DesignSystem {
  raw_tokens?: {
    spacing?: {
      spacing_xs?: number;
      spacing_sm?: number;
      spacing_md?: number;
      spacing_lg?: number;
      spacing_xl?: number;
      spacing_xxl?: number;
      spacing_xxxl?: number;
    };
    radius?: {
      radius_none?: number;
      radius_sm?: number;
      radius_md?: number;
      radius_lg?: number;
      radius_xl?: number;
      radius_full?: number;
    };
    transition?: {
      transition_duration_fast?: number;
      transition_duration_base?: number;
      transition_duration_slow?: number;
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
}

// Default theme settings
const defaultTheme: DesignSystem = {
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