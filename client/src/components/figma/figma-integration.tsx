import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Figma, Plus, RefreshCw, Trash2, AlertTriangle, CheckCircle, Clock, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FigmaConnection {
  id: number;
  figmaFileId: string;
  figmaFileKey: string;
  figmaFileName: string;
  figmaTeamId?: string;
  isActive: boolean;
  lastSyncAt?: string;
  syncStatus: "idle" | "syncing" | "success" | "error";
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

interface FigmaSyncLog {
  id: number;
  syncType: string;
  syncDirection: string;
  status: string;
  elementsChanged?: Array<{ type: string; name: string; action: string }>;
  errorMessage?: string;
  duration?: number;
  createdAt: string;
}

const figmaConnectionSchema = z.object({
  figmaFileKey: z.string().min(1, "Figma file key is required"),
  figmaFileName: z.string().min(1, "File name is required"),
  figmaTeamId: z.string().optional(),
  accessToken: z.string().min(1, "Figma access token is required"),
});

type FigmaConnectionForm = z.infer<typeof figmaConnectionSchema>;

interface FigmaIntegrationProps {
  clientId: number;
}

export default function FigmaIntegration({ clientId }: FigmaIntegrationProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FigmaConnectionForm>({
    resolver: zodResolver(figmaConnectionSchema),
    defaultValues: {
      figmaFileKey: "",
      figmaFileName: "",
      figmaTeamId: "",
      accessToken: "",
    },
  });

  // Fetch Figma connections
  const { data: connections = [], isLoading } = useQuery<FigmaConnection[]>({
    queryKey: ["/api/figma/connections", clientId],
    enabled: !!clientId,
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (accessToken: string) => {
      const response = await fetch(`/api/figma/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });

  // Create connection mutation
  const createConnectionMutation = useMutation({
    mutationFn: async (data: FigmaConnectionForm & { clientId: number; figmaFileId: string }) => {
      const response = await fetch(`/api/figma/connections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/figma/connections", clientId] });
      setIsConnecting(false);
      form.reset();
      toast({
        title: "Connection created",
        description: "Figma file has been connected successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect Figma file.",
        variant: "destructive",
      });
    },
  });

  // Sync from Figma mutation
  const syncFromFigmaMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const response = await fetch(`/api/figma/connections/${connectionId}/sync-from-figma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/figma/connections", clientId] });
      toast({
        title: "Sync completed",
        description: "Design tokens synced successfully from Figma.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync from Figma.",
        variant: "destructive",
      });
    },
  });

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const response = await fetch(`/api/figma/connections/${connectionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/figma/connections", clientId] });
      toast({
        title: "Connection deleted",
        description: "Figma connection has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete connection.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FigmaConnectionForm) => {
    try {
      // First test the connection
      await testConnectionMutation.mutateAsync(data.accessToken);
      
      // If test passes, create the connection
      await createConnectionMutation.mutateAsync({
        ...data,
        clientId,
        figmaFileId: data.figmaFileKey,
      });
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "syncing":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Figma className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "syncing":
        return "bg-blue-100 text-blue-800";
      case "success":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Figma Integration</h3>
          <p className="text-sm text-muted-foreground">
            Connect and sync design tokens with your Figma files
          </p>
        </div>
        <Dialog open={isConnecting} onOpenChange={setIsConnecting}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Connect Figma File
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Connect Figma File</DialogTitle>
              <DialogDescription>
                Connect a Figma file to sync design tokens and styles with your brand guidelines.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Figma Access Token</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your Figma access token"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Generate a personal access token in your Figma account settings
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="figmaFileKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Figma File Key</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., abc123def456"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Found in the Figma file URL: figma.com/file/[FILE_KEY]/...
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="figmaFileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>File Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter a descriptive name for this connection"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="figmaTeamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team ID (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter team ID if the file belongs to a team"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsConnecting(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={testConnectionMutation.isPending || createConnectionMutation.isPending}
                  >
                    {testConnectionMutation.isPending
                      ? "Testing..."
                      : createConnectionMutation.isPending
                      ? "Connecting..."
                      : "Connect File"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing Connections */}
      {connections.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Figma className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No Figma files connected
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your first Figma file to start syncing design tokens
              </p>
              <Button onClick={() => setIsConnecting(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Figma File
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections.map((connection: FigmaConnection) => (
            <Card key={connection.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getStatusIcon(connection.syncStatus)}
                    <div>
                      <CardTitle className="text-base">{connection.figmaFileName}</CardTitle>
                      <CardDescription className="text-sm">
                        File Key: {connection.figmaFileKey}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(connection.syncStatus)}>
                      {connection.syncStatus}
                    </Badge>
                    {!connection.isActive && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {connection.syncError && (
                  <Alert className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{connection.syncError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {connection.lastSyncAt ? (
                      <>Last synced: {new Date(connection.lastSyncAt).toLocaleString()}</>
                    ) : (
                      "Never synced"
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncFromFigmaMutation.mutate(connection.id)}
                      disabled={syncFromFigmaMutation.isPending || connection.syncStatus === "syncing"}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {connection.syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteConnectionMutation.mutate(connection.id)}
                      disabled={deleteConnectionMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start space-x-2">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium mt-0.5">
                1
              </div>
              <p>Connect your Figma file using a personal access token from your Figma account settings</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium mt-0.5">
                2
              </div>
              <p>Design tokens (colors, typography, spacing) are automatically extracted from your Figma styles</p>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium mt-0.5">
                3
              </div>
              <p>Sync tokens manually or set up automatic synchronization to keep everything up to date</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}