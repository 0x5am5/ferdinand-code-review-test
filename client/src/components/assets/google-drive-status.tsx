import { CheckCircle2, CloudIcon, CloudOffIcon } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useGoogleDriveConnectionQuery,
  useGoogleDriveDisconnectMutation,
} from "@/lib/queries/google-drive";

/**
 * Google Drive Connection Status Component
 * Displays current connection status and provides disconnect option
 */
export const GoogleDriveStatus: FC = () => {
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudIcon className="h-5 w-5" />
            Google Drive Integration
          </CardTitle>
          <CardDescription>Loading connection status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!connection) {
    return null; // Don't show anything if not connected
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudIcon className="h-5 w-5" />
          Google Drive Integration
        </CardTitle>
        <CardDescription>
          Manage your Google Drive connection for importing assets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            We only access files you explicitly choose to import into Ferdinand.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
