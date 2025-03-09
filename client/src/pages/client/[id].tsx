import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, BrandAsset } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { AssetCard } from "@/components/brand/asset-card";
import { LogoManager } from "@/components/brand/logo-manager";
import { ColorManager } from "@/components/brand/color-manager";
import { FontManager } from "@/components/brand/font-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClientDetails() {
  const { id } = useParams();
  const clientId = parseInt(id);

  const { data: client, isLoading: isLoadingClient } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
  });

  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<BrandAsset[]>({
    queryKey: [`/api/clients/${clientId}/assets`],
    enabled: !!clientId,
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

  // Filter assets by category
  const logoAssets = assets.filter(asset => asset.category === 'logo');
  const colorAssets = assets.filter(asset => asset.category === 'color') || [];
  const fontAssets = assets.filter(asset => asset.category === 'font') || [];

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
          <h1 className="text-4xl font-bold">{client.name}</h1>
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

          <TabsContent value="logos">
            <LogoManager clientId={clientId} logos={logoAssets} />
          </TabsContent>

          <TabsContent value="colors">
            <ColorManager clientId={clientId} colors={colorAssets} />
          </TabsContent>

          <TabsContent value="typography">
            <FontManager clientId={clientId} fonts={fontAssets} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}