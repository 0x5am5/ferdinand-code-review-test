import { useCallback, useEffect, useState } from "react";
import { type DesignSystem, themeManager } from "../lib/theme-manager";

interface ThemeManagerHookResult {
  designSystem: DesignSystem;
  draftDesignSystem: DesignSystem | null;
  updateDesignSystem: (newTheme: Partial<DesignSystem>) => Promise<void>;
  updateDraftDesignSystem: (newTheme: Partial<DesignSystem>) => void;
  applyDraftChanges: () => Promise<boolean | undefined>;
  clearDraft: () => void;
  isLoading: boolean;
}

// React hook to integrate the theme manager with React components
export function useThemeManager(): ThemeManagerHookResult {
  const [currentTheme, setCurrentTheme] = useState<DesignSystem>(
    themeManager.getTheme()
  );
  const [draftTheme, setDraftTheme] = useState<DesignSystem | null>(
    themeManager.getDraftTheme()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Apply theme changes to DOM with debounce
  const applyThemeToDom = useCallback((theme: DesignSystem) => {
    // Prevent the infinite loop by using requestAnimationFrame
    requestAnimationFrame(() => {
      const root = document.documentElement;

      // Apply basic theme properties
      if (theme.theme) {
        // Apply border radius
        if (theme.theme.radius !== undefined) {
          root.style.setProperty("--radius", `${theme.theme.radius}rem`);
        }

        // Apply animation settings
        if (theme.theme.animation) {
          const animationSettings: Record<string, string> = {
            none: "0s",
            minimal: "0.1s",
            smooth: "0.2s",
            bounce: "0.3s",
          };
          const animValue = theme.theme
            .animation as keyof typeof animationSettings;
          root.style.setProperty(
            "--transition",
            animationSettings[animValue] || "0.2s"
          );
        }

        // Apply appearance (dark/light mode)
        if (theme.theme.appearance === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }

      // Apply all CSS variables from theme.colors
      // Skip 'primary' as it's already set from theme.primary in the theme manager
      if (theme.colors) {
        Object.entries(theme.colors).forEach(([key, value]) => {
          if (typeof value === "string" && key !== "primary") {
            root.style.setProperty(`--${key}`, value);
          }
        });

        // Explicitly set primary-foreground if it exists
        if (theme.colors["primary-foreground"]) {
          root.style.setProperty(
            "--primary-foreground",
            theme.colors["primary-foreground"]
          );
        }
      }

      // Apply typography settings
      if (theme.typography) {
        if (theme.typography.primary) {
          root.style.setProperty("--font-sans", theme.typography.primary);
        }
        if (theme.typography.heading) {
          root.style.setProperty("--font-heading", theme.typography.heading);
        }
      }
    });
  }, []);

  useEffect(() => {
    // Subscribe to theme changes
    const themeUnsubscribe = themeManager.subscribe("theme-update", (theme) => {
      if (theme) {
        setCurrentTheme(theme);
      }
      setIsLoading(false);
    });

    // Subscribe to draft theme changes
    const draftUnsubscribe = themeManager.subscribe("draft-update", (theme) => {
      setDraftTheme(theme);
      setIsLoading(false);
    });

    // Clean up subscriptions
    return () => {
      themeUnsubscribe();
      draftUnsubscribe();
    };
  }, []);

  // Apply theme changes when currentTheme or draftTheme changes
  useEffect(() => {
    // Apply the draft theme if it exists, otherwise use current theme
    const themeToApply = draftTheme || currentTheme;
    if (themeToApply) {
      applyThemeToDom(themeToApply);
    }
  }, [currentTheme, draftTheme, applyThemeToDom]);

  return {
    designSystem: currentTheme,
    draftDesignSystem: draftTheme,
    updateDesignSystem: async (newTheme: Partial<DesignSystem>) => {
      // First update the draft theme
      themeManager.updateDraftTheme(newTheme);
      // Then apply the changes directly
      await themeManager.applyDraftChanges();
    },
    updateDraftDesignSystem: (newTheme: Partial<DesignSystem>) => {
      themeManager.updateDraftTheme(newTheme);
    },
    applyDraftChanges: async () => {
      return await themeManager.applyDraftChanges();
    },
    clearDraft: () => {
      themeManager.clearDraft();
    },
    isLoading,
  };
}

// For backward compatibility, we create a separate named hook function
// This approach preserves React Fast Refresh compatibility
export function useTheme(): ThemeManagerHookResult {
  return useThemeManager();
}
