import { InfoIcon } from "lucide-react";
import { type FC, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useGoogleDriveConnectionQuery,
  useGoogleDriveConnectMutation,
} from "@/lib/queries/google-drive";

interface GoogleDriveConnectProps {
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  clientId?: number;
}

/**
 * Google Drive Connect Button with Consent Modal
 * Shows a consent modal before redirecting to Google OAuth
 */
export const GoogleDriveConnect: FC<GoogleDriveConnectProps> = ({
  variant = "outline",
  size = "default",
  clientId,
}) => {
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const { data: connection, isLoading } = useGoogleDriveConnectionQuery();
  const connectMutation = useGoogleDriveConnectMutation();

  const handleConnect = () => {
    setConsentModalOpen(true);
  };

  const handleConfirmConnect = () => {
    connectMutation.mutate(clientId);
  };

  // Don't show button if already connected
  if (connection) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleConnect}
        disabled={isLoading}
      >
        Connect Google Drive
      </Button>

      {/* OAuth Consent Modal */}
      <Dialog open={consentModalOpen} onOpenChange={setConsentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5 text-primary" />
              Connect Google Drive
            </DialogTitle>
            <DialogDescription>
              To download files from Google Drive, we need your permission to
              access your Drive files. Files will be downloaded and stored in
              your Ferdinand account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-sm">Permissions Requested:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong>View files in your Drive:</strong> We'll be able to
                    see and download files you choose to share with Ferdinand
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong>View file metadata:</strong> We'll access file
                    names, sizes, and modification dates to help you organize
                    your assets
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong>Download files:</strong> Selected files will be
                    downloaded and stored in your Ferdinand account
                  </span>
                </li>
              </ul>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Your privacy matters:</strong>
              </p>
              <ul className="space-y-1 ml-4">
                <li>• We only download files you explicitly select</li>
                <li>• Your credentials are encrypted and stored securely</li>
                <li>• Downloaded files are stored in your Ferdinand account</li>
                <li>• You can disconnect at any time from your settings</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConsentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmConnect}>Continue to Google</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
