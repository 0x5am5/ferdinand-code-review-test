import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Download, Upload, Trash2, FileType, Info, CheckCircle, ExternalLink, Sun, Moon, Lock, Unlock, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { BrandAsset, LogoType, FILE_FORMATS, UserRole } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface LogoManagerProps {
  clientId: number;
  logos: BrandAsset[];
}

interface FileUploadProps {
  type: string;
  clientId: number;
  onSuccess: () => void;
  isDarkVariant?: boolean;
  parentLogoId?: number;
  queryClient: any;
  className?: string;
  buttonOnly?: boolean;
  children?: React.ReactNode;
}

// Main detailed writeups for each logo type
const logoDescriptions = {
  main: "This is your go-to logo—the one that should appear most often. It's built for versatility and designed to work across digital, print, and product touchpoints. Use this wherever you need to establish brand presence.",
  horizontal: "Your default logo layout. The horizontal version is built for clarity and legibility in wide spaces—ideal for websites, decks, documents, and anywhere horizontal real estate isn't an issue.",
  vertical: "A stacked layout that fits better in tighter spaces. Use the vertical logo when the horizontal version feels cramped—think merch tags, narrow print formats, or content blocks with vertical constraints.",
  square: "A clean, compact logo focused on your core brand mark. It's designed for tight or constrained spaces where your full logo won't fit—like social avatars, internal tools, or platform UI elements.",
  app_icon: "This version is optimized for app stores and mobile screens. It's bold, recognizable, and readable even at small sizes. Use this wherever your product needs to stand on its own in a crowded app ecosystem.",
  favicon: "The smallest version of your brand mark. Used in browser tabs, bookmarks, and other micro contexts. At this size, clarity is everything—keep it simple, sharp, and undistorted."
};

const logoUsageGuidance = {
  main: "Use this logo anywhere brand visibility matters—your homepage, pitch decks, marketing campaigns, or press releases. Always give it room to breathe, with padding equal to at least the height of the logo mark.",
  horizontal: "Best for banners, website headers, email footers, and letterhead. Don't crowd it—maintain clear space around all sides and avoid scaling below legible size.",
  vertical: "Ideal for square or constrained areas like merch, business cards, and packaging. Keep the layout consistent and never stretch or compress.",
  square: "Use in spaces where simplicity matters: social icons, profile images, or internal dashboards. Stick to its native proportions and avoid visual clutter around it.",
  app_icon: "Use on mobile devices, app marketplaces, and launcher screens. Make sure it renders cleanly at small sizes, and avoid placing it on complex backgrounds.",
  favicon: "Use in browsers and tab displays. This should always be the most simplified version of your logo mark—no words, no extras. Stick to a .ico or .svg file where supported for best results."
};

