import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssetSection } from "./asset-section";
import { AssetDisplay } from "./asset-display";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  RadioGroup, 
  RadioGroupItem 
} from "@/components/ui/radio-group";
import { Plus, Download, Upload, Trash2, FileType, Info, CheckCircle, ExternalLink, Sun, Moon, Lock, Unlock, Copy, X, Folder, FileImage } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { useHiddenSections, useAddHiddenSection, useRemoveHiddenSection } from "@/lib/queries/hidden-sections";
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

// CRITICAL FIX: New helper to ensure we always download the correct client's logos
// This prevents the issue of downloading Summa logo instead of client-specific logo
function getSecureAssetUrl(assetId: number, clientId: number, options: {
  format?: string;
  size?: number;
  variant?: 'dark' | 'light';
  preserveRatio?: boolean;
  preserveVector?: boolean;
} = {}) {
  const { format, size, variant, preserveRatio = true, preserveVector = false } = options;

  // Create URL with built-in URLSearchParams handling
  const url = new URL(`/api/assets/${assetId}/file`, window.location.origin);

  // Add required parameters
  url.searchParams.append('clientId', clientId.toString());
  url.searchParams.append('t', Date.now().toString()); // Cache buster

  // Add optional parameters if provided
  if (variant === 'dark') url.searchParams.append('variant', 'dark');
  if (format) url.searchParams.append('format', format);
  if (size) {
    url.searchParams.append('size', size.toString());
    // Always include preserveRatio for size requests unless explicitly set to false
    url.searchParams.append('preserveRatio', preserveRatio.toString());
  }
  if (preserveVector) url.searchParams.append('preserveVector', 'true');

  console.log(`Generated download URL for asset ${assetId}: ${url.toString()}`);
  return url.toString();
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

// Specialized download button for App Icons
function AppIconDownloadButton({
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
  const [open, setOpen] = useState<boolean>(false);
  const [originalWidth, setOriginalWidth] = useState<number>(300);
  const [originalHeight, setOriginalHeight] = useState<number>(200);
  const { toast } = useToast();

  // Load dimensions once when component mounts
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setOriginalWidth(img.width);
      setOriginalHeight(img.height);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Function to get download URL for a specific size and format
  const getDownloadUrl = (size: number, format: string) => {
    const baseUrl = variant === 'dark' && parsedData.hasDarkVariant ? 
      `/api/assets/${logo.id}/file?variant=dark` : 
      `/api/assets/${logo.id}/file`;

    const separator = baseUrl.includes('?') ? '&' : '?';

    return `${baseUrl}${separator}size=${size}&preserveRatio=true${format !== parsedData.format ? `&format=${format}` : ''}`;
  };

  // Function to download app icon package as a zip file
  const downloadAppIconPackage = async () => {
    try {
      // Show loading toast
      toast({
        title: "Preparing app icon package",
        description: "Creating ZIP file with all app icon sizes...",
      });

      // Define app icon sizes to include in the package
      const sizes = [192, 512, 1024];

      // Create a new JSZip instance
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Create folders in the zip
      const pngFolder = zip.folder("PNG");
      const vectorFolder = zip.folder("Vector");

      if (!pngFolder || !vectorFolder) {
        throw new Error("Failed to create folders in zip file");
      }

      // Fetch all the files and add to zip
      const fetchPromises = [];

      // Add PNG files in different sizes
      for (const size of sizes) {
        // Calculate exact pixel size (but don't exceed 100%)
        const sizePercentage = Math.min(100, (size / originalWidth) * 100);

        // PNG file
        fetchPromises.push(
          fetch(getDownloadUrl(sizePercentage, 'png'))
            .then(response => response.arrayBuffer())
            .then(data => {
              pngFolder.file(`${logo.name}${variant === 'dark' ? '-Dark' : ''}-${size}px.png`, data);
            })
            .catch(err => {
              console.error(`Error fetching PNG for size ${size}:`, err);
            })
        );
      }

      // Add vector files (SVG)
      fetchPromises.push(
        fetch(getDownloadUrl(100, 'svg'))
          .then(response => response.arrayBuffer())
          .then(data => {
            vectorFolder.file(`${logo.name}${variant === 'dark' ? '-Dark' : ''}.svg`, data);
          })
          .catch(err => {
            console.error('Error fetching SVG:', err);
          })
      );

      // Wait for all fetches to complete
      await Promise.all(fetchPromises);

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link for the zip
      const zipUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = zipUrl;
      downloadLink.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}-app-icon-package.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(zipUrl);
        setOpen(false);

        // Show success toast
        toast({
          title: "Download ready",
          description: "App icon package has been downloaded successfully.",
        });
      }, 100);
    } catch (error) {
      console.error("Error creating app icon package:", error);
      toast({
        title: "Download failed",
        description: "There was an error creating the app icon package. Please try downloading individual files instead.",
        variant: "destructive"
      });
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
        <div className="logo-download__content">
          <h4 className="logo-download__heading">App Icon Download Options</h4>

          <div className="logo-download__options">
            {/* App Icon Package Section */}
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">App Icon Package</h5>
              <p className="logo-download__description">
                Standard app icon sizes (512×512, 1024×1024) in PNG format
              </p>
              <div 
                className="logo-download__link"
                onClick={downloadAppIconPackage}
              >
                <Folder className="logo-download__icon" />
                Download app icon package
              </div>
            </div>

            {/* Editable Design Files Section */}
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">Editable Design Files</h5>
              <p className="logo-download__description">
                Vector formats for editing (SVG, EPS, AI)
              </p>
              <div className="logo-download__links">
                {parsedData.figmaLink && (
                  <a 
                    href={parsedData.figmaLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="logo-download__link"
                  >
                    <ExternalLink className="logo-download__icon" />
                    Open in Figma
                  </a>
                )}
                <div 
                  className="logo-download__link"
                  onClick={() => {
                    // Download SVG
                    const container = document.createElement('div');
                    container.style.display = 'none';
                    document.body.appendChild(container);

                    const link = document.createElement('a');
                    link.href = getDownloadUrl(100, 'svg');
                    link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.svg`;
                    container.appendChild(link);
                    link.click();

                    setTimeout(() => {
                      document.body.removeChild(container);
                      setOpen(false);
                    }, 100);
                  }}
                >
                  <FileType className="logo-download__icon" />
                  Download SVG logo
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => {
                    // Download EPS
                    const container = document.createElement('div');
                    container.style.display = 'none';
                    document.body.appendChild(container);

                    const link = document.createElement('a');
                    link.href = getDownloadUrl(100, 'eps');
                    link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.eps`;
                    container.appendChild(link);
                    link.click();

                    setTimeout(() => {
                      document.body.removeChild(container);
                      setOpen(false);
                    }, 100);
                  }}
                >
                  <FileType className="logo-download__icon" />
                  Download EPS logo
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => {
                    // Download AI
                    const container = document.createElement('div');
                    container.style.display = 'none';
                    document.body.appendChild(container);

                    const link = document.createElement('a');
                    link.href = getDownloadUrl(100, 'ai');
                    link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.ai`;
                    container.appendChild(link);
                    link.click();

                    setTimeout(() => {
                      document.body.removeChild(container);
                      setOpen(false);
                    }, 100);
                  }}
                >
                  <FileType className="logo-download__icon" />
                  Download AI logo
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Logo download button with customization options
// Generic Download Button for most logo types
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
  // For favicon type, use specialized download button
  if (parsedData.type === 'favicon') {
    return <FaviconDownloadButton logo={logo} imageUrl={imageUrl} variant={variant} parsedData={parsedData} />;
  }

  // For app-icon type, use specialized download button
  if (parsedData.type === 'app-icon') {
    return <AppIconDownloadButton logo={logo} imageUrl={imageUrl} variant={variant} parsedData={parsedData} />;
  }

  // For standard logo types (main, horizontal, vertical, square)
  return <StandardLogoDownloadButton logo={logo} imageUrl={imageUrl} variant={variant} parsedData={parsedData} />;
}

// Specialized download button for standard logo types (main, horizontal, vertical, square)
function StandardLogoDownloadButton({
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
  const [open, setOpen] = useState<boolean>(false);
  const [originalWidth, setOriginalWidth] = useState<number>(300);
  const [originalHeight, setOriginalHeight] = useState<number>(200);
  const { toast } = useToast();

  // Load dimensions once when component mounts
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setOriginalWidth(img.width);
      setOriginalHeight(img.height);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Function to get download URL for a specific size and format
  const getDownloadUrl = (size: number, format: string) => {
    const baseUrl = variant === 'dark' && parsedData.hasDarkVariant ? 
      `/api/assets/${logo.id}/file?variant=dark` : 
      `/api/assets/${logo.id}/file`;

    const separator = baseUrl.includes('?') ? '&' : '?';

    return `${baseUrl}${separator}size=${size}&preserveRatio=true${format !== parsedData.format ? `&format=${format}` : ''}`;
  };

  // Function to download a zip package of all logo sizes
  const downloadAllLogos = async () => {
    try {
      // Show loading toast
      toast({
        title: "Preparing download package",
        description: "Creating ZIP file with all logo sizes...",
      });

      // Define logo sizes to include in the package (small, medium, large)
      const sizes = [300, 800, 2000];

      // Log the logo info we're downloading
      console.log(`Creating download package for logo: ID ${logo.id}, Name: ${logo.name}, Client ID: ${logo.clientId}`);

      // Create a new JSZip instance
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Create a better folder structure for the zip with client name
      const clientName = logo.name.replace(/[^a-z0-9]/gi, '-').toLowerCase(); 
      const pngFolder = zip.folder("PNG");
      const vectorFolder = zip.folder("Vector");

      if (!pngFolder || !vectorFolder) {
        throw new Error("Failed to create folders in zip file");
      }

      // Fetch all the files and add to zip
      const fetchPromises = [];

      // Add PNG files in different sizes - pass exact pixel dimensions
      for (const size of sizes) {
        // CRITICAL FIX: Ensure we pass correct client ID for downloads
        const url = `/api/assets/${logo.id}/file?clientId=${logo.clientId}&size=${size}&format=png${variant === 'dark' ? '&variant=dark' : ''}&preserveRatio=true`;
        console.log(`Downloading logo: ID ${logo.id}, Client: ${logo.clientId}, Name: ${logo.name}`);

        console.log(`Fetching ${size}px logo from: ${url}`);

        // Use a reference to avoid TypeScript null warnings
        const pngFolderRef = pngFolder;
        fetchPromises.push(
          fetch(url, {
            // CRITICAL FIX: Add cache control headers
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          })
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed to fetch ${size}px PNG: ${response.status} ${response.statusText}`);
              }
              return response.arrayBuffer();
            })
            .then(data => {
              pngFolderRef.file(filename, data);
            })
            .catch(err => {
              console.error(`Error with ${size}px PNG:`, err);
              // Continue with other files
            })
        );
      }

      // Add vector files (SVG, EPS, AI, PDF)
      const vectorFormats = ['svg', 'eps', 'ai', 'pdf'];
      // Use a reference to avoid TypeScript null warnings
      const vectorFolderRef = vectorFolder;
      for (const format of vectorFormats) {
        // CRITICAL FIX: Use the secure URL helper to ensure we download the correct client's logo
        // This prevents the issue where clients were downloading the Summa logo instead of their own
        const url = getSecureAssetUrl(logo.id, logo.clientId, {
          format,
          variant: variant === 'dark' ? 'dark' : undefined,
          preserveVector: true
        });
        const filename = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;

        console.log(`Fetching ${format} logo from: ${url}`);

        fetchPromises.push(
          fetch(url, {
            // CRITICAL FIX: Add cache control headers
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          })
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed to fetch ${format}: ${response.status} ${response.statusText}`);
              }
              return response.arrayBuffer();
            })
            .then(data => {
              vectorFolderRef.file(filename, data);
            })
            .catch(err => {
              console.error(`Error with ${format}:`, err);
              // Continue with other files
            })
        );
      }

      // Wait for all fetches to complete
      await Promise.all(fetchPromises);

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link for the zip
      const zipUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = zipUrl;
      downloadLink.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}-package.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(zipUrl);
        setOpen(false);

        // Show success toast
        toast({
          title: "Download ready",
          description: "Logo package has been downloaded successfully.",
        });
      }, 100);
    } catch (error) {
      console.error("Error creating download package:", error);
      toast({
        title: "Download failed",
        description: "There was an error creating the logo package. Please try downloading individual files instead.",
        variant: "destructive"
      });
    }
  };

  // Function to download a specific size
  const downloadSpecificSize = (size: number) => {
    try {
      // Validate required parameters
      if (!logo.id || !logo.clientId) {
        throw new Error('Missing required logo data');
      }

      // Add extensive logging for debugging
      console.log('Download initiated with details:', {
        logoId: logo.id,
        clientId: logo.clientId,
        logoName: logo.name,
        variant,
        size
      });

      // Build download URL with explicit verification parameters
      // Use the secure helper function to construct the URL
      const downloadUrl = getSecureAssetUrl(logo.id, logo.clientId, {
        format: 'png',
        size: size,
        variant: variant === 'dark' ? 'dark' : undefined,
        preserveRatio: true
      });

      console.log(`Downloading logo ${logo.id} for client ${logo.clientId} with URL: ${downloadUrl}`);

      console.log('Initiating download:', {
        logoId: logo.id,
        clientId: logo.clientId,
        name: logo.name,
        size,
        variant,
        url: downloadUrl.toString()
      });

      // Create temporary download link
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);

      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl.toString();
      downloadLink.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}-${size}px.png`;

      container.appendChild(downloadLink);
      downloadLink.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(container);
        setOpen(false);
      }, 100);

    } catch (error) {
      console.error("Download failed:", error);
```python
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download logo",
        variant: "destructive"
      });
    }
  };

  // Function to download editable design files (SVG, EPS, AI)
  const downloadEditableFiles = (format: string) => {
    try {
      // Create an invisible container for download links
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);

      // Create secure download URL with explicit client ID
      const downloadUrlWithClientId = getSecureAssetUrl(logo.id, logo.clientId, {
        format,
        variant: variant === 'dark' ? 'dark' : undefined,
        preserveVector: true
      });
      console.log(`Downloading vector format ${format} for logo: ID ${logo.id}, Client: ${logo.clientId}, URL: ${downloadUrlWithClientId}`);

      // Create download link
      const link = document.createElement('a');
      link.href = downloadUrlWithClientId;
      link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;
      container.appendChild(link);
      link.click();

      // Clean up the container after download
      setTimeout(() => {
        document.body.removeChild(container);
        setOpen(false); // Close popover after download
      }, 100);
    } catch (error) {
      console.error(`Error downloading ${format} file:`, error);
      toast({
        title: "Download failed",
        description: `There was an error downloading the ${format.toUpperCase()} file.`,
        variant: "destructive"
      });
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
        <div className="logo-download__content">
          <h4 className="logo-download__heading">Download Options</h4>

          <div className="logo-download__options">
            {/* PNG Package Section */}
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">PNG File Options</h5>
              <p className="logo-download__description">
                Standard PNG formats with transparent background
              </p>
              <div className="logo-download__links">
                <div 
                  className="logo-download__link"
                  onClick={downloadAllLogos}
                >
                  <Folder className="logo-download__icon" />
                  Logo Package (small, medium, large)
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => downloadSpecificSize(300)}
                >
                  <FileType className="logo-download__icon" />
                  Small (300px wide)
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => downloadSpecificSize(800)}
                >
                  <FileType className="logo-download__icon" />
                  Medium (800px wide)
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => downloadSpecificSize(2000)}
                >
                  <FileType className="logo-download__icon" />
                  Large (2000px wide)
                </div>
              </div>
            </div>

            {/* Editable Design Files Section */}
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">Editable Design Files</h5>
              <p className="logo-download__description">
                Vector formats for editing (SVG, EPS, AI)
              </p>
              <div className="logo-download__links">
                {parsedData.figmaLink && (
                  <a 
                    href={parsedData.figmaLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="logo-download__link"
                  >
                    <ExternalLink className="logo-download__icon" />
                    Open in Figma
                  </a>
                )}
                <div 
                  className="logo-download__link"
                  onClick={() => downloadEditableFiles('svg')}
                >
                  <FileType className="logo-download__icon" />
                  Download SVG logo
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => downloadEditableFiles('eps')}
                >
                  <FileType className="logo-download__icon" />
                  Download EPS logo
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => downloadEditableFiles('ai')}
                >
                  <FileType className="logo-download__icon" />
                  Download AI logo
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => downloadEditableFiles('pdf')}
                >
                  <FileType className="logo-download__icon" />
                  Download PDF logo
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Specialized download button for Favicons
function FaviconDownloadButton({
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
  const [open, setOpen] = useState<boolean>(false);
  const [originalWidth, setOriginalWidth] = useState<number>(300);
  const [originalHeight, setOriginalHeight] = useState<number>(200);
  const { toast } = useToast();

  // Load dimensions once when component mounts
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setOriginalWidth(img.width);
      setOriginalHeight(img.height);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Function to get download URL for a specific size and format
  const getDownloadUrl = (size: number, format: string) => {
    const baseUrl = variant === 'dark' && parsedData.hasDarkVariant ? 
      `/api/assets/${logo.id}/file?variant=dark` : 
      `/api/assets/${logo.id}/file`;

    const separator = baseUrl.includes('?') ? '&' : '?';

    return `${baseUrl}${separator}size=${size}&preserveRatio=true${format !== parsedData.format ? `&format=${format}` : ''}`;
  };

  // Function to download the favicon package as a zip file (multiple sizes in ICO and PNG formats)
  const downloadFaviconPackage = async () => {
    try {
      // Show loading toast
      toast({
        title: "Preparing favicon package",
        description: "Creating ZIP file with all favicon sizes...",
      });

      // Define favicon sizes to include in the package
      const sizes = [16, 32, 48, 64];

      // Create a new JSZip instance
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Create folders in the zip
      const icoFolder = zip.folder("ICO");
      const pngFolder = zip.folder("PNG");
      const vectorFolder = zip.folder("Vector");

      if (!icoFolder || !pngFolder || !vectorFolder) {
        throw new Error("Failed to create folders in zip file");
      }

      // Fetch all the files and add to zip
      const fetchPromises = [];

      // Add ICO and PNG files in different sizes
      for (const size of sizes) {
        // Calculate exact pixel size
        const sizePercentage = Math.min(100, (size / originalWidth) * 100);

        // ICO file - strongly typed to avoid TypeScript errors
        const icoFolderRef = icoFolder;
        fetchPromises.push(
          fetch(getDownloadUrl(sizePercentage, 'ico'))
            .then(response => response.arrayBuffer())
            .then(data => {
              icoFolderRef.file(`${logo.name}${variant === 'dark' ? '-Dark' : ''}-${size}px.ico`, data);
            })
            .catch(err => {
              console.error(`Error fetching ICO for size ${size}:`, err);
            })
        );

        // PNG file - strongly typed to avoid TypeScript errors
        const pngFolderRef = pngFolder;
        fetchPromises.push(
          fetch(getDownloadUrl(sizePercentage, 'png'))
            .then(response => response.arrayBuffer())
            .then(data => {
              pngFolderRef.file(`${logo.name}${variant === 'dark' ? '-Dark' : ''}-${size}px.png`, data);
            })
            .catch(err => {
              console.error(`Error fetching PNG for size ${size}:`, err);
            })
        );
      }

      // Add vector files (SVG) - strongly typed to avoid TypeScript errors
      const vectorFolderRef = vectorFolder;
      fetchPromises.push(
        fetch(getDownloadUrl(100, 'svg'))
          .then(response => response.arrayBuffer())
          .then(data => {
            vectorFolderRef.file(`${logo.name}${variant === 'dark' ? '-Dark' : ''}.svg`, data);
          })
          .catch(err => {
            console.error('Error fetching SVG:', err);
          })
      );

      // Wait for all fetches to complete
      await Promise.all(fetchPromises);

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create download link for the zip
      const zipUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = zipUrl;
      downloadLink.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}-favicon-package.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(zipUrl);
        setOpen(false);

        // Show success toast
        toast({
          title: "Download ready",
          description: "Favicon package has been downloaded successfully.",
        });
      }, 100);
    } catch (error) {
      console.error("Error creating favicon package:", error);
      toast({
        title: "Download failed",
        description: "There was an error creating the favicon package. Please try downloading individual files instead.",
        variant: "destructive"
      });
    }
  };

  // Function to download editable design files (SVG, EPS, AI)
  const downloadEditableFiles = (format: string) => {
    try {
      // Create an invisible container for download links
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);

      // Create download link
      const link = document.createElement('a');
      link.href = getDownloadUrl(100, format); // Use original size (100%)
      link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;
      container.appendChild(link);
      link.click();

      // Clean up the container after download
      setTimeout(() => {
        document.body.removeChild(container);
        setOpen(false); // Close popover after download
      }, 100);
    } catch (error) {
      console.error(`Error downloading ${format} file:`, error);
      toast({
        title: "Download failed",
        description: `There was an error downloading the ${format.toUpperCase()} file.`,
        variant: "destructive"
      });
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
        <div className="logo-download__content">
          <h4 className="logo-download__heading">Favicon Download Options</h4>

          <div className="logo-download__options">
            {/* Favicon Package Section */}
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">Favicon Package</h5>
              <p className="logo-download__description">
                Standard favicon sizes (16×16, 32×32, 48×48) in ICO and PNG formats
              </p>
              <div 
                className="logo-download__link"
                onClick={downloadFaviconPackage}
              >
                <Folder className="logo-download__icon" />
                Download favicon package
              </div>
            </div>

            {/* Editable Design Files Section */}
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">Editable Design Files</h5>
              <p className="logo-download__description">
                Vector formats for editing (SVG, EPS, AI)
              </p>
              <div className="logo-download__links">
                {parsedData.figmaLink && (
                  <a 
                    href={parsedData.figmaLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="logo-download__link"
                  >
                    <ExternalLink className="logo-download__icon" />
                    Open in Figma
                  </a>
                )}
                <div 
                  className="logo-download__link"
                  onClick={() => {
                    // Download SVG
                    const container = document.createElement('div');
                    container.style.display = 'none';
                    document.body.appendChild(container);

                    const link = document.createElement('a');
                    link.href = getDownloadUrl(100, 'svg');
                    link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.svg`;
                    container.appendChild(link);
                    link.click();

                    setTimeout(() => {
                      document.body.removeChild(container);
                      setOpen(false);
                    }, 100);
                  }}
                >
                  <FileType className="logo-download__icon" />
                  Download SVG logo
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => {
                    // Download EPS
                    const container = document.createElement('div');
                    container.style.display = 'none';
                    document.body.appendChild(container);

                    const link = document.createElement('a');
                    link.href = getDownloadUrl(100, 'eps');
                    link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.eps`;
                    container.appendChild(link);
                    link.click();

                    setTimeout(() => {
                      document.body.removeChild(container);
                      setOpen(false);
                    }, 100);
                  }}
                >
                  <FileType className="logo-download__icon" />
                  Download EPS logo
                </div>
                <div 
                  className="logo-download__link"
                  onClick={() => {
                    // Download AI
                    const container = document.createElement('div');
                    container.style.display = 'none';
                    document.body.appendChild(container);

                    const link = document.createElement('a');
                    link.href = getDownloadUrl(100, 'ai');
                    link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.ai`;
                    container.appendChild(link);
                    link.click();

                    setTimeout(() => {
                      document.body.removeChild(container);
                      setOpen(false);
                    }, 100);
                  }}
                >
                  <FileType className="logo-download__icon" />
                  Download AI logo
                </div>
              </div>
            </div>
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
  const type = parsedData.type;
  const { toast } = useToast();

  const handleFileUpload = async (file: File, variant: 'light' | 'dark') => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo${variant === 'dark' ? ' (Dark)' : ''}`);
    formData.append("type", type);
    formData.append("category", "logo");

    if (variant === 'dark') {
      formData.append("isDarkVariant", "true");
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      formData.append("data", JSON.stringify({
        type,
        format: fileExtension,
        hasDarkVariant: true,
        isDarkVariant: true
      }));
    } else {
      formData.append("isDarkVariant", "false");
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      formData.append("data", JSON.stringify({
        type,
        format: fileExtension,
        hasDarkVariant: parsedData.hasDarkVariant || false
      }));
    }

    const endpoint = variant === 'dark' ? 
      `/api/clients/${clientId}/assets/${logo.id}?variant=dark` :
      `/api/clients/${clientId}/assets/${logo.id}`;

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
      });
      await queryClient.invalidateQueries({
        queryKey: [`/api/assets/${logo.id}`],
      });

      toast({
        title: "Success",
        description: variant === 'dark' 
          ? `${type.charAt(0).toUpperCase() + type.slice(1)} dark variant uploaded successfully` 
          : `${type.charAt(0).toUpperCase() + type.slice(1)} logo updated successfully`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload logo",
        variant: "destructive",
      });
    }
  };

  return (
    
    <AssetDisplay
      renderActions={(variant) => (
        <>
          <LogoDownloadButton 
            logo={logo} 
            imageUrl={imageUrl} 
            variant={variant}
            parsedData={parsedData}
          />
          <Button
            variant="ghost"
            size="sm"
            className="asset-display__preview-action-button"
            onClick={(e) => {
              e.preventDefault();
              const fileInput = e.currentTarget.closest('.asset-display')?.querySelector('input[type="file"]');
              if (fileInput) {
                fileInput.click();
              }
            }}
          >
            <Upload className="h-3 w-3" />
            <span>Replace</span>
          </Button>
          {((variant === 'dark' && parsedData.hasDarkVariant) || variant === 'light') && (
            <button 
              className="asset-display__preview-action-button"
              onClick={() => onDelete(logo.id, variant)}
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete</span>
            </button>
          )}
        </>
      )}
      onFileUpload={handleFileUpload}
      renderAsset={(variant) => (
        variant === 'dark' && !parsedData.hasDarkVariant ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={async () => {
                  try {
                    const fileResponse = await fetch(`/api/assets/${logo.id}/file`);
                    if (!fileResponse.ok) throw new Error("Failed to fetch light variant file");

                    const fileBlob = await fileResponse.blob();
                    const fileName = `${type}_logo_dark.${parsedData.format}`;
                    const file = new File([fileBlob], fileName, { type: fileResponse.headers.get('content-type') || 'image/svg+xml' });
                    await handleFileUpload(file, 'dark');
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
          <div className="asset-display__preview-image-container">
            {parsedData.format === 'svg' ? (
              <object
                data={variant === 'dark' && parsedData.hasDarkVariant ? 
                  `/api/assets/${logo.id}/file?variant=dark` : 
                  imageUrl}
                type="image/svg+xml"
                className="asset-display__preview-image"
              >
                <img
                  src={variant === 'dark' && parsedData.hasDarkVariant ? 
                    `/api/assets/${logo.id}/file?variant=dark` : 
                    imageUrl}
                  className="asset-display__preview-image"
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
                className="asset-display__preview-image"
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
        )
      )}
      description={logoUsageGuidance[type as keyof typeof logoUsageGuidance]}
      supportsVariants={true}
    />
  );
}

// LogoSection component for each type of logo (used for both empty and populated states)
function LogoSection({ 
  type, 
  logos, 
  clientId, 
  onDeleteLogo,
  queryClient,
  onRemoveSection
}: { 
  type: string, 
  logos: BrandAsset[],
  clientId: number,
  onDeleteLogo: (logoId: number, variant: 'light' | 'dark') => void,
  queryClient: any,
  onRemoveSection?: (type: string) => void
}) {
  const { user = null } = useAuth();
  const hasLogos = logos.length > 0;

  return (
    <AssetSection
      title={`${type.charAt(0).toUpperCase() + type.slice(1)} Logo`}
      description={logoDescriptions[type as keyof typeof logoDescriptions]}
      isEmpty={!hasLogos}
      onRemoveSection={onRemoveSection}
      sectionType={type}
      uploadComponent={
        <FileUpload 
          type={type} 
          clientId={clientId}
          onSuccess={() => {}}
          queryClient={queryClient}
        />
      }
      emptyPlaceholder={
        <div className="logo-section__empty-placeholder">
          <FileType className="logo-section__empty-placeholder-icon h-10 w-10" />
          <p>
            No {type.toLowerCase()} logo uploaded yet
          </p>
        </div>
      }
    >
      {hasLogos && logos.map((logo) => {
        const parsedData = parseBrandAssetData(logo);
        if (!parsedData) return null;
        const imageUrl = `/api/assets/${logo.id}/file`;
        return (
          
</previous_generation>          <LogoDisplay
            key={logo.id}
            renderActions={(variant) => (
              <>
                <LogoDownloadButton 
                  logo={logo} 
                  imageUrl={imageUrl} 
                  variant={variant}
                  parsedData={parsedData}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="asset-display__preview-action-button"
                  onClick={(e) => {
                    e.preventDefault();
                    const fileInput = e.currentTarget.closest('.asset-display')?.querySelector('input[type="file"]');
                    if (fileInput) {
                      fileInput.click();
                    }
                  }}
                >
                  <Upload className="h-3 w-3" />
                  <span>Replace</span>
                </Button>
                {((variant === 'dark' && parsedData.hasDarkVariant) || variant === 'light') && (
                  <button 
                    className="asset-display__preview-action-button"
                    onClick={() => onDeleteLogo(logo.id, variant)}
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                )}
              </>
            )}
            onFileUpload={(file, variant) => {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo`);
              formData.append("type", type);
              formData.append("category", "logo");

              if (variant === 'dark') {
                formData.append("isDarkVariant", "true");
                formData.append("data", JSON.stringify({
                  type,
                  format: file.name.split('.').pop()?.toLowerCase(),
                  hasDarkVariant: true,
                  isDarkVariant: true
                }));
                formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo (Dark)`);
              } else {
                formData.append("isDarkVariant", "false");
                formData.append("data", JSON.stringify({
                  type,
                  format: file.name.split('.').pop()?.toLowerCase(),
                  hasDarkVariant: parsedData.hasDarkVariant || false
                }));
              }

              const createUpload = async () => {
                const endpoint = variant === 'dark' ? 
                  `/api/clients/${clientId}/assets/${logo.id}?variant=dark` :
                  `/api/clients/${clientId}/assets/${logo.id}`;

                const response = await fetch(endpoint, {
                  method: "PATCH",
                  body: formData,
                });

                if (!response.ok) {
                  throw new Error(await response.text());
                }

                await queryClient.invalidateQueries({
                  queryKey: [`/api/clients/${clientId}/assets`],
                });
                await queryClient.invalidateQueries({
                  queryKey: [`/api/assets/${logo.id}`],
                });
              };

              createUpload();
            }}
            renderAsset={(variant) => (
              variant === 'dark' && !parsedData.hasDarkVariant ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={async () => {
                        try {
                          const fileResponse = await fetch(`/api/assets/${logo.id}/file`);
                          if (!fileResponse.ok) throw new Error("Failed to fetch light variant file");

                          const fileBlob = await fileResponse.blob();
                          const fileName = `${type}_logo_dark.${parsedData.format}`;
                          const file = new File([fileBlob], fileName, { type: fileResponse.headers.get('content-type') || 'image/svg+xml' });

                          const formData = new FormData();
                          formData.append("file", file);
                          formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo (Dark)`);
                          formData.append("type", type);
                          formData.append("category", "logo");
                          formData.append("isDarkVariant", "true");
                          formData.append("data", JSON.stringify({
                            type,
                            format: parsedData.format,
                            hasDarkVariant: true,
                            isDarkVariant: true
                          }));

                          const response = await fetch(`/api/clients/${clientId}/assets/${logo.id}?variant=dark`, {
                            method: "PATCH",
                            body: formData,
                          });

                          if (!response.ok) {
                            throw new Error(await response.text());
                          }

                          parsedData.hasDarkVariant = true;
                          await queryClient.invalidateQueries({
                            queryKey: [`/api/clients/${clientId}/assets`],
                          });
                          await queryClient.invalidateQueries({
                            queryKey: [`/api/assets/${logo.id}`],
                          });
                        } catch (error) {
                          console.error("Error copying light variant as dark:", error);
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
                <div className="asset-display__preview-image-container">
                  {parsedData.format === 'svg' ? (
                    <object
                      data={variant === 'dark' && parsedData.hasDarkVariant ? 
                        `/api/assets/${logo.id}/file?variant=dark` : 
                        imageUrl}
                      type="image/svg+xml"
                      className="asset-display__preview-image"
                    >
                      <img
                        src={variant === 'dark' && parsedData.hasDarkVariant ? 
                          `/api/assets/${logo.id}/file?variant=dark` : 
                          imageUrl}
                        className="asset-display__preview-image"
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
                      className="asset-display__preview-image"
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
              )
            )}
            description={logoUsageGuidance[type as keyof typeof logoUsageGuidance]}
            supportsVariants={true}
          />
        );
      })}
    </AssetSection>
  );
}

