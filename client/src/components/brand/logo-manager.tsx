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

// Helper to ensure we always download the correct client's logos
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

// Specialized download button for logos
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
  const { toast } = useToast();

  // Function to get download URL for a specific size and format
  const getDownloadUrl = (size: number, format: string) => {
    const baseUrl = variant === 'dark' && parsedData.hasDarkVariant ? 
      `/api/assets/${logo.id}/file?variant=dark` : 
      `/api/assets/${logo.id}/file`;

    const separator = baseUrl.includes('?') ? '&' : '?';

    return `${baseUrl}${separator}size=${size}&preserveRatio=true${format !== parsedData.format ? `&format=${format}` : ''}`;
  };

  // Function to download a single file of a specific format
  const downloadSingleFile = async (format: string) => {
    try {
      // Create a hidden container to download the file
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);

      // Create a temporary anchor element
      const link = document.createElement('a');
      link.href = getDownloadUrl(300, format);
      link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;
      container.appendChild(link);
      link.click();

      // Clean up the container after download
      setTimeout(() => {
        document.body.removeChild(container);
        setOpen(false); // Close popover after download
      }, 100);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Download failed",
        description: "There was an error downloading the file.",
        variant: "destructive"
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="asset-display__preview-action-button">
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
                  onClick={() => downloadSingleFile('png')}
                >
                  <FileType className="logo-download__icon" />
                  Download PNG
                </div>
              </div>
            </div>

            {/* SVG Section */}
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">Vector Format</h5>
              <p className="logo-download__description">
                Scalable vector format for design work
              </p>
              <div className="logo-download__links">
                <div 
                  className="logo-download__link"
                  onClick={() => downloadSingleFile('svg')}
                >
                  <FileType className="logo-download__icon" />
                  Download SVG
                </div>
              </div>
            </div>

            {/* PDF Section */}
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">Print Format</h5>
              <p className="logo-download__description">
                High-quality PDF for print materials
              </p>
              <div className="logo-download__links">
                <div 
                  className="logo-download__link"
                  onClick={() => downloadSingleFile('pdf')}
                >
                  <FileType className="logo-download__icon" />
                  Download PDF
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Simplified logo section component
function LogoSection({ 
  type, 
  logos, 
  clientId, 
  onDeleteLogo, 
  queryClient,
  onRemoveSection
}: {
  type: string;
  logos: BrandAsset[];
  clientId: number;
  onDeleteLogo: (logoId: number, variant?: 'light' | 'dark') => void;
  queryClient: any;
  onRemoveSection?: (type: string) => void;
}) {
  const hasLogos = logos.length > 0;
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const description = logoDescriptions[type as keyof typeof logoDescriptions] || "";
  const usageGuidance = logoUsageGuidance[type as keyof typeof logoUsageGuidance] || "";

  return (
    <AssetSection
      title={`${type.charAt(0).toUpperCase() + type.slice(1)} Logo`}
      description={description}
      isEmpty={!hasLogos}
      onRemoveSection={onRemoveSection}
      sectionType={type}
      uploadComponent={
        !hasLogos ? (
          <FileUpload
            type={type}
            clientId={clientId}
            queryClient={queryClient}
            onSuccess={() => {
              queryClient.invalidateQueries({
                queryKey: [`/api/clients/${clientId}/assets`],
              });
            }}
          />
        ) : null
      }
    >
      {hasLogos && logos.map((logo) => {
        const parsedData = parseBrandAssetData(logo);
        if (!parsedData) return null;
        const imageUrl = `/api/assets/${logo.id}/file`;

        return (
          <AssetDisplay
            key={logo.id}
            className="logo-asset-display"
            onFileUpload={async (file, variant) => {
              // Handle file upload for variant updates
              try {
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
              } catch (error) {
                console.error("Error updating logo:", error);
                throw error;
              }
            }}
            renderActions={(variant: 'light' | 'dark') => (
              <div className="asset-display__actions">
                <StandardLogoDownloadButton
                  logo={logo}
                  imageUrl={variant === 'dark' && parsedData.hasDarkVariant ? 
                    `/api/assets/${logo.id}/file?variant=dark` : imageUrl}
                  variant={variant}
                  parsedData={parsedData}
                />
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="asset-display__preview-action-button asset-display__preview-action-button--danger">
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Logo</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the {variant} version of this logo. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteLogo(logo.id, variant)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Logo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
            renderAsset={(variant: 'light' | 'dark') => {
              const assetUrl = variant === 'dark' && parsedData.hasDarkVariant ? 
                `/api/assets/${logo.id}/file?variant=dark` : imageUrl;
              
              return (
                <div className="asset-display__preview">
                  <img
                    src={assetUrl}
                    alt={`${logo.name} - ${variant} variant`}
                    className="asset-display__image"
                  />
                </div>
              );
            }}
            description={`Format: ${parsedData.format?.toUpperCase()}`}
            supportsVariants={true}
            onFileUpload={async (file, variant) => {
              // Handle file upload for variant updates
              try {
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
              } catch (error) {
                console.error("Error updating logo:", error);
                throw error;
              }
            }}
            className="logo-asset-display"
          />
        );
      })}

      {!hasLogos && (
        <div className="logo-section__empty">
          <FileUpload
            type={type}
            clientId={clientId}
            queryClient={queryClient}
            onSuccess={() => {
              queryClient.invalidateQueries({
                queryKey: [`/api/clients/${clientId}/assets`],
              });
            }}
          />
        </div>
      )}
    </AssetSection>
  );
}

export function LogoManager({ clientId, logos }: LogoManagerProps) {
  const [showAddSection, setShowAddSection] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  // Get hidden sections
  const { data: hiddenSections = [] } = useHiddenSections(clientId);
  const addHiddenSection = useAddHiddenSection();
  const removeHiddenSection = useRemoveHiddenSection();

  // Group logos by type
  const logosByType = logos.reduce((acc: Record<string, BrandAsset[]>, logo) => {
    const parsedData = parseBrandAssetData(logo);
    if (parsedData && parsedData.type) {
      const type = parsedData.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(logo);
    }
    return acc;
  }, {});

  // All possible logo types
  const allLogoTypes = ['main', 'horizontal', 'vertical', 'square', 'app_icon', 'favicon'];

  // Visible sections (not hidden)
  const visibleSections = allLogoTypes.filter(type => 
    !hiddenSections.includes(type)
  );

  // Available sections to add (hidden sections that aren't already visible)
  const availableSections = allLogoTypes.filter(type => 
    hiddenSections.includes(type)
  );

  // Delete logo mutation
  const deleteLogo = useMutation({
    mutationFn: async ({ logoId, variant }: { logoId: number; variant?: 'light' | 'dark' }) => {
      const endpoint = variant === 'dark' ? 
        `/api/clients/${clientId}/assets/${logoId}?variant=dark` :
        `/api/clients/${clientId}/assets/${logoId}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete logo");
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

  const handleAddSection = (section: string) => {
    addHiddenSection.mutate(
      { clientId, sectionType: section },
      {
        onSuccess: () => {
          setShowAddSection(false);
          toast({
            title: "Success",
            description: `${section.charAt(0).toUpperCase() + section.slice(1)} section added`,
          });
        },
        onError: (error: Error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleRemoveSection = (section: string) => {
    removeHiddenSection.mutate(
      { clientId, sectionType: section },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: `${section.charAt(0).toUpperCase() + section.slice(1)} section removed`,
          });
        },
        onError: (error: Error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="logo-manager">
      <div className="logo-manager__header">
        <h2 className="logo-manager__title">Logo Assets</h2>
        <p className="logo-manager__description">
          Manage your brand's logo variations for different use cases and contexts.
        </p>
        {isAdmin && availableSections.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddSection(true)}
            className="logo-manager__add-section"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Logo Section
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