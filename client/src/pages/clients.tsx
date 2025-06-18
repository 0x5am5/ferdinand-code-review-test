import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Client, User } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import {
  Share,
  Edit2,
  Eye,
  Trash,
  LayoutGrid,
  Table,
  Plus,
  X,
  Package,
  Palette,
  Type,
  User as UserIcon,
  Image,
  UserCircle,
  ChevronDown,
  UserPlus,
  Mail,
  Search,
  Check,
  Figma,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  useClientsQuery,
  useDeleteClientMutation,
  useUpdateClientMutation,
  useClientUsersQuery,
  useClientUserMutations,
} from "@/lib/queries/clients";
import { useUsersQuery } from "@/lib/queries/users";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Download } from "lucide-react";

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
    figmaIntegration: false,
    aiDownloads: true,
  });
  const [animatingRows, setAnimatingRows] = useState<Record<number, boolean>>({});
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("standard");
  const [activeClientId, setActiveClientId] = useState<number | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const { data: clients = [] } = useClientsQuery();
  const { data: allUsers = [] } = useUsersQuery();
  const updateClient = useUpdateClientMutation();
  const deleteClient = useDeleteClientMutation();

  // Load client users for active client
  const { data: activeClientUsers = [] } = useClientUsersQuery(activeClientId || 0);
  const { assignUser, removeUser, inviteUser } = useClientUserMutations(activeClientId || 0);

  // Create a map to store client users with a default empty array for each client
  const [clientUsersMap, setClientUsersMap] = useState<Map<number, User[]>>(new Map());

  // When activeClientId changes, update the map with fetched users
  useEffect(() => {
    if (activeClientId && activeClientUsers.length > 0) {
      setClientUsersMap(prevMap => {
        const newMap = new Map(prevMap);
        newMap.set(activeClientId, activeClientUsers);
        return newMap;
      });
    }
  }, [activeClientId, activeClientUsers]);

  // Filter users that are not already assigned to the active client
  const availableUsers = allUsers.filter(user => 
    !activeClientUsers.some(clientUser => clientUser.id === user.id)
  );

  // Filter users based on search query
  const filteredAvailableUsers = availableUsers.filter(user => 
    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Initialize the map with empty arrays for each client
  useEffect(() => {
    if (clients.length > 0) {
      const initialMap = new Map<number, User[]>();
      clients.forEach(client => {
        // Initialize with an empty array for each client
        initialMap.set(client.id, []);
      });
      setClientUsersMap(initialMap);
    }
  }, [clients]);

  // Load users for all clients after the map is initialized
  useEffect(() => {
    const loadAllClientUsers = async () => {
      // Only load if we have clients and the map is initialized
      if (clients.length > 0 && clientUsersMap.size > 0) {
        for (const client of clients) {
          try {
            const response = await fetch(`/api/clients/${client.id}/users`);
            if (response.ok) {
              const users = await response.json();
              if (Array.isArray(users)) {
                setClientUsersMap(prevMap => {
                  const newMap = new Map(prevMap);
                  newMap.set(client.id, users);
                  return newMap;
                });
              }
            }
          } catch (error) {
            console.error(`Error loading users for client ${client.id}:`, error);
          }
        }
      }
    };

    loadAllClientUsers();
  }, [clients, clientUsersMap.size]);

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
          figmaIntegration: Boolean(featureTogglesObj.figmaIntegration ?? false),
          aiDownloads: Boolean(featureTogglesObj.aiDownloads ?? true),
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
          figmaIntegration: false,
          aiDownloads: true,
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
        figmaIntegration: false,
        aiDownloads: true,
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
            <Button
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
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
                      <Package className="h-3 w-3 mr-1" />
                      Logo
                    </Badge>
                  )}
                  {(client.featureToggles as any)?.colorSystem && (
                    <Badge className="bg-green-100 text-green-800">
                      <Palette className="h-3 w-3 mr-1" />
                      Colors
                    </Badge>
                  )}
                  {(client.featureToggles as any)?.typeSystem && (
                    <Badge className="bg-purple-100 text-purple-800">
                      <Type className="h-3 w-3 mr-1" />
                      Type
                    </Badge>
                  )}
                  {(client.featureToggles as any)?.userPersonas && (
                    <Badge className="bg-amber-100 text-amber-800">
                      <UserIcon className="h-3 w-3 mr-1" />
                      Personas
                    </Badge>
                  )}
                  {(client.featureToggles as any)?.inspiration && (
                    <Badge className="bg-red-100 text-red-800">
                      <Image className="h-3 w-3 mr-1" />
                      Inspo
                    </Badge>
                  )}
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/clients/${client.id}`,
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
                      <DropdownMenuItem
                        onClick={() => setEditingClient(client)}
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingClient(client)}
                        className="text-destructive"
                      >
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
                <th className="text-left p-4">Users</th>
                <th className="text-left p-4">Created</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client: Client) => {
                // Get feature toggles for this client
                const clientFeatures = (client.featureToggles as any) || {
                  logoSystem: true,
                  colorSystem: true,
                  typeSystem: true,
                  userPersonas: true,
                  inspiration: true,
                };

                return (
                  <tr
                    key={client.id}
                    className={`border-b transition-all duration-300 ${animatingRows[client.id] ? "opacity-0 transform translate-x-full" : "opacity-100"}`}
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
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newToggles = {
                                  ...clientFeatures,
                                  logoSystem: false,
                                };
                                await updateClient.mutate({
                                  id: client.id,
                                  data: { featureToggles: newToggles },
                                });
                                setEditingClient(null);
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
                                const newToggles = {
                                  ...clientFeatures,
                                  colorSystem: false,
                                };
                                updateClient.mutate({
                                  id: client.id,
                                  data: { featureToggles: newToggles },
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
                                const newToggles = {
                                  ...clientFeatures,
                                  typeSystem: false,
                                };
                                updateClient.mutate({
                                  id: client.id,
                                  data: { featureToggles: newToggles },
                                });
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        )}
                        {clientFeatures.userPersonas && (
                          <Badge className="flex items-center gap-1 bg-amber-100 text-amber-800 hover:bg-amber-200">
                            <UserIcon className="h-3 w-3" />
                            Personas
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 ml-1 hover:bg-amber-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newToggles = {
                                  ...clientFeatures,
                                  userPersonas: false,
                                };
                                updateClient.mutate({
                                  id: client.id,
                                  data: { featureToggles: newToggles },
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
                                const newToggles = {
                                  ...clientFeatures,
                                  inspiration: false,
                                };
                                updateClient.mutate({
                                  id: client.id,
                                  data: { featureToggles: newToggles },
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
                      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Fetch and display client users or use cached ones */}
                        {(clientUsersMap.get(client.id) || []).map((user) => (
                          <Badge
                            key={user.id}
                            className="flex items-center gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200 text-xs"
                          >
                            <UserCircle className="h-3 w-3" />
                            {user.name}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 ml-1 hover:bg-blue-200"
                              onClick={() => {
                                setActiveClientId(client.id);
                                removeUser.mutate(user.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}

                        {/* User management dropdown */}
                        <Popover
                          onOpenChange={(open) => {
                            if (open) {
                              setActiveClientId(client.id);
                              setUserSearchQuery('');
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="h-6 text-xs p-2 flex items-center gap-1"
                              onClick={() => setActiveClientId(client.id)}
                            >
                              <UserPlus className="h-3 w-3" />
                              <span>Add User</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0 bg-white border shadow-md" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search users..." 
                                className="border-none focus:ring-0"
                                value={userSearchQuery}
                                onValueChange={setUserSearchQuery}
                              />

                              <CommandList>
                                <CommandEmpty>
                                  {userSearchQuery ? (
                                    <div className="py-3 px-4 text-sm text-center">
                                      <p>No users found matching <strong>{userSearchQuery}</strong></p>
                                      <Button 
                                        variant="link" 
                                        className="mt-2 h-auto p-0"
                                        onClick={() => {
                                          setInviteEmail(userSearchQuery);
                                          setInviteName('');
                                          setInviteDialogOpen(true);
                                        }}
                                      >
                                        <Mail className="h-3 w-3 mr-1" />
                                        Invite by email
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="py-3 px-4 text-sm text-center">
                                      No users available to add
                                    </div>
                                  )}
                                </CommandEmpty>

                                {filteredAvailableUsers.length > 0 && (
                                  <CommandGroup heading="Select a user">
                                    {filteredAvailableUsers.map((user) => (
                                      <CommandItem
                                        key={user.id}
                                        onSelect={() => {
                                          setActiveClientId(client.id);
                                          assignUser.mutate(user.id);
                                        }}
                                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-100"
                                      >
                                        <UserCircle className="h-4 w-4 opacity-70" />
                                        <div className="flex flex-col">
                                          <span className="font-medium">{user.name}</span>
                                          <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}

                                <CommandGroup>
                                  <CommandItem
                                    onSelect={() => {
                                      setInviteEmail(userSearchQuery);
                                      setInviteName('');
                                      setInviteDialogOpen(true);
                                    }}
                                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-100"
                                  >
                                    <UserPlus className="h-4 w-4 text-primary" />
                                    <span className="font-medium">Invite new user</span>
                                  </CommandItem>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
                              `${window.location.origin}/clients/${client.id}`,
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
      <Dialog
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
      >
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
                <span className="flex items-center gap-2">Client Info</span>
              </TabsTrigger>
              <TabsTrigger value="features">
                <span className="flex items-center gap-2">Features</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="client-info" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editingClient?.name || ""}
                  onChange={(e) =>
                    setEditingClient((prev) =>
                      prev ? { ...prev, name: e.target.value } : null,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingClient?.description || ""}
                  onChange={(e) =>
                    setEditingClient((prev) =>
                      prev ? { ...prev, description: e.target.value } : null,
                    )
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Brand Features</h3>
                <p className="text-sm text-muted-foreground">
                  Enable or disable features for this client. When a feature is
                  disabled, it will be hidden from the client view but all data
                  will remain in the database.
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
                        Brand colors, palettes, and accessibility information
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
                        <UserIcon className="h-4 w-4 mr-2" />
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

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center">
                        <Layers className="h-4 w-4 mr-2" />
                        <div className="font-medium">Figma Integration</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sync design tokens and styles with Figma design files
                      </div>
                    </div>
                    <Switch
                      checked={featureToggles.figmaIntegration}
                      onCheckedChange={(checked) =>
                        setFeatureToggles((prev) => ({
                          ...prev,
                          figmaIntegration: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center">
                        <Download className="h-4 w-4 mr-2" />
                        <div className="font-medium">AI Downloads</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Enable Adobe Illustrator file downloads
                      </div>
                    </div>
                    <Switch
                      checked={featureToggles.aiDownloads}
                      onCheckedChange={(checked) =>
                        setFeatureToggles((prev) => ({
                          ...prev,
                          aiDownloads: checked,
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
              onClick={() =>
                editingClient &&
                updateClient.mutate({
                  id: editingClient.id,
                  data: {
                    name: editingClient.name,
                    description: editingClient.description,
                    featureToggles: featureToggles,
                  },
                }, {
                  onSuccess: () => {
                    setEditingClient(null);
                  }
                })
              }
              disabled={updateClient.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingClient}
        onOpenChange={(open) => !open && setDeletingClient(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingClient?.name}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingClient(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deletingClient || deleteClient.isPending}
              onClick={async () => {
                if (!deletingClient) return;

                setAnimatingRows((prev) => ({
                  ...prev,
                  [deletingClient.id]: true,
                }));

                await deleteClient.mutateAsync(deletingClient.id);

                setDeletingClient(null);
                setAnimatingRows({});
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to a new user to join the platform and this client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                value={inviteEmail} 
                onChange={(e) => setInviteEmail(e.target.value)} 
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input 
                id="name"
                value={inviteName} 
                onChange={(e) => setInviteName(e.target.value)} 
                placeholder="User's name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                defaultValue={inviteRole} 
                onValueChange={(value) => setInviteRole(value)}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setInviteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!activeClientId) return;

                inviteUser.mutate({
                  email: inviteEmail, 
                  name: inviteName, 
                  role: inviteRole
                });

                setInviteDialogOpen(false);
                setInviteEmail('');
                setInviteName('');
              }}
              disabled={!inviteEmail || inviteUser.isPending}
            >
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}