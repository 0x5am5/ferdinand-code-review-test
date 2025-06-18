import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Palette, Type, Grid3X3, Download, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientAssetsById } from "@/lib/queries/clients";

// Design System Schema
const designSystemSchema = z.object({
  // Typography Raw Tokens
  typography: z.object({
    fontSizeBase: z.number().min(0.5).max(2),
    lineHeightBase: z.number().min(1).max(3),
    typeScaleBase: z.number().min(1.1).max(2),
    letterSpacingBase: z.number().min(-0.1).max(0.5),
    fontFamily1Base: z.string().min(1),
    fontFamily2Base: z.string().min(1),
    fontFamilyMonoBase: z.string().min(1),
  }),
  
  // Color Raw Tokens
  colors: z.object({
    brandPrimaryBase: z.string().regex(/^#[0-9A-F]{6}$/i),
    brandSecondaryBase: z.string().regex(/^#[0-9A-F]{6}$/i),
    neutralBase: z.string(),
    interactiveSuccessBase: z.string().regex(/^#[0-9A-F]{6}$/i),
    interactiveWarningBase: z.string().regex(/^#[0-9A-F]{6}$/i),
    interactiveErrorBase: z.string().regex(/^#[0-9A-F]{6}$/i),
    interactiveInfoBase: z.string().regex(/^#[0-9A-F]{6}$/i),
  }),
  
  // Spacing Raw Tokens
  spacing: z.object({
    spacingUnitBase: z.number().min(0.25).max(2),
    spacingScaleBase: z.number().min(1.1).max(2),
  }),
  
  // Border & Radius Raw Tokens
  borders: z.object({
    borderWidthBase: z.number().min(1).max(8),
    borderRadiusBase: z.number().min(0).max(50),
  }),
  
  // Component Properties (Basic)
  components: z.object({
    button: z.object({
      primaryBackgroundColor: z.string(),
      primaryTextColor: z.string(),
      secondaryBackgroundColor: z.string(),
      secondaryTextColor: z.string(),
      borderRadius: z.string(),
    }),
    input: z.object({
      backgroundColor: z.string(),
      borderColor: z.string(),
      textColor: z.string(),
      borderRadius: z.string(),
    }),
    card: z.object({
      backgroundColor: z.string(),
      borderColor: z.string(),
      borderRadius: z.string(),
    }),
  }),
});

type DesignSystemForm = z.infer<typeof designSystemSchema>;

interface DesignSystemBuilderProps {
  clientId: number;
}

const DesignSystemPreview = ({ formData, clientLogo }: { formData: DesignSystemForm; clientLogo?: string }) => {
  // Generate CSS custom properties from form data
  const cssVars = {
    '--font-size-base': `${formData.typography.fontSizeBase}rem`,
    '--line-height-base': formData.typography.lineHeightBase,
    '--type-scale': formData.typography.typeScaleBase,
    '--font-family-primary': formData.typography.fontFamily1Base,
    '--font-family-secondary': formData.typography.fontFamily2Base,
    '--color-brand-primary': formData.colors.brandPrimaryBase,
    '--color-brand-secondary': formData.colors.brandSecondaryBase,
    '--color-success': formData.colors.interactiveSuccessBase,
    '--color-error': formData.colors.interactiveErrorBase,
    '--spacing-base': `${formData.spacing.spacingUnitBase}rem`,
    '--border-radius': `${formData.borders.borderRadiusBase}px`,
  } as React.CSSProperties;

  return (
    <div className="space-y-6 p-6 border rounded-lg bg-white" style={cssVars}>
      {/* Header with Logo */}
      <header className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--color-brand-primary)' }}>
        {clientLogo && (
          <img 
            src={clientLogo} 
            alt="Client Logo" 
            className="h-12 w-auto object-contain"
          />
        )}
        <nav className="flex space-x-4">
          <a href="#" style={{ color: 'var(--color-brand-primary)' }}>Home</a>
          <a href="#" style={{ color: 'var(--color-brand-secondary)' }}>About</a>
          <a href="#" style={{ color: 'var(--color-brand-secondary)' }}>Contact</a>
        </nav>
      </header>

      {/* Typography Showcase */}
      <section className="space-y-4">
        <h1 
          style={{ 
            fontSize: `calc(var(--font-size-base) * var(--type-scale) * var(--type-scale) * var(--type-scale))`,
            fontFamily: 'var(--font-family-primary)',
            lineHeight: 'var(--line-height-base)',
            color: 'var(--color-brand-secondary)',
            margin: `var(--spacing-base) 0`
          }}
        >
          Welcome to Our Brand
        </h1>
        
        <h2 
          style={{ 
            fontSize: `calc(var(--font-size-base) * var(--type-scale) * var(--type-scale))`,
            fontFamily: 'var(--font-family-primary)',
            color: 'var(--color-brand-secondary)',
            margin: `calc(var(--spacing-base) * 0.75) 0`
          }}
        >
          Design System Preview
        </h2>
        
        <p 
          style={{ 
            fontSize: 'var(--font-size-base)',
            fontFamily: 'var(--font-family-secondary)',
            lineHeight: 'var(--line-height-base)',
            margin: `var(--spacing-base) 0`
          }}
        >
          This is a preview of how your design system tokens will look when applied to content. 
          Typography, colors, spacing, and other design elements are automatically generated 
          from your token definitions.
        </p>
      </section>

      {/* Button Examples */}
      <section className="space-y-4">
        <h3 
          style={{ 
            fontSize: `calc(var(--font-size-base) * var(--type-scale))`,
            fontFamily: 'var(--font-family-primary)',
            color: 'var(--color-brand-secondary)'
          }}
        >
          Interactive Elements
        </h3>
        
        <div className="flex space-x-4">
          <button 
            style={{ 
              backgroundColor: 'var(--color-brand-primary)',
              color: 'white',
              padding: `calc(var(--spacing-base) * 0.5) var(--spacing-base)`,
              borderRadius: 'var(--border-radius)',
              border: 'none',
              fontFamily: 'var(--font-family-secondary)',
              fontSize: 'var(--font-size-base)',
              cursor: 'pointer'
            }}
          >
            Primary Button
          </button>
          
          <button 
            style={{ 
              backgroundColor: 'transparent',
              color: 'var(--color-brand-primary)',
              padding: `calc(var(--spacing-base) * 0.5) var(--spacing-base)`,
              borderRadius: 'var(--border-radius)',
              border: `2px solid var(--color-brand-primary)`,
              fontFamily: 'var(--font-family-secondary)',
              fontSize: 'var(--font-size-base)',
              cursor: 'pointer'
            }}
          >
            Secondary Button
          </button>
          
          <button 
            style={{ 
              backgroundColor: 'var(--color-success)',
              color: 'white',
              padding: `calc(var(--spacing-base) * 0.5) var(--spacing-base)`,
              borderRadius: 'var(--border-radius)',
              border: 'none',
              fontFamily: 'var(--font-family-secondary)',
              fontSize: 'var(--font-size-base)',
              cursor: 'pointer'
            }}
          >
            Success Button
          </button>
        </div>
      </section>

      {/* Card Example */}
      <section>
        <div 
          style={{ 
            padding: `calc(var(--spacing-base) * 1.5)`,
            borderRadius: 'var(--border-radius)',
            border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}
        >
          <h4 
            style={{ 
              fontSize: `calc(var(--font-size-base) * var(--type-scale))`,
              fontFamily: 'var(--font-family-primary)',
              color: 'var(--color-brand-secondary)',
              margin: `0 0 var(--spacing-base) 0`
            }}
          >
            Card Component
          </h4>
          <p 
            style={{ 
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family-secondary)',
              lineHeight: 'var(--line-height-base)',
              margin: '0'
            }}
          >
            This card demonstrates how spacing and typography tokens work together to create consistent layouts.
          </p>
        </div>
      </section>
    </div>
  );
};

export default function DesignSystemBuilder({ clientId }: DesignSystemBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("colors");

  // Fetch client assets to get the logo for preview
  const { data: clientAssets = [] } = useClientAssetsById(clientId);
  const logoAsset = clientAssets.find(asset => asset.category === "logo");
  const clientLogo = logoAsset ? `/api/assets/${logoAsset.id}/file` : undefined;

  // Default form values based on provided raw tokens
  const defaultValues: DesignSystemForm = {
    typography: {
      fontSizeBase: 1,
      lineHeightBase: 1.4,
      typeScaleBase: 1.4,
      letterSpacingBase: 0,
      fontFamily1Base: 'Rock Grotesque',
      fontFamily2Base: 'Rock Grotesque Wide',
      fontFamilyMonoBase: 'monospace',
    },
    colors: {
      brandPrimaryBase: '#0052CC',
      brandSecondaryBase: '#172B4D',
      neutralBase: 'hsl(0, 0%, 60%)',
      interactiveSuccessBase: '#28a745',
      interactiveWarningBase: '#ffc107',
      interactiveErrorBase: '#dc3545',
      interactiveInfoBase: '#17a2b8',
    },
    spacing: {
      spacingUnitBase: 1,
      spacingScaleBase: 1.5,
    },
    borders: {
      borderWidthBase: 1,
      borderRadiusBase: 8,
    },
    components: {
      button: {
        primaryBackgroundColor: 'brandPrimaryBase',
        primaryTextColor: '#ffffff',
        secondaryBackgroundColor: 'transparent',
        secondaryTextColor: 'brandPrimaryBase',
        borderRadius: 'borderRadiusBase',
      },
      input: {
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        textColor: '#374151',
        borderRadius: 'borderRadiusBase',
      },
      card: {
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        borderRadius: 'borderRadiusBase',
      },
    },
  };

  const form = useForm<DesignSystemForm>({
    resolver: zodResolver(designSystemSchema),
    defaultValues,
  });

  const formData = form.watch();

  // Fetch existing design system
  const { data: existingDesignSystem } = useQuery({
    queryKey: ["/api/design-system", clientId],
    enabled: !!clientId,
  });

  // Save design system mutation
  const saveDesignSystemMutation = useMutation({
    mutationFn: async (data: DesignSystemForm) => {
      const response = await fetch("/api/design-system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          raw_tokens: data,
        }),
      });
      if (!response.ok) throw new Error("Failed to save design system");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/design-system", clientId] });
      toast({
        title: "Design system saved",
        description: "Your design system tokens have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export functions using backend endpoints
  const exportAsCSS = useCallback(() => {
    window.open(`/api/design-system/export/css/${clientId}`, '_blank');
  }, [clientId]);

  const exportAsSCSS = useCallback(() => {
    window.open(`/api/design-system/export/scss/${clientId}`, '_blank');
  }, [clientId]);

  const exportAsTailwind = useCallback(() => {
    window.open(`/api/design-system/export/tailwind/${clientId}`, '_blank');
  }, [clientId]);

  const handleSave = () => {
    const data = form.getValues();
    saveDesignSystemMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Code-Based Design System Builder</h3>
          <p className="text-sm text-muted-foreground">
            Define and manage your brand's design tokens with real-time preview
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={handleSave} disabled={saveDesignSystemMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveDesignSystemMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Select onValueChange={(value) => {
            if (value === 'css') exportAsCSS();
            else if (value === 'scss') exportAsSCSS();
            else if (value === 'tailwind') exportAsTailwind();
          }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Export">
                <Download className="h-4 w-4 mr-2" />
                Export
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="css">CSS Variables</SelectItem>
              <SelectItem value="scss">SCSS Variables</SelectItem>
              <SelectItem value="tailwind">Tailwind Config</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <div className="space-y-6">
          <Form {...form}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="colors">
                  <Palette className="h-4 w-4 mr-2" />
                  Colors
                </TabsTrigger>
                <TabsTrigger value="typography">
                  <Type className="h-4 w-4 mr-2" />
                  Typography
                </TabsTrigger>
                <TabsTrigger value="spacing">
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Spacing
                </TabsTrigger>
                <TabsTrigger value="borders">Borders</TabsTrigger>
                <TabsTrigger value="components">Components</TabsTrigger>
              </TabsList>

              <TabsContent value="colors" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Brand Colors</CardTitle>
                    <CardDescription>Define your primary brand color palette</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="colors.brandPrimaryBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="colors.brandSecondaryBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Interactive Colors</CardTitle>
                    <CardDescription>Colors for interactive elements and states</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="colors.interactiveSuccessBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Success</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="colors.interactiveErrorBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Error</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="colors.interactiveWarningBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Warning</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="colors.interactiveInfoBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Info</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="typography" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Font Families</CardTitle>
                    <CardDescription>Define your typography system</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="typography.fontFamily1Base"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Font Family</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Rock Grotesque" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="typography.fontFamily2Base"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Font Family</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Rock Grotesque Wide" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="typography.fontFamilyMonoBase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monospace Font Family</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="monospace" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Type Scale</CardTitle>
                    <CardDescription>Configure font sizing and spacing</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="typography.fontSizeBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Font Size (rem)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.1" 
                                min="0.5" 
                                max="2" 
                                {...field} 
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="typography.typeScaleBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type Scale Ratio</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.1" 
                                min="1.1" 
                                max="2" 
                                {...field} 
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="typography.lineHeightBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Line Height</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.1" 
                                min="1" 
                                max="3" 
                                {...field} 
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="typography.letterSpacingBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Letter Spacing</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="-0.1" 
                                max="0.5" 
                                {...field} 
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="spacing" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Spacing System</CardTitle>
                    <CardDescription>Define your spacing and layout tokens</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="spacing.spacingUnitBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Spacing Unit (rem)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.25" 
                                min="0.25" 
                                max="2" 
                                {...field} 
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="spacing.spacingScaleBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Spacing Scale Ratio</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.1" 
                                min="1.1" 
                                max="2" 
                                {...field} 
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="borders" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Borders & Radius</CardTitle>
                    <CardDescription>Configure border and radius tokens</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="borders.borderWidthBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Border Width (px)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1" 
                                max="8" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="borders.borderRadiusBase"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Border Radius (px)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                max="50" 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="components" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Button Components</CardTitle>
                    <CardDescription>Link button properties to existing design tokens</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="components.button.primaryBackgroundColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Button Background</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select token" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="brandPrimaryBase">Brand Primary</SelectItem>
                                  <SelectItem value="brandSecondaryBase">Brand Secondary</SelectItem>
                                  <SelectItem value="interactiveSuccessBase">Success</SelectItem>
                                  <SelectItem value="interactiveErrorBase">Error</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="components.button.primaryTextColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Button Text</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Input Components</CardTitle>
                    <CardDescription>Configure form input styling</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="components.input.backgroundColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Input Background</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="components.input.borderColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Input Border</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Card Components</CardTitle>
                    <CardDescription>Configure card styling</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="components.card.backgroundColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Card Background</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="components.card.borderColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Card Border</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </Form>
        </div>

        {/* Preview Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Preview</CardTitle>
              <CardDescription>
                See how your design tokens look when applied to content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DesignSystemPreview formData={formData} clientLogo={clientLogo} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}