import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client, BrandAsset } from "@shared/schema";
import { Link, useParams } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { LogoManager } from "@/components/brand/logo-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import AssetCard from "@/components/brand/asset-card";

export default function ClientDetails() {
  const { id } = useParams();
  const clientId = parseInt(id);

  const { data: client, isLoading: isLoadingClient } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
  });

  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<BrandAsset[]>({
    queryKey: ["/api/clients", clientId, "assets"],
    enabled: !!clientId,
  });

  // Update document title when client data is loaded
  useEffect(() => {
    if (client) {
      document.title = `${client.name} - Brand Assets`;
    }
  }, [client]);

  if (isLoadingClient || isLoadingAssets) {
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

  // Filter and validate logo assets
  const logoAssets = assets.filter(asset => {
    if (asset.category !== 'logo') return false;
    try {
      const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
      return true;
    } catch (error) {
      console.error('Invalid logo data:', error, asset);
      return false;
    }
  });

  const colorAssets = assets.filter(asset => asset.category === 'color');
  const typographyAssets = assets.filter(asset => asset.category === 'typography');

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground">Brand Assets</p>
          </div>
        </div>

        <Tabs defaultValue="logos" className="space-y-6">
          <TabsList className="bg-card w-full justify-start border-b rounded-none h-12 p-0">
            <TabsTrigger value="logos" className="data-[state=active]:bg-background rounded-none h-full px-6">
              Brand Assets
            </TabsTrigger>
            <TabsTrigger value="colors" className="data-[state=active]:bg-background rounded-none h-full px-6">
              Color Palette
            </TabsTrigger>
            <TabsTrigger value="typography" className="data-[state=active]:bg-background rounded-none h-full px-6">
              Typography
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logos" className="mt-6">
            <LogoManager clientId={clientId} logos={logoAssets} />
          </TabsContent>

          <TabsContent value="colors">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {colorAssets.length > 0 ? (
                colorAssets.map(asset => (
                  <AssetCard key={asset.id} asset={asset} />
                ))
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>No Colors Added</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      The color palette has not been defined yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="typography">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {typographyAssets.length > 0 ? (
                typographyAssets.map(asset => (
                  <AssetCard key={asset.id} asset={asset} />
                ))
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>No Typography</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Typography settings have not been configured yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}