import { CloudIcon } from "lucide-react";
import { GoogleDriveIntegration } from "@/components/integrations/google-drive-integration";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export default function AdminSettings() {
  const { user } = useAuth();

  // Only allow super admins to access this page
  if (!user || user.role !== "super_admin") {
    return (
      <div className="p-8 pt-4">
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
    <div className="p-8 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage system-wide integrations and settings
          </p>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudIcon className="h-5 w-5" />
              Google Drive Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GoogleDriveIntegration
              clientId={0}
              userRole="super_admin"
              description="Connect your Google Drive to import brand assets directly from
              your Drive files into any client's Brand Assets page."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
