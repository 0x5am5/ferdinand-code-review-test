import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, BrandAsset, UserPersona } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { AssetCard } from "@/components/brand/asset-card";
import { LogoManager } from "@/components/brand/logo-manager";
import { ColorManager } from "@/components/brand/color-manager";
import { FontManager } from "@/components/brand/font-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonaManager } from "@/components/brand/persona-manager";
import { InspirationBoard } from "@/components/brand/inspiration-board";

export default function ClientDetails() {
  const { id } = useParams();
  const clientId = id ? parseInt(id) : null;

  const { data: client, isLoading: isLoadingClient } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
    enabled: !!clientId,
  });

  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<BrandAsset[]>({
    queryKey: [`/api/clients/${clientId}/assets`],
    enabled: !!clientId,
  });

  const { data: personas = [], isLoading: isLoadingPersonas } = useQuery<UserPersona[]>({
    queryKey: [`/api/clients/${clientId}/personas`],
    enabled: !!clientId,
  });

  if (!clientId || isNaN(clientId)) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <CardTitle>Invalid Client ID</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isLoadingClient || isLoadingAssets || isLoadingPersonas) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <CardTitle>Client Not Found</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Filter assets by category
  const logoAssets = assets.filter(asset => asset.category === 'logo');
  const colorAssets = assets.filter(asset => asset.category === 'color') || [];
  const fontAssets = assets.filter(asset => asset.category === 'font') || [];

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/clients">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-4xl font-bold">{client.name}</h1>
        </div>

        {/* Get default tab based on available features */}
        {(() => {
          // Read feature toggles from client data
          const featureToggles = client.featureToggles || {
            logoSystem: true,
            colorSystem: true,
            typeSystem: true,
            userPersonas: true,
            inspiration: true
          };
          
          // Determine which tab should be default (first enabled one)
          let defaultTab = "logos";
          if (!featureToggles.logoSystem) {
            if (featureToggles.colorSystem) defaultTab = "colors";
            else if (featureToggles.typeSystem) defaultTab = "typography";
            else if (featureToggles.userPersonas) defaultTab = "personas";
            else if (featureToggles.inspiration) defaultTab = "inspiration";
          }
          
          const anyFeatureEnabled = Object.values(featureToggles).some(value => value === true);
          
          if (!anyFeatureEnabled) {
            return (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>All Features Disabled</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>All features are currently disabled for this client. Enable features in the client settings.</p>
                </CardContent>
              </Card>
            );
          }
          
          return (
            <Tabs defaultValue={defaultTab} className="space-y-6">
              <TabsList className="bg-card w-full justify-start border-b rounded-none h-12 p-0">
                {featureToggles.logoSystem && (
                  <TabsTrigger 
                    value="logos" 
                    className="data-[state=active]:bg-background rounded-none h-full px-6"
                  >
                    Logo System
                  </TabsTrigger>
                )}
                {featureToggles.colorSystem && (
                  <TabsTrigger 
                    value="colors" 
                    className="data-[state=active]:bg-background rounded-none h-full px-6"
                  >
                    Colors
                  </TabsTrigger>
                )}
                {featureToggles.typeSystem && (
                  <TabsTrigger 
                    value="typography" 
                    className="data-[state=active]:bg-background rounded-none h-full px-6"
                  >
                    Typography
                  </TabsTrigger>
                )}
                {featureToggles.userPersonas && (
                  <TabsTrigger 
                    value="personas" 
                    className="data-[state=active]:bg-background rounded-none h-full px-6"
                  >
                    User Personas
                  </TabsTrigger>
                )}
                {featureToggles.inspiration && (
                  <TabsTrigger 
                    value="inspiration" 
                    className="data-[state=active]:bg-background rounded-none h-full px-6"
                  >
                    Inspiration
                  </TabsTrigger>
                )}
              </TabsList>

              {featureToggles.logoSystem && (
                <TabsContent value="logos">
                  <LogoManager clientId={clientId} logos={logoAssets} />
                </TabsContent>
              )}

              {featureToggles.colorSystem && (
                <TabsContent value="colors">
                  <ColorManager clientId={clientId} colors={colorAssets} />
                </TabsContent>
              )}

              {featureToggles.typeSystem && (
                <TabsContent value="typography">
                  <FontManager clientId={clientId} fonts={fontAssets} />
                </TabsContent>
              )}

              {featureToggles.userPersonas && (
                <TabsContent value="personas">
                  <PersonaManager clientId={clientId} personas={personas} />
                </TabsContent>
              )}

              {featureToggles.inspiration && (
                <TabsContent value="inspiration">
                  <InspirationBoard clientId={clientId} />
                </TabsContent>
              )}
            </Tabs>
          );
        })()}
      </main>
    </div>
  );
}