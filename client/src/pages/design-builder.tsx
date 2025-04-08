import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useThemeManager } from "@/hooks/use-theme-manager";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent, 
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useLocation } from "wouter";
import { Save, ArrowUpDown, Moon, Sun, Palette, Type, Check, Code } from "lucide-react";

// Form schema for validation
const themeFormSchema = z.object({
  variant: z.enum(['professional', 'tint', 'vibrant']),
  primary: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color"),
  secondary: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color").optional(),
  tertiary: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color").optional(),
  appearance: z.enum(['light', 'dark', 'system']),
  radius: z.number().min(0).max(2),
  animation: z.enum(['none', 'minimal', 'smooth', 'bounce'])
});

export default function DesignBuilder() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { 
    designSystem: appliedDesignSystem, 
    draftDesignSystem, 
    updateDraftDesignSystem,
    applyDraftChanges
  } = useThemeManager();

  // Define the designSystem variable to use throughout the component
  const designSystem = draftDesignSystem || appliedDesignSystem;

  // State for handling navigation confirmation
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);
  const [navTarget, setNavTarget] = useState("");
  const [activeTab, setActiveTab] = useState("theme");
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize the form with current theme values
  const form = useForm<z.infer<typeof themeFormSchema>>({
    resolver: zodResolver(themeFormSchema),
    defaultValues: {
      variant: designSystem.theme.variant,
      primary: designSystem.theme.primary,
      secondary: designSystem.theme.secondary || '#666666',
      tertiary: designSystem.theme.tertiary || '#444444',
      appearance: designSystem.theme.appearance,
      radius: designSystem.theme.radius,
      animation: designSystem.theme.animation
    }
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof themeFormSchema>) => {
    try {
      // Update the draft theme
      updateDraftDesignSystem({
        theme: values
      });

      setHasChanges(true);
      toast({
        title: "Changes applied to preview",
        description: "Your changes have been applied to the preview. Save to make them permanent.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "There was an error applying your changes.",
        variant: "destructive"
      });
    }
  };

  // Handle saving changes permanently
  const handleSaveChanges = async () => {
    try {
      await applyDraftChanges();
      setHasChanges(false);
      toast({
        title: "Changes saved",
        description: "Your design changes have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error saving changes",
        description: "There was an error saving your changes.",
        variant: "destructive"
      });
    }
  };

  const confirmNavigation = () => {
    setShowLeaveAlert(false);
    if (navTarget) {
      navigate(navTarget);
    }
  };

  // Color preview component
  const ColorPreview = ({ color }: { color: string | undefined }) => (
    <div 
      className="h-6 w-6 rounded-full inline-block mr-2 border border-border" 
      style={{ backgroundColor: color || '#cccccc' }}
    />
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Design Builder</h1>
          <p className="text-muted-foreground">Customize your application's design system</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button onClick={handleSaveChanges} variant="default">
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="theme">
            <Palette className="mr-2 h-4 w-4" />
            Theme
          </TabsTrigger>
          <TabsTrigger value="typography">
            <Type className="mr-2 h-4 w-4" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="preview">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="raw">
            <Code className="mr-2 h-4 w-4"/>
            Raw Variables
          </TabsTrigger>

        </TabsList>

        <TabsContent value="theme" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Theme Settings</CardTitle>
              <CardDescription>
                Customize the colors, appearance, and other theme settings using Material Design principles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="variant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Theme Variant</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a theme variant" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="tint">Tint</SelectItem>
                            <SelectItem value="vibrant">Vibrant</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Controls how colors are applied to UI elements:
                        </FormDescription>
                        <div className="mt-2">
                          <ul className="list-disc pl-5 text-xs space-y-1">
                            <li><strong>Professional:</strong> Subtle, balanced colors for corporate applications</li>
                            <li><strong>Tint:</strong> Gentle color tinting across the interface</li> 
                            <li><strong>Vibrant:</strong> High-contrast, full Material Design color system</li>
                          </ul>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Color</FormLabel>
                        <div className="flex items-center gap-2">
                          <ColorPreview color={field.value} />
                          <FormControl>
                            <Input {...field} type="color" className="w-10 h-10 p-1" />
                          </FormControl>
                          <FormControl>
                            <Input 
                              value={field.value} 
                              onChange={field.onChange}
                              className="w-32"
                            />
                          </FormControl>
                        </div>
                        <FormDescription>
                          The main brand color used throughout the application.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('variant') === 'vibrant' && (
                    <>
                      <FormField
                        control={form.control}
                        name="secondary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary Color</FormLabel>
                            <div className="flex items-center gap-2">
                              <ColorPreview color={field.value || '#666666'} />
                              <FormControl>
                                <Input {...field} type="color" className="w-10 h-10 p-1" />
                              </FormControl>
                              <FormControl>
                                <Input 
                                  value={field.value || '#666666'} 
                                  onChange={field.onChange}
                                  className="w-32"
                                />
                              </FormControl>
                            </div>
                            <FormDescription>
                              Secondary brand color for accents and complementary elements.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="tertiary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tertiary Color</FormLabel>
                            <div className="flex items-center gap-2">
                              <ColorPreview color={field.value || '#444444'} />
                              <FormControl>
                                <Input {...field} type="color" className="w-10 h-10 p-1" />
                              </FormControl>
                              <FormControl>
                                <Input 
                                  value={field.value || '#444444'} 
                                  onChange={field.onChange}
                                  className="w-32"
                                />
                              </FormControl>
                            </div>
                            <FormDescription>
                              Tertiary color for additional UI accents and visual hierarchy.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="appearance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appearance</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an appearance" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="light">
                              <div className="flex items-center">
                                <Sun className="mr-2 h-4 w-4" />
                                Light
                              </div>
                            </SelectItem>
                            <SelectItem value="dark">
                              <div className="flex items-center">
                                <Moon className="mr-2 h-4 w-4" />
                                Dark
                              </div>
                            </SelectItem>
                            <SelectItem value="system">
                              <div className="flex items-center">
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                System
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The default light/dark mode setting.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="radius"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Border Radius: {field.value}rem</FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={2}
                            step={0.1}
                            defaultValue={[field.value]}
                            onValueChange={(values) => field.onChange(values[0])}
                            className="w-full"
                          />
                        </FormControl>
                        <FormDescription>
                          Controls the roundness of UI elements.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="animation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Animation Style</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select animation style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                            <SelectItem value="smooth">Smooth</SelectItem>
                            <SelectItem value="bounce">Bounce</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Controls the animation speed and style throughout the UI.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit">Apply Changes</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Typography Settings</CardTitle>
              <CardDescription>
                Customize font families and typography settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Font Family</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Primary Font</Label>
                        <Input 
                          value={designSystem.typography.primary}
                          onChange={(e) => {
                            updateDraftDesignSystem({
                              typography: {
                                ...designSystem.typography,
                                primary: e.target.value
                              }
                            });
                            setHasChanges(true);
                          }}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Used for body text throughout the application.
                        </p>
                      </div>
                      <div>
                        <Label>Heading Font</Label>
                        <Input 
                          value={designSystem.typography.heading}
                          onChange={(e) => {
                            updateDraftDesignSystem({
                              typography: {
                                ...designSystem.typography,
                                heading: e.target.value
                              }
                            });
                            setHasChanges(true);
                          }}
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          Used for headings and emphasized text.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    // Just apply changes without any further API call
                    toast({
                      title: "Changes applied to preview",
                      description: "Typography changes have been applied to the preview."
                    });
                  }}
                >
                  Apply Typography Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>UI Component Preview</CardTitle>
              <CardDescription>
                See how your theme changes affect various UI components.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Typography</h3>
                  <div className="space-y-2">
                    <h1 className="text-4xl font-bold">Heading 1</h1>
                    <h2 className="text-3xl font-bold">Heading 2</h2>
                    <h3 className="text-2xl font-bold">Heading 3</h3>
                    <h4 className="text-xl font-bold">Heading 4</h4>
                    <p className="text-base">
                      Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      Nullam in dui mauris. Vivamus hendrerit arcu sed erat molestie vehicula.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This is smaller muted text often used for descriptions.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Buttons</h3>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="default">Default Button</Button>
                    <Button variant="secondary">Secondary Button</Button>
                    <Button variant="outline">Outline Button</Button>
                    <Button variant="destructive">Destructive Button</Button>
                    <Button variant="ghost">Ghost Button</Button>
                    <Button variant="link">Link Button</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Forms</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="preview-input">Input Field</Label>
                      <Input id="preview-input" placeholder="Enter some text" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preview-select">Select Menu</Label>
                      <Select>
                        <SelectTrigger id="preview-select">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="option1">Option 1</SelectItem>
                          <SelectItem value="option2">Option 2</SelectItem>
                          <SelectItem value="option3">Option 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preview-checkbox">Checkbox</Label>
                      <div className="flex items-center space-x-2">
                        <Switch id="preview-checkbox" />
                        <Label htmlFor="preview-checkbox">Toggle me</Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Cards</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Card Title</CardTitle>
                        <CardDescription>Card description text</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p>This is the main content area of the card.</p>
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <Button variant="ghost">Cancel</Button>
                        <Button>Submit</Button>
                      </CardFooter>
                    </Card>
                  </div>
                </div>

                {form.watch('variant') === 'vibrant' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Material Design Color System</h3>
                    <Card className="mb-4 border-primary/20">
                      <CardContent className="pt-6">
                        <p className="text-sm">
                          The Material Design color system creates harmony across UI elements with a limited palette that still provides flexibility.
                          It helps maintain accessible color contrast while supporting a cohesive experience.
                        </p>
                      </CardContent>
                    </Card>
                    <div className="space-y-8">
                      <div>
                        <h4 className="font-medium mb-2">Primary Color Palette</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full bg-primary rounded-md mb-1"></div>
                            <span className="text-xs">Primary</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--primary-tint-1)'}}></div>
                            <span className="text-xs">Tint 1</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--primary-tint-2)'}}></div>
                            <span className="text-xs">Tint 2</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--primary-shade-1)'}}></div>
                            <span className="text-xs">Shade 1</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--primary-shade-2)'}}></div>
                            <span className="text-xs">Shade 2</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--primary-container)'}}></div>
                            <span className="text-xs">Container</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--on-primary-container)', color: 'var(--primary-container)'}}>
                              <div className="h-full flex items-center justify-center text-xs">Text</div>
                            </div>
                            <span className="text-xs">On Container</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Secondary Color Palette</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--secondary)'}}></div>
                            <span className="text-xs">Secondary</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--secondary-tint-1)'}}></div>
                            <span className="text-xs">Tint 1</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--secondary-tint-2)'}}></div>
                            <span className="text-xs">Tint 2</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--secondary-container)'}}></div>
                            <span className="text-xs">Container</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--on-secondary-container)', color: 'var(--secondary-container)'}}>
                              <div className="h-full flex items-center justify-center text-xs">Text</div>
                            </div>
                            <span className="text-xs">On Container</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">System Colors</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--error)'}}></div>
                            <span className="text-xs">Error</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--success)'}}></div>
                            <span className="text-xs">Success</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--warning)'}}></div>
                            <span className="text-xs">Warning</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--error-container)'}}></div>
                            <span className="text-xs">Error Container</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-full rounded-md mb-1" style={{backgroundColor: 'var(--success-container)'}}></div>
                            <span className="text-xs">Success Container</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Neutral Palette</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-11 gap-1">
                          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
                            <div key={value} className="flex flex-col items-center">
                              <div 
                                className="h-10 w-full rounded-md mb-1" 
                                style={{backgroundColor: `var(--neutral-${value})`}}
                              ></div>
                              <span className="text-xs">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="space-y-4">
          <Card>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">CSS Variables</h3>
                <div className="grid gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Colors</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><code>--background</code></div>
                      <div><code>--foreground</code></div>
                      <div><code>--primary</code></div>
                      <div><code>--primary-foreground</code></div>
                      <div><code>--primary-light</code></div>
                      <div><code>--secondary</code></div>
                      <div><code>--secondary-foreground</code></div>
                      <div><code>--muted</code></div>
                      <div><code>--muted-foreground</code></div>
                      <div><code>--accent</code></div>
                      <div><code>--accent-foreground</code></div>
                      <div><code>--destructive</code></div>
                      <div><code>--destructive-foreground</code></div>
                      <div><code>--border</code></div>
                      <div><code>--input</code></div>
                      <div><code>--ring</code></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Typography</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><code>--font-sans</code></div>
                      <div><code>--font-heading</code></div>
                      <div><code>--heading-1-size</code></div>
                      <div><code>--heading-2-size</code></div>
                      <div><code>--heading-3-size</code></div>
                      <div><code>--body-size</code></div>
                      <div><code>--line-height</code></div>
                      <div><code>--heading-weight</code></div>
                      <div><code>--body-weight</code></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Layout & Animation</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><code>--radius</code></div>
                      <div><code>--transition</code></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Sidebar</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><code>--sidebar-background</code></div>
                      <div><code>--sidebar-foreground</code></div>
                      <div><code>--sidebar-hover</code></div>
                      <div><code>--sidebar-active</code></div>
                      <div><code>--sidebar-border</code></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

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