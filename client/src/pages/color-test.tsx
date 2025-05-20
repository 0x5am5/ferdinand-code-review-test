import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { ColorManagerRefactored } from "@/components/brand/color-manager-refactored";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandAsset } from "@shared/schema";

export function ColorTestPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const clientIdNum = parseInt(clientId, 10);

  // Fetch client assets
  const { data: assets = [], isLoading } = useQuery<BrandAsset[]>({
    queryKey: [`/api/clients/${clientId}/assets`],
  });

  // Filter colors
  const colors = assets.filter((asset) => asset.category === "color");

  return (
    <div className="p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Color System - Refactored</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This page demonstrates the refactored color manager using the new standardized asset components.
          </p>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="mt-6">
          <ColorManagerRefactored 
            clientId={clientIdNum} 
            colors={colors}
          />
        </div>
      )}
    </div>
  );
}