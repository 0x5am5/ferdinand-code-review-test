import { Sidebar } from "@/components/layout/sidebar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Client, User, insertClientSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Plus, Search, SortAsc, SortDesc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Dashboard() {
  const isAdmin = true;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients/current"],
  });

  // Filter and sort clients
  const filteredAndSortedClients = [...clients]
    .filter((client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name);
      } else {
        return b.name.localeCompare(a.name);
      }
    });

  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      address: "",
      phone: "",
      logo: "",
    },
  });

  const createClient = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client created successfully",
      });
      form.reset();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLoading = isAdmin ? clientsLoading : clientLoading;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Admin View */}
            {isAdmin && (
              <>
                <div className="mb-8">
                  <h1 className="text-4xl font-bold mb-6">Brand Guidelines</h1>

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
                          {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                          Sort by Name
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
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

                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {/* New Client Card */}
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Card className="cursor-pointer hover:bg-accent transition-colors border-dashed">
                          <CardHeader className="flex items-center justify-center h-full text-center">
                            <Plus className="h-8 w-8 mb-4 text-muted-foreground" />
                            <CardTitle>New Client</CardTitle>
                            <CardDescription>Add a new client to manage</CardDescription>
                          </CardHeader>
                        </Card>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Create New Client</DialogTitle>
                          <DialogDescription>
                            Add a new client to manage their brand assets and guidelines.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                          <form
                            onSubmit={form.handleSubmit((data) => createClient.mutate(data))}
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

                            <FormField
                              control={form.control}
                              name="website"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Website</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="url" placeholder="https://example.com" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="address"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Address</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} />
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
                                    <Input {...field} type="tel" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="logo"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Logo URL</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="url" placeholder="https://example.com/logo.png" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button
                              type="submit"
                              className="w-full"
                              disabled={createClient.isPending}
                            >
                              {createClient.isPending ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                "Create Client"
                              )}
                            </Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>

                    {/* Existing Client Cards */}
                    {filteredAndSortedClients.map((client) => (
                      <Link key={client.id} href={`/client/${client.id}`}>
                        <Card className="cursor-pointer hover:bg-accent transition-colors">
                          <CardHeader>
                            {client.logo && (
                              <div className="w-16 h-16 mb-4">
                                <img
                                  src={client.logo}
                                  alt={`${client.name} logo`}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            )}
                            <CardTitle>{client.name}</CardTitle>
                            <CardDescription>{client.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              {client.website && (
                                <p>Website: {client.website}</p>
                              )}
                              {client.phone && (
                                <p>Phone: {client.phone}</p>
                              )}
                              <p>
                                Created: {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}

                    {filteredAndSortedClients.length === 0 && searchQuery && (
                      <Card>
                        <CardHeader>
                          <CardTitle>No Results</CardTitle>
                          <CardDescription>No clients found matching "{searchQuery}"</CardDescription>
                        </CardHeader>
                      </Card>
                    )}

                    {filteredAndSortedClients.length === 0 && !searchQuery && (
                      <Card>
                        <CardHeader>
                          <CardTitle>No Clients</CardTitle>
                          <CardDescription>Get started by creating your first client</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground">
                            Click the "New Client" card to add your first client and start managing their brand assets.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Client View */}
            {!isAdmin && client && (
              <Card>
                <CardHeader>
                  {client.logo && (
                    <div className="w-24 h-24 mb-4">
                      <img
                        src={client.logo}
                        alt={`${client.name} logo`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <CardTitle className="text-3xl">{client.name}</CardTitle>
                  <CardDescription>{client.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      {client.website && (
                        <div>
                          <h3 className="font-medium mb-1">Website</h3>
                          <a
                            href={client.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {client.website}
                          </a>
                        </div>
                      )}
                      {client.phone && (
                        <div>
                          <h3 className="font-medium mb-1">Phone</h3>
                          <p>{client.phone}</p>
                        </div>
                      )}
                      {client.address && (
                        <div>
                          <h3 className="font-medium mb-1">Address</h3>
                          <p>{client.address}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold mb-4">Brand Assets</h2>
                      <Link href={`/clients/${client.id}/assets`}>
                        <Button size="lg">
                          View Brand Guidelines
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isAdmin && !client && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <CardTitle>No Client Assigned</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    You currently don't have access to any client dashboards.
                    Please contact your administrator to get assigned to a client.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}