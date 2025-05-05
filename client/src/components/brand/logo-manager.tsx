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
function FileUpload({ type, clientId, onSuccess }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createLogo = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", `${type.charAt(0).toUpperCase() + type.slice(1)} Logo`); // Auto-generate name
      formData.append("type", type);
      formData.append("category", "logo");

      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload logo");
      }

      return await response.json();
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

  return (
    <div className="col-span-3 flex flex-col">
      <div 
        className={`flex flex-col items-center justify-center border-2 ${
          isDragging ? 'border-primary' : 'border-dashed border-muted-foreground/20'
        } rounded-lg py-12 px-6 bg-muted/20 transition-colors duration-200 h-full min-h-[200px]`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
            <label>
              <Input
                type="file"
                accept={Object.values(FILE_FORMATS).map(format => `.${format}`).join(",")}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                type="button"
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

function LogoDisplay({ logo, imageUrl, parsedData, onDelete }: { 
  logo: BrandAsset, 
  imageUrl: string, 
  parsedData: any,
  onDelete: (logoId: number) => void 
}) {
  const { user = null } = useAuth();
  const type = parsedData.type;
  const [variant, setVariant] = useState<'light' | 'dark'>('light');
  
  // Available formats for this logo
  const availableFormats = [
    { id: `current-${parsedData.format}`, format: parsedData.format, current: true },
    { id: "svg", format: "svg", available: parsedData.format === "svg" },
    { id: "png", format: "png", available: false },
    { id: "jpg", format: "jpg", available: false },
    { id: "ai", format: "ai", available: false },
    { id: "pdf", format: "pdf", available: false }
  ];

  return (
    <div className="grid grid-cols-4 gap-8 mb-8">
      {/* 1/4 column - Logo information */}
      <div className="space-y-6">
        <div>
          <h4 className="text-lg font-semibold mb-2">{logo.name}</h4>
          <p className="text-sm text-muted-foreground mb-4">
            {logoUsageGuidance[type as keyof typeof logoUsageGuidance]}
          </p>
        </div>
        
        <div>
          <h5 className="text-sm font-medium flex items-center">
            <FileType className="h-4 w-4 mr-2" />
            Available Formats
          </h5>
          <div className="space-y-2 mt-3">
            {availableFormats.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className={`text-xs uppercase font-medium ${item.current || item.available ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                    {item.format}
                  </span>
                  {item.current && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] uppercase font-medium">Current</span>
                  )}
                </div>
                
                {(item.current || item.available) ? (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                    <a href={imageUrl} download={`${logo.name}.${item.format}`}>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled>
                    <Download className="h-3.5 w-3.5 text-muted-foreground/30" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {user && user.role !== UserRole.STANDARD && (
          <div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Logo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete Logo
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this logo?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(logo.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
      
      {/* 3/4 column - Logo preview with light/dark toggle */}
      <div className="col-span-3 flex flex-col">
        <div className="mb-4 self-end">
          <Tabs value={variant} className="w-[200px]">
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
        
        <div 
          className={`rounded-lg pt-[15vh] pb-[15vh] flex items-center justify-center ${
            variant === 'light' 
              ? 'bg-white' 
              : 'bg-slate-900'
          }`}
          style={{ minHeight: '250px' }}
        >
          <img
            src={imageUrl}
            alt={logo.name}
            className="max-w-full max-h-[250px] object-contain"
            style={{ 
              filter: variant === 'dark' ? 'invert(1) brightness(1.5)' : 'none' 
            }}
            onError={(e) => {
              console.error("Error loading image:", imageUrl);
              e.currentTarget.src =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.88 9.88 4.24 4.24"/><path d="m9.88 14.12 4.24-4.24"/><circle cx="12" cy="12" r="10"/></svg>';
            }}
          />
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
  onDeleteLogo 
}: { 
  type: string, 
  logos: BrandAsset[],
  clientId: number,
  onDeleteLogo: (logoId: number) => void
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
          <p className="text-sm text-muted-foreground">
            {type === "horizontal" && "Wide format logo with mark and text side by side"}
            {type === "vertical" && "Stacked version with mark above text"}
            {type === "square" && "Compact version optimized for small spaces"}
          </p>
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
    mutationFn: async (logoId: number) => {
      const response = await fetch(
        `/api/clients/${clientId}/assets/${logoId}`,
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Logo System</h2>
          <p className="text-muted-foreground mt-1">Manage and download the official logos for this brand</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">Logo Usage Guidelines</CardTitle>
              <CardDescription className="mt-1">
                Always maintain clear space around logos, never alter colors, and avoid distortion when resizing. 
                Use the SVG format whenever possible for the highest quality. The dark variant should be used on dark backgrounds only.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {Object.entries(logosByType).map(([type, typeLogos]) => (
        <LogoSection 
          key={type}
          type={type}
          logos={typeLogos}
          clientId={clientId}
          onDeleteLogo={(logoId) => deleteLogo.mutate(logoId)}
        />
      ))}
    </div>
  );
}