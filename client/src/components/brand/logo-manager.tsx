import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, Trash2, FileType, Info, CheckCircle, ExternalLink, Sun, Moon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandAsset, LogoType, FILE_FORMATS, UserRole } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

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
  horizontal: "The horizontal logo is the primary brand identifier, designed for optimal legibility and recognition in wide formats. Use it as the main logo on websites, letterheads, presentations, and marketing materials where horizontal space is available.",
  vertical: "The vertical logo stacks elements for a more compact footprint without sacrificing brand recognition. This variant is perfect for square spaces including social media profiles, merchandise tags, and promotional items.",
  square: "The square logo focuses on the essential visual element of your brand, making it ideal for small spaces where legibility may be challenging. Use it for app icons, favicons, profile pictures, and anywhere space is at a premium."
};

// Usage guidance for each logo type
const logoUsageGuidance = {
  horizontal: "This logo is optimal for website headers, email signatures, business cards, and letterhead where horizontal space allows. Maintain clear space around the logo equal to the height of the logo mark.",
  vertical: "This logo works best in square spaces such as social media profiles, merchandise, and promotional materials. Ensure adequate padding around all sides for visibility.",
  square: "This logo is designed for small spaces such as app icons, favicons, and profile pictures. Never distort or rotate this logo variant; maintain its square proportions."
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

        const response = await fetch(`/api/clients/${clientId}/assets/${parentLogoId}`, {
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
    <div className="col-span-3 flex flex-col">
      <div 
        className={`flex flex-col items-center justify-center border-2 ${
          isDragging ? 'border-primary' : 'border-dashed border-muted-foreground/20'
        } rounded-lg bg-muted/5 hover:bg-muted/10 transition-colors duration-200 h-full w-full min-h-[400px]`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ height: '100%' }}
      >
        {selectedFile ? (
          <>
            <div className="bg-primary/10 p-3 rounded-full mb-4">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h4 className="text-lg font-medium mb-1">{selectedFile.name}</h4>
            <p className="text-sm text-muted-foreground mb-6">
              {Math.round(selectedFile.size / 1024)}KB • {selectedFile.type}
            </p>
            <div className="flex gap-3">
              <Button
                variant="default"
                onClick={() => createLogo.mutate()}
                disabled={createLogo.isPending}
              >
                {createLogo.isPending ? "Uploading..." : "Upload Logo"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedFile(null)}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-muted-foreground/10 p-3 rounded-full mb-4">
              <Upload className="h-8 w-8 text-muted-foreground/70" />
            </div>
            <h4 className="text-lg font-medium mb-1">Upload {type.charAt(0).toUpperCase() + type.slice(1)} Logo</h4>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Drag and drop your logo file here, or click to browse.<br />
              Supported formats: {Object.values(FILE_FORMATS).join(", ")}
            </p>
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
          </>
        )}
      </div>
    </div>
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
  const type = parsedData.type;
  const [variant, setVariant] = useState<'light' | 'dark'>('light');

  return (
    <div className="grid grid-cols-4 gap-8 mb-8">
      {/* 1/4 column - Logo information */}
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground mb-4">
            {logoUsageGuidance[type as keyof typeof logoUsageGuidance]}
          </p>
        </div>

        {/* Light/Dark toggle moved here */}
        <div>
          <h5 className="text-sm font-medium mb-3">Display Mode</h5>
          <Tabs value={variant} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="light" onClick={() => setVariant('light')}>
                <Sun className="h-4 w-4 mr-2" />
                Light
              </TabsTrigger>
              <TabsTrigger value="dark" onClick={() => setVariant('dark')}>
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* File name and download section */}
        <div>
          <h5 className="text-sm font-medium flex items-center">
            <FileType className="h-4 w-4 mr-2" />
            File Details
          </h5>
          <div className="space-y-2 mt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm font-medium">
                  {logo.name} {variant === 'dark' ? '- Dark' : ''}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                <a href={variant === 'dark' && parsedData.hasDarkVariant ? 
                  `/api/assets/${logo.id}/file?variant=dark` : imageUrl} 
                  download={`${logo.name}${variant === 'dark' ? '-Dark' : ''}.${parsedData.format}`}>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Filename: {parsedData.fileName || `${logo.name}.${parsedData.format}`}
            </div>
            
            {/* Display available converted formats */}
            <div className="mt-4">
              <h6 className="text-xs font-medium mb-2">Available Formats:</h6>
              <ul className="space-y-2">
                <li>
                  <a 
                    href={variant === 'dark' && parsedData.hasDarkVariant ? 
                    `/api/assets/${logo.id}/file?variant=dark` : 
                    `/api/assets/${logo.id}/file`} 
                    download={`${logo.name}${variant === 'dark' ? '-Dark' : ''}.${parsedData.format}`}
                    className="flex items-center text-xs hover:text-primary transition-colors"
                  >
                    <Download className="h-3 w-3 mr-2" />
                    {parsedData.format.toUpperCase()}
                  </a>
                </li>
                
                <li>
                  <a 
                    href={variant === 'dark' && parsedData.hasDarkVariant ? 
                    `/api/assets/${logo.id}/file?format=jpg&variant=dark` : 
                    `/api/assets/${logo.id}/file?format=jpg`} 
                    download={`${logo.name}${variant === 'dark' ? '-Dark' : ''}.jpg`}
                    className="flex items-center text-xs hover:text-primary transition-colors"
                  >
                    <Download className="h-3 w-3 mr-2" />
                    JPG
                  </a>
                </li>
                
                <li>
                  <a 
                    href={variant === 'dark' && parsedData.hasDarkVariant ? 
                    `/api/assets/${logo.id}/file?format=pdf&variant=dark` : 
                    `/api/assets/${logo.id}/file?format=pdf`} 
                    download={`${logo.name}${variant === 'dark' ? '-Dark' : ''}.pdf`}
                    className="flex items-center text-xs hover:text-primary transition-colors"
                  >
                    <Download className="h-3 w-3 mr-2" />
                    PDF
                  </a>
                </li>
                
                {/* For vector files, show png option */}
                {['svg', 'ai'].includes(parsedData.format.toLowerCase()) && (
                  <li>
                    <a 
                      href={variant === 'dark' && parsedData.hasDarkVariant ? 
                      `/api/assets/${logo.id}/file?format=png&variant=dark` : 
                      `/api/assets/${logo.id}/file?format=png`} 
                      download={`${logo.name}${variant === 'dark' ? '-Dark' : ''}.png`}
                      className="flex items-center text-xs hover:text-primary transition-colors"
                    >
                      <Download className="h-3 w-3 mr-2" />
                      PNG
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 3/4 column - Logo preview */}
      <div className="col-span-3 flex flex-col">
        <div 
          className={`rounded-lg pt-[15vh] pb-[15vh] flex items-center justify-center relative ${
            variant === 'light' 
              ? 'bg-white' 
              : 'bg-slate-900'
          }`}
          style={{ minHeight: '250px' }}
        >
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              asChild
            >
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
                          const response = await fetch(`/api/clients/${clientId}/assets/${logo.id}?variant=dark`, {
                            method: "PATCH",
                            body: formData,
                          });
                        } else {
                          // Replace light variant
                          const response = await fetch(`/api/clients/${clientId}/assets/${logo.id}`, {
                            method: "PATCH",
                            body: formData,
                          });
                        }
                        
                        queryClient.invalidateQueries({
                          queryKey: [`/api/clients/${clientId}/assets`],
                        });
                      };
                      
                      createUpload();
                    }
                  }}
                  className="hidden"
                />
                <Upload className="h-4 w-4" />
              </label>
            </Button>
            
            {((variant === 'dark' && parsedData.hasDarkVariant) || variant === 'light') && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                onClick={() => onDelete(logo.id, variant)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {variant === 'dark' && !parsedData.hasDarkVariant ? (
            <div className="w-full h-full flex items-center justify-center">
              <FileUpload
                type={type}
                clientId={clientId}
                isDarkVariant={true}
                parentLogoId={logo.id}
                queryClient={queryClient}
                onSuccess={() => {
                  parsedData.hasDarkVariant = true;
                  queryClient.invalidateQueries({
                    queryKey: [`/api/clients/${clientId}/assets`],
                  });
                }}
              />
            </div>
          ) : (
            <div className="relative">
              {parsedData.format === 'svg' ? (
                <div className="relative max-w-[60%] svg-container">
                  {/* Using iframe for SVG to better isolate and prevent issues */}
                  <iframe
                    src={variant === 'dark' && parsedData.hasDarkVariant ? 
                      `/api/assets/${logo.id}/file?variant=dark` : 
                      imageUrl}
                    className="max-h-[250px] border-0"
                    style={{ background: 'transparent' }}
                    onError={(e) => {
                      console.error("Error loading SVG:", imageUrl);
                      // In case the iframe fails, we'll try to fallback to img
                      const container = e.currentTarget.parentElement;
                      if (container) {
                        const fallbackImg = document.createElement('img');
                        fallbackImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="m9.88 9.88 4.24 4.24"/%3E%3Cpath d="m9.88 14.12 4.24-4.24"/%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E';
                        fallbackImg.alt = logo.name || "SVG Logo";
                        fallbackImg.className = "max-w-[60%] max-h-[250px]";
                        container.innerHTML = '';
                        container.appendChild(fallbackImg);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="max-w-[60%] flex justify-self-center">
                <img
                  src={variant === 'dark' && parsedData.hasDarkVariant ? 
                    `/api/assets/${logo.id}/file?variant=dark` : 
                    imageUrl}
                  alt={logo.name}
                  className="max-h-[250px] object-contain"
                  style={{ 
                    filter: variant === 'dark' && !parsedData.hasDarkVariant ? 'invert(1) brightness(1.5)' : 'none' 
                  }}
                  onError={(e) => {
                    console.error("Error loading image:", imageUrl);
                    e.currentTarget.src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="m9.88 9.88 4.24 4.24"/%3E%3Cpath d="m9.88 14.12 4.24-4.24"/%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E';
                  }}
                />
                </div>
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
  const [uploadMode, setUploadMode] = useState(false);
  const hasLogos = logos.length > 0;

  return (
    <div className="pt-4 mb-8">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h3 className="text-xl font-semibold mb-1">
            {type.charAt(0).toUpperCase() + type.slice(1)} Logo
          </h3>
        </div>

        {!uploadMode && !hasLogos && user && user.role !== UserRole.STANDARD && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setUploadMode(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Logo
          </Button>
        )}
      </div>

      <Separator className="my-4" />

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
        // Empty state with two-column layout
        <div className="grid grid-cols-4 gap-8">
          {/* 1/4 column with description */}
          <div className="space-y-4">
            <div className="bg-muted/30 p-3 rounded-lg inline-block">
              <FileType className="h-5 w-5 text-muted-foreground" />
            </div>
            <h4 className="text-lg font-medium">
              {type.charAt(0).toUpperCase() + type.slice(1)} Logo
            </h4>
            <p className="text-sm text-muted-foreground">
              {logoDescriptions[type as keyof typeof logoDescriptions]}
            </p>

            {uploadMode && (
              <Button 
                variant="outline" 
                size="sm"
                className="mt-4"
                onClick={() => setUploadMode(false)}
              >
                Cancel Upload
              </Button>
            )}
          </div>

          {/* 3/4 column - upload area or placeholder */}
          {uploadMode ? (
            <FileUpload 
              type={type} 
              clientId={clientId}
              onSuccess={() => setUploadMode(false)}
              queryClient={queryClient}
            />
          ) : (
            <div className="col-span-3 bg-muted/10 rounded-lg flex flex-col items-center justify-center p-8 text-center">
              <FileType className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground mb-4">
                No {type.toLowerCase()} logo uploaded yet
              </p>
              {user && user.role !== UserRole.STANDARD && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setUploadMode(true)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Logo
                </Button>
              )}
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
    <div className="space-y-6 pb-12">
    <div className="client-hero--asset my-[10vh]">
      <h1>Logo System</h1>
      <p className="text-muted-foreground mt-1">Manage and download the official logos for this brand</p>
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