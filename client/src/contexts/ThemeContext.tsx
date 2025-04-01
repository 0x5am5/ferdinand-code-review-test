import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { DesignSystem, designSystemToCssVariables } from '@/utils/design-system-mapper';
import { applyClientTheme, clearClientThemes, getActiveClientId } from '@/utils/client-theme-manager';

// Default design system configuration
const defaultDesignSystem: DesignSystem = {
  theme: {
    variant: 'professional',
    primary: '#3366FF',
    appearance: 'light',
    radius: 6,
    animation: 'all 0.2s ease-in-out',
  },
  typography: {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
  },
  colors: {
    primary: '#3366FF',
    background: '#FFFFFF',
    foreground: '#1F2933',
    muted: '#F4F5F7',
    'muted-foreground': '#7B8794',
    card: '#FFFFFF',
    'card-foreground': '#1F2933',
    accent: '#6554C0',
    'accent-foreground': '#FFFFFF',
    destructive: '#FF5630',
    'destructive-foreground': '#FFFFFF',
    border: '#E1E4E8',
    ring: '#3366FF',
  },
};

interface ThemeContextType {
  designSystem: DesignSystem;
  draftDesignSystem: DesignSystem | null;
  setDesignSystem: (system: DesignSystem) => void;
  updateDraftDesignSystem: (updates: Partial<DesignSystem>) => void;
  resetDraftDesignSystem: () => void;
  applyDraftChanges: () => Promise<void>;
  activeClientId: number | null;
  setActiveClientId: (id: number | null) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  designSystem: defaultDesignSystem,
  draftDesignSystem: null,
  setDesignSystem: () => {},
  updateDraftDesignSystem: () => {},
  resetDraftDesignSystem: () => {},
  applyDraftChanges: async () => {},
  activeClientId: null,
  setActiveClientId: () => {},
  isDarkMode: false,
  toggleDarkMode: () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Active design system state
  const [designSystem, setDesignSystemState] = useState<DesignSystem>(defaultDesignSystem);
  
  // Draft design system for pending changes
  const [draftDesignSystem, setDraftDesignSystem] = useState<DesignSystem | null>(null);
  
  // Active client ID for client-specific styling
  const [activeClientId, setActiveClientIdState] = useState<number | null>(getActiveClientId());
  
  // Track dark mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    designSystem.theme.appearance === 'dark' || 
    (designSystem.theme.appearance === 'system' && 
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  // Apply the design system to the document root on initial load
  useEffect(() => {
    document.documentElement.style.cssText = designSystemToCssVariables(designSystem);
    
    // Add dark mode class if necessary
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    
    // Listen for system preference changes if set to 'system'
    if (designSystem.theme.appearance === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [designSystem, isDarkMode]);

  // Apply client theme when activeClientId changes
  useEffect(() => {
    if (activeClientId) {
      applyClientTheme(activeClientId);
    } else {
      clearClientThemes();
    }
  }, [activeClientId]);

  // Set the design system
  const setDesignSystem = (system: DesignSystem) => {
    setDesignSystemState(system);
    setDraftDesignSystem(null);
  };

  // Helper function to ensure type safety when merging partial updates
  const safeDesignSystemMerge = (base: DesignSystem, updates: Partial<DesignSystem>): DesignSystem => {
    // Create a deep clone to avoid accidental mutations
    const result = JSON.parse(JSON.stringify(base)) as DesignSystem;
    
    // Handle theme updates
    if (updates.theme) {
      result.theme = {
        ...result.theme,
        ...(updates.theme || {})
      };
      
      // Ensure appearance stays as a valid union type
      if (updates.theme.appearance) {
        const appearance = updates.theme.appearance;
        if (appearance === 'light' || appearance === 'dark' || appearance === 'system') {
          result.theme.appearance = appearance;
        }
      }
    }
    
    // Handle typography updates
    if (updates.typography) {
      result.typography = {
        ...result.typography,
        ...(updates.typography || {})
      };
    }
    
    // Handle colors updates
    if (updates.colors) {
      result.colors = {
        ...result.colors,
        ...(updates.colors || {})
      };
    }
    
    return result;
  };

  // Update the draft design system with partial changes
  const updateDraftDesignSystem = (updates: Partial<DesignSystem>) => {
    // If no draft exists yet, create one based on current design system
    if (!draftDesignSystem) {
      setDraftDesignSystem(safeDesignSystemMerge(designSystem, updates));
    } else {
      // Otherwise update the existing draft
      setDraftDesignSystem(safeDesignSystemMerge(draftDesignSystem, updates));
    }
  };

  // Reset the draft design system
  const resetDraftDesignSystem = () => {
    setDraftDesignSystem(null);
  };

  // Apply draft changes to the active design system
  const applyDraftChanges = async () => {
    if (!draftDesignSystem) return;
    
    try {
      // Here we would make an API call to save the design system changes
      // For now, just update the state
      setDesignSystemState(draftDesignSystem);
      setDraftDesignSystem(null);
      
      // Example API call (commented out)
      // await fetch('/api/design-system', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(draftDesignSystem),
      // });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to save design system changes:', error);
      return Promise.reject(error);
    }
  };

  // Set the active client ID
  const setActiveClientId = (id: number | null) => {
    setActiveClientIdState(id);
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    // Update the design system appearance
    const appearance: 'light' | 'dark' | 'system' = newDarkMode ? 'dark' : 'light';
    
    // Create a partial update with just the appearance change
    // The safe merge function will handle preserving all other required properties
    const updates: Partial<DesignSystem> = {
      theme: { 
        variant: designSystem.theme.variant,
        primary: designSystem.theme.primary,
        appearance,
        radius: designSystem.theme.radius,
        animation: designSystem.theme.animation
      }
    };
    
    // Use the safe merge function to ensure type safety
    const updatedSystem = safeDesignSystemMerge(designSystem, updates);
    setDesignSystemState(updatedSystem);
  };

  return (
    <ThemeContext.Provider
      value={{
        designSystem,
        draftDesignSystem,
        setDesignSystem,
        updateDraftDesignSystem,
        resetDraftDesignSystem,
        applyDraftChanges,
        activeClientId,
        setActiveClientId,
        isDarkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};