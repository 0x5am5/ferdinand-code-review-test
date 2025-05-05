import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams, useLocation } from "wouter";
import { LogoManager } from "@/components/brand/logo-manager";
import { ColorManager } from "@/components/brand/color-manager";
import { FontManager } from "@/components/brand/font-manager";
import { PersonaManager } from "@/components/brand/persona-manager";
import { InspirationBoard } from "@/components/brand/inspiration-board";
import {
  useClientAssetsById,
  useClientsQuery,
  useClientPersonasById,
} from "@/lib/queries/clients";
import { useEffect, useState } from "react";

export default function ClientDetails() {
  const { id } = useParams();
  const clientId = id ? parseInt(id) : null;
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("logos");

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
        console.log('Received tab change event:', e.detail.tab);
        setActiveTab(e.detail.tab);
      }
    };

    window.addEventListener('client-tab-change', handleTabChange as EventListener);

    return () => {
      window.removeEventListener('client-tab-change', handleTabChange as EventListener);
    };
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('Current active tab:', activeTab);
  }, [activeTab]);

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
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: client, isLoading: isLoadingClient } = useClientsQuery();
  const { isLoading: isLoadingAssets, data: assets = [] } =
    useClientAssetsById(clientId);
  const { data: personas = [], isLoading: isLoadingPersonas } =
    useClientPersonasById(clientId);

  if (isLoadingClient || isLoadingAssets || isLoadingPersonas) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
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
              <Button variant="outline">
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

  // Render the content based on activeTab
  const renderContent = () => {
    switch (activeTab) {
      case "logos":
        return featureToggles.logoSystem ? (
          <LogoManager clientId={clientId} logos={logoAssets} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Feature Disabled</CardTitle>
            </CardHeader>
            <CardContent>Logo System feature is disabled for this client.</CardContent>
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
            <CardContent>Color System feature is disabled for this client.</CardContent>
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
            <CardContent>Typography System feature is disabled for this client.</CardContent>
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
            <CardContent>User Personas feature is disabled for this client.</CardContent>
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
            <CardContent>Inspiration Board feature is disabled for this client.</CardContent>
          </Card>
        );

      default:
        // Find first enabled tab
        if (featureToggles.logoSystem) return <LogoManager clientId={clientId} logos={logoAssets} />;
        if (featureToggles.colorSystem) return <ColorManager clientId={clientId} colors={colorAssets} />;
        if (featureToggles.typeSystem) return <FontManager clientId={clientId} fonts={fontAssets} />;
        if (featureToggles.userPersonas) return <PersonaManager clientId={clientId} personas={personas} />;
        if (featureToggles.inspiration) return <InspirationBoard clientId={clientId} />;

        return (
          <Card>
            <CardHeader>
              <CardTitle>No Active Tab</CardTitle>
            </CardHeader>
            <CardContent>Please select a tab from the sidebar.</CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="p-8 pt-4">
      <h1 className="text-3xl font-bold mb-8">{client.name}</h1>
      {renderContent()}
    </div>
  );
}