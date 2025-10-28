import { CloudIcon, Settings as SettingsIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleDriveConnect } from "@/components/assets/google-drive-connect";
import { useAuth } from "@/hooks/use-auth";

export default function AdminSettings() {
  const { user } = useAuth();

  // Only allow super admins to access this page
  if (!user || user.role !== "super_admin") {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access admin settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <section className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage system-wide integrations and settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          <div className="grid gap-6">
            {/* Google Drive Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CloudIcon className="h-5 w-5" />
                  Google Drive Integration
                </CardTitle>
                <CardDescription>
                  Link your Google Drive — allows importing files into any client
                  from its Brand Assets page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GoogleDriveConnect variant="default" size="default" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}