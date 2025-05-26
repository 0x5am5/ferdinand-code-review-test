import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit2,
  Trash2,
  Type,
  Search,
  ChevronDown,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandAsset, UserRole } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AssetSection } from "./asset-section";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// Font source constants
const FontSource = {
  GOOGLE: "google",
  ADOBE: "adobe",
  FILE: "file",
} as const;

// Google Fonts interface
interface GoogleFont {
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
}

interface GoogleFontsResponse {
  kind: string;
  items: GoogleFont[];
}

// Convert Google Fonts variant format to readable weights
const convertGoogleFontVariants = (variants: string[]): string[] => {
  return variants
    .filter(variant => !variant.includes('italic'))
    .map(variant => variant === 'regular' ? '400' : variant)
    .filter(variant => /^\d+$/.test(variant))
    .sort((a, b) => parseInt(a) - parseInt(b));
};

// Convert Google Fonts category to our format
const convertGoogleFontCategory = (category: string): string => {
  switch (category.toLowerCase()) {
    case 'sans-serif': return 'Sans Serif';
    case 'serif': return 'Serif';
    case 'display': return 'Display';
    case 'handwriting': return 'Handwriting';
    case 'monospace': return 'Monospace';
    default: return 'Sans Serif';
  }
};

const generateGoogleFontUrl = (fontName: string, weights: string[] = ["400"], styles: string[] = ["normal"]) => {
  const family = fontName.replace(/\s+/g, '+');
  const weightStr = weights.join(';');
  const italicWeights = styles.includes('italic') ? `:ital@0;1` : '';
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weightStr}${italicWeights}&display=swap`;
};

interface FontData {
  id?: number;
  name: string;
  source: (typeof FontSource)[keyof typeof FontSource];
  weights: string[];
  styles: string[];
  sourceData: {
    projectId?: string;
    url?: string;
    files?: {
      weight: string;
      style: string;
      format: string;
      fileName: string;
      fileData: string;
    }[];
  };
}

function FontCard({
  font,
  onEdit,
  onDelete,
}: {
  font: FontData;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const isAbleToEdit = user && [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.EDITOR,
  ].includes(user.role);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="p-6 border rounded-lg bg-white shadow-sm"
      style={{ minHeight: "300px" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2" style={{ fontFamily: font.name }}>
            {font.name}
          </h3>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-xs">
              {font.source.toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {font.weights.length} weights
            </span>
          </div>
        </div>
        {isAbleToEdit && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div style={{ fontFamily: font.name, fontSize: "24px", fontWeight: "400" }}>
          The quick brown fox
        </div>
        <div style={{ fontFamily: font.name, fontSize: "16px", fontWeight: "400" }}>
          jumps over the lazy dog
        </div>
        <div className="flex flex-wrap gap-1">
          {font.weights.slice(0, 4).map((weight) => (
            <Badge key={weight} variant="outline" className="text-xs">
              {weight}
            </Badge>
          ))}
          {font.weights.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{font.weights.length - 4}
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function GoogleFontPicker({ 
  onFontSelect, 
  isLoading,
  googleFonts,
  isFontsLoading
}: { 
  onFontSelect: (fontName: string) => void; 
  isLoading: boolean;
  googleFonts: { name: string; category: string; weights: string[] }[];
  isFontsLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [displayCount, setDisplayCount] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const filteredFonts = googleFonts.filter(font =>
    font.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    font.category.toLowerCase().includes(searchValue.toLowerCase())
  );

  const displayedFonts = filteredFonts.slice(0, displayCount);
  const hasMore = displayCount < filteredFonts.length;

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    // Add a small delay to simulate loading and prevent rapid scrolling issues
    await new Promise(resolve => setTimeout(resolve, 200));
    setDisplayCount(prev => Math.min(prev + 25, filteredFonts.length));
    setIsLoadingMore(false);
  };

  // Reset display count when search changes
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setDisplayCount(50);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border rounded-lg bg-white/50 border-dashed flex flex-col items-center justify-center gap-4 transition-colors"
      style={{ minHeight: "300px" }}
    >
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Type className="h-6 w-6 text-primary" />
      </div>
      <div className="text-center space-y-4">
        <div>
          <h3 className="font-medium">Add Google Font</h3>
          <p className="text-sm text-muted-foreground">
            Search and select from popular Google Fonts
          </p>
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[300px] justify-between"
              disabled={isLoading || isFontsLoading}
            >
              <Search className="mr-2 h-4 w-4" />
              {isLoading 
                ? "Adding font..." 
                : isFontsLoading 
                ? "Loading fonts..." 
                : googleFonts.length === 0 
                ? "No fonts available"
                : "Search Google Fonts..."
              }
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput 
                placeholder="Search fonts..." 
                value={searchValue}
                onValueChange={handleSearchChange}
              />
              <CommandList
                onScroll={(e) => {
                  const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                  // Trigger load more when user scrolls near the bottom (within 100px)
                  if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !isLoadingMore) {
                    loadMore();
                  }
                }}
              >
                <CommandEmpty>No fonts found.</CommandEmpty>
                <CommandGroup>
                  {displayedFonts.map((font) => (
                    <CommandItem
                      key={font.name}
                      value={font.name}
                      onSelect={() => {
                        onFontSelect(font.name);
                        setOpen(false);
                        setSearchValue("");
                        setDisplayCount(50); // Reset display count when closing
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{font.name}</span>
                        <span className="text-xs text-muted-foreground">{font.category}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {font.weights.length} weights
                      </div>
                    </CommandItem>
                  ))}
                  {isLoadingMore && (
                    <div className="flex items-center justify-center py-4">
                      <div className="text-sm text-muted-foreground">Loading more fonts...</div>
                    </div>
                  )}
                  {hasMore && !isLoadingMore && displayedFonts.length > 0 && (
                    <div className="flex items-center justify-center py-2">
                      <div className="text-xs text-muted-foreground">
                        Showing {displayedFonts.length} of {filteredFonts.length} fonts - Scroll for more
                      </div>
                    </div>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </motion.div>
  );
}

function WeightStyleSelector({
  selectedWeights,
  selectedStyles,
  onWeightChange,
  onStyleChange,
  availableWeights,
}: {
  selectedWeights: string[];
  selectedStyles: string[];
  onWeightChange: (weights: string[]) => void;
  onStyleChange: (styles: string[]) => void;
  availableWeights: string[];
}) {
  const allWeights = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
  const availableStyles = ["normal", "italic"];

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Font Weights</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {allWeights.map((weight) => {
            const isAvailable = availableWeights.includes(weight);
            const isSelected = selectedWeights.includes(weight);

            return (
              <div key={weight} className="flex items-center space-x-2">
                <Checkbox
                  id={`weight-${weight}`}
                  checked={isSelected}
                  disabled={!isAvailable}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onWeightChange([...selectedWeights, weight]);
                    } else {
                      onWeightChange(selectedWeights.filter(w => w !== weight));
                    }
                  }}
                />
                <Label 
                  htmlFor={`weight-${weight}`}
                  className={`text-sm ${!isAvailable ? 'text-muted-foreground' : ''}`}
                >
                  {weight}
                </Label>
                {!isAvailable && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Font Styles</Label>
        <div className="flex gap-4 mt-2">
          {availableStyles.map((style) => (
            <div key={style} className="flex items-center space-x-2">
              <Checkbox
                id={`style-${style}`}
                checked={selectedStyles.includes(style)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onStyleChange([...selectedStyles, style]);
                  } else {
                    onStyleChange(selectedStyles.filter(s => s !== style));
                  }
                }}
              />
              <Label htmlFor={`style-${style}`} className="text-sm capitalize">
                {style}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FontManager({ clientId, fonts }: FontManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingFont, setEditingFont] = useState<FontData | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<string[]>(["400"]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["normal"]);
  const { user } = useAuth();

  if (!user) return null;

  // Validate clientId is available
  if (!clientId) {
    console.error("FontManager: clientId is missing");
    return (
      <div className="font-manager">
        <div className="manager__header">
          <div>
            <h1>Typography System</h1>
            <p className="text-muted-foreground text-red-500">
              Error: Client ID is missing. Please refresh the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isAbleToEdit = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.EDITOR,
  ].includes(user.role);

  // Add font mutation
  const addFont = useMutation({
    mutationFn: async (data: FormData) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      console.log("Sending font data to server for client:", clientId);
      console.log("FormData contents:");
      for (const [key, value] of data.entries()) {
        console.log(`  ${key}:`, value);
      }

      const response = await apiRequest(
        "POST",
        `/api/clients/${clientId}/assets`,
        data,
      );

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        console.error("Server error:", response.status, errorMessage);
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("Font added successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({
        title: "Success",
        description: `${data.name} font added successfully`,
        variant: "default",
      });
    },
    onError: (error: Error) => {
      console.error("Font addition failed:", error);
      toast({
        title: "Error adding font",
        description: error.message || "Failed to add font. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Edit font mutation
  const editFont = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/clients/${clientId}/assets/${id}`,
        data,
      );
      if (!response.ok) {
        throw new Error("Failed to update font");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      setEditingFont(null);
      toast({
        title: "Success",
        description: "Font updated successfully",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete font mutation
  const deleteFont = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(
        "DELETE",
        `/api/clients/${clientId}/assets/${id}`,
      );
      if (!response.ok) {
        throw new Error("Failed to delete font");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({
        title: "Success",
        description: "Font deleted successfully",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Try to fetch from API, but always have the comprehensive fallback
  const { data: googleFontsData, isLoading: isFontsLoading } = useQuery<GoogleFontsResponse>({
    queryKey: ['/api/google-fonts'],
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Comprehensive font list including IBM Plex Sans and all popular Google Fonts
  const allGoogleFonts = [
    // IBM Plex Family (what you specifically requested)
    { name: "IBM Plex Sans", category: "Sans Serif", weights: ["100", "200", "300", "400", "500", "600", "700"] },
    { name: "IBM Plex Serif", category: "Serif", weights: ["100", "200", "300", "400", "500", "600", "700"] },
    { name: "IBM Plex Mono", category: "Monospace", weights: ["100", "200", "300", "400", "500", "600", "700"] },

    // Popular Sans Serif Fonts
    { name: "Roboto", category: "Sans Serif", weights: ["100", "300", "400", "500", "700", "900"] },
    { name: "Open Sans", category: "Sans Serif", weights: ["300", "400", "500", "600", "700", "800"] },
    { name: "Lato", category: "Sans Serif", weights: ["100", "300", "400", "700", "900"] },
    { name: "Montserrat", category: "Sans Serif", weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "Poppins", category: "Sans Serif", weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "Inter", category: "Sans Serif", weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "Source Sans Pro", category: "Sans Serif", weights: ["200", "300", "400", "600", "700", "900"] },
    { name: "Oswald", category: "Sans Serif", weights: ["200", "300", "400", "500", "600", "700"] },
    { name: "Raleway", category: "Sans Serif", weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "Nunito", category: "Sans Serif", weights: ["200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "PT Sans", category: "Sans Serif", weights: ["400", "700"] },
    { name: "Ubuntu", category: "Sans Serif", weights: ["300", "400", "500", "700"] },
    { name: "Mukti", category: "Sans Serif", weights: ["200", "300", "400", "500", "600", "700", "800"] },
    { name: "Fira Sans", category: "Sans Serif", weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "Work Sans", category: "Sans Serif", weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },

    // Popular Serif Fonts
    { name: "Playfair Display", category: "Serif", weights: ["400", "500", "600", "700", "800", "900"] },
    { name: "Merriweather", category: "Serif", weights: ["300", "400", "700", "900"] },
    { name: "PT Serif", category: "Serif", weights: ["400", "700"] },
    { name: "Lora", category: "Serif", weights: ["400", "500", "600", "700"] },
    { name: "Source Serif Pro", category: "Serif", weights: ["200", "300", "400", "600", "700", "900"] },
    { name: "Crimson Text", category: "Serif", weights: ["400", "600", "700"] },
    { name: "Libre Baskerville", category: "Serif", weights: ["400", "700"] },
    { name: "Cormorant Garamond", category: "Serif", weights: ["300", "400", "500", "600", "700"] },
    { name: "EB Garamond", category: "Serif", weights: ["400", "500", "600", "700", "800"] },

    // Monospace Fonts
    { name: "Source Code Pro", category: "Monospace", weights: ["200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "JetBrains Mono", category: "Monospace", weights: ["100", "200", "300", "400", "500", "600", "700", "800"] },
    { name: "Fira Code", category: "Monospace", weights: ["300", "400", "500", "600", "700"] },
    { name: "Roboto Mono", category: "Monospace", weights: ["100", "200", "300", "400", "500", "600", "700"] },
    { name: "Space Mono", category: "Monospace", weights: ["400", "700"] },
    { name: "Inconsolata", category: "Monospace", weights: ["200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "Ubuntu Mono", category: "Monospace", weights: ["400", "700"] },

    // Display Fonts
    { name: "Lobster", category: "Display", weights: ["400"] },
    { name: "Comfortaa", category: "Display", weights: ["300", "400", "500", "600", "700"] },
    { name: "Righteous", category: "Display", weights: ["400"] },
    { name: "Fredoka One", category: "Display", weights: ["400"] },
    { name: "Bebas Neue", category: "Display", weights: ["400"] },
    { name: "Anton", category: "Display", weights: ["400"] },

    // Handwriting Fonts
    { name: "Dancing Script", category: "Handwriting", weights: ["400", "500", "600", "700"] },
    { name: "Pacifico", category: "Handwriting", weights: ["400"] },
    { name: "Kaushan Script", category: "Handwriting", weights: ["400"] },
    { name: "Great Vibes", category: "Handwriting", weights: ["400"] },
  ];

  // Use API data if available and valid, otherwise use comprehensive fallback
  const googleFonts = (googleFontsData?.items?.length > 0) 
    ? googleFontsData.items.map((font: GoogleFont) => ({
        name: font.family,
        category: convertGoogleFontCategory(font.category),
        weights: convertGoogleFontVariants(font.variants)
      }))
    : allGoogleFonts;

  console.log(`Google Fonts loaded: ${googleFonts?.length || 0} fonts available (${googleFontsData?.items?.length > 0 ? 'from API' : 'from fallback'})`);

  // Google Font handler with proper validation
  const handleGoogleFontSelect = (fontName: string) => {
    if (!fontName?.trim()) {
      toast({
        title: "Error",
        description: "Invalid font name",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Error",
        description: "Client ID is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    // Find the font in our Google Fonts list to get available weights
    const selectedFont = googleFonts?.find(font => font.name === fontName);
    const availableWeights = selectedFont?.weights || ["400", "700"];
    const defaultWeights = availableWeights.slice(0, 3); // Use first 3 available weights

    console.log(`Creating Google Font: ${fontName} with weights:`, defaultWeights);

    // Create proper font data structure
    const fontData = {
      source: FontSource.GOOGLE,
      weights: defaultWeights,
      styles: ["normal"],
      sourceData: {
        url: generateGoogleFontUrl(fontName, defaultWeights, ["normal"]),
        fontFamily: fontName,
        category: selectedFont?.category || "Sans Serif"
      },
    };

    console.log("Sending font data to server for client:", clientId);
    console.log("Font data structure:", JSON.stringify(fontData, null, 2));

    const formData = new FormData();
    formData.append("name", fontName.trim());
    formData.append("category", "font");
    formData.append("subcategory", "google");
    formData.append("data", JSON.stringify(fontData));

    addFont.mutate(formData);
  };

  const handleEditFont = (font: FontData) => {
    setEditingFont(font);
    setSelectedWeights(font.weights);
    setSelectedStyles(font.styles);
  };

  const handleUpdateFont = async () => {
    if (!editingFont) return;

    const updateData = {
      name: editingFont.name,
      data: JSON.stringify({
        source: editingFont.source,
        weights: selectedWeights,
        styles: selectedStyles,
        sourceData: editingFont.sourceData,
      }),
    };

    editFont.mutate({ id: editingFont.id!, data: updateData });
  };

  const parseFontAsset = (asset: BrandAsset): FontData | null => {
    try {
      const data = typeof asset.data === 'string' 
        ? JSON.parse(asset.data) 
        : asset.data;

      return {
        id: asset.id,
        name: asset.name,
        source: data.source || FontSource.GOOGLE,
        weights: data.weights || ["400"],
        styles: data.styles || ["normal"],
        sourceData: data.sourceData || {},
      };
    } catch (error) {
      console.error("Error parsing font asset:", error);
      return null;
    }
  };

  const transformedFonts = fonts
    .filter(asset => asset.category === "font")
    .map(parseFontAsset)
    .filter((font): font is FontData => font !== null);

  return (
    <div className="font-manager">
      <div className="manager__header">
        <div>
          <h1>Typography System</h1>
          <p className="text-muted-foreground">Manage fonts and typography for this brand</p>
        </div>
      </div>

      <div className="font-manager__sections space-y-8">
        <AssetSection
          title="Brand Fonts"
          description="Typography assets that define the brand's visual identity and should be used consistently across all materials."
          isEmpty={transformedFonts.length === 0}
          sectionType="brand-fonts"
          uploadComponent={
            <div className="flex flex-col gap-4 w-full">
              <GoogleFontPicker 
                onFontSelect={handleGoogleFontSelect}
                isLoading={addFont.isPending}
                googleFonts={googleFonts}
                isFontsLoading={isFontsLoading}
              />
              
              {/* Font Source Buttons */}
              <div className="grid grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 border rounded-lg bg-white/50 border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer"
                  style={{ minHeight: "200px" }}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Type className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-medium text-sm">Add Google Font</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Browse Google Fonts
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 border rounded-lg bg-white/50 border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer"
                  style={{ minHeight: "200px" }}
                >
                  <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Type className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-medium text-sm">Add Adobe Font</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Browse Adobe Fonts
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 border rounded-lg bg-white/50 border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer"
                  style={{ minHeight: "200px" }}
                >
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-medium text-sm">Add Custom Font</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload font files
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          }
          emptyPlaceholder={
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Type className="h-8 w-8" />
              </div>
              <p>No fonts yet</p>
              <p className="text-sm">Contact an admin to add brand fonts</p>
            </div>
          }
        >
          <div className="asset-display">
            <div className="asset-display__info">
              Typography assets that define the brand's visual identity and should be used consistently across all materials.
            </div>
            <div className="asset-display__preview">
              <AnimatePresence>
                {transformedFonts.map((font) => (
                  <FontCard
                    key={font.id}
                    font={font}
                    onEdit={() => handleEditFont(font)}
                    onDelete={() => font.id && deleteFont.mutate(font.id)}
                  />
                ))}
              </AnimatePresence>

              
            </div>
          </div>
        </AssetSection>
      </div>

      {/* Edit Font Dialog */}
      {isAbleToEdit && (
        <Dialog
          open={!!editingFont}
          onOpenChange={(open) => !open && setEditingFont(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Font</DialogTitle>
              <DialogDescription>Update font properties</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Font Name</Label>
                <Input
                  value={editingFont?.name || ""}
                  onChange={(e) =>
                    setEditingFont((prev) =>
                      prev ? { ...prev, name: e.target.value } : null,
                    )
                  }
                />
              </div>

              <WeightStyleSelector
                selectedWeights={selectedWeights}
                selectedStyles={selectedStyles}
                onWeightChange={setSelectedWeights}
                onStyleChange={setSelectedStyles}
                availableWeights={editingFont?.weights || ["400"]}
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingFont(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateFont}
                  disabled={editFont.isPending}
                >
                  {editFont.isPending ? "Updating..." : "Update Font"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface FontManagerProps {
  clientId: number;
  fonts: BrandAsset[];
} 