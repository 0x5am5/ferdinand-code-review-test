import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface LogoManagerProps {
  clientId: number;
  logos: BrandAsset[];
}

export function LogoManager({ clientId, logos }: LogoManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>(LogoType.MAIN);
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
      formData.append('type', selectedType);

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
      // Force an immediate refetch of the assets
      queryClient.invalidateQueries({ 
        queryKey: ["/api/clients", clientId, "assets"],
        refetchType: "all"
      });

      toast({
        title: "Success",
        description: "Logo added successfully",
      });
      setDialogOpen(false);
      setLogoName("");
      setSelectedFile(null);
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

  // Group logos by type
  const logosByType = Object.values(LogoType).reduce((acc, type) => {
    acc[type] = logos.filter(logo => {
      const data = logo.data as { type: string; format: string };
      return data?.type === type;
    });
    return acc;
  }, {} as Record<string, BrandAsset[]>);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Logo System</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Logo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Logo</DialogTitle>
              <DialogDescription>
                Add a new logo to your brand system. Supported formats: {Object.values(FILE_FORMATS).join(', ')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Logo Name</Label>
                <Input
                  id="name"
                  value={logoName}
                  onChange={(e) => setLogoName(e.target.value)}
                  placeholder="e.g., Primary Logo"
                />
              </div>
              <div>
                <Label>Logo Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(LogoType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Upload Logo</Label>
                <Input
                  type="file"
                  accept={Object.values(FILE_FORMATS).map(format => `.${format}`).join(',')}
                  onChange={handleFileChange}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Supported formats: {Object.values(FILE_FORMATS).join(', ')}
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => createLogo.mutate()}
                disabled={createLogo.isPending || !selectedFile || !logoName}
              >
                {createLogo.isPending ? "Adding..." : "Add Logo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(logosByType).map(([type, typeLogos]) => (
          <div key={type} className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">
              {type.charAt(0).toUpperCase() + type.slice(1)} Logo
            </h3>
            {typeLogos.length > 0 ? (
              <div className="space-y-4">
                {typeLogos.map((logo) => (
                  <div key={logo.id} className="space-y-4">
                    <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center p-4">
                      <img
                        src={`/api/assets/${logo.id}/file`}
                        alt={logo.name}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          console.error('Failed to load image:', logo.id);
                          e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
                        }}
                      />
                    </div>
                    <div>
                      <h4 className="font-medium">{logo.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Format: {(logo.data as any)?.format?.toUpperCase()}
                      </p>
                      <Button variant="secondary" size="sm" asChild className="w-full">
                        <a
                          href={`/api/assets/${logo.id}/file`}
                          download={`${logo.name}.${(logo.data as any)?.format}`}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download {(logo.data as any)?.format?.toUpperCase()}
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No {type} logo added yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}