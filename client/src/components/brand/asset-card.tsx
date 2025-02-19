import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BrandAsset } from "@shared/schema";

interface AssetCardProps {
  asset: BrandAsset;
}

export function AssetCard({ asset }: AssetCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{asset.name}</span>
          <Button variant="ghost" size="icon" asChild>
            <a 
              href={(asset.data as any).downloadUrl} 
              download={asset.name}
            >
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {asset.description && (
          <p className="text-muted-foreground mb-4">
            {asset.description}
          </p>
        )}
        <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center">
          <img 
            src={(asset.data as any).previewUrl} 
            alt={asset.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </CardContent>
    </Card>
  );
}
