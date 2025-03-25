import { Sidebar } from "@/components/layout/sidebar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Client, insertClientSchema } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, SortAsc, SortDesc, MoreVertical, Edit2, Trash, GripVertical, Eye, Share, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "custom">("custom");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const { toast } = useToast();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    select: (data) => {
      // Sort by displayOrder if available, fallback to id
      return [...data].sort((a, b) => {
        if (a.displayOrder !== null && a.displayOrder !== undefined && 
            b.displayOrder !== null && b.displayOrder !== undefined) {
          return Number(a.displayOrder) - Number(b.displayOrder);
        }
        return a.id - b.id;
      });
    }
  });

  const [orderedClients, setOrderedClients] = useState<Client[]>([]);

  useEffect(() => {
    setOrderedClients(clients);
  }, [clients]);

  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Update client mutation
  const updateClient = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
      setEditingClient(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete client mutation
  const deleteClient = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
      setDeletingClient(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update client order mutation
  const updateClientOrder = useMutation({
    mutationFn: async (clientOrders: { id: number; displayOrder: number }[]) => {
      const response = await apiRequest("PATCH", "/api/clients/order", { clientOrders });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update client order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client order updated successfully",
      });
      // Ensure we stay in custom sort mode after reordering
      setSortOrder("custom");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // Reset to the original order on error
      setOrderedClients(clients);
    },
  });

  // Handle drag end with improved animation and interaction
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
      displayOrder: index
    }));

    updateClientOrder.mutate(clientOrders);
  };

  // Reset form when editing client changes
  useEffect(() => {
    if (editingClient) {
      form.reset({
        name: editingClient.name,
        description: editingClient.description || "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
      });
    }
  }, [editingClient, form]);

  const filteredAndSortedClients = orderedClients
    .filter((client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
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
                  <Draggable key={client.id} draggableId={client.id.toString()} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <Card className="group">
                          <CardHeader className="relative">
                            <Link href={`/clients/${client.id}`} className="block w-full h-full p-4 relative">
                              <div className="cursor-move flex justify-center mt-4">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                              {client.logo && (
                                <div className="absolute bottom-4 left-4 w-16 h-16">
                                  <img
                                    src={client.logo}
                                    alt={`${client.name} logo`}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              )}
                              <CardTitle className="absolute bottom-4 left-24">{client.name}</CardTitle>
                              <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(`/preview/${client.id}`, '_blank');
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
                                      description: "Client URL has been copied to clipboard",
                                      duration: 2000,
                                    });
                                  }}
                                >
                                  <Share className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setEditingClient(client);
                                    }}>
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
                              </div>
                            </Link>
                          </CardHeader>
                          {/* Removed CardContent -  unnecessary with the new layout */}
                        </Card>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}

                {/* Add New Client Card */}
                <Link href="/clients/new">
                  <Card className="cursor-pointer border-2 border-dashed hover:border-primary transition-colors h-full">
                    <CardHeader className="h-full flex flex-col items-center justify-center text-center">
                      <Plus className="h-8 w-8 mb-4 text-muted-foreground" />
                      <CardTitle className="text-muted-foreground">Add New Instance</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {filteredAndSortedClients.length === 0 && searchQuery && (
          <Card>
            <CardHeader>
              <CardTitle>No Results</CardTitle>
              <CardDescription>No clients found matching "{searchQuery}"</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Edit Client Dialog */}
        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => editingClient && updateClient.mutate({ id: editingClient.id, data }))}
                className="space-y-4"
              >
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

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={updateClient.isPending}
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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
              <Button
                variant="outline"
                onClick={() => setDeletingClient(null)}
              >
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
      </main>
    </div>
  );
}