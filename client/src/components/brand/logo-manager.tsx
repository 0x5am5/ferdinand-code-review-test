import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, Trash2, FileType, Info, CheckCircle, ExternalLink } from "lucide-react";
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

interface UploadDialogProps {
  type: string;
  clientId: number;
  onSuccess: () => void;
}

// Define alternative format descriptions
const formatDescriptions = {
  svg: "Vector format ideal for web and print at any scale",
  png: "Raster format with transparency support for digital use",
  jpg: "Compressed raster format for photography and web",
  ai: "Adobe Illustrator source file for professional editing",
  pdf: "Portable document format for sharing and printing"
};

// Usage guidance for each logo type
const logoUsageGuidance = {
  horizontal: "The horizontal logo is optimal for website headers, email signatures, and business cards where horizontal space is available. Maintain clear space around the logo equal to the height of the logo mark.",
  vertical: "The vertical logo works best in square spaces such as social media profiles, merchandise, and promotional materials. Ensure adequate padding around all sides.",
  square: "The square logo is designed for app icons, favicons, and profile pictures. Never distort or rotate this logo variant."
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

function UploadDialog({ type, clientId, onSuccess }: UploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logoName, setLogoName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createLogo = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", logoName);
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
      setIsOpen(false);
      setLogoName("");
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (
      !fileExtension ||
      !Object.values(FILE_FORMATS).includes(fileExtension as any)
    ) {
      toast({
        title: "Invalid file type",
        description: `File must be one of: ${Object.values(FILE_FORMATS).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  return (
    user.role !== UserRole.STANDARD && (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            Upload {type} Logo
          </Button>
        </DialogTrigger>
        <DialogContent
          className="sm:max-w-[425px]"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Upload {type} Logo</DialogTitle>
            <DialogDescription>
              Add a new {type.toLowerCase()} logo to your brand system.
              Supported formats: {Object.values(FILE_FORMATS).join(", ")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Logo Name</Label>
              <Input
                id="name"
                value={logoName}
                onChange={(e) => setLogoName(e.target.value)}
                placeholder={`e.g., ${type} Logo`}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <Label>Upload Logo</Label>
              <Input
                type="file"
                accept={Object.values(FILE_FORMATS)
                  .map((format) => `.${format}`)
                  .join(",")}
                onChange={handleFileChange}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <Button
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                createLogo.mutate();
              }}
              disabled={createLogo.isPending || !selectedFile || !logoName}
            >
              {createLogo.isPending ? "Uploading..." : "Upload Logo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  );
}

function LogoDisplay({ logo, imageUrl, parsedData, onDelete }: { 
  logo: BrandAsset, 
  imageUrl: string, 
  parsedData: any,
  onDelete: (logoId: number) => void 
}) {
  const { user } = useAuth();
  const type = parsedData.type;
  
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
    <div className="grid grid-cols-4 gap-8 mb-12 rounded-lg bg-card">
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
        
        {user.role !== UserRole.STANDARD && (
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
      
      {/* 3/4 column - Logo preview */}
      <div className="col-span-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg p-8 flex items-center justify-center">
        <img
          src={imageUrl}
          alt={logo.name}
          className="max-w-full max-h-[250px] object-contain"
          onError={(e) => {
            console.error("Error loading image:", imageUrl);
            e.currentTarget.src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.88 9.88 4.24 4.24"/><path d="m9.88 14.12 4.24-4.24"/><circle cx="12" cy="12" r="10"/></svg>';
          }}
        />
      </div>
    </div>
  );
}

export function LogoManager({ clientId, logos }: LogoManagerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
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
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Logo System</h2>
          <p className="text-muted-foreground mt-1">Manage and download the official logos for this brand</p>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-primary/5 border-b">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">Logo Usage Guidelines</CardTitle>
              <CardDescription className="mt-1">
                Always maintain clear space around logos, never alter colors, and avoid distortion when resizing. 
                Use the SVG format whenever possible for the highest quality.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {Object.entries(logosByType).map(([type, typeLogos]) => (
        <div key={type} className="pt-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end">
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
              
              <div data-type={type}>
                <UploadDialog
                  type={type}
                  clientId={clientId}
                  onSuccess={() => {
                    console.log("Logo upload success for type:", type);
                  }}
                />
              </div>
            </div>

            <Separator className="my-3" />

            {typeLogos.length > 0 ? (
              <div>
                {typeLogos.map((logo) => {
                  const parsedData = parseBrandAssetData(logo);
                  if (!parsedData) return null;

                  const imageUrl = `/api/assets/${logo.id}/file`;

                  return (
                    <LogoDisplay 
                      key={logo.id}
                      logo={logo}
                      imageUrl={imageUrl}
                      parsedData={parsedData}
                      onDelete={(logoId) => deleteLogo.mutate(logoId)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg border border-dashed p-8 text-center">
                <FileType className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No {type.toLowerCase()} logo uploaded yet
                </p>
                {user.role !== UserRole.STANDARD && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => document.querySelector<HTMLButtonElement>(`[data-type="${type}"] button`)?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {type} Logo
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
