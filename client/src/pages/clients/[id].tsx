import type { BrandAsset, FeatureToggles } from "@shared/schema";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ClientDashboard } from "@/components/brand/client-dashboard";
import { ColorManager } from "@/components/brand/color-manager";
import { FontManager } from "@/components/brand/font-manager/font-manager";
import { InspirationBoard } from "@/components/brand/inspiration-board";
import { LogoManager } from "@/components/brand/logo-manager/logo-manager";
import { PersonaManager } from "@/components/brand/persona-manager";
import FigmaIntegration from "@/components/figma/figma-integration";
import { IntegrationsHub } from "@/components/integrations/IntegrationsHub";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useClientAssetsById,
  useClientPersonasById,
  useClientsById,
} from "@/lib/queries/clients";
import { queryClient } from "@/lib/queryClient";

export default function ClientDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const clientId = id ? parseInt(id, 10) : null;
  const [activeTab, setActiveTab] = useState<string>("dashboard"); // Default to dashboard

  // Get the active tab from the sidebar through URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) {
      // If users tab is selected, redirect to the users page
      if (tab === "users" && clientId) {
        setLocation(`/clients/${clientId}/users`);
        return;
      }
      setActiveTab(tab);
    }
  }, [clientId, setLocation]);

  // Listen for tab changes from the sidebar
  useEffect(() => {
    // This function will be called from the sidebar
    const handleTabChange = (e: CustomEvent) => {
      if (e.detail?.tab) {
        console.log("Received tab change event:", e.detail.tab);
        // If users tab is selected, redirect to the users page
        if (e.detail.tab === "users" && clientId) {
          setLocation(`/clients/${clientId}/users`);
          return;
        }
        setActiveTab(e.detail.tab);
      }
    };

    window.addEventListener(
      "client-tab-change",
      handleTabChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "client-tab-change",
        handleTabChange as EventListener
      );
    };
  }, [clientId, setLocation]);

  const { data: client, isLoading: isLoadingClient } = useClientsById(clientId);
  const { isLoading: isLoadingAssets, data: assets = [] } = useClientAssetsById(
    clientId ?? null
  );
  const { data: personas = [], isLoading: isLoadingPersonas } =
    useClientPersonasById(clientId ?? null);

  if (!clientId || Number.isNaN(clientId)) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <CardTitle>Invalid Client ID</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingClient || isLoadingAssets || isLoadingPersonas) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client && !isLoadingClient) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <CardTitle>Client Not Found</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter assets by category
  const logoAssets = assets.filter((asset) => asset.category === "logo");
  const colorAssets =
    assets.filter((asset) => asset.category === "color") || [];
  const fontAssets = assets.filter((asset) => asset.category === "font") || [];

  // Read feature toggles from client data
  const featureToggles: FeatureToggles =
    (client?.featureToggles as FeatureToggles) || {
      logoSystem: true,
      colorSystem: true,
      typeSystem: true,
      userPersonas: true,
      inspiration: true,
      figmaIntegration: false,
      slackIntegration: false,
    };

  const anyFeatureEnabled = Object.values(featureToggles).some(
    (value) => value === true
  );

  if (!anyFeatureEnabled) {
    return (
      <div className="p-8 pt-4">
        <Card>
          <CardHeader>
            <CardTitle>All Features Disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              All features are currently disabled for this client. Enable
              features in the client settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract primary color from color assets if available
  let primaryColor: string | undefined;
  try {
    if (colorAssets && colorAssets.length > 0) {
      const primaryColorAsset = colorAssets.find((asset: BrandAsset) => {
        if (!asset || !asset.data) return false;
        try {
          const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
          return data && typeof data === "object" && data.category === "brand";
        } catch {
          return false;
        }
      });

      if (primaryColorAsset?.data) {
        let colorData: { colors?: { hex: string }[] };
        try {
          colorData =
            typeof primaryColorAsset.data === "string"
              ? JSON.parse(primaryColorAsset.data)
              : primaryColorAsset.data;

          // Extract color from the colors array (main color value)
          if (
            colorData.colors &&
            colorData.colors.length > 0 &&
            colorData.colors[0].hex
          ) {
            primaryColor = colorData.colors[0].hex;
          }
        } catch (parseErr: unknown) {
          console.error(
            "Error parsing color data:",
            parseErr instanceof Error ? parseErr.message : "Unknown error"
          );
        }
      }
    }
  } catch (e: unknown) {
    console.error(
      "Error processing color assets:",
      e instanceof Error ? e.message : "Unknown error"
    );
  }

  // Render the content based on activeTab
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <ClientDashboard
            clientId={clientId}
            clientName={client?.name || "Unknown Client"}
            logos={logoAssets}
            primaryColor={primaryColor}
            featureToggles={featureToggles}
            onTabChange={setActiveTab}
          />
        );

      case "logos":
        return featureToggles.logoSystem ? (
          <LogoManager clientId={clientId} logos={logoAssets} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Feature Disabled</CardTitle>
            </CardHeader>
            <CardContent>
              Logo System feature is disabled for this client.
            </CardContent>
          </Card>
        );

      case "colors":
        return featureToggles.colorSystem ? (
          <ColorManager clientId={clientId} colors={colorAssets} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Feature Disabled</CardTitle>
            </CardHeader>
            <CardContent>
              Color System feature is disabled for this client.
            </CardContent>
          </Card>
        );

      case "typography":
        return featureToggles.typeSystem ? (
          <FontManager clientId={clientId} fonts={fontAssets} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Feature Disabled</CardTitle>
            </CardHeader>
            <CardContent>
              Typography System feature is disabled for this client.
            </CardContent>
          </Card>
        );

      case "personas":
        return featureToggles.userPersonas ? (
          <PersonaManager clientId={clientId} personas={personas} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Feature Disabled</CardTitle>
            </CardHeader>
            <CardContent>
              User Personas feature is disabled for this client.
            </CardContent>
          </Card>
        );

      case "inspiration":
        return featureToggles.inspiration ? (
          <InspirationBoard clientId={clientId} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Feature Disabled</CardTitle>
            </CardHeader>
            <CardContent>
              Inspiration Board feature is disabled for this client.
            </CardContent>
          </Card>
        );

      case "design-system":
        return (
          <IntegrationsHub
            clientId={client?.id || 0}
            featureToggles={{
              figmaIntegration: featureToggles.figmaIntegration,
              slackIntegration: featureToggles.slackIntegration,
            }}
          />
        );

      default:
        // Show dashboard by default
        return (
          <ClientDashboard
            clientId={clientId}
            clientName={client?.name || "Unknown Client"}
            logos={logoAssets}
            primaryColor={primaryColor}
            featureToggles={featureToggles}
            onTabChange={setActiveTab}
          />
        );
    }
  };

  // Only display title for non-dashboard views
  return (
    <div className={activeTab === "dashboard" ? "" : "p-8 pt-4"}>
      {renderContent()}
    </div>
  );
}
