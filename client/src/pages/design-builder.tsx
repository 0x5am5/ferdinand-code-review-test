
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { TypographyCard } from "@/components/brand/typography-card";
import { ColorCard } from "@/components/brand/color-card";

interface DesignSystem {
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

export default function DesignBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("theme");
  
  // Get current theme from theme.json
  const { data: designSystem, isLoading } = useQuery<DesignSystem>({
    queryKey: ["/api/design-system"],
    queryFn: async () => {
      // If endpoint doesn't exist yet, use default values from theme.json
      try {
        const response = await fetch("/api/design-system");
        if (!response.ok) throw new Error("Failed to fetch design system");
        return response.json();
      } catch (error) {
        // Fallback to default values
        return {
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
      }
    }
  });

  // Update design system
  const updateDesignSystem = useMutation({
    mutationFn: async (newData: Partial<DesignSystem>) => {
      // If endpoint doesn't exist yet, this would fail, but we'll add it
      const response = await fetch("/api/design-system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newData),
      });
      if (!response.ok) throw new Error("Failed to update design system");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Changes saved",
        description: "Your design system changes have been applied"
      });
    },
    onError: () => {
      toast({
        title: "Couldn't save changes",
        description: "The API endpoint for design system may not exist yet",
        variant: "destructive"
      });
    }
  });

  const handleThemeChange = (key: string, value: any) => {
    if (!designSystem) return;
    
    const newDesignSystem = { 
      ...designSystem,
      theme: {
        ...designSystem.theme,
        [key]: value
      }
    };
    
    updateDesignSystem.mutate(newDesignSystem);
  };
  
  const handleColorChange = (key: string, value: string) => {
    if (!designSystem) return;
    
    const newDesignSystem = { 
      ...designSystem,
      colors: {
        ...designSystem.colors,
        [key]: value
      }
    };
    
    updateDesignSystem.mutate(newDesignSystem);
  };
  
  const handleTypographyChange = (key: string, value: string) => {
    if (!designSystem) return;
    
    const newDesignSystem = { 
      ...designSystem,
      typography: {
        ...designSystem.typography,
        [key]: value
      }
    };
    
    updateDesignSystem.mutate(newDesignSystem);
  };

  const handleSaveChanges = () => {
    if (!designSystem) return;
    updateDesignSystem.mutate(designSystem);
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
            <Button onClick={handleSaveChanges} disabled={updateDesignSystem.isPending}>
              {updateDesignSystem.isPending ? "Saving..." : "Save Changes"}
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
