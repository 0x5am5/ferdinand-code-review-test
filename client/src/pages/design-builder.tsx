import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    if (isLoading || typographySettingsLoaded.current) return;

    const loadTypographySettings = async () => {
      try {
        // First try to load from the server
        const response = await fetch('/api/design-system');
        if (response.ok) {
          const data = await response.json();
          // If there's typography_extended data in the theme
          if (data.typography_extended) {
            // Store it in localStorage for our local state
            localStorage.setItem('typographySettings', JSON.stringify(data.typography_extended));
            
            // Apply each setting to the document
            Object.entries(data.typography_extended).forEach(([key, rawValue]) => {
              const value = rawValue as string | number;
              applyTypographySetting(key, value);
              
              // Update the displayed value in the UI
              if (key === 'headingScale') {
                const element = document.getElementById('heading-scale-value');
                if (element) element.textContent = String(value);
              } else if (key === 'bodyTextSize') {
                const element = document.getElementById('body-size-value');
                if (element) element.textContent = String(value);
              } else if (key === 'lineHeight') {
                const element = document.getElementById('line-height-value');
                if (element) element.textContent = String(value);
              }
            });
          }
        }
      } catch (error) {
        console.error('Error loading typography settings from server:', error);
        
        // Fall back to localStorage if available
        const savedSettings = localStorage.getItem('typographySettings');
        if (savedSettings) {
          try {
            const settings = JSON.parse(savedSettings);
            // Apply each setting
            Object.entries(settings).forEach(([key, rawValue]) => {
              const value = rawValue as string | number;
              applyTypographySetting(key, value);
            });
          } catch (e) {
            console.error('Error parsing typography settings from localStorage:', e);
          }
        }
      }
      
      typographySettingsLoaded.current = true;
    };
    
    loadTypographySettings();
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
  
  // Use the draft for display purposes
  const designSystem = draftDesignSystem || appliedDesignSystem;
  
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
    let updatedDesignSystem = { ...designSystem };
    
    // First, handle the basic typography settings (font family)
    if (key === 'primary' || key === 'heading') {
      updatedDesignSystem = {
        ...designSystem,
        typography: {
          ...designSystem.typography,
          [key]: value
        }
      };
      
      updateDraftDesignSystem({ 
        typography: {
          ...designSystem.typography,
          [key]: value
        }
      });
    } 
    // For extended typography settings that are not directly in the typography object
    else {
      // Store the updated typography settings in a separate object in localStorage
      let typographySettings = localStorage.getItem('typographySettings');
      let settings = typographySettings ? JSON.parse(typographySettings) : {};
      
      // Update the specific setting
      settings[key] = value;
      
      // Save to localStorage
      localStorage.setItem('typographySettings', JSON.stringify(settings));
      
      // Apply the setting to the document for immediate visual feedback
      applyTypographySetting(key, value);
    }
    
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
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <h1 className="text-2xl font-bold mb-6">Design Builder</h1>
          <div className="grid gap-6">
            <p>Loading design system...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-2">Design Builder</h1>
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
                <Card className="p-6">
                  {/* General Tab Content */}
                  <TabsContent value="general" className="mt-0">
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
                          {designSystem?.raw_tokens?.colors?.brand && Object.entries(designSystem.raw_tokens.colors.brand).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3">
                              <Label htmlFor={`brand-${key}`} className="w-1/3 flex-shrink-0 text-sm">
                                {key.replace(/_/g, ' ')}:
                              </Label>
                              <div className="flex-1">
                                <ColorPicker
                                  id={`brand-${key}`}
                                  value={value}
                                  onChange={(value) => handleRawTokenChange('colors', `brand.${key}`, value)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Neutral Colors */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3">Neutral Colors</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {designSystem?.raw_tokens?.colors?.neutral && Object.entries(designSystem.raw_tokens.colors.neutral).map(([key, value]) => (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label htmlFor={`neutral-${key}`} className="text-sm">
                                  {key.replace(/_/g, ' ')}
                                </Label>
                                <div 
                                  className="w-6 h-6 rounded border" 
                                  style={{ backgroundColor: value }}
                                ></div>
                              </div>
                              <ColorPicker
                                id={`neutral-${key}`}
                                value={value}
                                onChange={(value) => handleRawTokenChange('colors', `neutral.${key}`, value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Interactive Colors */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3">Interactive Colors</h4>
                        <div className="space-y-3">
                          {designSystem?.raw_tokens?.colors?.interactive && Object.entries(designSystem.raw_tokens.colors.interactive).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-3">
                              <Label htmlFor={`interactive-${key}`} className="w-1/3 flex-shrink-0 text-sm">
                                {key.replace(/_/g, ' ')}:
                              </Label>
                              <div className="flex-1">
                                <ColorPicker
                                  id={`interactive-${key}`}
                                  value={value}
                                  onChange={(value) => handleRawTokenChange('colors', `interactive.${key}`, value)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Semantic Colors (UI Component Colors) */}
                    <div className="mt-8 border-t pt-4">
                      <h3 className="text-md font-semibold mb-3">UI Component Colors</h3>
                      <div className="space-y-4">
                        {designSystem && Object.entries(designSystem.colors).map(([key, color]) => (
                          <div key={key} className="space-y-2">
                            <Label className="capitalize">{key.replace(/-/g, ' ')}</Label>
                            <ColorPicker
                              value={color}
                              onChange={(value) => handleColorChange(key, value)}
                            />
                          </div>
                        ))}
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
                </Card>
              </div>

              {/* Right column: Component Preview (2 columns) */}
              <div className="lg:col-span-2">
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Component Preview</h2>
                  
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
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ColorCard name="Primary" hex={designSystem?.colors.primary || "#0000ff"} />
                        <ColorCard name="Background" hex={designSystem?.colors.background || "#ffffff"} />
                        <ColorCard name="Foreground" hex={designSystem?.colors.foreground || "#000000"} />
                        <ColorCard name="Muted" hex={designSystem?.colors.muted || "#f1f5f9"} />
                        <ColorCard name="Accent" hex={designSystem?.colors.accent || "#f1f5f9"} />
                        <ColorCard name="Destructive" hex={designSystem?.colors.destructive || "#ef4444"} />
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium border-b pb-2">Raw & Semantic Color Variables</h3>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 border rounded">
                              <h4 className="text-md font-semibold mb-3">Brand Colors</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-8 h-8 rounded" 
                                    style={{ backgroundColor: "var(--color-brand-primary-base)" }}
                                  ></div>
                                  <span>Primary Base (--color-brand-primary-base)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-8 h-8 rounded" 
                                    style={{ backgroundColor: "var(--color-brand-primary-lighter1)" }}
                                  ></div>
                                  <span>Primary Lighter (--color-brand-primary-lighter1)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-8 h-8 rounded" 
                                    style={{ backgroundColor: "var(--color-brand-primary-darker1)" }}
                                  ></div>
                                  <span>Primary Darker (--color-brand-primary-darker1)</span>
                                </div>
                              </div>
                            </div>
                            <div className="p-4 border rounded">
                              <h4 className="text-md font-semibold mb-3">Interactive Colors</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-8 h-8 rounded" 
                                    style={{ backgroundColor: "var(--color-interactive-success-base)" }}
                                  ></div>
                                  <span>Success (--color-interactive-success-base)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-8 h-8 rounded" 
                                    style={{ backgroundColor: "var(--color-interactive-error-base)" }}
                                  ></div>
                                  <span>Error (--color-interactive-error-base)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-8 h-8 rounded" 
                                    style={{ backgroundColor: "var(--color-interactive-warning-base)" }}
                                  ></div>
                                  <span>Warning (--color-interactive-warning-base)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <h4 className="text-md font-semibold mt-4">Components with Raw Variables</h4>
                          <div className="flex flex-wrap gap-2">
                            <div 
                              className="py-2 px-4 rounded text-white" 
                              style={{ backgroundColor: "var(--color-brand-primary-base)" }}
                            >
                              Primary Button
                            </div>
                            <div 
                              className="py-2 px-4 rounded text-white" 
                              style={{ backgroundColor: "var(--color-interactive-success-base)" }}
                            >
                              Success Button
                            </div>
                            <div 
                              className="py-2 px-4 rounded text-white" 
                              style={{ backgroundColor: "var(--color-interactive-error-base)" }}
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
      </main>
      
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