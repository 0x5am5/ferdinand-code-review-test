import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ColorPicker } from "@/components/ui/color-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TypographyCard } from "@/components/brand/typography-card";
import { ColorCard } from "@/components/brand/color-card";
import { useTheme, DesignSystem } from "../contexts/ThemeContext";
import { lightenColor, darkenColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import utility functions for generating color palettes
function generateTintsAndShades(hex: string, tintPercents = [60, 40, 20], shadePercents = [20, 40, 60]) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const tints = tintPercents.map(percent => {
    const tintR = r + ((255 - r) * percent) / 100;
    const tintG = g + ((255 - g) * percent) / 100;
    const tintB = b + ((255 - b) * percent) / 100;
    return `#${Math.round(tintR).toString(16).padStart(2, '0')}${Math.round(tintG).toString(16).padStart(2, '0')}${Math.round(tintB).toString(16).padStart(2, '0')}`;
  });

  const shades = shadePercents.map(percent => {
    const shadeR = r * (1 - percent / 100);
    const shadeG = g * (1 - percent / 100);
    const shadeB = b * (1 - percent / 100);
    return `#${Math.round(shadeR).toString(16).padStart(2, '0')}${Math.round(shadeG).toString(16).padStart(2, '0')}${Math.round(shadeB).toString(16).padStart(2, '0')}`;
  });

  return { tints, shades };
}

