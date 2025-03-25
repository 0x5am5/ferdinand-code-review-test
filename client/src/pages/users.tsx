import { Sidebar } from "@/components/layout/sidebar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, UserRole, Client, USER_ROLES } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreHorizontal, UserPlus, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";

// Create form schemas
const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(USER_ROLES as [string, ...string[]]),
  clientIds: z.array(z.number()).optional(),
});

const updateUserRoleSchema = z.object({
  id: z.number(),
  role: z.enum(USER_ROLES as [string, ...string[]]),
});

type InviteUserForm = z.infer<typeof inviteUserSchema>;
type UpdateUserRoleForm = z.infer<typeof updateUserRoleSchema>;

// Helper to get badge variant based on role
const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return "destructive";
    case UserRole.ADMIN:
      return "default";
    case UserRole.STANDARD:
      return "secondary";
    case UserRole.GUEST:
      return "outline";
    default:
      return "outline";
  }
};

// Get initials from name
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  // Get all users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
  });

  // Get all clients for assignment
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // State for client assignment dialog
  const [clientAssignDialogOpen, setClientAssignDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  
  // Fetch client assignments for all users
  const { data: userClientAssignments = {}, isLoading: isLoadingAssignments } = useQuery<Record<number, Client[]>>({
    queryKey: ["/api/users/client-assignments"],
    queryFn: async () => {
      // Create a map of user IDs to their assigned clients
      const assignments: Record<number, Client[]> = {};
      
      // For each user, fetch their clients
      await Promise.all(users.map(async (user) => {
        try {
          const response = await fetch(`/api/users/${user.id}/clients`);
          if (response.ok) {
            const clients = await response.json();
            assignments[user.id] = clients;
          }
        } catch (error) {
          console.error(`Failed to fetch clients for user ${user.id}`, error);
          assignments[user.id] = [];
        }
      }));
      
      return assignments;
    },
    enabled: users.length > 0,
  });

  // Update user role
  const updateUserRole = useMutation({
    mutationFn: async (data: UpdateUserRoleForm) => {
      return await apiRequest("PATCH", `/api/users/${data.id}/role`, { role: data.role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Invite new user
  const inviteUser = useMutation({
    mutationFn: async (data: InviteUserForm) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User invited successfully",
      });
      setIsInviteDialogOpen(false);
      inviteForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assign client to user
  const assignClient = useMutation({
    mutationFn: async ({ userId, clientId }: { userId: number; clientId: number }) => {
      return await apiRequest("POST", `/api/user-clients`, { userId, clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "Client assigned successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove client from user
  const removeClient = useMutation({
    mutationFn: async ({ userId, clientId }: { userId: number; clientId: number }) => {
      return await apiRequest("DELETE", `/api/user-clients/${userId}/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "Client removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Define forms
  const inviteForm = useForm<InviteUserForm>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      name: "",
      role: UserRole.STANDARD,
      clientIds: [],
    },
  });

  const updateRoleForm = useForm<UpdateUserRoleForm>({
    resolver: zodResolver(updateUserRoleSchema),
    defaultValues: {
      id: 0,
      role: UserRole.STANDARD,
    },
  });

  // Filter users based on search query
  const filteredUsers = users.filter(
    (user) => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Users</h1>
          <Button onClick={() => setIsInviteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>

        {/* Search */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Manage your users and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Clients</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        defaultValue={user.role}
                        onValueChange={(value) => {
                          updateUserRole.mutate({ id: user.id, role: value as (typeof UserRole)[keyof typeof UserRole] });
                        }}
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue>
                            <Badge variant={getRoleBadgeVariant(user.role)}>
                              {user.role.replace("_", " ")}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {USER_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              <Badge variant={getRoleBadgeVariant(role)}>
                                {role.replace("_", " ")}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userClientAssignments[user.id]?.map(client => (
                          <Badge 
                            key={client.id} 
                            variant="outline" 
                            className="flex items-center gap-1"
                          >
                            {client.name}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-4 w-4 p-0 ml-1" 
                              onClick={() => removeClient.mutate({ userId: user.id, clientId: client.id })}
                            >
                              <span className="sr-only">Remove</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </Button>
                          </Badge>
                        ))}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setCurrentUserId(user.id);
                            setClientAssignDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Invite User Dialog */}
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Send an invitation to a new user to join the platform.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...inviteForm}>
              <form onSubmit={inviteForm.handleSubmit((data) => inviteUser.mutate(data))} className="space-y-4">
                <FormField
                  control={inviteForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={inviteForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={inviteForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {USER_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={inviteForm.control}
                  name="clientIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Clients</FormLabel>
                      <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
                        {clients.map(client => (
                          <div key={client.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`client-${client.id}`}
                              checked={field.value?.includes(client.id)} 
                              onCheckedChange={(checked: boolean | "indeterminate") => {
                                const newValue = [...(field.value || [])];
                                if (checked) {
                                  newValue.push(client.id);
                                } else {
                                  const index = newValue.indexOf(client.id);
                                  if (index !== -1) newValue.splice(index, 1);
                                }
                                field.onChange(newValue);
                              }}
                            />
                            <label 
                              htmlFor={`client-${client.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {client.name}
                            </label>
                          </div>
                        ))}
                        
                        {clients.length === 0 && (
                          <div className="text-center p-2 text-muted-foreground">
                            No clients available to assign
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={inviteUser.isPending}>
                    {inviteUser.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Client Assignment Dialog */}
        <Dialog open={clientAssignDialogOpen} onOpenChange={setClientAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Clients</DialogTitle>
              <DialogDescription>
                Select clients to assign to this user.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="max-h-80 overflow-y-auto space-y-2">
                {clients.filter(client => 
                  // Filter out clients already assigned to the user
                  !userClientAssignments[currentUserId || 0]?.some(c => c.id === client.id)
                ).map(client => (
                  <div key={client.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.description}</p>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => {
                        if (currentUserId) {
                          assignClient.mutate({ 
                            userId: currentUserId, 
                            clientId: client.id 
                          });
                        }
                      }}
                      disabled={assignClient.isPending}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Assign
                    </Button>
                  </div>
                ))}
                
                {clients.filter(client => 
                  !userClientAssignments[currentUserId || 0]?.some(c => c.id === client.id)
                ).length === 0 && (
                  <div className="text-center p-4 text-muted-foreground">
                    All clients have been assigned to this user.
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setClientAssignDialogOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}