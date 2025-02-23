import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, BrandAsset } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";

export default function ClientDetails() {
  const { id } = useParams();
  const clientId = parseInt(id);

  const { data: client, isLoading: isLoadingClient } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
  });

  const { data: assets, isLoading: isLoadingAssets } = useQuery<BrandAsset[]>({
    queryKey: ["/api/clients", clientId, "assets"],
  });

  if (isLoadingClient || isLoadingAssets) {
    return null;
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Group assets by category */}
          {assets?.filter(asset => asset.category === 'color').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {assets
                    .filter(asset => asset.category === 'color')
                    .map(asset => {
                      const colorData = asset.data as { hex: string };
                      return (
                        <div 
                          key={asset.id} 
                          className="flex items-center gap-2"
                        >
                          <div 
                            className="w-8 h-8 rounded border" 
                            style={{ backgroundColor: colorData.hex }}
                          />
                          <span>{asset.name}</span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {assets?.filter(asset => asset.category === 'typography').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {assets
                    .filter(asset => asset.category === 'typography')
                    .map(asset => {
                      const fontData = asset.data as { family: string, specimen: string };
                      return (
                        <div key={asset.id}>
                          <p className="font-medium">{asset.name}</p>
                          <p 
                            className="text-xl mt-2" 
                            style={{ fontFamily: fontData.family }}
                          >
                            {fontData.specimen}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {assets?.filter(asset => ['logo', 'icon', 'illustration'].includes(asset.category)).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {assets
                    .filter(asset => ['logo', 'icon', 'illustration'].includes(asset.category))
                    .map(asset => {
                      const imageData = asset.data as { url: string };
                      return (
                        <div key={asset.id}>
                          <p className="font-medium mb-2">{asset.name}</p>
                          <img 
                            src={imageData.url} 
                            alt={asset.name}
                            className="max-w-full rounded border"
                          />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}