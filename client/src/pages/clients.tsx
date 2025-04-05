
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Client } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Share, Edit2, Eye, Trash, LayoutGrid, Table, Plus, X, Package, Palette, Type, User, Image } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const { toast } = useToast();

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState("client-info");
  const [featureToggles, setFeatureToggles] = useState({
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
  });
  const [animatingRows, setAnimatingRows] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deleteClient = useMutation({
    mutationFn: async (id: number) => {
      // First set the row to animate out
      setAnimatingRows(prev => ({ ...prev, [id]: true }));
      
      // Wait for the animation to complete before deleting from the server
      return new Promise(resolve => {
        setTimeout(async () => {
          const result = await apiRequest("DELETE", `/api/clients/${id}`);
          resolve(result);
        }, 300); // Animation duration
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
      setDeletingClient(null);
      // Clear animation states
      setAnimatingRows({});
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Clear animation states
      setAnimatingRows({});
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Client> }) => {
      await apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
      setEditingClient(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  
  // Update feature toggles when editing client
  useEffect(() => {
    if (editingClient) {
      // Initialize feature toggles from client data
      if (
        editingClient.featureToggles &&
        typeof editingClient.featureToggles === "object"
      ) {
        // Make sure we have all expected properties
        const featureTogglesObj = editingClient.featureToggles as any;
        const toggles = {
          logoSystem: Boolean(featureTogglesObj.logoSystem ?? true),
          colorSystem: Boolean(featureTogglesObj.colorSystem ?? true),
          typeSystem: Boolean(featureTogglesObj.typeSystem ?? true),
          userPersonas: Boolean(featureTogglesObj.userPersonas ?? true),
          inspiration: Boolean(featureTogglesObj.inspiration ?? true),
        };
        setFeatureToggles(toggles);
      } else {
        // Default all toggles to true if not set
        setFeatureToggles({
          logoSystem: true,
          colorSystem: true,
          typeSystem: true,
          userPersonas: true,
          inspiration: true,
        });
      }
    } else {
      // Reset feature toggles to default
      setFeatureToggles({
        logoSystem: true,
        colorSystem: true,
        typeSystem: true,
        userPersonas: true,
        inspiration: true,
      });
    }
  }, [editingClient]);

  return (
    <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Clients</h1>
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
            >
              {viewMode === "grid" ? (
                <Table className="h-4 w-4" />
              ) : (
                <LayoutGrid className="h-4 w-4" />
              )}
            </Button>
            <Link href="/clients/new">
              <Button variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                New Client
              </Button>
            </Link>
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <Card key={client.id} className="relative group">
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                  <CardDescription>{client.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Feature Toggle Chips */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(client.featureToggles as any)?.logoSystem && (
                      <Badge className="bg-blue-100 text-blue-800">
                        <Package className="h-3 w-3 mr-1" />Logo
                      </Badge>
                    )}
                    {(client.featureToggles as any)?.colorSystem && (
                      <Badge className="bg-green-100 text-green-800">
                        <Palette className="h-3 w-3 mr-1" />Colors
                      </Badge>
                    )}
                    {(client.featureToggles as any)?.typeSystem && (
                      <Badge className="bg-purple-100 text-purple-800">
                        <Type className="h-3 w-3 mr-1" />Type
                      </Badge>
                    )}
                    {(client.featureToggles as any)?.userPersonas && (
                      <Badge className="bg-amber-100 text-amber-800">
                        <User className="h-3 w-3 mr-1" />Personas
                      </Badge>
                    )}
                    {(client.featureToggles as any)?.inspiration && (
                      <Badge className="bg-red-100 text-red-800">
                        <Image className="h-3 w-3 mr-1" />Inspo
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/clients/${client.id}`
                        );
                        toast({
                          description: "Client link copied to clipboard",
                          duration: 2000,
                        });
                      }}
                    >
                      <Share className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="19" cy="12" r="1" />
                            <circle cx="5" cy="12" r="1" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <Link href={`/clients/${client.id}`}>
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem onClick={() => setEditingClient(client)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeletingClient(client)} className="text-destructive">
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Description</th>
                  <th className="text-left p-4">Features</th>
                  <th className="text-left p-4">Created</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  // Get feature toggles for this client
                  const clientFeatures = client.featureToggles as any || {
                    logoSystem: true,
                    colorSystem: true,
                    typeSystem: true,
                    userPersonas: true,
                    inspiration: true
                  };
                  
                  return (
                    <tr 
                      key={client.id} 
                      className={`border-b transition-all duration-300 ${animatingRows[client.id] ? 'opacity-0 transform translate-x-full' : 'opacity-100'}`}
                    >
                      <td className="p-4">{client.name}</td>
                      <td className="p-4">{client.description}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {clientFeatures.logoSystem && (
                            <Badge className="flex items-center gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200">
                              <Package className="h-3 w-3" />
                              Logo
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 p-0 ml-1 hover:bg-blue-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newToggles = { ...clientFeatures, logoSystem: false };
                                  updateClient.mutate({
                                    id: client.id,
                                    data: { featureToggles: newToggles }
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          )}
                          {clientFeatures.colorSystem && (
                            <Badge className="flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-200">
                              <Palette className="h-3 w-3" />
                              Colors
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 p-0 ml-1 hover:bg-green-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newToggles = { ...clientFeatures, colorSystem: false };
                                  updateClient.mutate({
                                    id: client.id,
                                    data: { featureToggles: newToggles }
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          )}
                          {clientFeatures.typeSystem && (
                            <Badge className="flex items-center gap-1 bg-purple-100 text-purple-800 hover:bg-purple-200">
                              <Type className="h-3 w-3" />
                              Type
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 p-0 ml-1 hover:bg-purple-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newToggles = { ...clientFeatures, typeSystem: false };
                                  updateClient.mutate({
                                    id: client.id,
                                    data: { featureToggles: newToggles }
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          )}
                          {clientFeatures.userPersonas && (
                            <Badge className="flex items-center gap-1 bg-amber-100 text-amber-800 hover:bg-amber-200">
                              <User className="h-3 w-3" />
                              Personas
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 p-0 ml-1 hover:bg-amber-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newToggles = { ...clientFeatures, userPersonas: false };
                                  updateClient.mutate({
                                    id: client.id,
                                    data: { featureToggles: newToggles }
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          )}
                          {clientFeatures.inspiration && (
                            <Badge className="flex items-center gap-1 bg-red-100 text-red-800 hover:bg-red-200">
                              <Image className="h-3 w-3" />
                              Inspo
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 p-0 ml-1 hover:bg-red-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newToggles = { ...clientFeatures, inspiration: false };
                                  updateClient.mutate({
                                    id: client.id,
                                    data: { featureToggles: newToggles }
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {client.createdAt
                          ? new Date(client.createdAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/clients/${client.id}`
                              );
                              toast({
                                description: "Client link copied to clipboard",
                                duration: 2000,
                              });
                            }}
                          >
                            <Share className="h-4 w-4" />
                          </Button>
                          <Link href={`/clients/${client.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setEditingClient(client)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setDeletingClient(client)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Edit Client Dialog */}
        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>
                Update client information and manage available features
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="client-info">
                  <span className="flex items-center gap-2">
                    Client Info
                  </span>
                </TabsTrigger>
                <TabsTrigger value="features">
                  <span className="flex items-center gap-2">
                    Features
                  </span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="client-info" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingClient?.name || ''}
                    onChange={(e) => setEditingClient(prev => prev ? {...prev, name: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingClient?.description || ''}
                    onChange={(e) => setEditingClient(prev => prev ? {...prev, description: e.target.value} : null)}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="features" className="space-y-6 py-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Brand Features</h3>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable features for this client. When a
                    feature is disabled, it will be hidden from the client
                    view but all data will remain in the database.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-2" />
                          <div className="font-medium">Logo System</div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Logo variations, usage guidelines, and downloads
                        </div>
                      </div>
                      <Switch
                        checked={featureToggles.logoSystem}
                        onCheckedChange={(checked) =>
                          setFeatureToggles((prev) => ({
                            ...prev,
                            logoSystem: checked,
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center">
                          <Palette className="h-4 w-4 mr-2" />
                          <div className="font-medium">Color System</div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Brand colors, palettes, and accessibility
                          information
                        </div>
                      </div>
                      <Switch
                        checked={featureToggles.colorSystem}
                        onCheckedChange={(checked) =>
                          setFeatureToggles((prev) => ({
                            ...prev,
                            colorSystem: checked,
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center">
                          <Type className="h-4 w-4 mr-2" />
                          <div className="font-medium">Typography</div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Type families, guidelines, weights, and hierarchy
                        </div>
                      </div>
                      <Switch
                        checked={featureToggles.typeSystem}
                        onCheckedChange={(checked) =>
                          setFeatureToggles((prev) => ({
                            ...prev,
                            typeSystem: checked,
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2" />
                          <div className="font-medium">User Personas</div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Customer personas and target audience profiles
                        </div>
                      </div>
                      <Switch
                        checked={featureToggles.userPersonas}
                        onCheckedChange={(checked) =>
                          setFeatureToggles((prev) => ({
                            ...prev,
                            userPersonas: checked,
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center">
                          <Image className="h-4 w-4 mr-2" />
                          <div className="font-medium">Inspiration</div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Creative assets, mood boards, and inspiration galleries
                        </div>
                      </div>
                      <Switch
                        checked={featureToggles.inspiration}
                        onCheckedChange={(checked) =>
                          setFeatureToggles((prev) => ({
                            ...prev,
                            inspiration: checked,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingClient(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => editingClient && updateClient.mutate({
                  id: editingClient.id,
                  data: {
                    name: editingClient.name,
                    description: editingClient.description,
                    featureToggles: featureToggles
                  }
                })}
                disabled={updateClient.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Client</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {deletingClient?.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingClient(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deletingClient && deleteClient.mutate(deletingClient.id)}
                disabled={deleteClient.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
