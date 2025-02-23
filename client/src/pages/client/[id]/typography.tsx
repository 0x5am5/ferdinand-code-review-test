import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, BrandAsset } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams } from "wouter";
import { AssetCard } from "@/components/brand/asset-card";

export default function ClientTypography() {
  const { id } = useParams();
  const clientId = parseInt(id);

  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<BrandAsset[]>({
    queryKey: ["/api/clients", clientId, "assets"],
  });

  const typographyAssets = assets.filter(asset => asset.category === 'typography');

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Typography System</h1>
          <p className="text-muted-foreground mt-2">
            Font families and type styles
          </p>
        </div>

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
      </main>
    </div>
  );
}
