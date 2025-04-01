
import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ImprovedColorPicker } from "@/components/ui/improved-color-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorCard } from "@/components/brand/color-card";
import { useTheme } from "../contexts/ThemeContext";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, XIcon, ChevronRightIcon } from "lucide-react";

export default function DesignBuilder() {
  const { toast } = useToast();
  const { designSystem: appliedDesignSystem, draftDesignSystem, setDesignSystem, updateDraftDesignSystem, resetDraftDesignSystem, applyDraftChanges, isDarkMode } = useTheme();
  const isLoading = false; // hardcoded for now since we don't have this in the context
  
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
  
  // Use the draft for display purposes
  const designSystem = draftDesignSystem || appliedDesignSystem;
  
  const handleThemeChange = (key: string, value: any) => {
    updateDraftDesignSystem({ 
      theme: {
        ...designSystem.theme,
        [key]: value
      }
    });
  };
  
  const handleColorChange = (key: string, value: string) => {
    updateDraftDesignSystem({ 
      colors: {
        ...designSystem.colors,
        [key]: value
      }
    });
  };
  
  // Updated to handle typography changes, including properties not directly in the typography object
  const handleTypographyChange = (key: string, value: string | number) => {
    // First, handle the basic typography settings (font family)
    if (key === 'primary' || key === 'heading') {
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
      <main className="design-builder--main flex-1 p-8 overflow-auto">
        <div className="savebar">
          <Button onClick={handleSaveChanges}>
            Save Changes
          </Button>
        </div>
        <div className="max-w-7xl mx-auto">

          {/* Three-column layout: 1/3 for settings, 2/3 for preview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column: All customization options in a single container */}
            <div className="space-y-6">
              <div>
                <h1 className="">Design Builder</h1>
                <p className="text-muted-foreground">
                  Control the overall design system of your application
                </p>
              </div>
              
              <div>
                {/* Color System Section */}
                <div className="border-b pb-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Color System</h2>
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium mb-4">Base Colors</h3>
                      <div className="grid gap-4">
                        {designSystem && Object.entries(designSystem.colors).map(([key, color]) => (
                          <div key={key} className="space-y-2">
                            <Label className="capitalize">{key.replace(/-/g, ' ')}</Label>
                            <ImprovedColorPicker
                              value={color}
                              onChange={(value) => handleColorChange(key, value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Theme Settings */}
                <div className="border-b pb-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Theme Settings</h2>
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="radius">Border Radius: {designSystem?.theme.radius}rem</Label>
                      <div className="pt-2 pb-4">
                        <Slider 
                          id="radius"
                          defaultValue={[designSystem?.theme.radius || 0.5]} 
                          max={2} 
                          step={0.1}
                          onValueChange={(value) => handleThemeChange('radius', value[0])}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Controls the roundness of UI elements (0 = square, 2 = very rounded)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="animation">Animation Style</Label>
                      <Select 
                        value={designSystem?.theme.animation} 
                        onValueChange={(value) => handleThemeChange('animation', value)}
                      >
                        <SelectTrigger id="animation" className="w-full">
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
                        Controls the animation style throughout the application
                      </p>
                    </div>
                  </div>
                </div>

                {/* Typography Settings */}
                <div className="border-b pb-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Typography Settings</h2>
                  <div className="space-y-6">
                    {/* Font Selection */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Font Families</h3>
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
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">HTML Element Styling</h3>

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

                      <div className="grid gap-4 mt-4">
                          <div>
                            <Label htmlFor="heading-weight">Heading Weight</Label>
                            <Select 
                              defaultValue="700"
                              onValueChange={(value) => handleTypographyChange('headingWeight', value)}
                            >
                              <SelectTrigger id="heading-weight" className="mt-2">
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
                              <SelectTrigger id="body-weight" className="mt-2">
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

                      <p className="text-sm text-muted-foreground italic">
                        These settings will update the global styles for all HTML elements.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: Component Preview (spans 2 columns) */}
            <div className="lg:col-span-2 sticky top-8 self-start max-h-[calc(100vh-8rem)] overflow-auto">
              <Card className="p-6 h-full">
                <h2 className="text-xl font-semibold mb-6">Preview</h2>
                <div className="space-y-10">
                  
                  {/* Color Preview Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Color System Preview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ColorCard name="Primary" hex={designSystem?.colors.primary || "#0000ff"} />
                      <ColorCard name="Background" hex={designSystem?.colors.background || "#ffffff"} />
                      <ColorCard name="Foreground" hex={designSystem?.colors.foreground || "#000000"} />
                      <ColorCard name="Muted" hex={designSystem?.colors.muted || "#f1f5f9"} />
                      <ColorCard name="Accent" hex={designSystem?.colors.accent || "#f1f5f9"} />
                      <ColorCard name="Destructive" hex={designSystem?.colors.destructive || "#ef4444"} />
                    </div>
                  </div>
                  
                  {/* Buttons Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Buttons</h3>
                    <div className="grid gap-4">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="default">Default</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Destructive</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="default" size="sm">Small</Button>
                        <Button variant="default">Default</Button>
                        <Button variant="default" size="lg">Large</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline">
                          <ChevronRightIcon className="mr-2 h-4 w-4" /> Button with Icon
                        </Button>
                        <Button variant="default" disabled>
                          Disabled
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Badges Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Badges & Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Default</Badge>
                      <Badge variant="secondary">Secondary</Badge>
                      <Badge variant="outline">Outline</Badge>
                      <Badge variant="destructive">Destructive</Badge>
                    </div>
                  </div>

                  {/* Form Controls Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Form Controls</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor="example-input">Input Field</Label>
                          <Input id="example-input" placeholder="Enter text..." />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="example-switch" className="cursor-pointer">Toggle Switch</Label>
                          <Switch id="example-switch" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="example-select">Select Dropdown</Label>
                        <Select defaultValue="option1">
                          <SelectTrigger id="example-select">
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="option1">Option 1</SelectItem>
                            <SelectItem value="option2">Option 2</SelectItem>
                            <SelectItem value="option3">Option 3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Alerts Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Alerts & Messaging</h3>
                    <div className="space-y-4">
                      <Alert>
                        <InfoIcon className="h-4 w-4 mr-2" />
                        <AlertTitle>Information</AlertTitle>
                        <AlertDescription>
                          This is a neutral information alert.
                        </AlertDescription>
                      </Alert>
                      <Alert variant="destructive">
                        <XIcon className="h-4 w-4 mr-2" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                          This is a destructive error alert.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>

                  {/* Typography Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Typography</h3>
                    <div className="space-y-4">
                      <div>
                        <h1 className="text-4xl font-bold mb-2">Heading 1</h1>
                        <h2 className="text-3xl font-bold mb-2">Heading 2</h2>
                        <h3 className="text-2xl font-bold mb-2">Heading 3</h3>
                        <h4 className="text-xl font-bold mb-2">Heading 4</h4>
                        <h5 className="text-lg font-bold">Heading 5</h5>
                      </div>
                      <div>
                        <p className="mb-2">Regular paragraph text. The quick brown fox jumps over the lazy dog.</p>
                        <p className="text-sm mb-2">Small text for captions and secondary content.</p>
                        <p><strong>Bold text</strong> and <em>italic text</em> for emphasis.</p>
                      </div>
                    </div>
                  </div>

                  {/* Cards Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">Cards</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="p-4">
                        <h4 className="font-medium mb-2">Simple Card</h4>
                        <p className="text-sm text-muted-foreground">
                          Cards are used to group related content.
                        </p>
                      </Card>
                      <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-medium">Card with Actions</h4>
                          <Button variant="outline" size="sm">Action</Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          This card includes a button for interactive elements.
                        </p>
                      </Card>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
