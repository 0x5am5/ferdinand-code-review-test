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
import { useToast } from "@/hooks/use-toast";

interface SlackConnectProps {
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  clientId?: number;
  onConnecting?: (state: boolean) => void;
}

/**
 * Slack Connect Button with Consent Modal
 * Shows a consent modal before redirecting to Slack OAuth
 */
export const SlackConnect: FC<SlackConnectProps> = ({
  variant = "default",
  size = "default",
  clientId,
  onConnecting,
}) => {
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnect = () => {
    setConsentModalOpen(true);
  };

  const handleConfirmConnect = async () => {
    try {
      setIsConnecting(true);
      onConnecting?.(true);

      const response = await fetch(
        `/api/clients/${clientId}/slack/oauth/install`
      );
      if (!response.ok) {
        throw new Error("Failed to initiate Slack installation");
      }

      const data = await response.json();

      // Redirect to Slack OAuth URL
      window.open(data.authUrl, "_blank", "width=600,height=800");

      setConsentModalOpen(false);

      toast({
        title: "Slack Installation Started",
        description:
          "Complete the installation in the new window. We'll automatically detect when it's done.",
      });
    } catch (error) {
      console.error("Failed to initiate Slack connect:", error);
      toast({
        title: "Connection Failed",
        description: "Unable to start Slack connection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
      onConnecting?.(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleConnect}
        disabled={isConnecting}
      >
        Connect Slack
      </Button>

      {/* OAuth Consent Modal */}
      <Dialog open={consentModalOpen} onOpenChange={setConsentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5 text-primary" />
              Connect Slack
            </DialogTitle>
            <DialogDescription>
              To access Ferdinand brand assets from Slack, we need your
              permission to install our bot in your workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-sm">Permissions Requested:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong>Access commands in channels:</strong> The Ferdinand
                    bot will respond to commands in channels where it's invited
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong>View user information:</strong> We'll access member
                    names and profiles to show who requested information
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong>Send messages:</strong> The bot will send brand
                    assets and information responses to your team
                  </span>
                </li>
              </ul>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Your security matters:</strong>
              </p>
              <ul className="space-y-1 ml-4">
                <li>
                  • You can revoke access anytime from your Slack workspace
                  settings
                </li>
                <li>
                  • The bot only responds to authorized members in your
                  workspace
                </li>
                <li>
                  • You can disconnect at any time from Ferdinand settings
                </li>
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
            <Button onClick={handleConfirmConnect} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Continue to Slack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
