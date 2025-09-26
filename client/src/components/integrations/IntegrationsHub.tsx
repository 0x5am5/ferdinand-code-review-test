import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Slack, Figma } from "lucide-react";
import FigmaIntegration from "@/components/figma/figma-integration";
import { SlackIntegration } from "@/components/settings/SlackIntegration";

interface IntegrationsHubProps {
  clientId: number;
  featureToggles?: {
    figmaIntegration?: boolean;
    slackIntegration?: boolean;
  };
}

export function IntegrationsHub({ clientId, featureToggles = {} }: IntegrationsHubProps) {
  const figmaEnabled = featureToggles.figmaIntegration ?? false;
  const slackEnabled = featureToggles.slackIntegration ?? false;

  // Only show integrations that are enabled
  const enabledIntegrations = [
    ...(figmaEnabled ? [{ key: 'figma', name: 'Figma', icon: Figma, component: <FigmaIntegration clientId={clientId} /> }] : []),
    ...(slackEnabled ? [{ key: 'slack', name: 'Slack', icon: Slack, component: <SlackIntegration clientId={clientId} /> }] : []),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Integrations
          </CardTitle>
          <CardDescription>
            Connect Ferdinand with your design and communication tools
          </CardDescription>
        </CardHeader>
      </Card>

      {enabledIntegrations.length === 0 ? (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">No Integrations Enabled</CardTitle>
            <CardDescription className="text-orange-600">
              Contact your administrator to enable integrations for this client.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-orange-700">
            <p>Available integrations: Figma (design token sync), Slack (brand asset access)</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {enabledIntegrations.map(({ key, name, icon: Icon, component }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {name} Integration
                </CardTitle>
              </CardHeader>
              <CardContent>
                {component}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}