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

function LogoDisplay({ logo }: { logo: BrandAsset }) {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!logo.data || typeof logo.data !== 'object') {
    console.error('Invalid logo data:', logo);
    return null;
  }

  const { type, format } = logo.data;
  const imageUrl = `/api/assets/${logo.id}/file`;

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center p-4 mb-4 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        {error ? (
          <div className="text-sm text-muted-foreground">Failed to load image</div>
        ) : (
          <img
            src={imageUrl}
            alt={logo.name}
            className="max-w-full max-h-full object-contain"
            onLoad={() => setIsLoading(false)}
            onError={(e) => {
              console.error('Failed to load logo:', imageUrl);
              setError(true);
              setIsLoading(false);
            }}
          />
        )}
      </div>
      <div className="space-y-4">
        <div>
          <h4 className="font-medium">{logo.name}</h4>
          <p className="text-sm text-muted-foreground">
            Type: {type}
          </p>
          <p className="text-sm text-muted-foreground">
            Format: {format.toUpperCase()}
          </p>
        </div>
        <Button 
          variant="secondary" 
          size="sm" 
          asChild 
          className="w-full"
          disabled={error}
        >
          <a
            href={imageUrl}
            download={`${logo.name}.${format}`}
            className="flex items-center justify-center"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
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
      <DialogContent className="sm:max-w-[425px]">
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
            />
          </div>
          <div>
            <Label>Upload Logo</Label>
            <Input
              type="file"
              accept={Object.values(FILE_FORMATS).map(format => `.${format}`).join(',')}
              onChange={handleFileChange}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => createLogo.mutate()}
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
  // Group logos by type
  const logosByType = Object.values(LogoType).reduce((acc, type) => {
    acc[type] = logos.filter(logo => {
      if (!logo.data || typeof logo.data !== 'object') {
        console.error('Invalid logo data structure:', logo);
        return false;
      }
      return logo.data.type === type;
    });
    return acc;
  }, {} as Record<string, BrandAsset[]>);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Brand Assets</h2>
      </div>

      <div className="space-y-8">
        {Object.entries(logosByType).map(([type, typeLogos]) => (
          <div key={type} className="border rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                {type.charAt(0).toUpperCase() + type.slice(1)} Asset
              </h3>
              <UploadDialog 
                type={type} 
                clientId={clientId} 
                onSuccess={() => {
                  console.log('Asset upload succeeded');
                }}
              />
            </div>

            {typeLogos.length > 0 ? (
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {typeLogos.map((logo) => (
                  <LogoDisplay key={logo.id} logo={logo} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No {type.toLowerCase()} asset uploaded yet
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}