function parseBrandAssetData(logo: BrandAsset) {
  try {
    if (!logo.data) {
      console.warn("Logo data is missing:", logo);
      return null;
    }
    const data =
      typeof logo.data === "string" ? JSON.parse(logo.data) : logo.data;
    if (!data.type || !data.format) {
      console.warn("Invalid logo data format:", data);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Error parsing logo data:", error, logo);
    return null;
  }
}

// Helper function to get estimated file size display string based on format
function getFileSizeString(format: string): string {
  switch(format.toLowerCase()) {
    case 'svg':
      return '15 KB';
    case 'pdf':
      return '250 KB';
    case 'png':
      return '120 KB';
    case 'jpg':
    case 'jpeg':
      return '85 KB';
    default:
      return '100 KB';
  }
}

// Drag and drop file upload component
function FileUpload({ type, clientId, onSuccess, queryClient, isDarkVariant, parentLogoId, buttonOnly = false, children, className }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const createLogo = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo`);
      formData.append("type", type);
      formData.append("category", "logo");

      const fileFormat = selectedFile.name.split('.').pop()?.toLowerCase();

      if (isDarkVariant && parentLogoId) {
        const logoData = {
          type,
          format: fileFormat,
          hasDarkVariant: true,
          isDarkVariant: true
        };
        formData.append("data", JSON.stringify(logoData));
        formData.append("category", "logo");
        formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo (Dark)`);

        const response = await fetch(`/api/clients/${clientId}/assets/${parentLogoId}?variant=dark`, {
          method: "PATCH",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to update logo");
        }

        return await response.json();
      } else {
        formData.append("data", JSON.stringify({
          type,
          format: fileFormat,
          hasDarkVariant: false
        }));

        const response = await fetch(`/api/clients/${clientId}/assets`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to upload logo");
        }

        return await response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
      });
      toast({
        title: "Success",
        description: "Logo added successfully",
      });
      setSelectedFile(null);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (!fileExtension || !Object.values(FILE_FORMATS).includes(fileExtension as any)) {
        toast({
          title: "Invalid file type",
          description: `File must be one of: ${Object.values(FILE_FORMATS).join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      // Automatically trigger upload without confirmation
      setTimeout(() => createLogo.mutate(), 0);
    }
  }, [toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (!fileExtension || !Object.values(FILE_FORMATS).includes(fileExtension as any)) {
      toast({
        title: "Invalid file type",
        description: `File must be one of: ${Object.values(FILE_FORMATS).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    // Automatically trigger upload without confirmation
    setTimeout(() => createLogo.mutate(), 0);
  }, [toast]);

  // If in button-only mode, render just a button
  if (buttonOnly) {
    return (
      <label className="cursor-pointer">
        <Input
          type="file"
          accept={Object.values(FILE_FORMATS).map(format => `.${format}`).join(",")}
          onChange={(e) => {
            handleFileChange(e);
            if (e.target.files?.[0]) {
              createLogo.mutate();
            }
          }}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          className={className}
          type="button"
          onClick={(e) => {
            const fileInput = e.currentTarget.closest('label')?.querySelector('input[type="file"]');
            if (fileInput) {
              (fileInput as HTMLInputElement).click();
            }
          }}
        >
          {children}
        </Button>
      </label>
    );
  }

  // Otherwise render the full drag-and-drop interface
  return (
    <div className="logo-upload">
      <div 
        className={`logo-upload__dropzone ${isDragging ? 'logo-upload__dropzone--active' : ''} ${createLogo.isPending ? 'logo-upload__dropzone--loading' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {createLogo.isPending ? (
          <>
            <div className="logo-upload__dropzone-icon logo-upload__dropzone-icon--loading">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
            <div className="logo-upload__dropzone-file-info">
              <h4>Uploading logo...</h4>
              <p>Please wait while your file is being processed</p>
            </div>
          </>
        ) : (
          <>
            <div className="logo-upload__dropzone-icon">
              <Upload className="h-8 w-8" />
            </div>
            <h4 className="logo-upload__dropzone-heading">
              Upload {type.charAt(0).toUpperCase() + type.slice(1)} Logo
            </h4>
            <p className="logo-upload__dropzone-text">
              Drag and drop your logo file here, or click to browse.<br />
              Supported formats: {Object.values(FILE_FORMATS).join(", ")}
            </p>
            <div className="logo-upload__dropzone-actions">
              <label className="cursor-pointer">
                <Input
                  type="file"
                  accept={Object.values(FILE_FORMATS).map(format => `.${format}`).join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={(e) => {
                    const fileInput = e.currentTarget.closest('label')?.querySelector('input[type="file"]');
                    if (fileInput) {
                      (fileInput as HTMLInputElement).click();
                    }
                  }}
                >
                  Browse Files
                </Button>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Logo download button with customization options
function LogoDownloadButton({ 
  logo, 
  imageUrl, 
  variant, 
  parsedData 
}: { 
  logo: BrandAsset, 
  imageUrl: string, 
  variant: 'light' | 'dark',
  parsedData: any
}) {
  const [size, setSize] = useState<number>(100);
  const [lockRatio, setLockRatio] = useState<boolean>(true);
  const [width, setWidth] = useState<number>(300); // Default width, will be calculated from image
  const [height, setHeight] = useState<number>(200); // Default height, will be calculated from image
  const [selectedFormats, setSelectedFormats] = useState<string[]>([parsedData.format]);
  const [originalWidth, setOriginalWidth] = useState<number>(300);
  const [originalHeight, setOriginalHeight] = useState<number>(200);
  const [open, setOpen] = useState<boolean>(false);
  
  // Helper function to estimate file size based on dimensions and format
  const estimateFileSize = (format: string, scaledWidth: number, scaledHeight: number): string => {
    // Calculate area ratio compared to original
    const originalArea = originalWidth * originalHeight;
    const newArea = scaledWidth * scaledHeight;
    const areaRatio = newArea / originalArea;
    
    // Base sizes from getFileSizeString
    let baseSizeKB = 0;
    switch(format.toLowerCase()) {
      case 'svg':
        return '15 KB'; // SVG size doesn't change with dimensions
      case 'pdf':
        baseSizeKB = 250;
        break;
      case 'png':
        baseSizeKB = 120;
        break;
      case 'jpg':
      case 'jpeg':
        baseSizeKB = 85;
        break;
      default:
        baseSizeKB = 100;
    }
    
    // Scale size by area ratio, but with some compression efficiency for larger sizes
    let scaledSize = baseSizeKB * Math.sqrt(areaRatio);
    
    // Format the result
    if (scaledSize < 1000) {
      return `${Math.round(scaledSize)} KB`;
    } else {
      return `${(scaledSize / 1024).toFixed(1)} MB`;
    }
  };
  
  // Create download URL with size parameters
  const getDownloadUrl = (format: string) => {
    const baseUrl = variant === 'dark' && parsedData.hasDarkVariant ? 
      `/api/assets/${logo.id}/file?variant=dark` : 
      imageUrl;
    
    // Build query params - start with ? if there aren't any params yet
    const separator = baseUrl.includes('?') ? '&' : '?';
    
    // Only add size parameters for image formats that support resizing
    if (format !== 'svg') {
      return `${baseUrl}${separator}size=${size}${lockRatio ? '&preserveRatio=true' : ''}${format !== parsedData.format ? `&format=${format}` : ''}`;
    }
    
    // For format conversion with SVG
    if (format !== parsedData.format) {
      return `${baseUrl}${separator}format=${format}`;
    }
    
    return baseUrl;
  };

  // Start download of all selected formats
  const downloadSelected = () => {
    // Create an invisible container for download links
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);
    
    // Create a link for each format and click it
    selectedFormats.forEach((format, index) => {
      const link = document.createElement('a');
      link.href = getDownloadUrl(format);
      link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}-${size}pct.${format}`;
      
      // Add a small delay between downloads to avoid browser limitations
      setTimeout(() => {
        container.appendChild(link);
        link.click();
        container.removeChild(link);
      }, index * 100);
    });
    
    // Clean up the container after all downloads started
    setTimeout(() => {
      document.body.removeChild(container);
      setOpen(false); // Close popover after download
    }, selectedFormats.length * 100 + 100);
  };

  // Load dimensions once when component mounts
  useEffect(() => {
    // Create a new image to get dimensions
    const img = new Image();
    img.onload = () => {
      setWidth(img.width);
      setHeight(img.height);
      setOriginalWidth(img.width);
      setOriginalHeight(img.height);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Calculate the actual pixel dimensions based on size percentage
  const scaledWidth = Math.max(10, Math.round(originalWidth * (size / 100)));
  const scaledHeight = Math.max(10, Math.round(originalHeight * (size / 100)));

  // Handle width input change with better validation
  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty input for better editing experience
    if (inputValue === '') {
      // Just set width to a temporary empty value, will be corrected on blur
      setWidth(0);
      return;
    }
    
    const newWidth = parseInt(inputValue);
    
    // Validate the width is a positive number
    if (isNaN(newWidth) || newWidth <= 0) {
      return;
    }
    
    if (lockRatio && originalWidth > 0) {
      const aspectRatio = originalHeight / originalWidth;
      const newHeight = Math.round(newWidth * aspectRatio);
      const newSizePercentage = (newWidth / originalWidth) * 100;
      setSize(newSizePercentage);
    } else {
      const newSizePercentage = (newWidth / originalWidth) * 100;
      setSize(newSizePercentage);
    }
  };

  // Handle height input change with better validation
  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty input for better editing experience
    if (inputValue === '') {
      // Just set height to a temporary empty value, will be corrected on blur
      setHeight(0);
      return;
    }
    
    const newHeight = parseInt(inputValue);
    
    // Validate the height is a positive number
    if (isNaN(newHeight) || newHeight <= 0) {
      return;
    }
    
    if (lockRatio && originalHeight > 0) {
      const aspectRatio = originalWidth / originalHeight;
      const newWidth = Math.round(newHeight * aspectRatio);
      const newSizePercentage = (newHeight / originalHeight) * 100;
      setSize(newSizePercentage);
    } else {
      const newSizePercentage = (newHeight / originalHeight) * 100;
      setSize(newSizePercentage);
    }
  };

  // Handle input field blur events to ensure valid values
  const handleInputBlur = () => {
    // Ensure minimum size is maintained
    if (size < 10) setSize(10);
  };

  // Toggle format selection
  const toggleFormat = (format: string) => {
    if (selectedFormats.includes(format)) {
      setSelectedFormats(selectedFormats.filter(f => f !== format));
    } else {
      setSelectedFormats([...selectedFormats, format]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="logo-display__preview-action-button">
          <Download className="h-3 w-3" />
          <span>Download</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="logo-download__popover">
        <div className="logo-download__popover-content">
          <h4 className="logo-download__popover-heading">Download Options</h4>
          
          <div className="logo-download__popover-dimensions">
            <div className="logo-download__popover-dimensions-header">
              <Label htmlFor="size">Dimensions</Label>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => setLockRatio(!lockRatio)}
                title={lockRatio ? "Unlock aspect ratio" : "Lock aspect ratio"}
              >
                {lockRatio ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </Button>
            </div>
            
            <div className="logo-download__popover-dimensions-inputs">
              <div className="logo-download__popover-dimensions-inputs-group">
                <Label htmlFor="width" className="text-xs">Width (px)</Label>
                <Input
                  id="width"
                  type="text"
                  value={scaledWidth}
                  onChange={handleWidthChange}
                  onBlur={handleInputBlur}
                  min={10}
                />
              </div>
              <div className="logo-download__popover-dimensions-inputs-group">
                <Label htmlFor="height" className="text-xs">Height (px)</Label>
                <Input
                  id="height"
                  type="text"
                  value={scaledHeight}
                  onChange={handleHeightChange}
                  onBlur={handleInputBlur}
                  min={10}
                />
              </div>
            </div>
            
            <div className="logo-download__popover-dimensions-slider">
              <Label htmlFor="size">Size: {size.toFixed(0)}%</Label>
              <Slider 
                id="size"
                value={[size]} 
                min={10} 
                max={400} 
                step={5}
                onValueChange={(value) => setSize(value[0])} 
              />
            </div>
          </div>
          
          <div className="logo-download__popover-formats">
            <Label htmlFor="format" className="logo-download__popover-formats-heading">File Formats</Label>
            <p className="logo-download__popover-formats-hint">Select formats to download</p>
            
            <div className="logo-download__popover-formats-list">
              {/* Original format */}
              <div className="logo-download__popover-formats-list-item">
                <Checkbox 
                  id={`format-${parsedData.format}`}
                  checked={selectedFormats.includes(parsedData.format)}
                  onCheckedChange={() => toggleFormat(parsedData.format)}
                />
                <div className="logo-download__popover-formats-list-item-label">
                  <Label 
                    htmlFor={`format-${parsedData.format}`}
                  >
                    {parsedData.format.toUpperCase()}
                  </Label>
                  <span className="logo-download__popover-formats-list-item-label-size">
                    {estimateFileSize(parsedData.format, scaledWidth, scaledHeight)}
                  </span>
                </div>
              </div>
              
              {/* JPG format */}
              <div className="logo-download__popover-formats-list-item">
                <Checkbox 
                  id="format-jpg"
                  checked={selectedFormats.includes('jpg')}
                  onCheckedChange={() => toggleFormat('jpg')}
                />
                <div className="logo-download__popover-formats-list-item-label">
                  <Label 
                    htmlFor="format-jpg"
                  >
                    JPG
                  </Label>
                  <span className="logo-download__popover-formats-list-item-label-size">
                    {estimateFileSize('jpg', scaledWidth, scaledHeight)}
                  </span>
                </div>
              </div>
              
              {/* PNG format */}
              <div className="logo-download__popover-formats-list-item">
                <Checkbox 
                  id="format-png"
                  checked={selectedFormats.includes('png')}
                  onCheckedChange={() => toggleFormat('png')}
                />
                <div className="logo-download__popover-formats-list-item-label">
                  <Label 
                    htmlFor="format-png"
                  >
                    PNG
                  </Label>
                  <span className="logo-download__popover-formats-list-item-label-size">
                    {estimateFileSize('png', scaledWidth, scaledHeight)}
                  </span>
                </div>
              </div>
              
              {/* PDF format */}
              <div className="logo-download__popover-formats-list-item">
                <Checkbox 
                  id="format-pdf"
                  checked={selectedFormats.includes('pdf')}
                  onCheckedChange={() => toggleFormat('pdf')}
                />
                <div className="logo-download__popover-formats-list-item-label">
                  <Label 
                    htmlFor="format-pdf"
                  >
                    PDF
                  </Label>
                  <span className="logo-download__popover-formats-list-item-label-size">
                    {estimateFileSize('pdf', scaledWidth, scaledHeight)}
                  </span>
                </div>
              </div>
              
              {/* SVG format */}
              {['png', 'jpg', 'jpeg'].includes(parsedData.format.toLowerCase()) && (
                <div className="logo-download__popover-formats-list-item">
                  <Checkbox 
                    id="format-svg"
                    checked={selectedFormats.includes('svg')}
                    onCheckedChange={() => toggleFormat('svg')}
                  />
                  <div className="logo-download__popover-formats-list-item-label">
                    <Label 
                      htmlFor="format-svg"
                    >
                      SVG
                    </Label>
                    <span className="logo-download__popover-formats-list-item-label-size">
                      {estimateFileSize('svg', scaledWidth, scaledHeight)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="logo-download__popover-actions">
            {selectedFormats.length > 0 ? (
              <>
                <Button 
                  onClick={downloadSelected}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download ({selectedFormats.length})
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button 
                  disabled
                >
                  <Download className="h-4 w-4 mr-2" />
                  Select formats
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LogoDisplay({ logo, imageUrl, parsedData, onDelete, clientId, queryClient }: { 
  logo: BrandAsset, 
  imageUrl: string, 
  parsedData: any,
  onDelete: (logoId: number, variant: 'light' | 'dark') => void,
  clientId: number,
  queryClient: any
}) {
  const { user = null } = useAuth();
  const { toast } = useToast();
  const type = parsedData.type;
  const [variant, setVariant] = useState<'light' | 'dark'>('light');

  return (
    <div className="logo-display">
      {/* Logo information */}
      <div className="logo-display__info">
        <p className="logo-display__info-description">
          {logoUsageGuidance[type as keyof typeof logoUsageGuidance]}
        </p>
      </div>

      {/* Logo preview */}
      <div className="logo-display__preview">
        <div 
          className={`logo-display__preview-container ${
            variant === 'light' 
              ? 'logo-display__preview-container--light' 
              : 'logo-display__preview-container--dark'
          }`}
        >
          <div className="logo-display__preview-nav">
            {/* Background toggle at the top left */}
            <div className="logo-display__preview-background-toggle">
              <div className="logo-display__preview-background-toggle-tabs">
                <button 
                  data-state={variant === 'light' ? 'active' : 'inactive'} 
                  onClick={() => setVariant('light')}
                >
                  <Sun className="h-4 w-4" />
                  Light Background
                </button>
                <button 
                  data-state={variant === 'dark' ? 'active' : 'inactive'} 
                  onClick={() => setVariant('dark')}
                >
                  <Moon className="h-4 w-4" />
                  Dark Background
                </button>
              </div>
            </div>
            
            {/* Top right controls */}
            <div className={`logo-display__preview-controls ${
                variant === 'light' 
                  ? 'light' 
                  : 'dark'
              }`}
              >
              <button className="logo-display__preview-action-button">
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept={Object.values(FILE_FORMATS).map(format => `.${format}`).join(",")}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        const createUpload = async () => {
                          const formData = new FormData();
                          formData.append("file", e.target.files![0]);
                          formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo`);
                          formData.append("type", type);
                          formData.append("category", "logo");
                          
                          if (variant === 'dark') {
                            // Update with dark variant
                            formData.append("isDarkVariant", "true");
                            
                            // Add data with hasDarkVariant flag
                            const fileExtension = e.target.files![0].name.split('.').pop()?.toLowerCase();
                            formData.append("data", JSON.stringify({
                              type,
                              format: fileExtension,
                              hasDarkVariant: true,
                              isDarkVariant: true
                            }));
                            
                            // Adding a temp name for debug clarity
                            formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo (Dark)`);
                            
                            console.log("Uploading dark variant with isDarkVariant=true");
                            // IMPORTANT: The ?variant=dark parameter is critical here
                            const response = await fetch(`/api/clients/${clientId}/assets/${logo.id}?variant=dark`, {
                              method: "PATCH",
                              body: formData,
                            });
                            
                            if (!response.ok) {
                              console.error("Failed to upload dark variant:", await response.text());
                            } else {
                              console.log("Dark variant uploaded successfully");
                            }
                          } else {
                            // Replace light variant
                            formData.append("isDarkVariant", "false");
                            
                            // Add data without replacing dark variant data
                            const fileExtension = e.target.files![0].name.split('.').pop()?.toLowerCase();
                            formData.append("data", JSON.stringify({
                              type,
                              format: fileExtension,
                              // Preserve dark variant if it exists
                              hasDarkVariant: parsedData.hasDarkVariant || false
                            }));
                            
                            console.log("Uploading light variant");
                            const response = await fetch(`/api/clients/${clientId}/assets/${logo.id}`, {
                              method: "PATCH",
                              body: formData,
                            });
                            
                            if (!response.ok) {
                              console.error("Failed to replace light variant:", await response.text());
                            } else {
                              console.log("Light variant uploaded successfully");
                            }
                          }
                          
                          // Invalidate the cache to show the updated logo immediately
                          await queryClient.invalidateQueries({
                            queryKey: [`/api/clients/${clientId}/assets`],
                          });
                          
                          // Force a reload of this specific logo to ensure it's updated in the UI
                          await queryClient.invalidateQueries({
                            queryKey: [`/api/assets/${logo.id}`],
                          });
                          
                          // Show success message
                          toast({
                            title: "Success",
                            description: variant === 'dark' 
                              ? `${type.charAt(0).toUpperCase() + type.slice(1)} dark variant uploaded successfully` 
                              : `${type.charAt(0).toUpperCase() + type.slice(1)} logo updated successfully`,
                          });
                        };
                        
                        createUpload();
                      }
                    }}
                    className="hidden"
                  />
                  <Upload className="h-3 w-3" />
                  <span>Replace</span>
                </label>
              </button>
              
              {/* Add the download button here */}
              <LogoDownloadButton 
                logo={logo} 
                imageUrl={imageUrl} 
                variant={variant}
                parsedData={parsedData}
              />
              
              {((variant === 'dark' && parsedData.hasDarkVariant) || variant === 'light') && (
                <button 
                  className="logo-display__preview-action-button"
                  onClick={() => onDelete(logo.id, variant)}
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
          {variant === 'dark' && !parsedData.hasDarkVariant ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-6">
              {/* Button to copy light variant as dark variant */}
              <div className="flex flex-col items-center gap-2">

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={async () => {
                    try {
                      // Fetch the light variant file data
                      const fileResponse = await fetch(`/api/assets/${logo.id}/file`);
                      if (!fileResponse.ok) throw new Error("Failed to fetch light variant file");

                      const fileBlob = await fileResponse.blob();
                      const fileName = `${type}_logo_dark.${parsedData.format}`;
                      const file = new File([fileBlob], fileName, { type: fileResponse.headers.get('content-type') || 'image/svg+xml' });

                      // Create FormData with the file and necessary metadata
                      const formData = new FormData();
                      formData.append("file", file);
                      formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo (Dark)`);
                      formData.append("type", type);
                      formData.append("category", "logo");
                      formData.append("isDarkVariant", "true");

                      // Add data with hasDarkVariant flag
                      formData.append("data", JSON.stringify({
                        type,
                        format: parsedData.format,
                        hasDarkVariant: true,
                        isDarkVariant: true
                      }));

                      console.log("Using light variant as dark variant");
                      // IMPORTANT: The ?variant=dark parameter is critical here
                      const response = await fetch(`/api/clients/${clientId}/assets/${logo.id}?variant=dark`, {
                        method: "PATCH",
                        body: formData,
                      });

                      if (!response.ok) {
                        throw new Error(await response.text());
                      }

                      // Update UI
                      parsedData.hasDarkVariant = true;
                      await queryClient.invalidateQueries({
                        queryKey: [`/api/clients/${clientId}/assets`],
                      });
                      await queryClient.invalidateQueries({
                        queryKey: [`/api/assets/${logo.id}`],
                      });

                      toast({
                        title: "Success",
                        description: `Light logo copied as dark variant`,
                      });
                    } catch (error) {
                      console.error("Error copying light variant as dark:", error);
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "Failed to copy light variant",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Use light logo for dark variant
                </Button>
                <div className="text-sm text-muted-foreground">- or -</div>
              </div>
              
              <div className="logo-upload__dropzone logo-upload__dropzone--dark flex flex-col items-center justify-center">
                <div className="logo-upload__dropzone-icon">
                  <Upload className="h-8 w-8" />
                </div>
                <h4 className="logo-upload__dropzone-heading">
                  Upload {type.charAt(0).toUpperCase() + type.slice(1)} Logo for Dark Background
                </h4>
                <p className="logo-upload__dropzone-text text-center">
                  Drag and drop your logo file here, or click to browse.<br />
                  Supported formats: {Object.values(FILE_FORMATS).join(", ")}
                </p>
                <div className="logo-upload__dropzone-actions mt-4">
                  <FileUpload
                    type={type}
                    clientId={clientId}
                    isDarkVariant={true}
                    parentLogoId={logo.id}
                    queryClient={queryClient}
                    buttonOnly={true}
                    className="min-w-32"
                    onSuccess={async () => {
                      parsedData.hasDarkVariant = true;
                      // Ensure we update both queries to refresh the UI immediately
                      await queryClient.invalidateQueries({
                        queryKey: [`/api/clients/${clientId}/assets`],
                      });
                      await queryClient.invalidateQueries({
                        queryKey: [`/api/assets/${logo.id}`],
                      });
                    }}
                  >
                    Browse Files
                  </FileUpload>
                </div>
              </div>
              
              
            </div>
          ) : (
            <div className="logo-display__preview-image-container">
              {parsedData.format === 'svg' ? (
                  <object
                    data={variant === 'dark' && parsedData.hasDarkVariant ? 
                      `/api/assets/${logo.id}/file?variant=dark` : 
                      imageUrl}
                    type="image/svg+xml"
                    className="logo-display__preview-image"
                  >
                    <img
                      src={variant === 'dark' && parsedData.hasDarkVariant ? 
                        `/api/assets/${logo.id}/file?variant=dark` : 
                        imageUrl}
                      className="logo-display__preview-image"
                      alt={logo.name || "SVG Logo"}
                      onError={(e) => {
                        console.error("Error loading SVG:", imageUrl);
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="m9.88 9.88 4.24 4.24"/%3E%3Cpath d="m9.88 14.12 4.24-4.24"/%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E';
                      }}
                    />
                  </object>
              ) : (
                <img
                  src={variant === 'dark' && parsedData.hasDarkVariant ? 
                    `/api/assets/${logo.id}/file?variant=dark` : 
                    imageUrl}
                  alt={logo.name}
                  className="logo-display__preview-image"
                  style={{ 
                    filter: variant === 'dark' && !parsedData.hasDarkVariant ? 'invert(1) brightness(1.5)' : 'none' 
                  }}
                  onError={(e) => {
                    console.error("Error loading image:", imageUrl);
                    e.currentTarget.src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="m9.88 9.88 4.24 4.24"/%3E%3Cpath d="m9.88 14.12 4.24-4.24"/%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E';
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// LogoSection component for each type of logo (used for both empty and populated states)
function LogoSection({ 
  type, 
  logos, 
  clientId, 
  onDeleteLogo,
  queryClient
}: { 
  type: string, 
  logos: BrandAsset[],
  clientId: number,
  onDeleteLogo: (logoId: number, variant: 'light' | 'dark') => void,
  queryClient: any
}) {
  const { user = null } = useAuth();
  const hasLogos = logos.length > 0;

  return (
    <div className="logo-section">
      <div className="logo-section__header">
        <div>
          <h3>
            {type.charAt(0).toUpperCase() + type.slice(1)} Logo
          </h3>
        </div>
      </div>

      <Separator className="logo-section__separator" />

      {/* Display logos if available */}
      {hasLogos ? (
        <div>
          {logos.map((logo) => {
            const parsedData = parseBrandAssetData(logo);
            if (!parsedData) return null;
            const imageUrl = `/api/assets/${logo.id}/file`;
            return (
              <LogoDisplay 
                key={logo.id}
                logo={logo}
                imageUrl={imageUrl}
                parsedData={parsedData}
                onDelete={onDeleteLogo}
                clientId={clientId}
                queryClient={queryClient}
              />
            );
          })}
        </div>
      ) : (
        // Empty state with two-column layout and direct upload interface
        <div className="logo-section__empty">
          {/* Info column with description */}
          <div className="logo-section__empty-info">
            <p>
              {logoDescriptions[type as keyof typeof logoDescriptions]}
            </p>
          </div>

          {/* Always show upload area for non-standard users */}
          {user && user.role !== UserRole.STANDARD ? (
            <FileUpload 
              type={type} 
              clientId={clientId}
              onSuccess={() => {}}
              queryClient={queryClient}
            />
          ) : (
            <div className="logo-section__empty-placeholder">
              <FileType className="logo-section__empty-placeholder-icon h-10 w-10" />
              <p>
                No {type.toLowerCase()} logo uploaded yet
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoManager({ clientId, logos }: LogoManagerProps) {
  const { toast } = useToast();
  const { user = null } = useAuth();
  const queryClient = useQueryClient();

  const deleteLogo = useMutation({
    mutationFn: async ({ logoId, variant }: { logoId: number; variant: 'light' | 'dark' }) => {
      const response = await fetch(
        `/api/clients/${clientId}/assets/${logoId}${variant === 'dark' ? '?variant=dark' : ''}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete logo");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
      });
      toast({
        title: "Success",
        description: "Logo deleted successfully",
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

  const logosByType = Object.values(LogoType).reduce(
    (acc, type) => {
      acc[type] = logos.filter((logo) => {
        const parsedData = parseBrandAssetData(logo);
        return parsedData?.type === type;
      });
      return acc;
    },
    {} as Record<string, BrandAsset[]>,
  );

  return (
    <div className="logo-manager">
    <div className="logo-manager__header">
      <h1>Logo System</h1>
      <p>Manage and download the official logos for this brand</p>
    </div>

      {Object.entries(logosByType).map(([type, typeLogos]) => (
        <LogoSection 
          key={type}
          type={type}
          logos={typeLogos}
          clientId={clientId}
          onDeleteLogo={(logoId, variant) => deleteLogo.mutate({ logoId, variant })}
          queryClient={queryClient}
        />
      ))}
    </div>
  );
}
