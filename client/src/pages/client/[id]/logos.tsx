import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { BrandAsset } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useParams } from "wouter";
import { AssetCard } from "@/components/brand/asset-card";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function ClientLogos() {
  const { id } = useParams();
  const clientId = parseInt(id);

  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<BrandAsset[]>({
    queryKey: ["/api/clients", clientId, "assets"],
  });

  const logoAssets = assets.filter(asset => asset.category === 'logo');

  const logoGuideContent = [
    {
      title: "Main Logo",
      description: "The primary logo should be used as the default choice whenever possible. It represents the brand in its most complete and recognizable form.",
      when: "Use for marketing materials, website headers, business cards, and any primary brand touchpoints."
    },
    {
      title: "Horizontal Logo",
      description: "A horizontally-oriented version of the logo, designed for spaces that require a wider format.",
      when: "Perfect for website headers, email signatures, presentation slides, and banner advertisements."
    },
    {
      title: "Square Logo",
      description: "A compact, square version of the logo that maintains brand recognition in confined spaces.",
      when: "Ideal for social media profile pictures, app icons, and situations where space is limited but brand visibility is crucial."
    },
    {
      title: "App Icon",
      description: "A simplified version of the logo designed specifically for app icons and small digital displays.",
      when: "Use for mobile app icons, browser favicons, and other small digital applications where detail must be minimized."
    },
    {
      title: "Favicon",
      description: "The smallest version of the logo, optimized for browser tabs and bookmarks.",
      when: "Exclusively for website browser tabs and bookmark icons."
    }
  ];

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

        <div className="grid gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Logo Usage Guide</CardTitle>
              <CardDescription>
                Understanding when and how to use different logo variations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {logoGuideContent.map((guide, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger>{guide.title}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <p>{guide.description}</p>
                        <div>
                          <h4 className="font-medium mb-2">When to Use:</h4>
                          <p className="text-muted-foreground">{guide.when}</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

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
        </div>
      </main>
    </div>
  );
}