
import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/api";

export default function Dashboard() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: user?.role === "admin",
  });

  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      description: "",
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
        description: "Client instance created",
      });
      form.reset();
    },
  });

  if (user?.role === "admin") {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">Client Instances</h1>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Instance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Client Instance</DialogTitle>
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
                    
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createClient.isPending}
                    >
                      Create Instance
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {clients?.map((client) => (
              <Card key={client.id}>
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                  <CardDescription>{client.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(client.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients/current"],
  });

  if (isLoading) {
    return null;
  }

  if (!client) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
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
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-4xl font-bold mb-8">
          {client.name} Brand Guidelines
        </h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View and copy brand colors
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
