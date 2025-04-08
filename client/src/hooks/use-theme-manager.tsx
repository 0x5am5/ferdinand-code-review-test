import { useState, useEffect } from 'react';
import { DesignSystem, themeManager } from '../lib/theme-manager';

// React hook to integrate the theme manager with React components
export function useThemeManager() {
  const [currentTheme, setCurrentTheme] = useState<DesignSystem>(themeManager.getTheme());
  const [draftTheme, setDraftTheme] = useState<DesignSystem | null>(themeManager.getDraftTheme());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Subscribe to theme changes
    const themeUnsubscribe = themeManager.subscribe('theme-update', (theme) => {
      setCurrentTheme(theme);
      setIsLoading(false);
    });
    
    // Subscribe to draft theme changes
    const draftUnsubscribe = themeManager.subscribe('draft-update', (theme) => {
      setDraftTheme(theme);
      setIsLoading(false);
    });
    
    // Clean up subscriptions
    return () => {
      themeUnsubscribe();
      draftUnsubscribe();
    };
  }, []);

  return {
    designSystem: currentTheme,
    draftDesignSystem: draftTheme,
    updateDesignSystem: async (newTheme: Partial<DesignSystem>) => {
      await themeManager.applyDraftChanges();
    },
    updateDraftDesignSystem: (newTheme: Partial<DesignSystem>) => {
      themeManager.updateDraftTheme(newTheme);
    },
    applyDraftChanges: async () => {
      await themeManager.applyDraftChanges();
    },
    isLoading
  };
}

// Export a compatibility function for backward compatibility
export function useTheme() {
  return useThemeManager();
}