import { CloudIcon, Settings as SettingsIcon } from "lucide-react";
import { GoogleDriveIntegration } from "@/components/integrations/google-drive-integration";
import { SlackIntegration } from "@/components/settings/SlackIntegration";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsPageProps {
  clientId: number;
  featureToggles?: {
    figmaIntegration?: boolean;
    slackIntegration?: boolean;
    brandAssets?: boolean;
  };
}

export function SettingsPage({
  clientId,
  featureToggles = {},
}: SettingsPageProps) {
  const figmaEnabled = featureToggles.figmaIntegration ?? false;
  const slackEnabled = featureToggles.slackIntegration ?? false;
  const brandAssetsEnabled = featureToggles.brandAssets ?? false;

  return (
    <section className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your integrations and application settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          <div className="grid gap-6">
            {/* Google Drive Integration - Always available when brand assets are enabled */}
            {brandAssetsEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CloudIcon className="h-5 w-5" />
                    Google Drive Integration
                  </CardTitle>
                  <CardDescription>
                    Connect your Google Drive to import brand assets directly
                    from your Drive files.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GoogleDriveIntegration clientId={clientId} />
                </CardContent>
              </Card>
            )}

            {/* Slack Integration */}
            {slackEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    Slack Integration
                  </CardTitle>
                  <CardDescription>
                    Connect Slack to enable brand asset access and
                    notifications.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SlackIntegration clientId={clientId} />
                </CardContent>
              </Card>
            )}

            {/* Figma Integration */}
            {figmaEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    Figma Integration
                  </CardTitle>
                  <CardDescription>
                    Sync design tokens and styles with Figma design files.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Figma integration settings will be available here.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* No integrations available state */}
            {!brandAssetsEnabled && !slackEnabled && !figmaEnabled && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-orange-800">
                    No Integrations Available
                  </CardTitle>
                  <CardDescription className="text-orange-600">
                    Contact your administrator to enable integrations for this
                    client.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-orange-700">
                  <p>
                    Available integrations: Google Drive (asset import), Slack
                    (brand asset access), Figma (design token sync)
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
