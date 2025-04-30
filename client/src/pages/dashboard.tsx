import { UserManager } from "@/components/client/user-manager";
import {
  useUpdateClientMutation,
  useDeleteClientMutation,
  useUpdateClientOrderMutation,
} from "@/lib/queries/clients";
import { Client, insertClientSchema, UserRole } from "@shared/schema";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  SortAsc,
  SortDesc,
  Edit2,
  Trash,
  GripVertical,
  Eye,
  Share,
  MoreHorizontal,
  User,
  Users,
  Package,
  Palette,
  Type,
  Globe,
  MapPin,
  Phone,
  Clock,
  UserCircle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useClientsQuery } from "@/lib/queries/clients";

export default function Dashboard() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "custom">(
    "custom",
  );
  const [, setLocation] = useLocation();

  if (!user) return null;
  const isAbleToEdit = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.EDITOR,
  ].includes(user.role);

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState("client-info");

  // Feature toggles (all default to on)
  const [featureToggles, setFeatureToggles] = useState({
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
  });

  const { toast } = useToast();

  const { data: clients, isLoading: clientsIsLoading } = useClientsQuery();
  const updateClientOrder = useUpdateClientOrderMutation(setSortOrder);
  const updateClient = useUpdateClientMutation();
  const deleteClient = useDeleteClientMutation();

  if (clientsIsLoading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (clients?.length === 1) {
    setLocation(`/clients/${clients[0].id}`);
  }

  useEffect(() => {
    if (updateClient.isSuccess) {
      // Ensure this hook is always called
      setEditingClient(null);
    }
      form.reset();
    }
  }, [updateClient.isSuccess]);

  useEffect(() => {
    if (deleteClient.isSuccess) {
      setDeletingClient(null);
    }
  }, [deleteClient.isSuccess]);

  const [orderedClients, setOrderedClients] = useState<Client[]>([]);

  useEffect(() => {
    if (clients) {
      setOrderedClients(clients);
    }
  }, [clients]);

  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      address: "",
      phone: "",
    },
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(orderedClients);
    const [reorderedItem] = items.splice(result.source.index, 1);

    // Insert the item at its new position
    items.splice(result.destination.index, 0, reorderedItem);

    // Apply the new order with a smooth transition
    setOrderedClients(items);

    // Update the order in the backend
    const clientOrders = items.map((client, index) => ({
      id: client.id,
      displayOrder: index,
    }));

    updateClientOrder.mutate(clientOrders);
  };

  useEffect(() => {
    if (editingClient) {
      form.reset({
        name: editingClient.name,
        description: editingClient.description || "",
        website: editingClient.website || "",
        address: editingClient.address || "",
        phone: editingClient.phone || "",
      });

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
      form.reset({
        name: "",
        description: "",
        website: "",
        address: "",
        phone: "",
      });

      // Reset feature toggles to default
      setFeatureToggles({
        logoSystem: true,
        colorSystem: true,
        typeSystem: true,
        userPersonas: true,
        inspiration: true,
      });
    }
  }, [editingClient, form]);

  const filteredAndSortedClients = orderedClients
    .filter(
      (client: Client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortOrder === "custom") {
        // Use the current order for custom sorting
        return 0;
      }
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name);
      }
      return b.name.localeCompare(a.name);
    });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Client Instances</h1>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {sortOrder === "custom" ? (
                <>
                  <GripVertical className="h-4 w-4 mr-2" />
                  Custom Order
                </>
              ) : sortOrder === "asc" ? (
                <>
                  <SortAsc className="h-4 w-4 mr-2" />
                  Sort A-Z
                </>
              ) : (
                <>
                  <SortDesc className="h-4 w-4 mr-2" />
                  Sort Z-A
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSortOrder("custom")}>
              <GripVertical className="mr-2 h-4 w-4" />
              Custom Order
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder("asc")}>
              <SortAsc className="mr-2 h-4 w-4" />
              Sort A-Z
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder("desc")}>
              <SortDesc className="mr-2 h-4 w-4" />
              Sort Z-A
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="clients"
          direction="horizontal"
          ignoreContainerClipping={true}
        >
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            >
              {filteredAndSortedClients.map((client, index) => (
                <Draggable
                  key={client.id}
                  draggableId={client.id.toString()}
                  index={index}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <Card className="dashboard-card group h-full">
                        <CardHeader className="pb-5 relative">
                          <div className="dashboard-card--nav">
                            <GripVertical className="drag-and-drop--handle h-4 w-4 text-muted-foreground" />

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(`/preview/${client.id}`, "_blank");
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const url = `${window.location.origin}/clients/${client.id}`;
                                navigator.clipboard.writeText(url);
                                toast({
                                  title: "Link copied",
                                  description:
                                    "Client URL has been copied to clipboard",
                                  duration: 2000,
                                });
                              }}
                            >
                              <Share className="h-4 w-4" />
                            </Button>
                            {isAbleToEdit && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setEditingClient(client);
                                    }}
                                  >
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDeletingClient(client);
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <Link
                            href={`/clients/${client.id}`}
                            className="block w-full relative"
                          >
                            <div className="flex items-start flex-direction--column">
                              {client.logo && (
                                <div className="w-16 h-16 mr-4 flex-shrink-0">
                                  <img
                                    src={client.logo}
                                    alt={`${client.name} logo`}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              )}
                              <div className="">
                                <CardTitle className="mb-2">
                                  {client.name}
                                </CardTitle>

                                {/* Client metadata */}
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  {client.website && (
                                    <div className="flex items-top gap-2">
                                      <Globe className="h-3.5 w-3.5" />
                                      <span className="truncate">
                                        {client.website}
                                      </span>
                                    </div>
                                  )}

                                  {client.address && (
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-3.5 w-3.5" />
                                      <span className="truncate">
                                        {client.address}
                                      </span>
                                    </div>
                                  )}

                                  {client.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-3.5 w-3.5" />
                                      <span>{client.phone}</span>
                                    </div>
                                  )}

                                  {client.updatedAt && (
                                    <div className="flex items-top gap-2">
                                      <Clock className="h-3.5 w-3.5" />
                                      <span>
                                        Last updated:{" "}
                                        {new Date(
                                          client.updatedAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}

                                  {client.lastEditedBy && (
                                    <div className="flex items-top gap-2">
                                      <UserCircle className="h-3.5 w-3.5" />
                                      <span>Edited by: Admin</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </CardHeader>
                      </Card>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add New Client Card - Only visible to super admins */}
              {user?.role === UserRole.SUPER_ADMIN && (
                <Link href="/clients/new">
                  <Card className="cursor-pointer border-2 border-dashed hover:border-primary transition-colors h-full">
                    <CardHeader className="h-full flex flex-col items-center justify-center text-center">
                      <Plus className="h-8 w-8 mb-4 text-muted-foreground" />
                      <CardTitle className="text-muted-foreground">
                        Add New Client
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {filteredAndSortedClients.length === 0 && searchQuery && (
        <Card>
          <CardHeader>
            <CardTitle>No Results</CardTitle>
            <CardDescription>
              No clients found matching "{searchQuery}"
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Edit Client Dialog with Tabs */}
      <Dialog
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>

          <Tabs
            defaultValue="client-info"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="client-info">
                <User className="h-4 w-4 mr-2" />
                Client Information
              </TabsTrigger>
              <TabsTrigger value="features">
                <Package className="h-4 w-4 mr-2" />
                Features
              </TabsTrigger>
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-2" />
                Users
              </TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => {
                  if (editingClient) {
                    // Merge feature toggles into the form data
                    const dataWithToggles = {
                      ...data,
                      featureToggles,
                    };
                    updateClient.mutate({
                      id: editingClient.id,
                      data: dataWithToggles,
                    });
                  }
                })}
                className="space-y-4"
              >
                {/* Client Information Tab */}
                <TabsContent value="client-info" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter client address"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter phone number"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Features Tab */}
                <TabsContent value="features" className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Brand Features</h3>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable features for this client. When a feature
                      is disabled, it will be hidden from the client view but
                      all data will remain in the database.
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
                            <div className="font-medium">Type System</div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Typography, fonts, and text styling guidelines
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
                            <Eye className="h-4 w-4 mr-2" />
                            <div className="font-medium">Inspiration</div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Brand inspiration boards and mood collections
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

                {/* Users Tab */}
                <TabsContent value="users" className="space-y-6">
                  {editingClient && <UserManager clientId={editingClient.id} />}
                </TabsContent>

                <DialogFooter>
                  {activeTab === "client-info" && (
                    <Button
                      type="submit"
                      disabled={useUpdateClientMutation.isPending}
                    >
                      Save Changes
                    </Button>
                  )}
                  {activeTab === "features" && (
                    <Button
                      type="button"
                      onClick={() => {
                        if (editingClient) {
                          // Save feature toggles to the database
                          useUpdateClientMutation.mutate({
                            id: editingClient.id,
                            data: { featureToggles },
                          });
                        }
                      }}
                      disabled={useUpdateClientMutation.isPending}
                    >
                      Save Features
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          </Tabs>
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
              onClick={() =>
                deletingClient &&
                useDeleteClientMutation.mutate(deletingClient.id)
              }
              disabled={useDeleteClientMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
