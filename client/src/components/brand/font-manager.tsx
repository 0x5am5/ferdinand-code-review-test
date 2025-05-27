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
  sourceData: any;
}

// Font picker buttons component
function FontPickerButtons({ 
  onGoogleFontClick, 
  onAdobeFontClick, 
  onCustomFontClick 
}: { 
  onGoogleFontClick: () => void;
  onAdobeFontClick: () => void;
  onCustomFontClick: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={onGoogleFontClick}
        className="p-6 border rounded-lg bg-white border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer shadow-sm"
        style={{ minHeight: "200px" }}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Type className="h-6 w-6 text-primary" />
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
        onClick={onAdobeFontClick}
        className="p-6 border rounded-lg bg-white border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer shadow-sm"
        style={{ minHeight: "200px" }}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Type className="h-6 w-6 text-primary stroke-1" />
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
        onClick={onCustomFontClick}
        className="p-6 border rounded-lg bg-white border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer shadow-sm"
        style={{ minHeight: "200px" }}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-sm">Add Custom Font</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Upload font files
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// Google Font Picker Component
function GoogleFontPicker({ 
  onFontSelect, 
  isLoading,
  googleFonts,
  isFontsLoading
}: { 
  onFontSelect: (fontName: string) => void; 
  isLoading: boolean;
  googleFonts: any[];
  isFontsLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [displayCount, setDisplayCount] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const filteredFonts = googleFonts.filter((font: any) =>
    font.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    font.category.toLowerCase().includes(searchValue.toLowerCase())
  );

  const displayedFonts = filteredFonts.slice(0, displayCount);
  const hasMore = displayCount < filteredFonts.length;

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    setDisplayCount(prev => Math.min(prev + 25, filteredFonts.length));
    setIsLoadingMore(false);
  };

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
                        setDisplayCount(50);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{font.name}</span>
                        <span className="text-xs text-muted-foreground">{font.category}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {font.weights?.length || 0} weights
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

// Adobe Font Picker Component
function AdobeFontPicker({ 
  onFontSubmit, 
  isLoading 
}: { 
  onFontSubmit: (data: { projectId: string; fontFamily: string; weights: string[] }) => void; 
  isLoading: boolean;
}) {
  const [projectId, setProjectId] = useState("");
  const [fontFamily, setFontFamily] = useState("");
  const [selectedWeights, setSelectedWeights] = useState<string[]>(["400"]);

  const handleSubmit = () => {
    if (!projectId.trim() || !fontFamily.trim()) {
      return;
    }
    onFontSubmit({
      projectId: projectId.trim(),
      fontFamily: fontFamily.trim(),
      weights: selectedWeights
    });
    setProjectId("");
    setFontFamily("");
    setSelectedWeights(["400"]);
  };

  const allWeights = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border rounded-lg bg-white/50 border-dashed space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Type className="h-6 w-6 text-primary stroke-1" />
        </div>
        <div>
          <h3 className="font-medium">Add Adobe Font</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Adobe Fonts project
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="projectId" className="text-sm font-medium">
            Adobe Fonts Project ID
          </Label>
          <Input
            id="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="e.g., abc1234"
            className="mt-1"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Find this in your Adobe Fonts project URL or embed code
          </p>
        </div>

        <div>
          <Label htmlFor="fontFamily" className="text-sm font-medium">
            Font Family Name
          </Label>
          <Input
            id="fontFamily"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            placeholder="e.g., source-sans-pro"
            className="mt-1"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use the exact font family name from Adobe Fonts
          </p>
        </div>

        <div>
          <Label className="text-sm font-medium">Font Weights</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {allWeights.map((weight) => (
              <div key={weight} className="flex items-center space-x-2">
                <Checkbox
                  id={`adobe-weight-${weight}`}
                  checked={selectedWeights.includes(weight)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedWeights([...selectedWeights, weight]);
                    } else {
                      setSelectedWeights(selectedWeights.filter(w => w !== weight));
                    }
                  }}
                  disabled={isLoading}
                />
                <Label htmlFor={`adobe-weight-${weight}`} className="text-sm">
                  {weight}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={!projectId.trim() || !fontFamily.trim() || isLoading}
          className="w-full"
        >
          {isLoading ? "Adding Font..." : "Add Adobe Font"}
        </Button>
      </div>
    </motion.div>
  );
}

// Custom Font Upload Component
function CustomFontPicker({ 
  onFontUpload, 
  isLoading 
}: { 
  onFontUpload: (files: FileList, fontName: string, weights: string[]) => void; 
  isLoading: boolean;
}) {
  const [fontName, setFontName] = useState("");
  const [selectedWeights, setSelectedWeights] = useState<string[]>(["400"]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleSubmit = () => {
    if (!selectedFiles || selectedFiles.length === 0 || !fontName.trim()) {
      return;
    }
    onFontUpload(selectedFiles, fontName.trim(), selectedWeights);
    setFontName("");
    setSelectedWeights(["400"]);
    setSelectedFiles(null);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };

  const allWeights = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
  const allowedFormats = ['OTF', 'TTF', 'WOFF', 'WOFF2', 'EOT', 'SVG', 'CFF'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border rounded-lg bg-white/50 border-dashed space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Upload Custom Font</h3>
          <p className="text-sm text-muted-foreground">
            Upload your own font files
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="customFontName" className="text-sm font-medium">
            Font Name
          </Label>
          <Input
            id="customFontName"
            value={fontName}
            onChange={(e) => setFontName(e.target.value)}
            placeholder="e.g., My Custom Font"
            className="mt-1"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Upload Font Files</Label>
          <div
            className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? "border-primary bg-primary/5" 
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              accept=".otf,.ttf,.woff,.woff2,.eot,.svg,.cff"
              onChange={handleFileChange}
              className="hidden"
              id="font-upload"
              disabled={isLoading}
            />
            <label htmlFor="font-upload" className="cursor-pointer">
              <div className="space-y-2">
                <Plus className="h-8 w-8 mx-auto text-gray-400" />
                <div>
                  <p className="text-sm font-medium">
                    {selectedFiles && selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected`
                      : "Click to upload or drag and drop"
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: {allowedFormats.join(', ')}
                  </p>
                </div>
              </div>
            </label>
            
            {selectedFiles && selectedFiles.length > 0 && (
              <div className="mt-3 text-left">
                <p className="text-xs font-medium text-gray-600 mb-1">Selected files:</p>
                {Array.from(selectedFiles).map((file, index) => (
                  <div key={index} className="text-xs text-gray-500 truncate">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">Font Weights</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {allWeights.map((weight) => (
              <div key={weight} className="flex items-center space-x-2">
                <Checkbox
                  id={`custom-weight-${weight}`}
                  checked={selectedWeights.includes(weight)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedWeights([...selectedWeights, weight]);
                    } else {
                      setSelectedWeights(selectedWeights.filter(w => w !== weight));
                    }
                  }}
                  disabled={isLoading}
                />
                <Label htmlFor={`custom-weight-${weight}`} className="text-sm">
                  {weight}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={!selectedFiles || selectedFiles.length === 0 || !fontName.trim() || isLoading}
          className="w-full"
        >
          {isLoading ? "Uploading Font..." : "Upload Custom Font"}
        </Button>
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

function FontCard({ font, onEdit, onDelete }: { font: FontData; onEdit: () => void; onDelete: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-sm">{font.name}</h3>
          <p className="text-xs text-muted-foreground capitalize mt-1">
            {font.source} Font
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {font.weights.slice(0, 3).map((weight) => (
              <Badge key={weight} variant="secondary" className="text-xs">
                {weight}
              </Badge>
            ))}
            {font.weights.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{font.weights.length - 3} more
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1 ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function FontManager({ clientId, fonts }: FontManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingFont, setEditingFont] = useState<FontData | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<string[]>(["400"]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["normal"]);
  const { user } = useAuth();
  const [showGoogleFontPicker, setShowGoogleFontPicker] = useState(false);
  const [showAdobeFontPicker, setShowAdobeFontPicker] = useState(false);
  const [showCustomFontPicker, setShowCustomFontPicker] = useState(false);

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

  // Fetch Google Fonts
  const { data: googleFontsData, isLoading: isFontsLoading } = useQuery({
    queryKey: ['/api/google-fonts'],
    enabled: true,
  });

  // Fallback Google Fonts data
  const allGoogleFonts = [
    { name: "Inter", category: "Sans Serif", weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },
    { name: "Roboto", category: "Sans Serif", weights: ["100", "300", "400", "500", "700", "900"] },
    { name: "Open Sans", category: "Sans Serif", weights: ["300", "400", "500", "600", "700", "800"] },
    // Add more fallback fonts as needed
  ];

  // Use API data if available and valid, otherwise use comprehensive fallback
  const googleFonts = (googleFontsData && (googleFontsData as any)?.items?.length > 0) 
    ? (googleFontsData as any).items.map((font: GoogleFont) => ({
        name: font.family,
        category: convertGoogleFontCategory(font.category),
        weights: convertGoogleFontVariants(font.variants)
      }))
    : allGoogleFonts;

  console.log(`Google Fonts loaded: ${googleFonts?.length || 0} fonts available (${googleFontsData && (googleFontsData as any)?.items?.length > 0 ? 'from API' : 'from fallback'})`);

  // Add font mutation
  const addFont = useMutation({
    mutationFn: async (data: FormData) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      console.log("Sending font data to server for client:", clientId);

      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: "POST",
        body: data,
        credentials: "include",
      });

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
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      setEditingFont(null);
      toast({
        title: "Font updated successfully",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating font",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete font mutation
  const deleteFont = useMutation({
    mutationFn: async (fontId: number) => {
      const response = await apiRequest(
        "DELETE",
        `/api/clients/${clientId}/assets/${fontId}`,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({
        title: "Font deleted successfully",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting font",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  // Adobe Font handler
  const handleAdobeFontSubmit = (adobeFontData: { projectId: string; fontFamily: string; weights: string[] }) => {
    if (!adobeFontData.projectId?.trim() || !adobeFontData.fontFamily?.trim()) {
      toast({
        title: "Error",
        description: "Please provide both Project ID and Font Family name",
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

    console.log(`Creating Adobe Font: ${adobeFontData.fontFamily} with weights:`, adobeFontData.weights);

    // Create proper font data structure for Adobe fonts
    const fontData = {
      source: FontSource.ADOBE,
      weights: adobeFontData.weights.length > 0 ? adobeFontData.weights : ["400"],
      styles: ["normal"],
      sourceData: {
        projectId: adobeFontData.projectId.trim(),
        fontFamily: adobeFontData.fontFamily.trim(),
        url: `https://use.typekit.net/${adobeFontData.projectId}.css`
      },
    };

    console.log("Sending Adobe font data to server for client:", clientId);
    console.log("Adobe font data structure:", JSON.stringify(fontData, null, 2));

    const formData = new FormData();
    formData.append("name", adobeFontData.fontFamily.trim());
    formData.append("category", "font");
    formData.append("subcategory", "adobe");
    formData.append("data", JSON.stringify(fontData));

    addFont.mutate(formData);
  };

  // Custom Font upload handler
  const handleCustomFontUpload = (files: FileList, fontName: string, weights: string[]) => {
    if (!files || files.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one font file",
        variant: "destructive",
      });
      return;
    }

    if (!fontName.trim()) {
      toast({
        title: "Error",
        description: "Please provide a font name",
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

    // Validate file formats
    const allowedFormats = ['otf', 'ttf', 'woff', 'woff2', 'eot', 'svg', 'cff'];
    const validFiles = Array.from(files).filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return extension && allowedFormats.includes(extension);
    });

    if (validFiles.length === 0) {
      toast({
        title: "Invalid file format",
        description: "Please upload only font files (OTF, TTF, WOFF, WOFF2, EOT, SVG, CFF)",
        variant: "destructive",
      });
      return;
    }

    if (validFiles.length !== files.length) {
      toast({
        title: "Some files skipped",
        description: `Only ${validFiles.length} of ${files.length} files are valid font formats`,
        variant: "destructive",
      });
    }

    console.log(`Creating Custom Font: ${fontName} with ${validFiles.length} files`);

    // Process files and create FormData
    const formData = new FormData();
    formData.append("name", fontName.trim());
    formData.append("category", "font");
    formData.append("subcategory", "custom");

    // Add each file to FormData
    validFiles.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    // Create font data structure for custom fonts
    const fontData = {
      source: FontSource.FILE,
      weights: weights.length > 0 ? weights : ["400"],
      styles: ["normal"],
      sourceData: {
        fileCount: validFiles.length,
        fileNames: validFiles.map(f => f.name),
        totalSize: validFiles.reduce((sum, f) => sum + f.size, 0)
      },
    };

    formData.append("data", JSON.stringify(fontData));

    console.log("Sending custom font data to server for client:", clientId);
    console.log("Custom font data structure:", JSON.stringify(fontData, null, 2));

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
          emptyPlaceholder={
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Type className="h-8 w-8" />
              </div>
              <p>No fonts yet</p>
              <p className="text-sm">Contact an admin to add brand fonts</p>
            </div>
          }
          uploadComponent={
            isAbleToEdit ? (
              showGoogleFontPicker ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Add Google Font</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowGoogleFontPicker(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <GoogleFontPicker 
                    onFontSelect={(fontName) => {
                      handleGoogleFontSelect(fontName);
                      setShowGoogleFontPicker(false);
                    }}
                    isLoading={addFont.isPending}
                    googleFonts={googleFonts}
                    isFontsLoading={isFontsLoading}
                  />
                </div>
              ) : showAdobeFontPicker ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Add Adobe Font</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdobeFontPicker(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <AdobeFontPicker 
                    onFontSubmit={(data) => {
                      handleAdobeFontSubmit(data);
                      setShowAdobeFontPicker(false);
                    }}
                    isLoading={addFont.isPending}
                  />
                </div>
              ) : showCustomFontPicker ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Upload Custom Font</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCustomFontPicker(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <CustomFontPicker 
                    onFontUpload={(files, fontName, weights) => {
                      handleCustomFontUpload(files, fontName, weights);
                      setShowCustomFontPicker(false);
                    }}
                    isLoading={addFont.isPending}
                  />
                </div>
              ) : (
                <FontPickerButtons
                  onGoogleFontClick={() => setShowGoogleFontPicker(true)}
                  onAdobeFontClick={() => setShowAdobeFontPicker(true)}
                  onCustomFontClick={() => setShowCustomFontPicker(true)}
                />
              )
            ) : null
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

              {/* Show add font buttons when there are existing fonts */}
              {isAbleToEdit && transformedFonts.length > 0 && (
                <div className="mt-6">
                  {showGoogleFontPicker ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Add Google Font</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowGoogleFontPicker(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <GoogleFontPicker 
                        onFontSelect={(fontName) => {
                          handleGoogleFontSelect(fontName);
                          setShowGoogleFontPicker(false);
                        }}
                        isLoading={addFont.isPending}
                        googleFonts={googleFonts}
                        isFontsLoading={isFontsLoading}
                      />
                    </div>
                  ) : showAdobeFontPicker ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Add Adobe Font</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAdobeFontPicker(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <AdobeFontPicker 
                        onFontSubmit={(data) => {
                          handleAdobeFontSubmit(data);
                          setShowAdobeFontPicker(false);
                        }}
                        isLoading={addFont.isPending}
                      />
                    </div>
                  ) : showCustomFontPicker ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Upload Custom Font</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCustomFontPicker(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <CustomFontPicker 
                        onFontUpload={(files, fontName, weights) => {
                          handleCustomFontUpload(files, fontName, weights);
                          setShowCustomFontPicker(false);
                        }}
                        isLoading={addFont.isPending}
                      />
                    </div>
                  ) : (
                    <FontPickerButtons
                      onGoogleFontClick={() => setShowGoogleFontPicker(true)}
                      onAdobeFontClick={() => setShowAdobeFontPicker(true)}
                      onCustomFontClick={() => setShowCustomFontPicker(true)}
                    />
                  )}
                </div>
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