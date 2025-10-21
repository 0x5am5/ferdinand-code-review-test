import {
  CheckCircle2,
  CloudIcon,
  CloudOffIcon,
  FolderIcon,
  Loader2,
} from "lucide-react";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { GoogleDrivePicker } from "@/components/assets/google-drive-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useGoogleDriveConnectionQuery,
  useGoogleDriveDisconnectMutation,
  useGoogleDriveImportMutation,
  useGoogleDriveTokenQuery,
} from "@/lib/queries/google-drive";

interface GoogleDriveStatusProps {
  clientId: number;
}

/**
 * Google Drive Connection Status Component
 * Displays current connection status and provides disconnect option
 */
export const GoogleDriveStatus: FC<GoogleDriveStatusProps> = ({ clientId }) => {
  const { data: connection, isLoading } = useGoogleDriveConnectionQuery();
  const disconnectMutation = useGoogleDriveDisconnectMutation();
  const importMutation = useGoogleDriveImportMutation();
  const { data: tokenData, refetch: refetchToken } = useGoogleDriveTokenQuery();
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [importingFileCount, setImportingFileCount] = useState(0);

  // Fetch access token when connection exists
  useEffect(() => {
    if (connection) {
      refetchToken();
    }
  }, [connection, refetchToken]);

  // Update access token when token data changes
  useEffect(() => {
    if (tokenData?.accessToken) {
      setAccessToken(tokenData.accessToken);
    }
  }, [tokenData]);

  const handleDisconnect = () => {
    if (
      window.confirm(
        "Are you sure you want to disconnect Google Drive? You'll need to reconnect to import files from Drive again."
      )
    ) {
      disconnectMutation.mutate();
    }
  };

  const handleFilesSelected = (files: google.picker.DocumentObject[]) => {
    setImportingFileCount(files.length);
    importMutation.mutate({ files, clientId });
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
          <div className="flex gap-2">
            <GoogleDrivePicker
              clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}
              appId={import.meta.env.VITE_GOOGLE_APP_ID || ""}
              oauthToken={accessToken}
              onFilesSelected={handleFilesSelected}
              allowFolders={true}
              allowMultiple={true}
            >
              <Button
                variant="default"
                size="sm"
                disabled={importMutation.isPending || !accessToken}
              >
                <FolderIcon className="h-4 w-4 mr-2" />
                {importMutation.isPending
                  ? "Importing..."
                  : "Import from Drive"}
              </Button>
            </GoogleDrivePicker>
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
        </div>

        {/* Import Progress Indicator */}
        {importMutation.isPending && importingFileCount > 0 && (
          <output
            className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 space-y-3"
            aria-live="polite"
            aria-label={`Importing ${importingFileCount} file${importingFileCount !== 1 ? "s" : ""} from Google Drive`}
          >
            <div className="flex items-center gap-3">
              <Loader2
                className="h-5 w-5 animate-spin text-blue-600"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="font-medium text-sm text-blue-900 dark:text-blue-100">
                  Importing files from Google Drive...
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Importing {importingFileCount} file
                  {importingFileCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Progress
              value={undefined}
              className="h-2"
              aria-label="Import progress"
            />
          </output>
        )}

        {/* Success Message */}
        {importMutation.isSuccess && (
          <output
            className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2
                className="h-5 w-5 text-green-600"
                aria-hidden="true"
              />
              <p className="font-medium text-sm text-green-900 dark:text-green-100">
                Successfully imported {importingFileCount} file
                {importingFileCount !== 1 ? "s" : ""} from Google Drive
              </p>
            </div>
          </output>
        )}

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
