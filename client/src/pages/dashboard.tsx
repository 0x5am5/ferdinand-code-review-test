import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // For admin users, fetch all clients
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: user?.role === "admin",
  });

  // For regular users, fetch their assigned client
  const { data: client } = useQuery<Client>({
    queryKey: ["/api/clients/current"],
    enabled: user?.role !== "admin",
  });

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Admin View */}
        {user.role === "admin" && (
          <>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-4xl font-bold">Client Management</h1>
              <Link href="/admin/instances">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Client
                </Button>
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {clients?.map((client) => (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <Card className="cursor-pointer hover:bg-accent transition-colors">
                    <CardHeader>
                      <CardTitle>{client.name}</CardTitle>
                      <CardDescription>{client.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Created {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Regular User View */}
        {user.role !== "admin" && (
          <>
            {client ? (
              <Card>
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                  <CardDescription>{client.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/clients/${client.id}`}>
                    <Button>View Brand Guidelines</Button>
                  </Link>
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
      </main>
    </div>
  );
}