export function LogoManager({ clientId, logos }: LogoManagerProps) {
  const { toast } = useToast();
  const { user = null } = useAuth();
  const queryClient = useQueryClient();
  // State to track which logo types are visible
  const [visibleSections, setVisibleSections] = useState<string[]>([]);
  // State to track if add section dialog is open
  const [showAddSection, setShowAddSection] = useState(false);
  // State to track available sections to add
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  // Fetch hidden sections from database
  const { data: hiddenSections, isLoading: loadingHiddenSections } = useHiddenSections(clientId);

  // Mutations for adding/removing hidden sections
  const addHiddenSection = useAddHiddenSection(clientId);
  const removeHiddenSection = useRemoveHiddenSection(clientId);

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  // Set up initial visible sections based on hidden sections from database
  useEffect(() => {
    if (loadingHiddenSections) return;

    // Start with all logo types
    const allLogoTypes = Object.values(LogoType);

    // If we have hidden sections data, filter them out
    if (hiddenSections && Array.isArray(hiddenSections)) {
      const hiddenTypes = hiddenSections.map(section => section.sectionType);
      const visible = allLogoTypes.filter(type => !hiddenTypes.includes(type));
      setVisibleSections(visible);
    } else {
      // If no hidden sections or error, show all by default
      setVisibleSections(allLogoTypes);
    }
  }, [hiddenSections, loadingHiddenSections]);

  // When visible sections change, update available sections
  useEffect(() => {
    // Available sections are those that exist in LogoType but not in visibleSections
    const available = Object.values(LogoType).filter(
      (type) => !visibleSections.includes(type)
    );
    setAvailableSections(available);
  }, [visibleSections]);

  const deleteLogo = useMutation({
    mutationFn: async ({ logoId, variant }: { logoId: number; variant: 'light' | 'dark' }) => {
      const response =await fetch(
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

  // Handle removing a section
  const handleRemoveSection = (type: string) => {
    // Update local state immediately for responsiveness
    setVisibleSections(prev => prev.filter(section => section !== type));

    // Persist to database
    addHiddenSection.mutate(type, {
      onSuccess: () => {
        toast({
          title: "Section removed",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} logo section has been removed`,
        });
      },
      onError: (error) => {
        // Revert local state on error
        setVisibleSections(prev => [...prev, type]);
        toast({
          title: "Error",
          description: `Failed to remove section: ${error.message}`,
          variant: "destructive",
        });
      }
    });
  };

  // Handle adding a section
  const handleAddSection = (type: string) => {
    // Update local state immediately for responsiveness
    setVisibleSections(prev => [...prev, type]);
    setShowAddSection(false);

    // Persist to database
    removeHiddenSection.mutate(type, {
      onSuccess: () => {
        toast({
          title: "Section added",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} logo section has been added`,
        });
      },
      onError: (error) => {
        // Revert local state on error
        setVisibleSections(prev => prev.filter(section => section !== type));
        toast({
          title: "Error",
          description: `Failed to add section: ${error.message}`,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="logo-manager">
      <div className="logo-manager__header flex justify-between items-center">
        <div>
          <h1>Logo System</h1>
          <p>Manage and download the official logos for this brand</p>
        </div>
        {isAdmin && availableSections.length > 0 && (
          <Button 
            onClick={() => setShowAddSection(true)} 
            variant="outline"
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span>Add Section</span>
          </Button>
        )}
      </div>

      {visibleSections.map((type) => (
        <LogoSection 
          key={type}
          type={type}
          logos={logosByType[type] || []}
          clientId={clientId}
          onDeleteLogo={(logoId, variant) => deleteLogo.mutate({ logoId, variant })}
          queryClient={queryClient}
          onRemoveSection={isAdmin ? handleRemoveSection : undefined}
        />
      ))}

      {/* Dialog for adding sections */}
      {isAdmin && (
        <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Logo Section</DialogTitle>
              <DialogDescription>
                Select a logo section to add to the page
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {availableSections.map((section) => (
                <Button 
                  key={section} 
                  variant="outline" 
                  className="justify-start text-left"
                  onClick={() => handleAddSection(section)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {section.charAt(0).toUpperCase() + section.slice(1)} Logo
                </Button>
              ))}
              {availableSections.length === 0 && (
                <p className="text-muted-foreground text-center py-2">
                  All available sections are already displayed
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}