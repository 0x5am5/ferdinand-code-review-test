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
import { generateSemanticTokens, type RawTokens, type SemanticTokens } from "./token-generator";
import { BrandAsset } from "@shared/schema";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
    neutralBase: z.string().regex(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/),
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
  // Generate semantic tokens from raw tokens
  const semanticTokens = generateSemanticTokens(formData as RawTokens);

  // Generate CSS custom properties from semantic tokens
  const cssVars = {
    // Typography
    '--font-family-heading': semanticTokens.typography.fontFamilyHeading,
    '--font-family-body': semanticTokens.typography.fontFamilyBody,
    '--font-size-h1': semanticTokens.typography.fontSizeH1,
    '--font-size-h2': semanticTokens.typography.fontSizeH2,
    '--font-size-body': semanticTokens.typography.fontSizeBody,
    '--line-height-heading': semanticTokens.typography.lineHeightHeading,
    '--line-height-body': semanticTokens.typography.lineHeightBody,

    // Colors
    '--color-brand-primary': semanticTokens.colors.brandPrimary,
    '--color-brand-secondary': semanticTokens.colors.brandSecondary,
    '--color-text-heading': semanticTokens.colors.textHeading,
    '--color-text-body': semanticTokens.colors.textBody,
    '--color-text-link': semanticTokens.colors.textLink,
    '--color-background-page': semanticTokens.colors.backgroundPage,
    '--color-background-surface': semanticTokens.colors.backgroundSurface,
    '--color-button-primary-bg': semanticTokens.colors.buttonPrimaryBg,
    '--color-button-primary-text': semanticTokens.colors.buttonPrimaryText,
    '--color-success': semanticTokens.colors.successDark,
    '--color-error': semanticTokens.colors.errorDark,

    // Spacing
    '--spacing-s': semanticTokens.spacing.s,
    '--spacing-m': semanticTokens.spacing.m,
    '--spacing-l': semanticTokens.spacing.l,
    '--spacing-xl': semanticTokens.spacing.xl,

    // Borders & Radius
    '--border-radius-button': semanticTokens.borders.radiusButton,
    '--border-radius-card': semanticTokens.borders.radiusCard,

    // Shadows
    '--elevation-card': semanticTokens.shadows.elevationCard,
    '--elevation-button-hover': semanticTokens.shadows.elevationButtonHover,

    // Transitions
    '--transition-button': semanticTokens.transitions.button,
  } as React.CSSProperties;

  return (
    <div className="space-y-6">
      {/* Main Preview */}
      <div className="p-6 border rounded-lg" style={{...cssVars, backgroundColor: 'var(--color-background-page)'}}>
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
            <a href="#" style={{ color: 'var(--color-text-link)' }}>Home</a>
            <a href="#" style={{ color: 'var(--color-text-body)' }}>About</a>
            <a href="#" style={{ color: 'var(--color-text-body)' }}>Contact</a>
          </nav>
        </header>

        {/* Typography Showcase */}
        <section className="space-y-4 mt-6">
          <h1 
            style={{ 
              fontSize: 'var(--font-size-h1)',
              fontFamily: 'var(--font-family-heading)',
              lineHeight: 'var(--line-height-heading)',
              color: 'var(--color-text-heading)',
              margin: 'var(--spacing-l) 0 var(--spacing-m) 0'
            }}
          >
            Welcome to Our Brand
          </h1>

          <h2 
            style={{ 
              fontSize: 'var(--font-size-h2)',
              fontFamily: 'var(--font-family-heading)',
              color: 'var(--color-text-heading)',
              margin: 'var(--spacing-m) 0'
            }}
          >
            Design System Preview
          </h2>

          <p 
            style={{ 
              fontSize: 'var(--font-size-body)',
              fontFamily: 'var(--font-family-body)',
              lineHeight: 'var(--line-height-body)',
              color: 'var(--color-text-body)',
              margin: 'var(--spacing-m) 0'
            }}
          >
            This comprehensive preview shows your design system tokens in action. Typography scales, semantic colors, 
            and spacing relationships are automatically generated from your base token definitions.
          </p>
        </section>

        {/* Interactive Elements */}
        <section className="space-y-4 mt-6">
          <h3 
            style={{ 
              fontSize: 'var(--font-size-h2)',
              fontFamily: 'var(--font-family-heading)',
              color: 'var(--color-text-heading)'
            }}
          >
            Interactive Components
          </h3>

          <div className="flex flex-wrap gap-4">
            <button 
              style={{ 
                backgroundColor: 'var(--color-button-primary-bg)',
                color: 'var(--color-button-primary-text)',
                padding: 'var(--spacing-s) var(--spacing-m)',
                borderRadius: 'var(--border-radius-button)',
                border: 'none',
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-size-body)',
                cursor: 'pointer',
                transition: 'var(--transition-button)',
                boxShadow: 'var(--elevation-card)'
              }}
            >
              Primary Button
            </button>

            <button 
              style={{ 
                backgroundColor: 'transparent',
                color: 'var(--color-brand-primary)',
                padding: 'var(--spacing-s) var(--spacing-m)',
                borderRadius: 'var(--border-radius-button)',
                border: `2px solid var(--color-brand-primary)`,
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-size-body)',
                cursor: 'pointer',
                transition: 'var(--transition-button)'
              }}
            >
              Secondary Button
            </button>

            <button 
              style={{ 
                backgroundColor: 'var(--color-success)',
                color: 'white',
                padding: 'var(--spacing-s) var(--spacing-m)',
                borderRadius: 'var(--border-radius-button)',
                border: 'none',
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-size-body)',
                cursor: 'pointer'
              }}
            >
              Success Button
            </button>

            <button 
              style={{ 
                backgroundColor: 'var(--color-error)',
                color: 'white',
                padding: 'var(--spacing-s) var(--spacing-m)',
                borderRadius: 'var(--border-radius-button)',
                border: 'none',
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-size-body)',
                cursor: 'pointer'
              }}
            >
              Error Button
            </button>
          </div>
        </section>

        {/* Form Elements */}
        <section className="space-y-4 mt-6">
          <h3 
            style={{ 
              fontSize: 'var(--font-size-h2)',
              fontFamily: 'var(--font-family-heading)',
              color: 'var(--color-text-heading)'
            }}
          >
            Form Elements
          </h3>

          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Example input field"
              style={{ 
                padding: 'var(--spacing-s)',
                borderRadius: 'var(--border-radius-button)',
                border: '1px solid #e5e7eb',
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-size-body)',
                width: '100%',
                maxWidth: '300px'
              }}
            />

            <textarea 
              placeholder="Example textarea"
              style={{ 
                padding: 'var(--spacing-s)',
                borderRadius: 'var(--border-radius-button)',
                border: '1px solid #e5e7eb',
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-size-body)',
                width: '100%',
                maxWidth: '300px',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>
        </section>

        {/* Card Examples */}
        <section className="space-y-4 mt-6">
          <h3 
            style={{ 
              fontSize: 'var(--font-size-h2)',
              fontFamily: 'var(--font-family-heading)',
              color: 'var(--color-text-heading)'
            }}
          >
            Card Components
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              style={{ 
                padding: 'var(--spacing-l)',
                borderRadius: 'var(--border-radius-card)',
                backgroundColor: 'var(--color-background-surface)',
                boxShadow: 'var(--elevation-card)',
                border: '1px solid #e5e7eb'
              }}
            >
              <h4 
                style={{ 
                  fontSize: 'var(--font-size-body)',
                  fontFamily: 'var(--font-family-heading)',
                  color: 'var(--color-text-heading)',
                  margin: '0 0 var(--spacing-s) 0',
                  fontWeight: '600'
                }}
              >
                Card Title
              </h4>
              <p 
                style={{ 
                  fontSize: 'var(--font-size-body)',
                  fontFamily: 'var(--font-family-body)',
                  lineHeight: 'var(--line-height-body)',
                  color: 'var(--color-text-body)',
                  margin: '0'
                }}
              >
                This card demonstrates how spacing, typography, and elevation tokens work together.
              </p>
            </div>

            <div 
              style={{ 
                padding: 'var(--spacing-l)',
                borderRadius: 'var(--border-radius-card)',
                backgroundColor: 'var(--color-background-surface)',
                boxShadow: 'var(--elevation-card)',
                border: '1px solid #e5e7eb'
              }}
            >
              <h4 
                style={{ 
                  fontSize: 'var(--font-size-body)',
                  fontFamily: 'var(--font-family-heading)',
                  color: 'var(--color-text-heading)',
                  margin: '0 0 var(--spacing-s) 0',
                  fontWeight: '600'
                }}
              >
                Second Card
              </h4>
              <p 
                style={{ 
                  fontSize: 'var(--font-size-body)',
                  fontFamily: 'var(--font-family-body)',
                  lineHeight: 'var(--line-height-body)',
                  color: 'var(--color-text-body)',
                  margin: '0'
                }}
              >
                Multiple cards show consistency across your design system implementation.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Neutral Color Scale Visualization */}
      <div className="p-4 border rounded-lg bg-white">
        <h4 className="text-sm font-medium mb-3">Generated Neutral Color Scale</h4>
        <div className="flex flex-wrap gap-2">
          {[0,1,2,3,4,5,6,7,8,9,10].map(step => (
            <div key={step} className="text-center">
              <div 
                className="w-8 h-8 rounded border border-gray-200"
                style={{ backgroundColor: semanticTokens.colors[`neutral${step}` as keyof typeof semanticTokens.colors] }}
              />
              <span className="text-xs text-gray-600 mt-1 block">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Brand Color Variations */}
      <div className="p-4 border rounded-lg bg-white">
        <h4 className="text-sm font-medium mb-3">Brand Color Variations</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs w-20">Primary:</span>
            <div className="flex gap-1">
              {['brandPrimaryXLight', 'brandPrimaryLight', 'brandPrimary', 'brandPrimaryDark', 'brandPrimaryXDark'].map(variant => (
                <div 
                  key={variant}
                  className="w-6 h-6 rounded border border-gray-200"
                  style={{ backgroundColor: semanticTokens.colors[variant as keyof typeof semanticTokens.colors] }}
                  title={variant}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs w-20">Secondary:</span>
            <div className="flex gap-1">
              {['brandSecondaryXLight', 'brandSecondaryLight', 'brandSecondary', 'brandSecondaryDark', 'brandSecondaryXDark'].map(variant => (
                <div 
                  key={variant}
                  className="w-6 h-6 rounded border border-gray-200"
                  style={{ backgroundColor: semanticTokens.colors[variant as keyof typeof semanticTokens.colors] }}
                  title={variant}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Typography Scale */}
      <div className="p-4 border rounded-lg bg-white" style={cssVars}>
        <h4 className="text-sm font-medium mb-3">Generated Typography Scale</h4>
        <div className="space-y-2">
          {[
            { label: 'H1', value: 'var(--font-size-h1)' },
            { label: 'H2', value: 'var(--font-size-h2)' },
            { label: 'Body', value: 'var(--font-size-body)' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-4">
              <span className="text-xs w-8">{label}:</span>
              <span 
                style={{ 
                  fontSize: value,
                  fontFamily: 'var(--font-family-heading)',
                  lineHeight: 1
                }}
              >
                Sample Text ({value})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper function to parse color assets
const parseColorAsset = (asset: BrandAsset) => {
  try {
    const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
    if (!data?.colors?.[0]) return null;

    return {
      id: asset.id,
      hex: data.colors[0].hex,
      name: asset.name,
      category: data.category,
    };
  } catch (error) {
    console.error("Error parsing color asset:", error);
    return null;
  }
};

export default function DesignSystemBuilder({ clientId }: DesignSystemBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("colors");

  // Fetch client assets to get the logo for preview and colors
  const { data: clientAssets = [] } = useClientAssetsById(clientId);
  const logoAsset = clientAssets.find(asset => asset.category === "logo");
  const clientLogo = logoAsset ? `/api/assets/${logoAsset.id}/file` : undefined;

  // Parse existing colors from the color system
  const existingColors = clientAssets
    .filter((asset) => asset.category === "color")
    .map(parseColorAsset)
    .filter((color): color is NonNullable<typeof color> => color !== null);

  const brandColors = existingColors.filter(c => c.category === "brand");
  const neutralColors = existingColors.filter(c => c.category === "neutral");
  const interactiveColors = existingColors.filter(c => c.category === "interactive");

  // Default form values - use existing brand colors if available
  const getDefaultColors = () => {
    const primary = brandColors.find(c => c.name.toLowerCase().includes('primary')) || brandColors[0];
    const secondary = brandColors.find(c => c.name.toLowerCase().includes('secondary')) || brandColors[1];
    const neutral = neutralColors.find(c => c.name.toLowerCase().includes('base') || c.name.toLowerCase().includes('grey')) || neutralColors[0];

    // Find interactive colors by name
    const success = interactiveColors.find(c => c.name.toLowerCase().includes('success'));
    const warning = interactiveColors.find(c => c.name.toLowerCase().includes('warning'));
    const error = interactiveColors.find(c => c.name.toLowerCase().includes('error'));
    const info = interactiveColors.find(c => c.name.toLowerCase().includes('link') || c.name.toLowerCase().includes('info'));

    return {
      brandPrimaryBase: primary?.hex || '#0052CC',
      brandSecondaryBase: secondary?.hex || '#172B4D',
      neutralBase: neutral?.hex ? `hsl(0, 0%, ${Math.round((parseInt(neutral.hex.slice(1), 16) / 16777215) * 100)}%)` : 'hsl(0, 0%, 60%)',
      interactiveSuccessBase: success?.hex || '#28a745',
      interactiveWarningBase: warning?.hex || '#ffc107',
      interactiveErrorBase: error?.hex || '#dc3545',
      interactiveInfoBase: info?.hex || '#17a2b8',
    };
  };

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
    colors: getDefaultColors(),
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

  // Update form values when existing colors change
  useEffect(() => {
    if (existingColors.length > 0) {
      const newColors = getDefaultColors();
      form.setValue('colors', newColors);
    }
  }, [existingColors.length, form]);

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

      <div className="asset-display">
        <div className="asset-display__info relative">
          <div className="space-y-6">
            <Form {...form}>
              {/* Replacing Tabs with Accordion */}
              <Accordion type="single" collapsible>
                <AccordionItem value="colors">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline py-4 px-0">
                    <div className="flex items-center">
                      <Palette className="h-4 w-4 mr-2" />
                      Colors
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Brand Colors</h4>
                        <p className="text-sm text-muted-foreground">
                          Define your primary brand color palette
                          {brandColors.length > 0 && (
                            <span className="block text-sm text-muted-foreground mt-1">
                              ✓ Inherited {brandColors.length} color(s) from your Color System
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Interactive Colors</h4>
                        <p className="text-sm text-muted-foreground">
                          Colors for interactive elements and states
                          {interactiveColors.length > 0 && (
                            <span className="block text-sm text-muted-foreground mt-1">
                              ✓ Inherited {interactiveColors.length} color(s) from your Color System
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="typography">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline py-4 px-0">
                    <div className="flex items-center">
                      <Type className="h-4 w-4 mr-2" />
                      Typography
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Font Families</h4>
                        <p className="text-sm text-muted-foreground">Define your typography system</p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Type Scale</h4>
                        <p className="text-sm text-muted-foreground">Configure font sizing and spacing</p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="spacing">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline py-4 px-0">
                    <div className="flex items-center">
                      <Grid3X3 className="h-4 w-4 mr-2" />
                      Spacing
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Spacing System</h4>
                        <p className="text-sm text-muted-foreground">Define your spacing and layout tokens</p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="borders">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline py-4 px-0">
                    <div className="flex items-center">
                      Borders
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Borders & Radius</h4>
                        <p className="text-sm text-muted-foreground">Configure border and radius tokens</p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="components">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline py-4 px-0">
                    <div className="flex items-center">
                      Components
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Button Components</h4>
                        <p className="text-sm text-muted-foreground">Link button properties to existing design tokens</p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Input Components</h4>
                        <p className="text-sm text-muted-foreground">Configure form input styling</p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-base font-semibold">Card Components</h4>
                        <p className="text-sm text-muted-foreground">Configure card styling</p>
                      </div>
                      <div className="space-y-4">
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
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Form>
          </div>
        </div>

        <div className="asset-display__preview sticky">
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
    </div>
  );
}