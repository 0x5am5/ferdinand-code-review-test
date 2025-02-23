import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, BrandAsset } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { AssetCard } from "@/components/brand/asset-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClientDetails() {
  const { id } = useParams();
  const clientId = parseInt(id);

  const { data: client, isLoading: isLoadingClient } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
  });

  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<BrandAsset[]>({
    queryKey: ["/api/clients", clientId, "assets"],
  });

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

  // Group assets by category
  const logoAssets = assets.filter(asset => asset.category === 'logo');
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
          <h1 className="text-4xl font-bold">{client.name} Brand Guidelines</h1>
        </div>

        <Tabs defaultValue="logos" className="space-y-6">
          <TabsList className="bg-card w-full justify-start border-b rounded-none h-12 p-0">
            <TabsTrigger 
              value="logos" 
              className="data-[state=active]:bg-background rounded-none h-full px-6"
            >
              Logo System
            </TabsTrigger>
            <TabsTrigger 
              value="colors" 
              className="data-[state=active]:bg-background rounded-none h-full px-6"
            >
              Colors
            </TabsTrigger>
            <TabsTrigger 
              value="typography" 
              className="data-[state=active]:bg-background rounded-none h-full px-6"
            >
              Typography
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logos" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {logoAssets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
              {logoAssets.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>No Logos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      No logo assets have been added yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="colors" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {colorAssets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
              {colorAssets.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>No Colors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      No color assets have been added yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="typography" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {typographyAssets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
              {typographyAssets.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>No Typography</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      No typography assets have been added yet.
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