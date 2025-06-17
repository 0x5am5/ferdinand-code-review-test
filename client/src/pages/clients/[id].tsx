import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams, useLocation } from "wouter";
import { LogoManager } from "@/components/brand/logo-manager";
import { ColorManager } from "@/components/brand/color-manager";
import { FontManager } from "@/components/brand/font-manager";
import { PersonaManager } from "@/components/brand/persona-manager";
import { InspirationBoard } from "@/components/brand/inspiration-board";
import { ClientDashboard } from "@/components/brand/client-dashboard";
import {
  useClientAssetsById,
  useClientsById,
  useClientPersonasById,
} from "@/lib/queries/clients";
import { useEffect, useState } from "react";
import { queryClient } from "@/lib/queryClient";

export default function ClientDetails() {
  const { id } = useParams();
  const clientId = id ? parseInt(id) : null;
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("dashboard"); // Default to dashboard

  // Get the active tab from the sidebar through URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, []);

  // Listen for tab changes from the sidebar
  useEffect(() => {
    // This function will be called from the sidebar
    const handleTabChange = (e: CustomEvent) => {
      if (e.detail && e.detail.tab) {
        console.log("Received tab change event:", e.detail.tab);
        setActiveTab(e.detail.tab);
      }
    };

    window.addEventListener(
      "client-tab-change",
      handleTabChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "client-tab-change",
        handleTabChange as EventListener,
      );
    };
  }, []);

  // Debug logging
  useEffect(() => {
    console.log("Current active tab:", activeTab);
  }, [activeTab]);

  const { data: client, isLoading: isLoadingClient } = useClientsById(clientId);
  const { isLoading: isLoadingAssets, data: assets = [] } = useClientAssetsById(
    clientId ?? null,
  );
  const { data: personas = [], isLoading: isLoadingPersonas } =
    useClientPersonasById(clientId ?? null);

  if (!clientId || isNaN(clientId)) {
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
  const featureToggles = client.featureToggles || {
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
    figmaIntegration: false,
  };



  const anyFeatureEnabled = Object.values(featureToggles).some(
    (value) => value === true,
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
  let primaryColor = null;
  try {
    if (colorAssets && colorAssets.length > 0) {
      // Find a color asset with 'primary' in its role or name
      const primaryColorAsset = colorAssets.find(asset => {
        if (!asset || !asset.data) return false;
        
        let data;
        try {
          data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
        } catch (parseErr) {
          return false;
        }
        
        return (data.role === "primary" || 
               (data.name && typeof data.name === "string" && 
                data.name.toLowerCase().includes("primary")));
      });
      
      if (primaryColorAsset && primaryColorAsset.data) {
        let colorData;
        try {
          colorData = typeof primaryColorAsset.data === "string" 
            ? JSON.parse(primaryColorAsset.data) 
            : primaryColorAsset.data;
          
          primaryColor = colorData.value || colorData.hex || null;
        } catch (parseErr) {
          console.error("Error parsing color data:", parseErr);
        }
      }
    }
  } catch (e) {
    console.error("Error processing color assets:", e);
  }

  // Render the content based on activeTab
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <ClientDashboard 
            clientId={clientId} 
            clientName={client.name}
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
        return featureToggles.figmaIntegration ? (
          <Card>
            <CardHeader>
              <CardTitle>Design System</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Sync design tokens and styles with Figma design files. This feature allows seamless two-way synchronization of your brand guidelines with your Figma projects.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Coming Soon</h4>
                <p className="text-blue-800 text-sm">
                  Figma Integration features are currently in development. This will include:
                </p>
                <ul className="list-disc list-inside text-blue-800 text-sm mt-2 space-y-1">
                  <li>Two-way sync of color palettes</li>
                  <li>Typography system synchronization</li>
                  <li>Component token management</li>
                  <li>Design system validation</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Feature Disabled</CardTitle>
            </CardHeader>
            <CardContent>
              Design System feature is disabled for this client.
            </CardContent>
          </Card>
        );

      default:
        // Show dashboard by default
        return (
          <ClientDashboard 
            clientId={clientId} 
            clientName={client.name}
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
    <div className={activeTab === "dashboard" ? "p-0" : "p-8 pt-4"}>
      {/* {activeTab !== "dashboard" && (
        <h1 className="text-3xl font-bold mb-8">{client.name}</h1>
      )} */}
      {renderContent()}
    </div>
  );
}
