import { AlertTriangle, RotateCcw, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SlackConnect } from "@/components/integrations/slack-connect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSlackStatusPolling } from "@/hooks/use-slack-status";
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

interface SlackIntegrationProps {
  clientId: number;
}

export function SlackIntegration({ clientId }: SlackIntegrationProps) {
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<SlackWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollingForCompletion, setPollingForCompletion] = useState(false);
  const { data: slackStatus } = useSlackStatusPolling(pollingForCompletion);

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

  // Watch for successful OAuth completion and stop polling
  useEffect(() => {
    if (pollingForCompletion && slackStatus?.linked) {
      setPollingForCompletion(false);
      fetchSlackData(); // Refresh workspace data
      toast({
        title: "Slack Integration Complete!",
        description: "Your Slack workspace has been successfully connected.",
      });
    }
  }, [pollingForCompletion, slackStatus?.linked, fetchSlackData, toast]);

  // Add timeout to stop polling after 5 minutes if user doesn't complete OAuth
  useEffect(() => {
    if (pollingForCompletion) {
      const timeout = setTimeout(
        () => {
          setPollingForCompletion(false);
          toast({
            title: "OAuth Timeout",
            description:
              "The Slack installation process has timed out. Please try again if you didn't complete the setup.",
            variant: "destructive",
          });
        },
        5 * 60 * 1000
      ); // 5 minutes

      return () => clearTimeout(timeout);
    }
  }, [pollingForCompletion, toast]);

  const handleConnectingStateChange = (isConnecting: boolean) => {
    setPollingForCompletion(isConnecting);
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

  const reactivateWorkspace = async (workspaceId: number) => {
    try {
      const response = await fetch(
        `/api/clients/${clientId}/slack/workspaces/${workspaceId}/reactivate`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to reactivate workspace");
      }

      toast({
        title: "Workspace Reactivated",
        description: "The Slack workspace has been reconnected successfully.",
      });

      fetchSlackData(); // Refresh data
    } catch (error) {
      console.error("Failed to reactivate workspace:", error);
      toast({
        title: "Error",
        description: "Failed to reactivate workspace. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteWorkspace = async (workspaceId: number) => {
    try {
      const response = await fetch(
        `/api/clients/${clientId}/slack/workspaces/${workspaceId}/delete`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete workspace");
      }

      toast({
        title: "Integration Deleted",
        description:
          "The Slack integration and all associated data have been permanently deleted.",
      });

      fetchSlackData(); // Refresh data
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      toast({
        title: "Error",
        description: "Failed to delete workspace. Please try again.",
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
      {workspaces.length === 0 ? (
        <SlackConnect
          clientId={clientId}
          onConnecting={handleConnectingStateChange}
        />
      ) : (
        <>
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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Connected Workspaces</h3>
                  <SlackConnect
                    clientId={clientId}
                    variant="outline"
                    size="sm"
                    onConnecting={handleConnectingStateChange}
                  />
                </div>

                {workspaces.map((workspace) => (
                  <Card key={workspace.id} className="border">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{workspace.teamName}</h4>
                          <Badge
                            variant={
                              workspace.isActive ? "default" : "secondary"
                            }
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
                        {workspace.isActive ? (
                          <Button
                            onClick={() => deactivateWorkspace(workspace.id)}
                            variant="outline"
                            size="sm"
                            className="text-gray-600 hover:text-gray-700"
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={() => reactivateWorkspace(workspace.id)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                    Delete Slack Integration?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-3 text-left">
                                    <p>
                                      This action will permanently delete the
                                      Slack integration for{" "}
                                      <strong>{workspace.teamName}</strong> and
                                      cannot be undone.
                                    </p>
                                    <div className="rounded-md bg-red-50 border border-red-200 p-3">
                                      <p className="font-semibold text-red-900 mb-2">
                                        The following data will be permanently
                                        deleted:
                                      </p>
                                      <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                                        <li>
                                          All activity logs and command history
                                        </li>
                                        <li>
                                          User mappings between Slack and
                                          Ferdinand
                                        </li>
                                        <li>Workspace authentication tokens</li>
                                        <li>
                                          Integration configuration settings
                                        </li>
                                      </ul>
                                    </div>
                                    <p className="text-sm">
                                      To reconnect Slack in the future, you will
                                      need to complete the setup process again.
                                    </p>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      deleteWorkspace(workspace.id)
                                    }
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Delete Integration
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Commands</CardTitle>
              <CardDescription>
                Commands your team can use in Slack once the integration is set
                up
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
                ].map((item) => (
                  <div key={item.command} className="p-3 border rounded-lg">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {item.command}
                    </code>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.description}
                    </p>
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
                <strong>For Slack admins:</strong> Once a workspace is
                connected, all users in your Slack workspace can immediately
                access Ferdinand commands.
              </p>
              <p>
                <strong>For team members:</strong> Start using Ferdinand
                commands in any channel right away. No individual setup is
                required.
              </p>
              <p>
                <strong>Bot permissions:</strong> Invite the Ferdinand bot to
                channels where you want to use commands and file uploads.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
