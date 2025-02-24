import { Sidebar } from "@/components/layout/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Client } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Search, SortAsc, SortDesc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Dashboard() {
  // Initialize state first
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients/current"],
  });

  // Temporary: Set admin view for testing
  const isAdmin = true;

  const filteredAndSortedClients = [...clients]
    .filter((client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name);
      }
      return b.name.localeCompare(a.name);
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
                    {filteredAndSortedClients.map((client) => (
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
                            Add your first client and start managing their brand assets.
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    <Link href="/clients/new">
                      <Card className="cursor-pointer hover:bg-accent transition-colors border-dashed">
                        <CardHeader className="flex items-center justify-center h-full text-center">
                          <Plus className="h-8 w-8 mb-4 text-muted-foreground" />
                          <CardTitle>New Client</CardTitle>
                          <CardDescription>Add a new client to manage</CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
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
                  </div>
                </CardContent>
              </Card>
            )}

            {!isAdmin && !client && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
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