function generateNeutralPalette(baseGrey: string) {
  // Generate 10 shades from white to black
  const tints = generateTintsAndShades(baseGrey, [90, 80, 70, 60, 50]).tints;
  const shades = generateTintsAndShades(baseGrey, [40, 30, 20, 10, 5]).shades;
  return [...tints, baseGrey, ...shades];
}
import { 
  InfoIcon, 
  CheckIcon, 
  XIcon, 
  ChevronRightIcon, 
  SaveIcon, 
  UndoIcon, 
  RedoIcon, 
  RotateCcwIcon,
  AlertTriangleIcon 
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";

export default function DesignBuilder() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { designSystem: appliedDesignSystem, draftDesignSystem, updateDesignSystem, updateDraftDesignSystem, applyDraftChanges, isLoading } = useTheme();
  
  // History management for undo/redo functionality
  const [history, setHistory] = useState<DesignSystem[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);
  const [navTarget, setNavTarget] = useState("");

  // Ref to track if typography settings have been loaded
  const typographySettingsLoaded = useRef(false);

  // Load typography settings from the server or from localStorage on initial render
  useEffect(() => {
    // Skip if still loading or if typography settings are already loaded
    if (isLoading || typographySettingsLoaded.current) return;

    // Mark as loaded at the beginning to prevent potential re-runs
    typographySettingsLoaded.current = true;

    // Store UI element updates in a queue to process in one batch
    const uiUpdates = new Map<string, string>();

    // Function to update UI elements without triggering re-renders
    // Uses a safer approach with DOM references captured once
    const updateUIElements = () => {
      if (uiUpdates.size === 0) return;

      const headingScaleEl = document.getElementById('heading-scale-value');
      const bodySizeEl = document.getElementById('body-size-value');
      const lineHeightEl = document.getElementById('line-height-value');

      if (uiUpdates.has('headingScale') && headingScaleEl) {
        headingScaleEl.textContent = uiUpdates.get('headingScale') || '';
      }

      if (uiUpdates.has('bodyTextSize') && bodySizeEl) {
        bodySizeEl.textContent = uiUpdates.get('bodyTextSize') || '';
      }

      if (uiUpdates.has('lineHeight') && lineHeightEl) {
        lineHeightEl.textContent = uiUpdates.get('lineHeight') || '';
      }
    };

    const loadTypographySettings = async () => {
      let extendedTypography: Record<string, any> | null = null;

      try {
        // First try to load from the server
        const response = await fetch('/api/design-system');
        if (response.ok) {
          const data = await response.json();
          // If there's typography_extended data in the theme
          if (data.typography_extended) {
            extendedTypography = data.typography_extended;

            // Safely save to localStorage
            try {
              localStorage.setItem('typographySettings', JSON.stringify(data.typography_extended));
            } catch (storageError) {
              console.error('Error saving typography settings to localStorage:', storageError);
            }
          }
        }
      } catch (error) {
        console.error('Error loading typography settings from server:', error);
      }

      // If we couldn't get from server, try localStorage
      if (!extendedTypography) {
        try {
          const savedSettings = localStorage.getItem('typographySettings');
          if (savedSettings) {
            extendedTypography = JSON.parse(savedSettings);
          }
        } catch (e) {
          console.error('Error loading typography settings from localStorage:', e);
        }
      }

      // Apply the typography settings if we got them from anywhere
      if (extendedTypography) {
        try {
          Object.entries(extendedTypography).forEach(([key, rawValue]) => {
            const value = rawValue as string | number;
            applyTypographySetting(key, value);

            // Queue UI updates to handle in one batch
            uiUpdates.set(key, String(value));
          });

          // Apply all UI updates at once
          updateUIElements();
        } catch (error) {
          console.error('Error applying typography settings:', error);
        }
      }
    };

    // Load settings with error isolation
    loadTypographySettings().catch(err => {
      console.error('Unexpected error loading typography settings:', err);
    });

  }, [isLoading]);

  // Initialize history with the loaded design system
  useEffect(() => {
    if (!isLoading && draftDesignSystem && history.length === 0) {
      setHistory([draftDesignSystem]);
      setCurrentHistoryIndex(0);
    }
  }, [isLoading, draftDesignSystem, history.length]);

  // Confirm navigation if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // (Draft logic handled inline)

  // Add change to history
  const addToHistory = useCallback((newState: DesignSystem) => {
    setHistory(prev => {
      // Slice history to current index to remove any "future" history
      const newHistory = [...prev.slice(0, currentHistoryIndex + 1), JSON.parse(JSON.stringify(newState))];
      // Keep only last 20 states to avoid memory issues
      return newHistory.slice(-20);
    });
    setCurrentHistoryIndex(prev => Math.min(prev + 1, 19));
    setHasUnsavedChanges(true);
  }, [currentHistoryIndex]);

  const handleThemeChange = (key: string, value: any) => {
    const updatedDesignSystem = { 
      ...designSystem,
      theme: {
        ...designSystem.theme,
        [key]: value
      }
    };

    updateDraftDesignSystem({ 
      theme: {
        ...designSystem.theme,
        [key]: value
      }
    });

    addToHistory(updatedDesignSystem);
  };

  const handleColorChange = (key: string, value: string) => {
    const updatedDesignSystem = { 
      ...designSystem,
      colors: {
        ...designSystem.colors,
        [key]: value
      }
    };

    updateDraftDesignSystem({ 
      colors: {
        ...designSystem.colors,
        [key]: value
      }
    });

    addToHistory(updatedDesignSystem);
  };

  const handleRawTokenChange = (
    category: 'default_unit' | 'spacing' | 'radius' | 'transition' | 'border' | 'colors', 
    key: string, 
    value: string | number
  ) => {
    const updatedRawTokens = { ...(designSystem.raw_tokens || {}) };

    if (category === 'default_unit') {
      updatedRawTokens.default_unit = value as string;
    } else if (category === 'spacing') {
      updatedRawTokens.spacing = { ...(updatedRawTokens.spacing || {}), [key]: value };
    } else if (category === 'radius') {
      updatedRawTokens.radius = { ...(updatedRawTokens.radius || {}), [key]: value };
    } else if (category === 'transition') {
      updatedRawTokens.transition = { ...(updatedRawTokens.transition || {}), [key]: value };
    } else if (category === 'border') {
      updatedRawTokens.border = { ...(updatedRawTokens.border || {}), [key]: value };
    } else if (category === 'colors') {
      // Handle nested structure for colors
      // Extract parts from key: brand.primary_base, neutral.neutral_100, etc.
      const [colorType, colorName] = key.split('.');

      if (!updatedRawTokens.colors) {
        updatedRawTokens.colors = {};
      }

      if (colorType === 'brand') {
        updatedRawTokens.colors.brand = { ...(updatedRawTokens.colors.brand || {}), [colorName]: value as string };
      } else if (colorType === 'neutral') {
        updatedRawTokens.colors.neutral = { ...(updatedRawTokens.colors.neutral || {}), [colorName]: value as string };
      } else if (colorType === 'interactive') {
        updatedRawTokens.colors.interactive = { ...(updatedRawTokens.colors.interactive || {}), [colorName]: value as string };
      }
    }

    const updatedDesignSystem = { 
      ...designSystem,
      raw_tokens: updatedRawTokens
    };

    updateDraftDesignSystem({ raw_tokens: updatedRawTokens });
    addToHistory(updatedDesignSystem);
    setHasUnsavedChanges(true);
  };

  // Updated to handle typography changes, including properties not directly in the typography object
  const handleTypographyChange = (key: string, value: string | number) => {
    // Create a deep copy to avoid direct references that could cause circular updates
    const designSystemCopy = JSON.parse(JSON.stringify(designSystem));
    let updatedDesignSystem = designSystemCopy;

    // First, handle the basic typography settings (font family)
    if (key === 'primary' || key === 'heading') {
      updatedDesignSystem = {
        ...designSystemCopy,
        typography: {
          ...designSystemCopy.typography,
          [key]: value
        }
      };

      // Only update necessary fields with a clean object
      updateDraftDesignSystem({ 
        typography: {
          ...designSystemCopy.typography,
          [key]: value
        }
      });
    } 
    // For extended typography settings that are not directly in the typography object
    else {
      try {
        // Safely work with localStorage
        let settings = {};
        try {
          const typographySettings = localStorage.getItem('typographySettings');
          if (typographySettings) {
            settings = JSON.parse(typographySettings);
          }
        } catch (error) {
          console.error('Error parsing typography settings from localStorage:', error);
        }

        // Create a new object instead of modifying the existing one
        const updatedSettings = { ...settings, [key]: value };

        // Safely save to localStorage
        try {
          localStorage.setItem('typographySettings', JSON.stringify(updatedSettings));
        } catch (error) {
          console.error('Error saving typography settings to localStorage:', error);
        }

        // Apply the setting to the document for immediate visual feedback
        // But do it without triggering additional renders
        setTimeout(() => {
          applyTypographySetting(key, value);
        }, 0);

        // Update our design system copy with the new typography_extended data
        if (!updatedDesignSystem.typography_extended) {
          updatedDesignSystem.typography_extended = {};
        }
        updatedDesignSystem.typography_extended[key] = value;
      } catch (error) {
        console.error('Error in handleTypographyChange:', error);
      }
    }

    // Only record in history after all updates are done
    addToHistory(updatedDesignSystem);
  };

  // Function to apply typography settings to the document
  const applyTypographySetting = (key: string, value: string | number) => {
    const root = document.documentElement;

    switch(key) {
      case 'headingScale':
        // Scale all heading sizes
        const baseHeadingSize = 2.5; // Base size for h1 in rem
        root.style.setProperty('--heading-1-size', `${baseHeadingSize * Number(value)}rem`);
        root.style.setProperty('--heading-2-size', `${(baseHeadingSize * 0.8) * Number(value)}rem`);
        root.style.setProperty('--heading-3-size', `${(baseHeadingSize * 0.6) * Number(value)}rem`);
        break;
      case 'bodyTextSize':
        // Base size for body text
        root.style.setProperty('--body-size', `${Number(value)}rem`);
        break;
      case 'lineHeight':
        // Line height for all text
        root.style.setProperty('--line-height', String(value));
        break;
      case 'headingWeight':
        // Font weight for headings
        root.style.setProperty('--heading-weight', String(value));
        break;
      case 'bodyWeight':
        // Font weight for body text
        root.style.setProperty('--body-weight', String(value));
        break;
    }
  };

  // Undo last change
  const handleUndo = () => {
    if (currentHistoryIndex > 0) {
      const previousState = history[currentHistoryIndex - 1];
      updateDraftDesignSystem(previousState);
      setCurrentHistoryIndex(currentHistoryIndex - 1);
      setHasUnsavedChanges(true);
    }
  };

  // Redo previously undone change
  const handleRedo = () => {
    if (currentHistoryIndex < history.length - 1) {
      const nextState = history[currentHistoryIndex + 1];
      updateDraftDesignSystem(nextState);
      setCurrentHistoryIndex(currentHistoryIndex + 1);
      setHasUnsavedChanges(true);
    }
  };

  // Discard all unsaved changes
  const handleDiscardChanges = () => {
    if (appliedDesignSystem) {
      updateDraftDesignSystem(appliedDesignSystem);
      setHistory([appliedDesignSystem]);
      setCurrentHistoryIndex(0);
      setHasUnsavedChanges(false);

      toast({
        title: "Changes discarded",
        description: "All changes have been reset to the last saved state"
      });
    }
  };

  const handleSaveChanges = async () => {
    try {
      // First, apply draft changes to the main design system
      await applyDraftChanges();

      // Save typography extended settings to database
      const typographySettings = localStorage.getItem('typographySettings');
      if (typographySettings) {
        const settings = JSON.parse(typographySettings);

        // Save the typography settings to the server
        const response = await fetch('/api/design-system/typography', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        });

        if (!response.ok) {
          throw new Error('Failed to save typography settings');
        }
      }

      setHasUnsavedChanges(false);

      toast({
        title: "Design system saved",
        description: "All your design system changes have been applied"
      });
    } catch (error) {
      console.error('Error saving typography settings:', error);
      toast({
        title: "Partial save completed",
        description: "Main design settings saved, but typography details could not be saved",
        variant: "destructive"
      });
    }
  };

  // Handle navigation with confirmation if needed
  const handleNavigation = (path: string) => {
    if (hasUnsavedChanges) {
      setNavTarget(path);
      setShowLeaveAlert(true);
    } else {
      navigate(path);
    }
  };

  const confirmNavigation = () => {
    setShowLeaveAlert(false);
    if (navTarget) {
      navigate(navTarget);
    }
  };

  if (isLoading || !designSystem) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Design Builder</h1>
        <div className="grid gap-6">
          <p>Loading design system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="">Design Builder</h1>
            <p className="text-muted-foreground">
              Control the overall design system of your application
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleUndo}
              disabled={currentHistoryIndex <= 0}
              title="Undo"
            >
              <UndoIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleRedo}
              disabled={currentHistoryIndex >= history.length - 1}
              title="Redo"
            >
              <RedoIcon className="h-4 w-4" />
            </Button>
            {hasUnsavedChanges && (
              <Button 
                variant="outline" 
                onClick={handleDiscardChanges}
                className="gap-2"
              >
                <RotateCcwIcon className="h-4 w-4" />
                Discard Changes
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={handleSaveChanges}
              className="gap-2"
              disabled={!hasUnsavedChanges}
            >
              <SaveIcon className="h-4 w-4" />
              Save Changes
            </Button>
            </div>
          </div>

          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 mb-8">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="borders">Borders</TabsTrigger>
            </TabsList>

            {/* Main content with all tabs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Left column: Settings controls (1 column) */}
              <div className="lg:col-span-1">
                <div className="editor-container"
                  >
                  {/* General Tab Content */}
                  <TabsContent value="general" className="">
                    <h2 className="text-xl font-semibold mb-4">General Settings</h2>
                    <div className="space-y-6">
                      {/* Base Style Settings */}
                      <div className="border-b pb-4">
                        <h3 className="text-md font-semibold mb-3">Base Style</h3>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="animation">Animation Style</Label>
                            <Select 
                              value={designSystem?.theme.animation} 
                              onValueChange={(value) => handleThemeChange('animation', value)}
                            >
                              <SelectTrigger id="animation" className="w-full mt-1">
                                <SelectValue placeholder="Select animation style" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="minimal">Minimal</SelectItem>
                                <SelectItem value="smooth">Smooth</SelectItem>
                                <SelectItem value="bounce">Bounce</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground mt-1">
                              Controls the animation style
                            </p>
                          </div>

                          <div>
                            <Label htmlFor="radius">Border Radius: {designSystem?.theme.radius}rem</Label>
                            <div className="pt-2 pb-2">
                              <Slider 
                                id="radius"
                                defaultValue={[designSystem?.theme.radius || 0.5]} 
                                max={2} 
                                step={0.1}
                                onValueChange={(value) => handleThemeChange('radius', value[0])}
                              />
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Controls the roundness of UI elements
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Design Tokens Section */}
                      <div>
                        <h3 className="text-md font-semibold mb-3">Design Tokens</h3>

                        {/* Default Unit */}
                        <div className="mb-4">
                          <Label htmlFor="default-unit">Default Unit</Label>
                          <Select 
                            value={designSystem?.raw_tokens?.default_unit || 'rem'} 
                            onValueChange={(value) => handleRawTokenChange('default_unit', 'default_unit', value)}
                          >
                            <SelectTrigger id="default-unit" className="w-full mt-1">
                              <SelectValue placeholder="Select default unit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rem">rem</SelectItem>
                              <SelectItem value="em">em</SelectItem>
                              <SelectItem value="px">px</SelectItem>
                              <SelectItem value="%">%</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground mt-1">
                            Default unit used for spacing and sizing
                          </p>
                        </div>

                        {/* Spacing Variables */}
                        <div className="border-t pt-4 mt-4">
                          <h4 className="font-medium mb-3">Spacing Tokens</h4>
                          <div className="space-y-3">
                            {designSystem?.raw_tokens?.spacing && Object.entries(designSystem.raw_tokens.spacing).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-3">
                                <Label htmlFor={`spacing-${key}`} className="w-1/3 flex-shrink-0 text-sm">
                                  {key.replace(/_/g, ' ')}:
                                </Label>
                                <div className="flex-1">
                                  <Input
                                    id={`spacing-${key}`}
                                    type="number"
                                    value={value}
                                    min={0}
                                    step={0.1}
                                    onChange={(e) => handleRawTokenChange('spacing', key, parseFloat(e.target.value))}
                                  />
                                </div>
                                <div className="flex-shrink-0 w-16 text-sm text-muted-foreground">
                                  {designSystem?.raw_tokens?.default_unit || 'rem'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Colors Tab Content */}
                  <TabsContent value="colors" className="mt-0">
                    <h2 className="text-xl font-semibold mb-4">Color System</h2>

                    {/* Raw Color Tokens */}
                    <div className="mb-8">
                      <h3 className="text-md font-semibold mb-3">Base Color Tokens</h3>

                      {/* Brand Colors */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3">Brand Colors</h4>
                        <div className="space-y-3">
                          {designSystem?.raw_tokens?.colors?.brand && Object.entries(designSystem.raw_tokens.colors.brand)
                            .filter(([key]) => !key.includes('container') && !key.includes('on_container'))
                            .map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3">
                              <Label htmlFor={`brand-${key}`} className="w-1/3 flex-shrink-0 text-sm">
                                {key.replace(/_/g, ' ')}:
                              </Label>
                              <div className="flex-1 flex gap-2">
                                <div className="flex-1">
                                  <ColorPicker
                                    id={`brand-${key}`}
                                    value={value}
                                    onChange={(value) => {
                                      // When base color changes, update it and derived container/on-container colors
                                      handleRawTokenChange('colors', `brand.${key}`, value);

                                      // Auto-generate container color (lighter version)
                                      const containerColor = lightenColor(value, 60);
                                      const containerKey = key.replace('_base', '_container');
                                      handleRawTokenChange('colors', `brand.${containerKey}`, containerColor);

                                      // Auto-generate on-container color (darker version)
                                      const onContainerColor = darkenColor(value, 60);
                                      const onContainerKey = key.replace('_base', '_on_container');
                                      handleRawTokenChange('colors', `brand.${onContainerKey}`, onContainerColor);
                                    }}
                                  />
                                </div>
                                {/* Don't allow deleting primary color if it's the only one */}
                                {(key !== 'primary_base' || Object.keys(designSystem?.raw_tokens?.colors?.brand || {}).filter(k => k.includes('_base')).length > 1) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      // Get a copy of the current brand colors
                                      const updatedColors = { ...(designSystem?.raw_tokens?.colors || {}) };
                                      const updatedBrand = { ...(updatedColors.brand || {}) };

                                      // Remove the base color and its related container colors
                                      const colorName = key.replace('_base', '');
                                      delete updatedBrand[key]; // base
                                      delete updatedBrand[`${colorName}_container`]; // container
                                      delete updatedBrand[`${colorName}_on_container`]; // on-container

                                      // Update the design system
                                      updatedColors.brand = updatedBrand;

                                      const updatedRawTokens = {
                                        ...(designSystem.raw_tokens || {}),
                                        colors: updatedColors
                                      };

                                      updateDraftDesignSystem({ raw_tokens: updatedRawTokens });

                                      // Add to history for undo/redo
                                      const updatedDesignSystem = { 
                                        ...designSystem,
                                        raw_tokens: updatedRawTokens
                                      };
                                      addToHistory(updatedDesignSystem);

                                      toast({
                                        title: "Color removed",
                                        description: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} color has been removed.`
                                      });
                                    }}
                                  >
                                    <XIcon className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}

                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => {
                              // Find the next available base color name
                              const existingKeys = Object.keys(designSystem?.raw_tokens?.colors?.brand || {})
                                .filter(key => key.includes('_base'))
                                .map(key => key.replace('_base', ''));

                              let newColorName;
                              if (!existingKeys.includes('primary')) {
                                newColorName = 'primary';
                              } else if (!existingKeys.includes('secondary')) {
                                newColorName = 'secondary';
                              } else if (!existingKeys.includes('tertiary')) {
                                newColorName = 'tertiary';
                              } else {
                                // Generate a name like color4, color5, etc.
                                const customColors = existingKeys
                                  .filter(key => key.startsWith('color'))
                                  .map(key => parseInt(key.replace('color', '')))
                                  .sort((a, b) => a - b);

                                const nextNumber = customColors.length > 0 ? customColors[customColors.length - 1] + 1 : 4;
                                newColorName = `color${nextNumber}`;
                              }

                              // Default color is a shade of blue
                              const defaultColor = '#2563eb';
                              const newBaseKey = `${newColorName}_base`;
                              const newContainerKey = `${newColorName}_container`;
                              const newOnContainerKey = `${newColorName}_on_container`;

                              // Add the new base color and its derived colors
                              handleRawTokenChange('colors', `brand.${newBaseKey}`, defaultColor);
                              handleRawTokenChange('colors', `brand.${newContainerKey}`, lightenColor(defaultColor, 60));
                              handleRawTokenChange('colors', `brand.${newOnContainerKey}`, darkenColor(defaultColor, 60));

                              toast({
                                title: "New base color added",
                                description: `${newColorName.charAt(0).toUpperCase() + newColorName.slice(1)} base color has been added to your system.`
                              });
                            }}
                          >
                            + Add New Base Color
                          </Button>
                        </div>
                      </div>

                      {/* Neutral Colors */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3">Neutral Colors</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="neutral-base">Neutral Base Gray</Label>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <ColorPicker
                                  id="neutral-base"
                                  value={designSystem?.raw_tokens?.colors?.neutral?.neutral_base || "#6b7280"}
                                  onChange={(value) => {
                                    // When neutral base changes, update it and generate the entire neutral palette
                                    handleRawTokenChange('colors', 'neutral.neutral_base', value);

                                    // Generate neutral palette (10 shades)
                                    const neutralPalette = generateNeutralPalette(value);

                                    // Update all neutral colors
                                    neutralPalette.forEach((color: string, index: number) => {
                                      const colorKey = `neutral_${index * 100}`;
                                      handleRawTokenChange('colors', `neutral.${colorKey}`, color);
                                    });

                                    toast({
                                      title: "Neutral palette updated",
                                      description: "Generated 10 shades based on the base gray color."
                                    });
                                  }}
                                />
                              </div>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const baseGray = designSystem?.raw_tokens?.colors?.neutral?.neutral_base || "#6b7280";

                                  // Generate neutral palette (10 shades)
                                  const neutralPalette = generateNeutralPalette(baseGray);

                                  // Update all neutral colors
                                  neutralPalette.forEach((color: string, index: number) => {
                                    const colorKey = `neutral_${index * 100}`;
                                    handleRawTokenChange('colors', `neutral.${colorKey}`, color);
                                  });

                                  toast({
                                    title: "Neutral palette regenerated",
                                    description: "Generated 10 shades based on the base gray color."
                                  });
                                }}
                                title="Regenerate neutral palette"
                              >
                                <RotateCcwIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            <span className="text-xs text-muted-foreground">Base gray color used to generate the neutral palette</span>
                          </div>

                          <div className="grid grid-cols-5 gap-3 mt-4">
                            {designSystem?.raw_tokens?.colors?.neutral && 
                              Object.entries(designSystem.raw_tokens.colors.neutral)
                                .filter(([key]) => key.includes('neutral_'))
                                .sort((a, b) => {
                                  const numA = parseInt(a[0].split('_')[1]);
                                  const numB = parseInt(b[0].split('_')[1]);
                                  return numA - numB;
                                })
                                .map(([key, value]) => (
                                  <div key={key} className="text-center">
                                    <div 
                                      className="w-full aspect-square rounded border mb-1" 
                                      style={{ backgroundColor: value }}
                                    ></div>
                                    <Input 
                                      type="text" 
                                      value={value} 
                                      onChange={(e) => handleRawTokenChange('colors', key, e.target.value)}
                                      className="w-full mt-1"
                                    />
                                  </div>
                                ))
                            }
                          </div>
                        </div>
                      </div>

                      {/* Interactive Colors */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3">Interactive Colors</h4>
                        <div className="space-y-3">
                          {/* Initialize default interactive colors if they don't exist */}
                          {!designSystem?.raw_tokens?.colors?.interactive?.success_base && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mb-2"
                              onClick={() => {
                                // Initialize default interactive colors
                                const defaultInteractiveColors = {
                                  success_base: "#28a745",
                                  error_base: "#dc3545",
                                  warning_base: "#ffc107",
                                  link_base: "#007bff"
                                };

                                // Add each default color and generate container colors
                                Object.entries(defaultInteractiveColors).forEach(([key, value]) => {
                                  // Add base color
                                  handleRawTokenChange('colors', `interactive.${key}`, value);

                                  // Add container color (lighter version)
                                  const containerKey = key.replace('_base', '_container');
                                  const containerColor = lightenColor(value, 60);
                                  handleRawTokenChange('colors', `interactive.${containerKey}`, containerColor);

                                  // Add on-container color (darker version)
                                  const onContainerKey = key.replace('_base', '_on_container');
                                  const onContainerColor = darkenColor(value, 60);
                                  handleRawTokenChange('colors', `interactive.${onContainerKey}`, onContainerColor);
                                });

                                toast({
                                  title: "Default interactive colors added",
                                  description: "Added success, error, warning, and link colors to your system."
                                });
                              }}
                            >
                              + Initialize Default Interactive Colors
                            </Button>
                          )}

                          {designSystem?.raw_tokens?.colors?.interactive && Object.entries(designSystem.raw_tokens.colors.interactive)
                            .filter(([key]) => key.includes('_base'))
                            .map(([key, value]) => (
                              <div key={key} className="flex items-center gap-3">
                                <Label htmlFor={`interactive-${key}`} className="w-1/3 flex-shrink-0 text-sm">
                                  {key.replace(/_/g, ' ')}:
                                </Label>
                                <div className="flex-1">
                                  <ColorPicker
                                    id={`interactive-${key}`}
                                    value={value}
                                    onChange={(value) => {
                                      // Update base color
                                      handleRawTokenChange('colors', `interactive.${key}`, value);

                                      // Update container color (lighter version)
                                      const containerKey = key.replace('_base', '_container');
                                      const containerColor = lightenColor(value, 60);
                                      handleRawTokenChange('colors', `interactive.${containerKey}`, containerColor);

                                      // Update on-container color (darker version)
                                      const onContainerKey = key.replace('_base', '_on_container');
                                      const onContainerColor = darkenColor(value, 60);
                                      handleRawTokenChange('colors', `interactive.${onContainerKey}`, onContainerColor);
                                    }}
                                  />
                                </div>
                              </div>
                            ))
                          }
                          <div className="space-y-3">
                            {['error', 'warning', 'link'].map(type => (
                              <div key={type} className="flex items-center gap-3">
                                <Label htmlFor={`interactive-${type}`} className="w-1/3 flex-shrink-0 text-sm capitalize">
                                  {type} Base:
                                </Label>
                                <div className="flex-1">
                                  <ColorPicker
                                    id={`interactive-${type}`}
                                    value={designSystem?.raw_tokens?.colors?.interactive?.[`${type}_base`] || '#000000'}
                                    onChange={(value) => handleRawTokenChange('colors', `interactive.${type}_base`, value)}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Semantic Colors from _semantic.scss */}
                    <div className="mt-8 border-t pt-4">
                      <h3 className="text-md font-semibold mb-3">Semantic Colors</h3>
                      <div className="space-y-4">
                        {/* Dynamically generate semantic color sections based on defined base colors */}
                        {designSystem?.raw_tokens?.colors?.brand && 
                          Object.entries(designSystem.raw_tokens.colors.brand)
                            .filter(([key]) => key.includes('_base'))
                            .map(([key, value]) => {
                              const colorName = key.replace('_base', '');
                              const displayName = colorName.charAt(0).toUpperCase() + colorName.slice(1);
                              const containerKey = `${colorName}_container`;
                              const onContainerKey = `${colorName}_on_container`;

                              return (
                                <div key={key} className="pb-5">
                                  <h4 className="text-md font-semibold mb-3">{displayName} Colors</h4>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>{displayName} ($color-{colorName})</Label>
                                      <ColorPicker
                                        value={value}
                                        onChange={(newValue) => {
                                          // When base color changes, update it and derived container/on-container colors
                                          handleRawTokenChange('colors', `brand.${key}`, newValue);

                                          // Auto-generate container color (lighter version)
                                          const containerColor = lightenColor(newValue, 60);
                                          handleRawTokenChange('colors', `brand.${containerKey}`, containerColor);

                                          // Auto-generate on-container color (darker version)
                                          const onContainerColor = darkenColor(newValue, 60);
                                          handleRawTokenChange('colors', `brand.${onContainerKey}`, onContainerColor);
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>On {displayName} ($color-on-{colorName})</Label>
                                      <ColorPicker
                                        value={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"}
                                        onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_0', value)}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>{displayName} Container ($color-{colorName}-container)</Label>
                                      <ColorPicker
                                        value={designSystem?.raw_tokens?.colors?.brand?.[containerKey] || lightenColor(value, 60)}
                                        onChange={(value) => {
                                          // Allow manual override of the auto-generated color
                                          handleRawTokenChange('colors', `brand.${containerKey}`, value);
                                        }}
                                      />
                                      <span className="text-xs text-muted-foreground">Auto-generated as 60% lighter than {displayName} (can be overridden)</span>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>On {displayName} Container ($color-on-{colorName}-container)</Label>
                                      <ColorPicker
                                        value={designSystem?.raw_tokens?.colors?.brand?.[onContainerKey] || darkenColor(value, 60)}
                                        onChange={(value) => {
                                          // Allow manual override of the auto-generated color
                                          handleRawTokenChange('colors', `brand.${onContainerKey}`, value);
                                        }}
                                      />
                                      <span className="text-xs text-muted-foreground">Auto-generated as 60% darker than {displayName} (can be overridden)</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                        }

                        <div className="p-4 border rounded">
                          <h4 className="text-md font-semibold mb-3">Error Colors</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Error ($color-error)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.interactive?.error_base || "#dc3545"}
                                onChange={(value) => {
                                  // When error base changes, update it and derived container/on-container colors
                                  handleRawTokenChange('colors', 'interactive.error_base', value);

                                  // Auto-generate container color (lighter version)
                                  const containerColor = lightenColor(value, 60);
                                  handleRawTokenChange('colors', 'interactive.error_container', containerColor);

                                  // Auto-generate on-container color (darker version)
                                  const onContainerColor = darkenColor(value, 60);
                                  handleRawTokenChange('colors', 'interactive.error_on_container', onContainerColor);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>On Error ($color-on-error)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"}
                                onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_0', value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Error Container ($color-error-container)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.interactive?.error_container || lightenColor(designSystem?.raw_tokens?.colors?.interactive?.error_base || "#dc3545", 60)}
                                onChange={(value) => {
                                  // Allow manual override of the auto-generated color
                                  handleRawTokenChange('colors', 'interactive.error_container', value);
                                }}
                              />
                              <span className="text-xs text-muted-foreground">Auto-generated as 60% lighter than Error (can be overridden)</span>
                            </div>
                            <div className="space-y-2">
                              <Label>On Error Container ($color-on-error-container)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.interactive?.error_on_container || darkenColor(designSystem?.raw_tokens?.colors?.interactive?.error_base || "#dc3545", 60)}
                                onChange={(value) => {
                                  // Allow manual override of the auto-generated color
                                  handleRawTokenChange('colors', 'interactive.error_on_container', value);
                                }}
                              />
                              <span className="text-xs text-muted-foreground">Auto-generated as 60% darker than Error (can be overridden)</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border rounded">
                          <h4 className="text-md font-semibold mb-3">Neutral Colors (Backgrounds and Surfaces)</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Background ($color-background)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"}
                                onChange={(value) => {
                                  handleRawTokenChange('colors', 'neutral.neutral_0', value);
                                  handleColorChange("background", value);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>On Background ($color-on-background)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_900 || "#212529"}
                                onChange={(value) => {
                                  handleRawTokenChange('colors', 'neutral.neutral_900', value);
                                  handleColorChange("foreground", value);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Surface ($color-surface)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_100 || "#f8f9fa"}
                                onChange={(value) => {
                                  handleRawTokenChange('colors', 'neutral.neutral_100', value);
                                  handleColorChange("card", value);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>On Surface ($color-on-surface)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_800 || "#343a40"}
                                onChange={(value) => {
                                  handleRawTokenChange('colors', 'neutral.neutral_800', value);
                                  handleColorChange("card-foreground", value);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Surface Variant ($color-surface-variant)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_200 || "#e9ecef"}
                                onChange={(value) => {
                                  handleRawTokenChange('colors', 'neutral.neutral_200', value);
                                  handleColorChange("muted", value);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>On Surface Variant ($color-on-surface-variant)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_700 || "#495057"}
                                onChange={(value) => {
                                  handleRawTokenChange('colors', 'neutral.neutral_700', value);
                                  handleColorChange("muted-foreground", value);
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border rounded">
                          <h4 className="text-md font-semibold mb-3">Outline & Border</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Outline ($color-outline)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_500 || "#adb5bd"}
                                onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_500', value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Border ($color-border-default)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_200 || "#e9ecef"}
                                onChange={(value) => {
                                  handleRawTokenChange('colors', 'neutral.neutral_200', value);
                                  handleColorChange("border", value);
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Border Focus ($color-border-focus)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"}
                                onChange={(value) => {
                                  handleRawTokenChange('colors', 'brand.primary_base', value);
                                  handleColorChange("ring", value);
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border rounded">
                          <h4 className="text-md font-semibold mb-3">Text Colors</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Text Primary ($color-text-primary)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_900 || "#212529"}
                                onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_900', value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Text Secondary ($color-text-secondary)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_600 || "#6c757d"}
                                onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_600', value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Text Muted ($color-text-muted)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_500 || "#adb5bd"}
                                onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_500', value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Text Inverse ($color-text-inverse)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"}
                                onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_0', value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border rounded">
                          <h4 className="text-md font-semibold mb-3">Button Colors</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Button Primary BG ($color-button-primary-bg)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"}
                                onChange={(value) => handleRawTokenChange('colors', 'brand.primary_base', value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Button Primary Text ($color-button-primary-text)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"}
                                onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_0', value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Button Secondary BG ($color-button-secondary-bg)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.neutral?.neutral_100 || "#f8f9fa"}
                                onChange={(value) => handleRawTokenChange('colors', 'neutral.neutral_100', value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Button Secondary Text ($color-button-secondary-text)</Label>
                              <ColorPicker
                                value={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"}
                                onChange={(value) => handleRawTokenChange('colors', 'brand.primary_base', value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Typography Tab Content */}
                  <TabsContent value="typography" className="mt-0">
                    <h2 className="text-xl font-semibold mb-4">Typography Settings</h2>

                    {/* Font Selection */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="primary-font">Primary Font</Label>
                        <Input 
                          id="primary-font"
                          value={designSystem?.typography.primary} 
                          onChange={(e) => handleTypographyChange('primary', e.target.value)}
                          className="mt-1"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Main font used for body text
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="heading-font">Heading Font</Label>
                        <Input 
                          id="heading-font"
                          value={designSystem?.typography.heading} 
                          onChange={(e) => handleTypographyChange('heading', e.target.value)}
                          className="mt-1"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Font used for headings
                        </p>
                      </div>
                    </div>

                    {/* HTML Element Styling */}
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="heading-size-scale">Heading Size Scale: <span id="heading-scale-value">1</span></Label>
                        <Slider 
                          id="heading-size-scale"
                          defaultValue={[1]} 
                          min={0.8} 
                          max={1.5} 
                          step={0.05}
                          className="mt-2"
                          onValueChange={(value) => {
                            handleTypographyChange('headingScale', value[0]);
                            document.getElementById('heading-scale-value')!.textContent = value[0].toString();
                          }}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Controls the overall size of all headings
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="body-text-size">Body Text Size: <span id="body-size-value">1</span>rem</Label>
                        <Slider 
                          id="body-text-size"
                          defaultValue={[1]} 
                          min={0.8} 
                          max={1.2} 
                          step={0.05}
                          className="mt-2"
                          onValueChange={(value) => {
                            handleTypographyChange('bodyTextSize', value[0]);
                            document.getElementById('body-size-value')!.textContent = value[0].toString();
                          }}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Controls the base size of paragraph text
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="line-height">Line Height: <span id="line-height-value">1.5</span></Label>
                        <Slider 
                          id="line-height"
                          defaultValue={[1.5]} 
                          min={1} 
                          max={2} 
                          step={0.1}
                          className="mt-2"
                          onValueChange={(value) => {
                            handleTypographyChange('lineHeight', value[0]);
                            document.getElementById('line-height-value')!.textContent = value[0].toString();
                          }}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Controls spacing between lines of text
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 mt-4">
                        <div>
                          <Label htmlFor="heading-weight">Heading Weight</Label>
                          <Select 
                            defaultValue="700"
                            onValueChange={(value) => handleTypographyChange('headingWeight', value)}
                          >
                            <SelectTrigger id="heading-weight" className="mt-1">
                              <SelectValue placeholder="Select weight" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="400">Regular (400)</SelectItem>
                              <SelectItem value="500">Medium (500)</SelectItem>
                              <SelectItem value="600">Semibold (600)</SelectItem>
                              <SelectItem value="700">Bold (700)</SelectItem>
                              <SelectItem value="800">Extrabold (800)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="body-weight">Body Weight</Label>
                          <Select 
                            defaultValue="400"
                            onValueChange={(value) => handleTypographyChange('bodyWeight', value)}
                          >
                            <SelectTrigger id="body-weight" className="mt-1">
                              <SelectValue placeholder="Select weight" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="300">Light (300)</SelectItem>
                              <SelectItem value="400">Regular (400)</SelectItem>
                              <SelectItem value="500">Medium (500)</SelectItem>
                              <SelectItem value="600">Semibold (600)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Borders Tab Content */}
                  <TabsContent value="borders" className="mt-0">
                    <h2 className="text-xl font-semibold mb-4">Border Settings</h2>
                    <div className="space-y-6">
                      {/* Global Border Color */}
                      <div>
                        <Label htmlFor="border-color">Global Border Color</Label>
                        <ColorPicker
                          id="border-color"
                          value={designSystem?.colors.border || "#e2e8f0"}
                          onChange={(value) => handleColorChange('border', value)}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          This color is used for borders throughout the application
                        </p>
                      </div>

                      {/* Border Width Tokens */}
                      <div className="border-t pt-4 mt-4">
                        <h3 className="text-md font-semibold mb-3">Border Width Tokens</h3>
                        <div className="space-y-3 mt-2">
                          {designSystem?.raw_tokens?.border ? (
                            Object.entries(designSystem.raw_tokens.border)
                              .filter(([key]) => key.includes('width'))
                              .map(([key, value]) => (
                                <div key={key} className="flex items-center gap-3">
                                  <Label htmlFor={`border-${key}`} className="w-1/3 flex-shrink-0 text-sm">
                                    {key.replace(/_/g, ' ')}:
                                  </Label>
                                  <div className="flex-1">
                                    <Input
                                      id={`border-${key}`}
                                      type="number"
                                      value={typeof value === 'number' ? value : 1}
                                      min={0}
                                      max={20}
                                      onChange={(e) => handleRawTokenChange('border', key, parseInt(e.target.value))}
                                    />
                                  </div>
                                  <div className="flex-shrink-0 w-16 text-sm text-muted-foreground">
                                    px
                                  </div>
                                  <div 
                                    className="w-12 h-8 rounded" 
                                    style={{ 
                                      border: `${typeof value === 'number' ? value : 1}px solid ${designSystem?.colors.border || "#e2e8f0"}`,
                                    }}
                                  ></div>
                                </div>
                            ))
                          ) : (
                            // Default border tokens if none exist
                            [
                              { key: 'border_width_hairline', value: 1, label: 'Hairline' },
                              { key: 'border_width_thin', value: 2, label: 'Thin' },
                              { key: 'border_width_medium', value: 4, label: 'Medium' },
                              { key: 'border_width_thick', value: 8, label: 'Thick' }
                            ].map(({ key, value, label }) => (
                              <div key={key} className="flex items-center gap-3">
                                <Label htmlFor={`border-${key}`} className="w-1/3 flex-shrink-0 text-sm">
                                  {label}:
                                </Label>
                                <div className="flex-1">
                                  <Input
                                    id={`border-${key}`}
                                    type="number"
                                    value={value}
                                    min={0}
                                    max={20}
                                    onChange={(e) => handleRawTokenChange('border', key, parseInt(e.target.value))}
                                  />
                                </div>
                                <div className="flex-shrink-0 w-16 text-sm text-muted-foreground">
                                  px
                                </div>
                                <div 
                                  className="w-12 h-8 rounded" 
                                  style={{ 
                                    border: `${value}px solid ${designSystem?.colors.border || "#e2e8f0"}`,
                                  }}
                                ></div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Border Style Tokens */}
                      <div className="border-t pt-4 mt-4">
                        <h3 className="text-md font-semibold mb-3">Border Styles</h3>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          {['solid', 'dashed', 'dotted', 'double'].map(style => (
                            <div 
                              key={style}
                              className="border-2 p-3 text-center rounded cursor-pointer hover:bg-accent"
                              style={{ borderStyle: style }}
                              onClick={() => handleRawTokenChange('border', `border_style_${style}`, style)}
                            >
                              {style}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Border Radius Tokens */}
                      <div className="border-t pt-4 mt-4">
                        <h3 className="text-md font-semibold mb-3">Border Radius Tokens</h3>
                        <div className="space-y-3 mt-2">
                          {designSystem?.raw_tokens?.radius && Object.entries(designSystem.raw_tokens.radius).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3">
                              <Label htmlFor={`radius-${key}`} className="w-1/3 flex-shrink-0 text-sm">
                                {key.replace(/_/g, ' ')}:
                              </Label>
                              <div className="flex-1">
                                <Input
                                  id={`radius-${key}`}
                                  type="number"
                                  value={typeof value === 'number' ? value : 0}
                                  min={0}
                                  max={100}
                                  onChange={(e) => handleRawTokenChange('radius', key, parseInt(e.target.value))}
                                />
                              </div>
                              <div className="flex-shrink-0 w-16 text-sm text-muted-foreground">
                                px
                              </div>
                              <div 
                                className="w-12 h-12 border-2" 
                                style={{ 
                                  borderRadius: `${typeof value === 'number' ? value : 0}px`,
                                  borderColor: designSystem?.colors.border || "#e2e8f0",
                                }}
                              ></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </div>

              {/* Right column: Component Preview (2 columns) */}
              <div className="lg:col-span-2">
                <Card className="design-builder--preview">
                  <h2 className="component-preview--title">Component Preview</h2>

                  {/* General Tab Preview */}
                  <TabsContent value="general" className="mt-0 space-y-8">
                    <Alert className="mb-4">
                      <InfoIcon className="h-4 w-4 mr-2" />
                      <AlertTitle>Design System Preview</AlertTitle>
                      <AlertDescription>
                        Changes are shown in real-time but will only be applied when you save.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="p-4">
                        <h3 className="font-medium mb-2">Animation: {designSystem.theme.animation}</h3>
                        <div className="flex gap-2 flex-wrap">
                          <Button>Hover Me</Button>
                          <Button variant="outline">Interactive</Button>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <h3 className="font-medium mb-2">Border Radius: {designSystem.theme.radius}rem</h3>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-primary h-16 w-full"></div>
                          <Input placeholder="Input field" />
                        </div>
                      </Card>
                    </div>
                  </TabsContent>

                  {/* Colors Tab Preview */}
                  <TabsContent value="colors" className="mt-0">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium border-b pb-2">Base Color Tokens</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 mb-8">
                        {/* Brand Colors */}
                        <div className="p-4 border rounded">
                          <h4 className="text-md font-semibold mb-3">Brand Colors</h4>
                          <div className="space-y-2">
                            {designSystem?.raw_tokens?.colors?.brand && 
                              Object.entries(designSystem.raw_tokens.colors.brand)
                                .filter(([key]) => key.includes('_base'))
                                .map(([key, value]) => {
                                  const colorName = key.replace('_base', '');
                                  const displayName = colorName.charAt(0).toUpperCase() + colorName.slice(1);
                                  return (
                                    <div key={key} className="flex items-center gap-2">
                                      <div 
                                        className="w-10 h-10 rounded-full border" 
                                        style={{ backgroundColor: value as string }}
                                      ></div>
                                      <span>{displayName}</span>
                                    </div>
                                  );
                                })
                            }
                          </div>
                        </div>

                        {/* Neutral Colors */}
                        <div className="p-4 border rounded">
                          <h4 className="text-md font-semibold mb-3">Neutral Colors</h4>
                          <div>
                            {/* Neutral Base Color */}
                            <div className="flex items-center gap-2 mb-4">
                              <div 
                                className="w-10 h-10 rounded-full border" 
                                style={{ backgroundColor: designSystem?.raw_tokens?.colors?.neutral?.neutral_base || "#6b7280" }}
                              ></div>
                              <span>Base Gray</span>
                            </div>

                            {/* Neutral Color Palette */}
                            <p className="text-sm mb-2">Color Palette (10 shades):</p>
                            <div className="grid grid-cols-5 gap-2">
                              {designSystem?.raw_tokens?.colors?.neutral && 
                                Object.entries(designSystem.raw_tokens.colors.neutral)
                                  .filter(([key]) => key.includes('neutral_') && key !== 'neutral_base')
                                  .sort((a, b) => {
                                    const numA = parseInt(a[0].split('_')[1]);
                                    const numB = parseInt(b[0].split('_')[1]);
                                    return numA - numB;
                                  })
                                  .map(([key, value]) => (
                                    <div key={key} className="flex flex-col items-center">
                                      <div 
                                        className="w-8 h-8 rounded border mb-1" 
                                        style={{ backgroundColor: value as string }}
                                      ></div>
                                      <span className="text-xs">{key.replace('neutral_', '')}</span>
                                    </div>
                                  ))
                              }
                            </div>
                          </div>
                        </div>

                        {/* Interactive Colors */}
                        <div className="p-4 border rounded">
                          <h4 className="text-md font-semibold mb-3">Interactive Colors</h4>
                          <div className="space-y-2">
                            {designSystem?.raw_tokens?.colors?.interactive && 
                              Object.entries(designSystem.raw_tokens.colors.interactive)
                                .filter(([key]) => key.includes('_base'))
                                .map(([key, value]) => {
                                  const colorName = key.replace('_base', '');
                                  const displayName = colorName.charAt(0).toUpperCase() + colorName.slice(1);
                                  return (
                                    <div key={key} className="flex items-center gap-2">
                                      <div 
                                        className="w-10 h-10 rounded-full border" 
                                        style={{ backgroundColor: value as string }}
                                      ></div>
                                      <span>{displayName}</span>
                                    </div>
                                  );
                                })
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium border-b pb-2">Base Color Tokens Preview</h3>

                      {/* Brand Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Brand Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {designSystem?.raw_tokens?.colors?.brand && 
                            Object.entries(designSystem.raw_tokens.colors.brand)
                              .filter(([key]) => key.includes('_base'))
                              .map(([key, value]) => {
                                const colorName = key.replace('_base', '');
                                const displayName = colorName.charAt(0).toUpperCase() + colorName.slice(1);
                                return (
                                  <ColorCard key={key} name={`${displayName} Base`} hex={value as string} />
                                );
                              })
                          }
                        </div>
                      </div>

                      {/* Neutral Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Neutral Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
                          {designSystem?.raw_tokens?.colors?.neutral && 
                            Object.entries(designSystem.raw_tokens.colors.neutral)
                              .filter(([key]) => key.includes('neutral_') && key !== 'neutral_base')
                              .sort((a, b) => {
                                const numA = parseInt(a[0].split('_')[1]);
                                const numB = parseInt(b[0].split('_')[1]);
                                return numA - numB;
                              })
                              .map(([key, value]) => {
                                const shade = key.replace('neutral_', '');
                                return (
                                  <ColorCard key={key} name={`Neutral ${shade}`} hex={value as string} />
                                );
                              })
                          }
                        </div>
                      </div>

                      {/* Interactive Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Interactive Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {designSystem?.raw_tokens?.colors?.interactive && 
                            Object.entries(designSystem.raw_tokens.colors.interactive)
                              .filter(([key]) => key.includes('_base'))
                              .map(([key, value]) => {
                                const colorName = key.replace('_base', '');
                                const displayName = colorName.charAt(0).toUpperCase() + colorName.slice(1);
                                return (
                                  <ColorCard key={key} name={displayName} hex={value as string} />
                                );
                              })
                          }
                        </div>
                      </div>

                      <h3 className="text-lg font-medium border-b pb-2">Semantic Color Preview</h3>

                      {/* Primary Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Primary Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <ColorCard name="Primary" hex={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"} />
                          <ColorCard name="On Primary" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"} />
                          {designSystem?.raw_tokens?.colors?.brand?.primary_container ? (
                            <ColorCard name="Primary Container" hex={designSystem?.raw_tokens?.colors?.brand?.primary_container} />
                          ) : (
                            <ColorCard name="Primary Container" hex={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"} lighter amount={60} />
                          )}
                          {designSystem?.raw_tokens?.colors?.brand?.primary_on_container ? (
                            <ColorCard name="On Primary Container" hex={designSystem?.raw_tokens?.colors?.brand?.primary_on_container} />
                          ) : (
                            <ColorCard name="On Primary Container" hex={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"} darker amount={60} />
                          )}
                        </div>
                      </div>

                      {/* Secondary Colors - Only show if secondary_base exists */}
                      {designSystem?.raw_tokens?.colors?.brand?.secondary_base && (
                        <div className="space-y-2 mb-6">
                          <h4 className="font-medium">Secondary Colors</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <ColorCard name="Secondary" hex={designSystem?.raw_tokens?.colors?.brand?.secondary_base} />
                            <ColorCard name="On Secondary" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"} />
                            {designSystem?.raw_tokens?.colors?.brand?.secondary_container ? (
                              <ColorCard name="Secondary Container" hex={designSystem?.raw_tokens?.colors?.brand?.secondary_container} />
                            ) : (
                              <ColorCard name="Secondary Container" hex={designSystem?.raw_tokens?.colors?.brand?.secondary_base} lighter amount={60} />
                            )}
                            {designSystem?.raw_tokens?.colors?.brand?.secondary_on_container ? (
                              <ColorCard name="On Secondary Container" hex={designSystem?.raw_tokens?.colors?.brand?.secondary_on_container} />
                            ) : (
                              <ColorCard name="On Secondary Container" hex={designSystem?.raw_tokens?.colors?.brand?.secondary_base} darker amount={60} />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tertiary Colors - Only show if tertiary_base exists */}
                      {designSystem?.raw_tokens?.colors?.brand?.tertiary_base && (
                        <div className="space-y-2 mb-6">
                          <h4 className="font-medium">Tertiary Colors</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <ColorCard name="Tertiary" hex={designSystem?.raw_tokens?.colors?.brand?.tertiary_base} />
                            <ColorCard name="On Tertiary" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"} />
                            {designSystem?.raw_tokens?.colors?.brand?.tertiary_container ? (
                              <ColorCard name="Tertiary Container" hex={designSystem?.raw_tokens?.colors?.brand?.tertiary_container} />
                            ) : (
                              <ColorCard name="Tertiary Container" hex={designSystem?.raw_tokens?.colors?.brand?.tertiary_base} lighter amount={60} />
                            )}
                            {designSystem?.raw_tokens?.colors?.brand?.tertiary_on_container ? (
                              <ColorCard name="On Tertiary Container" hex={designSystem?.raw_tokens?.colors?.brand?.tertiary_on_container} />
                            ) : (
                              <ColorCard name="On Tertiary Container" hex={designSystem?.raw_tokens?.colors?.brand?.tertiary_base} darker amount={60} />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Error Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Error Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <ColorCard name="Error" hex={designSystem?.raw_tokens?.colors?.interactive?.error_base || "#dc3545"} />
                          <ColorCard name="On Error" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"} />
                          {designSystem?.raw_tokens?.colors?.interactive?.error_container ? (
                            <ColorCard name="Error Container" hex={designSystem?.raw_tokens?.colors?.interactive?.error_container} />
                          ) : (
                            <ColorCard name="Error Container" hex={designSystem?.raw_tokens?.colors?.interactive?.error_base || "#dc3545"} lighter amount={60} />
                          )}
                          {designSystem?.raw_tokens?.colors?.interactive?.error_on_container ? (
                            <ColorCard name="On Error Container" hex={designSystem?.raw_tokens?.colors?.interactive?.error_on_container} />
                          ) : (
                            <ColorCard name="On Error Container" hex={designSystem?.raw_tokens?.colors?.interactive?.error_base || "#dc3545"} darker amount={60} />
                          )}
                        </div>
                      </div>

                      {/* Background Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Background & Surface Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <ColorCard name="Background" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"} />
                          <ColorCard name="On Background" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_900 || "#212529"} />
                          <ColorCard name="Surface" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_100 || "#f8f9fa"} />
                          <ColorCard name="On Surface" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_800 || "#343a40"} />
                          <ColorCard name="Surface Variant" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_200 || "#e9ecef"} />
                          <ColorCard name="On Surface Variant" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_700 || "#495057"} />
                        </div>
                      </div>

                      {/* Text Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Text Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <ColorCard name="Text Primary" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_900 || "#212529"} />
                          <ColorCard name="Text Secondary" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_600 || "#6c757d"} />
                          <ColorCard name="Text Muted" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_500 || "#adb5bd"} />
                          <ColorCard name="Text Inverse" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"} />
                          <ColorCard name="Text Error" hex={designSystem?.raw_tokens?.colors?.interactive?.error_base || "#dc3545"} />
                          <ColorCard name="Text Success" hex={designSystem?.raw_tokens?.colors?.interactive?.success_base || "#28a745"} />
                          <ColorCard name="Text Link" hex={designSystem?.raw_tokens?.colors?.interactive?.link_base || "#007bff"} />
                        </div>
                      </div>

                      {/* Border & Outline Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Border & Outline Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <ColorCard name="Outline" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_500 || "#adb5bd"} />
                          <ColorCard name="Border Default" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_200 || "#e9ecef"} />
                          <ColorCard name="Border Subtle" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_100 || "#f8f9fa"} />
                          <ColorCard name="Border Strong" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_300 || "#dee2e6"} />
                          <ColorCard name="Border Focus" hex={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"} />
                          <ColorCard name="Border Error" hex={designSystem?.raw_tokens?.colors?.interactive?.error_base || "#dc3545"} />
                        </div>
                      </div>

                      {/* Button Colors */}
                      <div className="space-y-2 mb-6">
                        <h4 className="font-medium">Button Colors</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <ColorCard name="Button Primary BG" hex={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"} />
                          <ColorCard name="Button Primary Text" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_0 || "#ffffff"} />
                          <ColorCard name="Button Primary Hover" hex={designSystem?.raw_tokens?.colors?.brand?.primary_darker || "#000099"} />
                          <ColorCard name="Button Primary Disabled" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_300 || "#dee2e6"} />
                          <ColorCard name="Button Secondary BG" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_100 || "#f8f9fa"} />
                          <ColorCard name="Button Secondary Text" hex={designSystem?.raw_tokens?.colors?.brand?.primary_base || "#0000ff"} />
                          <ColorCard name="Button Secondary Border" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_300 || "#dee2e6"} />
                          <ColorCard name="Button Secondary Hover" hex={designSystem?.raw_tokens?.colors?.neutral?.neutral_200 || "#e9ecef"} />
                        </div>
                      </div>

                      <h3 className="text-lg font-medium border-b pb-2">Semantic Color Component Previews</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 border rounded">
                            <h4 className="text-md font-semibold mb-3">Brand Colors</h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded" 
                                  style={{ backgroundColor: "var(--color-primary)" }}
                                ></div>
                                <span>Primary ($color-primary)</span>
                              </div>
                              {designSystem?.raw_tokens?.colors?.brand?.secondary_base && (
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded" 
                                  style={{ backgroundColor: "var(--color-secondary)" }}
                                ></div>
                                <span>Secondary ($color-secondary)</span>
                              </div>
                            )}
                            {designSystem?.raw_tokens?.colors?.brand?.tertiary_base && (
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded" 
                                  style={{ backgroundColor: "var(--color-tertiary)" }}
                                ></div>
                                <span>Tertiary ($color-tertiary)</span>
                              </div>
                            )}
                            </div>
                          </div>
                          <div className="p-4 border rounded">
                            <h4 className="text-md font-semibold mb-3">Interactive Colors</h4>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded" 
                                  style={{ backgroundColor: "var(--color-error)" }}
                                ></div>
                                <span>Error ($color-error)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded" 
                                  style={{ backgroundColor: "var(--color-text-success)" }}
                                ></div>
                                <span>Success ($color-text-success)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded" 
                                  style={{ backgroundColor: "var(--color-text-link)" }}
                                ></div>
                                <span>Link ($color-text-link)</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <h4 className="text-md font-semibold mt-4">Buttons with Semantic Variables</h4>
                        <div className="flex flex-wrap gap-2">
                          <div 
                            className="py-2 px-4 rounded" 
                            style={{ 
                              backgroundColor: "var(--color-button-primary-bg)",
                              color: "var(--color-button-primary-text)"
                            }}
                          >
                            Primary Button
                          </div>
                          <div 
                            className="py-2 px-4 rounded" 
                            style={{ 
                              backgroundColor: "var(--color-button-secondary-bg)",
                              color: "var(--color-button-secondary-text)",
                              border: "1px solid var(--color-button-secondary-border)"
                            }}
                          >
                            Secondary Button
                          </div>
                          <div 
                            className="py-2 px-4 rounded" 
                            style={{ 
                              backgroundColor: "var(--color-error)",
                              color: "var(--color-on-error)"
                            }}
                          >
                            Error Button
                          </div>
                        </div>

                        <h4 className="text-md font-semibold mt-4">Standard Components</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="default">Primary Button</Button>
                          <Button variant="secondary">Secondary</Button>
                          <Button variant="destructive">Destructive</Button>
                        </div>
                      </div>

                    </div>
                  </TabsContent>

                  {/* Typography Tab Preview */}
                  <TabsContent value="typography" className="mt-0">
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium border-b pb-2">Type Scale</h3>
                      <div className="space-y-4">
                        <h1 className="text-4xl font-bold">Heading 1</h1>
                        <h2 className="text-3xl font-bold">Heading 2</h2>
                        <h3 className="text-2xl font-bold">Heading 3</h3>
                        <h4 className="text-xl font-bold">Heading 4</h4>
                        <h5 className="text-lg font-bold">Heading 5</h5>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium border-b pb-2">Text Styles</h3>
                        <div className="space-y-4">
                          <p className="max-w-prose">
                            Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                            Nullam in dui mauris. Vivamus hendrerit arcu sed erat molestie vehicula. 
                            Sed auctor neque eu tellus rhoncus ut eleifend nibh porttitor.
                          </p>
                          <p className="text-sm max-w-prose">
                            Small text for captions and secondary content. The quick brown fox jumps over the lazy dog.
                          </p>
                          <div className="space-y-1">
                            <p><strong>Bold text</strong> for emphasis</p>
                            <p><em>Italic text</em> for emphasis</p>
                            <p><a href="#" className="text-primary underline">Link text</a> for navigation</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Borders Tab Preview */}
                  <TabsContent value="borders" className="mt-0">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-lg font-medium border-b pb-2 mb-4">Border Widths</h3>
                          <div className="space-y-4">
                            {[
                              { key: 'hairline', value: '1px', label: 'Hairline' },
                              { key: 'thin', value: '2px', label: 'Thin' },
                              { key: 'medium', value: '4px', label: 'Medium' },
                              { key: 'thick', value: '8px', label: 'Thick' }
                            ].map(({ key, value, label }) => (
                              <div key={key} className="flex items-center gap-3">
                                <div 
                                  className={`h-16 w-16 bg-background`}
                                  style={{ 
                                    borderWidth: value, 
                                    borderStyle: 'solid',
                                    borderColor: designSystem.colors.border
                                  }}
                                ></div>
                                <span>{label} ({value})</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-medium border-b pb-2 mb-4">Border Styles</h3>
                          <div className="space-y-4">
                            {['solid', 'dashed', 'dotted', 'double'].map(style => (
                              <div key={style} className="flex items-center gap-3">
                                <div 
                                  className={`h-16 w-16 bg-background`}
                                  style={{ 
                                    borderWidth: '2px', 
                                    borderStyle: style,
                                    borderColor: designSystem.colors.border
                                  }}
                                ></div>
                                <span className="capitalize">{style}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium border-b pb-2 mb-4">Components with Raw Border Variables</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded" 
                            style={{ 
                              borderWidth: "var(--border-width-thin)",
                              borderStyle: "solid",
                              borderColor: "var(--color-brand-primary-base)",
                              borderRadius: "var(--radius-md)"
                            }}>
                            <h4 className="font-medium mb-2">Primary Border Card</h4>
                            <p className="text-sm">
                              Using --border-width-thin & --color-brand-primary-base
                            </p>
                          </div>

                          <div className="p-4 rounded" 
                            style={{ 
                              borderWidth: "var(--border-width-medium)",
                              borderStyle: "solid",
                              borderColor: "var(--color-interactive-success-base)",
                              borderRadius: "var(--radius-lg)"
                            }}>
                            <h4 className="font-medium mb-2">Success Border Card</h4>
                            <p className="text-sm">
                              Using --border-width-medium & --color-interactive-success-base
                            </p>
                          </div>

                          <div className="mt-4">
                            <h4 className="font-medium mb-2">Raw Border Button Examples</h4>
                            <div className="flex flex-wrap gap-2">
                              <button 
                                className="py-2 px-4 bg-transparent" 
                                style={{ 
                                  borderWidth: "var(--border-width-thin)",
                                  borderStyle: "solid",
                                  borderColor: "var(--color-brand-primary-base)",
                                  borderRadius: "var(--radius-md)",
                                  color: "var(--color-brand-primary-base)"
                                }}>
                                Primary Outline
                              </button>
                              <button 
                                className="py-2 px-4 bg-transparent" 
                                style={{ 
                                  borderWidth: "var(--border-width-thin)",
                                  borderStyle: "solid",
                                  borderColor: "var(--color-interactive-error-base)",
                                  borderRadius: "var(--radius-md)",
                                  color: "var(--color-interactive-error-base)"
                                }}>
                                Error Outline
                              </button>
                            </div>
                          </div>

                          <div className="mt-4">
                            <h4 className="font-medium mb-2">Standard Components</h4>
                            <div className="space-y-2">
                              <Input placeholder="Input with border" />
                              <Button variant="outline">Outline Button</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Card>
              </div>
            </div>
          </Tabs>
        </div>
      </div>

    {/* Alert dialog for unsaved changes */}
    <AlertDialog open={showLeaveAlert} onOpenChange={setShowLeaveAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmNavigation}>
            Leave Without Saving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
}