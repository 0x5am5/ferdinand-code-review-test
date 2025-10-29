import { CheckCircle2, CloudOffIcon } from "lucide-react";
import type { FC } from "react";
import { GoogleDriveConnect } from "@/components/assets/google-drive-connect";
import { Button } from "@/components/ui/button";
import {
  useGoogleDriveConnectionQuery,
  useGoogleDriveDisconnectMutation,
} from "@/lib/queries/google-drive";

interface GoogleDriveIntegrationProps {
  clientId: number;
  userRole?: string;
  description?: string;
}

/**
 * Google Drive Integration Component for Integrations Hub
 * Handles connection management, status display
 * Note: This component is wrapped in Card/CardHeader/CardContent by IntegrationsHub
 */
export const GoogleDriveIntegration: FC<GoogleDriveIntegrationProps> = ({
  clientId,
  userRole,
  description,
}) => {
  const { data: connection, isLoading } = useGoogleDriveConnectionQuery();
  const disconnectMutation = useGoogleDriveDisconnectMutation();

  const handleDisconnect = () => {
    if (
      window.confirm(
        "Are you sure you want to disconnect Google Drive? You'll need to reconnect to import files from Drive again."
      )
    ) {
      disconnectMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading Google Drive connection status...
      </p>
    );
  }

  // Not connected state - show connect button
  if (!connection) {
    // Guests cannot connect
    if (userRole === "guest") return null;

    // If a super admin initiates the connection from the Integrations Hub,
    // treat it the same as connecting from the Settings page by omitting
    // the clientId. The backend will interpret a missing clientId as a
    // tenant-wide (super-admin) connection.
    const connectClientId = userRole === "super_admin" ? undefined : clientId;

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {description ??
            "Connect your Google Drive to import brand assets directly from your Drive files."}
        </p>
        <GoogleDriveConnect clientId={connectClientId} variant="default" />
      </div>
    );
  }

  // Connected state - show management interface
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Connected</p>
            <p className="text-sm text-muted-foreground">
              {connection.connectedAt &&
                `Connected on ${new Date(connection.connectedAt).toLocaleDateString()}`}
            </p>
            {connection.lastUsedAt && (
              <p className="text-xs text-muted-foreground">
                Last used:{" "}
                {new Date(connection.lastUsedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={disconnectMutation.isPending}
        >
          <CloudOffIcon className="h-4 w-4 mr-2" />
          {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
        </Button>
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p className="font-medium">Permissions:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>View files in your Google Drive</li>
          <li>Access file metadata (names, sizes, dates)</li>
        </ul>
        <p className="text-xs mt-2">
          Import files from Google Drive using the "Import from Drive" button on
          the Brand Assets page.
        </p>
      </div>
    </div>
  );
};
