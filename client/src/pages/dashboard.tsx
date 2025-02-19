import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients/current"],
  });

  const [, setLocation] = useLocation();

  if (isLoading) {
    return null;
  }

  if (!client && user?.role === "admin") {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <CardTitle>Welcome, Admin!</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                To get started, create a client instance to manage brand guidelines.
              </p>
              <Button onClick={() => setLocation("/admin/instances")}>
                Manage Client Instances
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
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

          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Explore brand fonts and styles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Download logos, patterns, and more
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}