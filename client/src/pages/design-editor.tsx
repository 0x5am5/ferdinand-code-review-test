import type { BrandAsset } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "wouter";
import { ColorManager } from "@/components/brand/color-manager";
import { FontManager } from "@/components/brand/font-manager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface DesignSettings {
  radius: number;
  animation: "none" | "fast" | "normal" | "slow";
  colors: {
    primary: string;
    background: string;
    text: string;
  };
  typography: {
    primary: string;
    heading: string;
  };
}

export default function DesignEditor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { id } = useParams();
  const clientId = id ? parseInt(id, 10) : null;
  const [activeTab, setActiveTab] = useState("typography");

  // Fetch design settings and assets
  const { data: designSettings } = useQuery<DesignSettings>({
    queryKey: ["/api/design-settings"],
    enabled: !!clientId && !Number.isNaN(clientId),
  });

  const { data: brandAssets } = useQuery<BrandAsset[]>({
    queryKey: [`/api/clients/${clientId}/assets`],
    enabled: !!clientId && !Number.isNaN(clientId),
  });

  // Update design settings mutation
  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<DesignSettings>) => {
      const response = await fetch("/api/design-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to update design settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/design-settings"] });
      toast({
        title: "Success",
        description: "Design settings updated successfully",
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

  // Validate clientId
  if (!clientId || Number.isNaN(clientId)) {
    return (
      <div className="container py-8 max-w-6xl">
        <Card>
          <div className="p-6">
            <h1>Invalid Client ID</h1>
            <p className="text-muted-foreground">
              Please provide a valid client ID to access the design editor.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const handleSettingChange = (
    key: keyof DesignSettings,
    value: DesignSettings[keyof DesignSettings]
  ) => {
    updateSettings.mutate({ [key]: value });
  };

  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1>Design System</h1>
          <p className="text-muted-foreground">
            Customize the appearance of your brand portal
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="typography">
            <Card>
              <div className="p-6">
                <FontManager
                  clientId={clientId}
                  fonts={
                    brandAssets?.filter((asset) => asset.category === "font") ||
                    []
                  }
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="colors">
            <Card>
              <div className="p-6">
                <ColorManager
                  clientId={clientId}
                  colors={
                    brandAssets?.filter(
                      (asset) => asset.category === "color"
                    ) || []
                  }
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="components">
            <Card>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="mb-4">Component Settings</h3>
                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <Label>Border Radius</Label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={designSettings?.radius || 4}
                        onChange={(e) =>
                          handleSettingChange("radius", Number(e.target.value))
                        }
                        className="max-w-xs"
                      />
                      <p className="text-sm text-muted-foreground">
                        Adjust the border radius of components (0-20px)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Animation Speed</Label>
                      <select
                        className="w-full max-w-xs p-2 border rounded"
                        value={designSettings?.animation || "normal"}
                        onChange={(e) =>
                          handleSettingChange("animation", e.target.value)
                        }
                      >
                        <option value="none">None</option>
                        <option value="fast">Fast</option>
                        <option value="normal">Normal</option>
                        <option value="slow">Slow</option>
                      </select>
                      <p className="text-sm text-muted-foreground">
                        Control the speed of UI animations throughout the
                        application
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Preview Changes</h4>
                      <p className="text-sm text-muted-foreground">
                        See how your changes affect various components
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        designSettings && updateSettings.mutate(designSettings)
                      }
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
