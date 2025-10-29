import { CloudIcon, Figma, Slack, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import FigmaIntegration from "@/components/figma/figma-integration";
import { GoogleDriveIntegration } from "@/components/integrations/google-drive-integration";
import { SlackIntegration } from "@/components/settings/SlackIntegration";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface IntegrationsHubProps {
  clientId: number;
  featureToggles?: {
    figmaIntegration?: boolean;
    slackIntegration?: boolean;
    brandAssets?: boolean;
  };
  userRole?: string;
}

export function IntegrationsHub({
  clientId,
  featureToggles = {},
  userRole,
}: IntegrationsHubProps) {
  const figmaEnabled = featureToggles.figmaIntegration ?? false;
  const slackEnabled = featureToggles.slackIntegration ?? false;
  const googleDriveEnabled = featureToggles.brandAssets ?? false;

  // Track open/closed state for each integration
  const [openIntegrations, setOpenIntegrations] = useState<Record<string, boolean>>({
    figma: false,
    slack: false,
    googleDrive: false,
  });

  const toggleIntegration = (key: string) => {
    setOpenIntegrations((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Only show integrations that are enabled
  const enabledIntegrations = [
    ...(figmaEnabled
      ? [
          {
            key: "figma",
            name: "Figma",
            icon: Figma,
            component: <FigmaIntegration clientId={clientId} />,
          },
        ]
      : []),
    ...(slackEnabled
      ? [
          {
            key: "slack",
            name: "Slack",
            icon: Slack,
            component: <SlackIntegration clientId={clientId} />,
          },
        ]
      : []),
    ...(googleDriveEnabled
      ? [
          {
            key: "googleDrive",
            name: "Google Drive",
            icon: CloudIcon,
            component: <GoogleDriveIntegration clientId={clientId} userRole={userRole} />,
          },
        ]
      : []),
  ];

  return (
    <section className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect Ferdinand with your design and communication tools
          </p>
        </div>
      </div>

      {enabledIntegrations.length === 0 ? (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">
              No Integrations Enabled
            </CardTitle>
            <CardDescription className="text-orange-600">
              Contact your administrator to enable integrations for this client.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-orange-700">
            <p>
              Available integrations: Figma (design token sync), Slack (brand
              asset access), Google Drive (asset import)
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {enabledIntegrations.map(({ key, name, icon: Icon, component }) => (
            <Collapsible
              key={key}
              open={openIntegrations[key]}
              onOpenChange={() => toggleIntegration(key)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        {name} Integration
                      </div>
                      {openIntegrations[key] ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>{component}</CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </section>
  );
}
