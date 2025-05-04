import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
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

export default function ClientDetails() {
  const { id } = useParams();
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1]);
  const activeTab = searchParams.get("tab") || "logos";
  const clientId = id ? parseInt(id) : null;

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
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: client, isLoading: isLoadingClient } = useClientsQuery();
  const { isLoading: isLoadingAssets, data: assets = [] } = useClientAssetsById(clientId);
  const { data: personas = [], isLoading: isLoadingPersonas } = useClientPersonasById(clientId);

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
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const logoAssets = assets.filter((asset) => asset.category === "logo");
  const colorAssets = assets.filter((asset) => asset.category === "color") || [];
  const fontAssets = assets.filter((asset) => asset.category === "font") || [];
  const featureToggles = client.featureToggles || {
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
  };

  const renderContent = () => {
    switch (activeTab) {
      case "logos":
        return featureToggles.logoSystem ? <LogoManager clientId={clientId} logos={logoAssets} /> : null;
      case "colors":
        return featureToggles.colorSystem ? <ColorManager clientId={clientId} colors={colorAssets} /> : null;
      case "typography":
        return featureToggles.typeSystem ? <FontManager clientId={clientId} fonts={fontAssets} /> : null;
      case "personas":
        return featureToggles.userPersonas ? <PersonaManager clientId={clientId} personas={personas} /> : null;
      case "inspiration":
        return featureToggles.inspiration ? <InspirationBoard clientId={clientId} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">{client.name}</h1>
      {renderContent()}
    </div>
  );
}