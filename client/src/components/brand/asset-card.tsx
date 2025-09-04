import type { BrandAsset } from "@shared/schema";
import { Copy, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface AssetCardProps {
  asset: BrandAsset;
}

export function AssetCard({ asset }: AssetCardProps) {
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState(0);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Value copied to clipboard",
    });
  };

  const renderLogoAsset = () => {
    const data = asset.data as {
      type: string;
      formats: Array<{ format: string; url: string }>;
    };
    return (
      <>
        <div className="aspect-square rounded-lg border bg-muted flex items-center justify-center">
          <img
            src={data.formats[selectedFormat].url}
            alt={asset.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            {data.formats.map((format, index) => (
              <Button
                key={format.format}
                variant={selectedFormat === index ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFormat(index)}
              >
                {format.format}
              </Button>
            ))}
          </div>
          <Button variant="secondary" size="sm" asChild className="w-full">
            <a
              href={data.formats[selectedFormat].url}
              download={`${asset.name}.${data.formats[selectedFormat].format}`}
            >
              <Download className="mr-2 h-4 w-4" />
              Download {data.formats[selectedFormat].format}
            </a>
          </Button>
        </div>
      </>
    );
  };

  const renderColorAsset = () => {
    const data = asset.data as {
      hex: string;
      labels: { rgb?: string; cmyk?: string; pantone?: string };
    };
    return (
      <div className="space-y-4">
        <div
          className="h-24 rounded-lg border"
          style={{ backgroundColor: data.hex }}
        />
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => copyToClipboard(data.hex)}
          >
            <Copy className="mr-2 h-4 w-4" />
            {data.hex}
          </Button>
          {Object.entries(data.labels).map(
            ([format, value]) =>
              value && (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => copyToClipboard(value)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {format.toUpperCase()}: {value}
                </Button>
              )
          )}
        </div>
      </div>
    );
  };

  const renderTypographyAsset = () => {
    const data = asset.data as { source: string; family: string; url?: string };
    return (
      <div className="space-y-4">
        <p className="text-2xl" style={{ fontFamily: data.family }}>
          {data.family}
        </p>
        <div className="space-y-2">
          {data.url && (
            <Button variant="secondary" size="sm" asChild className="w-full">
              <a href={data.url} target="_blank" rel="noopener noreferrer">
                {data.source === "google"
                  ? "View on Google Fonts"
                  : data.source === "adobe"
                    ? "View on Adobe Fonts"
                    : "Download Font"}
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{asset.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {asset.description && (
          <p className="text-muted-foreground mb-4">{asset.description}</p>
        )}
        {asset.category === "logo" && renderLogoAsset()}
        {asset.category === "color" && renderColorAsset()}
        {asset.category === "typography" && renderTypographyAsset()}
      </CardContent>
    </Card>
  );
}
