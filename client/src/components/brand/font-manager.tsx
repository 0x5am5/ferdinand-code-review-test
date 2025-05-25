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
  isLoading 
}: { 
  onFontSelect: (fontName: string) => void; 
  isLoading: boolean; 
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  
  // Fetch Google Fonts from API
  const { data: googleFontsData, isLoading: isFontsLoading } = useQuery<GoogleFontsResponse>({
    queryKey: ['/api/google-fonts'],
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Transform Google Fonts API data to our format
  const googleFonts = googleFontsData?.items?.map(font => ({
    name: font.family,
    category: convertGoogleFontCategory(font.category),
    weights: convertGoogleFontVariants(font.variants)
  })) || [];

  const filteredFonts = googleFonts.filter(font =>
    font.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    font.category.toLowerCase().includes(searchValue.toLowerCase())
  ).slice(0, 50); // Show first 50 results for performance

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
              {isLoading ? "Adding font..." : isFontsLoading ? "Loading fonts..." : "Search Google Fonts..."}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput 
                placeholder="Search fonts..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                <CommandEmpty>No fonts found.</CommandEmpty>
                <CommandGroup>
                  {filteredFonts.map((font) => (
                    <CommandItem
                      key={font.name}
                      value={font.name}
                      onSelect={() => {
                        onFontSelect(font.name);
                        setOpen(false);
                        setSearchValue("");
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

  const isAbleToEdit = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.EDITOR,
  ].includes(user.role);

  // Add font mutation
  const addFont = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest(
        "POST",
        `/api/clients/${clientId}/assets`,
        data,
      );
      if (!response.ok) {
        throw new Error("Failed to add font");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({
        title: "Success",
        description: "Font added successfully",
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

  // Simplified Google Font handler
  const handleGoogleFontSelect = (fontName: string) => {
    // We'll use the API to get font details when adding
    // For now, just proceed with the font name

    const formData = new FormData();
    formData.append("name", fontName);
    formData.append("category", "font");
    formData.append("subcategory", "google");
    formData.append(
      "data",
      JSON.stringify({
        source: FontSource.GOOGLE,
        weights: ["400", "700"], // Default weights, can be customized later
        styles: ["normal", "italic"],
        sourceData: {
          url: generateGoogleFontUrl(fontName, ["400", "700"], ["normal", "italic"]),
        },
      }),
    );
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
            <div className="flex flex-col gap-2 w-full">
              <GoogleFontPicker 
                onFontSelect={handleGoogleFontSelect}
                isLoading={addFont.isPending}
              />
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
              
              {isAbleToEdit && (
                <GoogleFontPicker 
                  onFontSelect={handleGoogleFontSelect}
                  isLoading={addFont.isPending}
                />
              )}
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