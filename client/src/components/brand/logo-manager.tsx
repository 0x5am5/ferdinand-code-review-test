import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandAsset, LogoType, FILE_FORMATS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface LogoManagerProps {
  clientId: number;
  logos: BrandAsset[];
}

interface UploadDialogProps {
  type: string;
  clientId: number;
  onSuccess: () => void;
}

function parseBrandAssetData(logo: BrandAsset) {
  try {
    if (!logo.data) {
      console.warn('Logo data is missing:', logo);
      return null;
    }
    const data = typeof logo.data === 'string' ? JSON.parse(logo.data) : logo.data;
    if (!data.type || !data.format) {
      console.warn('Invalid logo data format:', data);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error parsing logo data:', error, logo);
    return null;
  }
}

function UploadDialog({ type, clientId, onSuccess }: UploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logoName, setLogoName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createLogo = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', logoName);
      formData.append('type', type);

      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: 'POST',
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
        queryKey: ["/api/clients", clientId, "assets"]
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

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !Object.values(FILE_FORMATS).includes(fileExtension as any)) {
      toast({
        title: "Invalid file type",
        description: `File must be one of: ${Object.values(FILE_FORMATS).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Upload className="mr-2 h-4 w-4" />
          Upload {type} Logo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Upload {type} Logo</DialogTitle>
          <DialogDescription>
            Add a new {type.toLowerCase()} logo to your brand system. Supported formats: {Object.values(FILE_FORMATS).join(', ')}
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
              accept={Object.values(FILE_FORMATS).map(format => `.${format}`).join(',')}
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
  );
}

export function LogoManager({ clientId, logos }: LogoManagerProps) {
  console.log('LogoManager: Initial logos:', logos);

  const logosByType = Object.values(LogoType).reduce((acc, type) => {
    acc[type] = logos.filter(logo => {
      const parsedData = parseBrandAssetData(logo);
      console.log(`LogoManager: Processing logo ${logo.id}:`, { type, parsedData, logo });
      return parsedData?.type === type;
    });
    return acc;
  }, {} as Record<string, BrandAsset[]>);

  console.log('LogoManager: Grouped logos:', logosByType);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Logo System</h2>
      </div>

      <div className="space-y-6">
        {Object.entries(logosByType).map(([type, typeLogos]) => (
          <div key={type} className="border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {type.charAt(0).toUpperCase() + type.slice(1)} Logo
              </h3>
              <UploadDialog 
                type={type} 
                clientId={clientId} 
                onSuccess={() => {
                  console.log('Logo upload success for type:', type);
                }}
              />
            </div>

            {typeLogos.length > 0 ? (
              <div className="space-y-6">
                {typeLogos.map((logo) => {
                  const parsedData = parseBrandAssetData(logo);
                  if (!parsedData) return null;

                  const imageUrl = `/api/assets/${logo.id}/file`;
                  console.log('LogoManager: Rendering logo:', { id: logo.id, url: imageUrl });

                  return (
                    <div key={logo.id} className="border rounded-lg p-4">
                      <div className="aspect-video rounded-lg border bg-muted flex items-center justify-center p-4 mb-4">
                        <img
                          src={imageUrl}
                          alt={logo.name}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            console.error('Error loading image:', imageUrl);
                            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.88 9.88 4.24 4.24"/><path d="m9.88 14.12 4.24-4.24"/><circle cx="12" cy="12" r="10"/></svg>';
                          }}
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium">{logo.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Format: {parsedData.format?.toUpperCase()}
                          </p>
                        </div>
                        <Button variant="secondary" size="sm" asChild className="w-full">
                          <a
                            href={imageUrl}
                            download={`${logo.name}.${parsedData.format}`}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download {parsedData.format?.toUpperCase()}
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">No {type.toLowerCase()} logo uploaded yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}