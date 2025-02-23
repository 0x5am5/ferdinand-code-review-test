import { Sidebar } from "@/components/layout/sidebar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Client, User, insertClientSchema } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export default function Dashboard() {
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients/current"],
  });

  // Temporary: Set admin view for testing
  const isAdmin = true;

  const { toast } = useToast();
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
      await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client created successfully",
      });
      form.reset();
    },
  });

  if (userLoading) {
    return <div>Loading...</div>;
  }

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const isLoading = isAdmin ? clientsLoading : clientLoading;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <>
            {/* Admin View */}
            {isAdmin && (
              <>
                <div className="flex justify-between items-center mb-8">
                  <h1 className="text-4xl font-bold">Brand Guidelines</h1>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Client
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Create New Client</DialogTitle>
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
                            Create Client
                          </Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {clients?.map((client) => (
                    <Link key={client.id} href={`/clients/${client.id}`}>
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
                            <p>
                              Last Updated: {client.updatedAt ? new Date(client.updatedAt).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {!clients?.length && (
                    <Card>
                      <CardHeader>
                        <CardTitle>No Clients</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p>Click "New Client" to create your first client.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}

            {/* Regular User View */}
            {!isAdmin && (
              <>
                {client ? (
                  <Card>
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
                      <div className="space-y-4">
                        <div className="space-y-2">
                          {client.website && (
                            <p>Website: {client.website}</p>
                          )}
                          {client.phone && (
                            <p>Phone: {client.phone}</p>
                          )}
                          {client.address && (
                            <p>Address: {client.address}</p>
                          )}
                        </div>
                        <Link href={`/clients/${client.id}`}>
                          <Button>View Brand Guidelines</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <CardTitle>No Client Assigned</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p>
                        You currently don't have access to any client instances. 
                        Please contact your administrator to get assigned to a client.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}