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
  // For development, we'll assume admin role
  const isAdmin = true;
  const { toast } = useToast();

  // Mock user data for development
  const mockUser = {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
  };

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    // Temporarily bypass API call
    initialData: [],
  });

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients/current"],
    // Temporarily bypass API call
    initialData: null,
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
      // For development, just log the data
      console.log("Creating client:", data);
      return data;
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
                  {/* Example client card for development */}
                  <Card className="cursor-pointer hover:bg-accent transition-colors">
                    <CardHeader>
                      <CardTitle>Example Client</CardTitle>
                      <CardDescription>A sample client for development</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Website: https://example.com</p>
                        <p>Phone: (555) 123-4567</p>
                        <p>Created: {new Date().toLocaleDateString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {/* Regular User View */}
            {!isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Example Client Dashboard</CardTitle>
                  <CardDescription>Welcome to your brand dashboard</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p>Website: https://example.com</p>
                      <p>Phone: (555) 123-4567</p>
                      <p>Address: 123 Main St, Example City</p>
                    </div>
                    <Button>View Brand Guidelines</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}