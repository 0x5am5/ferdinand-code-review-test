import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, BrandAsset } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { AssetCard } from "@/components/brand/asset-card";

export default function ClientLogos() {
  const { id } = useParams();
  const clientId = parseInt(id);

  const { data: client, isLoading: isLoadingClient } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
  });

  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<BrandAsset[]>({
    queryKey: ["/api/clients", clientId, "assets"],
  });

  const logoAssets = assets.filter(asset => asset.category === 'logo');

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

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Logo System</h1>
          <p className="text-muted-foreground mt-2">
            Manage and download brand logos in various formats
          </p>
        </div>

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
      </main>
    </div>
  );
}
