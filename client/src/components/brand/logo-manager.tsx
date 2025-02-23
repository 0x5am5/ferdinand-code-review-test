import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BrandAsset, LogoType } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface LogoManagerProps {
  clientId: number;
  logos: BrandAsset[];
}

export function LogoManager({ clientId, logos }: LogoManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>(LogoType.MAIN);
  const [logoName, setLogoName] = useState("");
  const [formats, setFormats] = useState<Array<{ format: string; url: string }>>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addFormat = () => {
    setFormats([...formats, { format: "", url: "" }]);
  };

  const updateFormat = (index: number, field: "format" | "url", value: string) => {
    const newFormats = [...formats];
    newFormats[index][field] = value;
    setFormats(newFormats);
  };

  const createLogo = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/clients/${clientId}/assets`, {
        category: "logo",
        name: logoName,
        data: {
          type: selectedType,
          formats,
        },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "assets"] });
      toast({
        title: "Success",
        description: "Logo added successfully",
      });
      setDialogOpen(false);
      setLogoName("");
      setFormats([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Group logos by type
  const logosByType = Object.values(LogoType).reduce((acc, type) => {
    acc[type] = logos.filter(logo => (logo.data as any).type === type);
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
                Add a new logo to your brand system with multiple download formats.
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
              <div className="space-y-4">
                <Label>Formats</Label>
                {formats.map((format, index) => (
                  <div key={index} className="space-y-2">
                    <Input
                      placeholder="Format (e.g., PNG, SVG)"
                      value={format.format}
                      onChange={(e) => updateFormat(index, "format", e.target.value)}
                    />
                    <Input
                      placeholder="URL"
                      value={format.url}
                      onChange={(e) => updateFormat(index, "url", e.target.value)}
                    />
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addFormat}>
                  Add Format
                </Button>
              </div>
              <Button
                className="w-full"
                onClick={() => createLogo.mutate()}
                disabled={createLogo.isPending}
              >
                {createLogo.isPending ? "Adding..." : "Add Logo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(logosByType).map(([type, logos]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{type.charAt(0).toUpperCase() + type.slice(1)} Logo</CardTitle>
            </CardHeader>
            <CardContent>
              {logos.length > 0 ? (
                logos.map((logo) => (
                  <div key={logo.id} className="space-y-4">
                    <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center p-4">
                      <img
                        src={(logo.data as any).formats[0].url}
                        alt={logo.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(logo.data as any).formats.map((format: any, index: number) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={format.url}
                            download={`${logo.name}.${format.format}`}
                            className="flex items-center"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {format.format}
                          </a>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No {type} logo added yet</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
