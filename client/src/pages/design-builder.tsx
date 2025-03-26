
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { InfoIcon, CheckIcon, XIcon } from "lucide-react";

export default function DesignBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("theme");
  const { designSystem, updateDesignSystem, isLoading } = useTheme();
  
  const handleThemeChange = (key: string, value: any) => {
    const newDesignSystem = { 
      ...designSystem,
      theme: {
        ...designSystem.theme,
        [key]: value
      }
    };
    
    updateDesignSystem(newDesignSystem);
    toast({
      title: "Theme updated",
      description: `Updated ${key} to ${value}`
    });
  };
  
  const handleColorChange = (key: string, value: string) => {
    const newDesignSystem = { 
      ...designSystem,
      colors: {
        ...designSystem.colors,
        [key]: value
      }
    };
    
    updateDesignSystem(newDesignSystem);
    toast({
      title: "Color updated",
      description: `Updated ${key} color`
    });
  };
  
  const handleTypographyChange = (key: string, value: string) => {
    const newDesignSystem = { 
      ...designSystem,
      typography: {
        ...designSystem.typography,
        [key]: value
      }
    };
    
    updateDesignSystem(newDesignSystem);
    toast({
      title: "Typography updated",
      description: `Updated ${key} font`
    });
  };

  const handleSaveChanges = () => {
    updateDesignSystem(designSystem);
    toast({
      title: "Design system saved",
      description: "All your design system changes have been applied"
    });
  };

  if (isLoading) {
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
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-2">Design Builder</h1>
              <p className="text-muted-foreground">
                Control the overall design system of your application
              </p>
            </div>
            <Button onClick={handleSaveChanges}>
              Save Changes
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="colors">Color System</TabsTrigger>
            </TabsList>

            <TabsContent value="theme">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Theme Settings</h2>
                <div className="grid gap-8">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="variant">Theme Variant</Label>
                      <Select 
                        value={designSystem?.theme.variant} 
                        onValueChange={(value) => handleThemeChange('variant', value)}
                      >
                        <SelectTrigger id="variant" className="w-full max-w-xs">
                          <SelectValue placeholder="Select variant" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="tint">Tint</SelectItem>
                          <SelectItem value="vibrant">Vibrant</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-1">
                        Determines the overall look and feel of the UI
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="appearance">Appearance Mode</Label>
                      <Select 
                        value={designSystem?.theme.appearance} 
                        onValueChange={(value) => handleThemeChange('appearance', value as 'light' | 'dark' | 'system')}
                      >
                        <SelectTrigger id="appearance" className="w-full max-w-xs">
                          <SelectValue placeholder="Select appearance" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-1">
                        Controls light/dark mode
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="primary-color">Primary Color</Label>
                      <div className="max-w-xs mt-1">
                        <ColorPicker
                          value={designSystem?.theme.primary || '#0000ff'}
                          onChange={(value) => handleThemeChange('primary', value)}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Main brand color used throughout the UI
                      </p>
                    </div>

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
                        <SelectTrigger id="animation" className="w-full max-w-xs">
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

                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4">Component Preview</h3>
                    <div className="border rounded-lg p-6 bg-card">
                      <div className="grid gap-8">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <h4 className="font-medium">Buttons</h4>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="default">Default</Button>
                              <Button variant="secondary">Secondary</Button>
                              <Button variant="outline">Outline</Button>
                              <Button variant="ghost">Ghost</Button>
                              <Button variant="destructive">Destructive</Button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-medium">Badges</h4>
                            <div className="flex flex-wrap gap-2">
                              <Badge>Default</Badge>
                              <Badge variant="secondary">Secondary</Badge>
                              <Badge variant="outline">Outline</Badge>
                              <Badge variant="destructive">Destructive</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <h4 className="font-medium">Form Controls</h4>
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 items-center gap-4">
                                <Label htmlFor="example-input">Input Field</Label>
                                <Input id="example-input" placeholder="Enter text..." />
                              </div>
                              <div className="grid grid-cols-2 items-center gap-4">
                                <Label htmlFor="example-switch">Switch</Label>
                                <Switch id="example-switch" />
                              </div>
                              <div className="grid grid-cols-2 items-center gap-4">
                                <Label htmlFor="example-select">Select</Label>
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

                          <div className="space-y-4">
                            <h4 className="font-medium">Alerts</h4>
                            <div className="space-y-2">
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
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="typography">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Typography Settings</h2>
                <div className="grid gap-8">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="primary-font">Primary Font</Label>
                      <Input 
                        id="primary-font"
                        value={designSystem?.typography.primary} 
                        onChange={(e) => handleTypographyChange('primary', e.target.value)}
                        className="max-w-xs mt-1"
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
                        className="max-w-xs mt-1"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Font used for headings
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Typography Preview</h3>
                    <div className="grid gap-6">
                      <TypographyCard 
                        name="Primary Font"
                        family={designSystem?.typography.primary || "System UI"}
                        weights={["400", "700"]}
                        specimen="The quick brown fox jumps over the lazy dog."
                        url=""
                      />
                      <TypographyCard 
                        name="Heading Font"
                        family={designSystem?.typography.heading || "System UI"}
                        weights={["400", "700"]}
                        specimen="The quick brown fox jumps over the lazy dog."
                        url=""
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="colors">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Color System</h2>
                <div className="grid gap-6">
                  <div className="grid gap-4">
                    <h3 className="font-medium">Base Colors</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {designSystem && Object.entries(designSystem.colors).map(([key, color]) => (
                        <div key={key} className="space-y-2">
                          <Label className="capitalize">{key.replace('-', ' ')}</Label>
                          <ColorPicker
                            value={color}
                            onChange={(value) => handleColorChange(key, value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="font-medium mb-4">Color Preview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <ColorCard name="Primary" hex={designSystem?.colors.primary || "#0000ff"} />
                      <ColorCard name="Background" hex={designSystem?.colors.background || "#ffffff"} />
                      <ColorCard name="Foreground" hex={designSystem?.colors.foreground || "#000000"} />
                      <ColorCard name="Muted" hex={designSystem?.colors.muted || "#f1f5f9"} />
                      <ColorCard name="Accent" hex={designSystem?.colors.accent || "#f1f5f9"} />
                      <ColorCard name="Destructive" hex={designSystem?.colors.destructive || "#ef4444"} />
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
