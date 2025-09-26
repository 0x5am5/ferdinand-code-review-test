import { AlertTriangle, Check, Plus, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface SlackWorkspace {
  id: number;
  slackTeamId: string;
  teamName: string;
  botUserId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SlackUserMapping {
  id: number;
  slackUserId: string;
  slackTeamId: string;
  ferdinandUserId: number;
  clientId: number;
  isActive: boolean;
  createdAt: string;
}

interface SlackIntegrationProps {
  clientId: number;
}

export function SlackIntegration({ clientId }: SlackIntegrationProps) {
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [userMappings, setUserMappings] = useState<SlackUserMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);

  const fetchSlackData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch workspaces
      const workspacesRes = await fetch(
        `/api/clients/${clientId}/slack/workspaces`
      );
      if (workspacesRes.ok) {
        const workspacesData = await workspacesRes.json();
        setWorkspaces(workspacesData);
      }

      // Fetch user mappings
      const mappingsRes = await fetch(
        `/api/clients/${clientId}/slack/mappings`
      );
      if (mappingsRes.ok) {
        const mappingsData = await mappingsRes.json();
        setUserMappings(mappingsData);
      }
    } catch (error) {
      console.error("Failed to fetch Slack data:", error);
      toast({
        title: "Error",
        description: "Failed to load Slack integration data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    fetchSlackData();
  }, [fetchSlackData]);

  const initiateSlackInstall = async () => {
    try {
      setInstalling(true);

      const response = await fetch(
        `/api/clients/${clientId}/slack/oauth/install`
      );
      if (!response.ok) {
        throw new Error("Failed to initiate Slack installation");
      }

      const data = await response.json();

      // Redirect to Slack OAuth URL
      window.open(data.authUrl, "_blank", "width=600,height=800");

      toast({
        title: "Slack Installation Started",
        description:
          "Complete the installation in the new window, then refresh this page.",
      });
    } catch (error) {
      console.error("Failed to initiate Slack install:", error);
      toast({
        title: "Installation Failed",
        description: "Unable to start Slack installation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setInstalling(false);
    }
  };

  const deactivateWorkspace = async (workspaceId: number) => {
    try {
      const response = await fetch(
        `/api/clients/${clientId}/slack/workspaces/${workspaceId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to deactivate workspace");
      }

      toast({
        title: "Workspace Deactivated",
        description: "The Slack workspace has been disconnected successfully.",
      });

      fetchSlackData(); // Refresh data
    } catch (error) {
      console.error("Failed to deactivate workspace:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate workspace. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Slack Integration
            </CardTitle>
            <CardDescription>
              Loading Slack integration settings...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Slack Integration
          </CardTitle>
          <CardDescription>
            Connect your Slack workspace to access Ferdinand brand assets
            directly from Slack.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {workspaces.length === 0 ? (
            <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-lg">
              <AlertTriangle className="mx-auto h-8 w-8 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Slack Workspaces Connected
              </h3>
              <p className="text-gray-500 mb-4">
                Connect your Slack workspace to enable brand asset access from
                Slack.
              </p>
              <Button
                onClick={initiateSlackInstall}
                disabled={installing}
                className="flex items-center gap-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                {installing ? "Starting Installation..." : "Add to Slack"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Connected Workspaces</h3>
                <Button
                  onClick={initiateSlackInstall}
                  disabled={installing}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Another Workspace
                </Button>
              </div>

              {workspaces.map((workspace) => (
                <Card key={workspace.id} className="border">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{workspace.teamName}</h4>
                        <Badge
                          variant={workspace.isActive ? "default" : "secondary"}
                        >
                          {workspace.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        Team ID: {workspace.slackTeamId}
                      </p>
                      <p className="text-sm text-gray-500">
                        Connected:{" "}
                        {new Date(workspace.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {workspace.isActive && (
                        <Button
                          onClick={() => deactivateWorkspace(workspace.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {userMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>User Mappings</CardTitle>
            <CardDescription>
              Slack users connected to Ferdinand accounts ({userMappings.length}{" "}
              active)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userMappings.slice(0, 5).map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      Slack User: {mapping.slackUserId}
                    </span>
                    {mapping.ferdinandUserId && (
                      <Badge variant="outline" className="text-xs">
                        Ferdinand User: {mapping.ferdinandUserId}
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant={mapping.isActive ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {mapping.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
              {userMappings.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  ... and {userMappings.length - 5} more user mappings
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Available Commands</CardTitle>
          <CardDescription>
            Commands your team can use in Slack once the integration is set up
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                command: "/ferdinand logo [variant]",
                description: "Get brand logo files",
              },
              {
                command: "/ferdinand color [variant]",
                description: "View color palettes",
              },
              {
                command: "/ferdinand font [variant]",
                description: "Get typography info",
              },
              {
                command: "/ferdinand search <query>",
                description: "Search all brand assets",
              },
              {
                command: "/ferdinand help",
                description: "Show help and usage",
              },
            ].map((item, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  {item.command}
                </code>
                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-orange-700 space-y-2">
          <p>
            <strong>For Slack admins:</strong> After connecting a workspace,
            users need to be mapped to Ferdinand accounts to access commands.
          </p>
          <p>
            <strong>For team members:</strong> Type any Ferdinand command in
            Slack to get started. The bot will guide you if setup is needed.
          </p>
          <p>
            <strong>Bot permissions:</strong> Invite the Ferdinand bot to
            channels where you want to use in-channel file uploads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
