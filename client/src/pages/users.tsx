import { Sidebar } from "@/components/layout/sidebar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, UserRole, Client, USER_ROLES } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  CardFooter,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  Mail, 
  Filter, 
  X, 
  RefreshCw, 
  Users, 
  Building2, 
  Briefcase,
  UserCheck,
  Shield,
  Settings,
  Loader2,
  ChevronDown,
  Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

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

// Define interface for pending invitations
interface PendingInvitation {
  id: number;
  email: string;
  role: string;
  clientIds: number[] | null;
  expiresAt: string;
  used: boolean;
  clientData?: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  };
}

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
  
  // Get pending invitations
  const { data: pendingInvitations = [], isLoading: isLoadingInvitations } = useQuery<PendingInvitation[]>({
    queryKey: ["/api/invitations"],
    queryFn: async () => {
      const response = await fetch("/api/invitations");
      if (!response.ok) {
        if (response.status === 403) {
          // User doesn't have permission, return empty array
          return [];
        }
        throw new Error("Failed to fetch pending invitations");
      }
      return response.json();
    },
  });
  
  // Resend invitation mutation
  const resendInvitation = useMutation({
    mutationFn: async (invitationId: number) => {
      const response = await fetch(`/api/invitations/${invitationId}/resend`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to resend invitation");
      }
      return response.json();
    },
    onSuccess: (_, invitationId) => {
      toast({
        title: "Invitation resent",
        description: "The invitation email has been resent successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resend invitation",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Reset password mutation
  const resetPassword = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to send password reset");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset email sent",
        description: "A password reset link has been sent to the user's email."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send password reset",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Get all clients for assignment
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // State for tracking user mutations
  const [isProcessing, setIsProcessing] = useState(false);
  
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
      try {
        const response = await apiRequest("POST", "/api/users", data);
        return response;
      } catch (err) {
        // Check if this is a JSON response with error details
        if (err instanceof Error && 'response' in err) {
          const response = (err as any).response;
          
          if (response?.data) {
            // Handle specific error codes
            if (response.data.code === 'EMAIL_EXISTS') {
              throw new Error("A user with this email already exists.");
            } else if (response.data.code === 'INVITATION_EXISTS') {
              // Store the invitation ID for potential resend
              const invitationId = response.data.invitationId;
              
              // Make this a special error object with the invitation ID
              const customError = new Error("An invitation for this email already exists. Would you like to resend it?");
              (customError as any).invitationId = invitationId;
              throw customError;
            }
            
            // If there's a message but no specific code we recognize
            if (response.data.message) {
              throw new Error(response.data.message);
            }
          }
        }
        
        // If we couldn't parse it as a special error, rethrow the original
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: "Success",
        description: "User invited successfully",
      });
      setIsInviteDialogOpen(false);
      inviteForm.reset();
    },
    onError: (error: Error) => {
      // Check if this is our special error with an invitation ID
      if ('invitationId' in error) {
        // Show a special toast with an action to resend
        toast({
          title: "Duplicate Invitation",
          description: (
            <div className="flex flex-col gap-2">
              <p>{error.message}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  // Call resend mutation with the stored invitation ID
                  resendInvitation.mutate((error as any).invitationId);
                  // Close the dialog since we're handling this invitation already
                  setIsInviteDialogOpen(false);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Resend Invitation
              </Button>
            </div>
          ),
          duration: 10000,
        });
      } else {
        // Regular error
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  // Assign client to user
  const assignClient = useMutation({
    mutationFn: async ({ userId, clientId }: { userId: number; clientId: number }) => {
      return await apiRequest("POST", `/api/user-clients`, { userId, clientId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      // Find the client and update local state immediately
      const client = clients.find(c => c.id === variables.clientId);
      if (client) {
        // Create a copy of the current state
        const updatedAssignments = { ...userClientAssignments };
        
        // Initialize the array if it doesn't exist
        if (!updatedAssignments[variables.userId]) {
          updatedAssignments[variables.userId] = [];
        }
        
        // Add the client if it's not already in the array
        if (!updatedAssignments[variables.userId].some(c => c.id === client.id)) {
          updatedAssignments[variables.userId] = [...updatedAssignments[variables.userId], client];
          
          // Update the query data directly in the cache
          queryClient.setQueryData(["/api/users/client-assignments"], updatedAssignments);
        }
      }
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      // Update local state immediately
      const updatedAssignments = { ...userClientAssignments };
      
      if (updatedAssignments[variables.userId]) {
        // Remove the client from the array
        updatedAssignments[variables.userId] = updatedAssignments[variables.userId]
          .filter(c => c.id !== variables.clientId);
        
        // Update the query data directly in the cache
        queryClient.setQueryData(["/api/users/client-assignments"], updatedAssignments);
      }
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

  // Debounced search implementation
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Enhanced search with fuzzy matching
  const filteredUsers = debouncedSearchQuery 
    ? users.filter((user) => {
        const nameMatch = user.name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        const emailMatch = user.email.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        const roleMatch = user.role.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        
        // Also match parts of names (first/last name)
        const nameParts = user.name?.toLowerCase().split(' ') || [];
        const namePartsMatch = nameParts.some(part => 
          part.startsWith(debouncedSearchQuery.toLowerCase())
        );
        
        // Also match client names if assigned to user
        const clientMatch = userClientAssignments[user.id]?.some(client => 
          client.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        );
        
        return nameMatch || emailMatch || roleMatch || namePartsMatch || clientMatch;
      })
    : users;

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

        {/* Enhanced Search Bar */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, role or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-10 transition-all focus:ring-2 ring-primary/20 w-full"
            />
            {searchQuery && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 rounded-full opacity-70 hover:opacity-100"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh user data</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Search results info */}
        {debouncedSearchQuery && (
          <div className="flex items-center mb-4 text-sm">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>
              Found <strong>{filteredUsers.length}</strong> {filteredUsers.length === 1 ? 'user' : 'users'} 
              {filteredUsers.length > 0 ? ' matching ' : ' matching search term '}
              <Badge variant="outline" className="mx-1 font-mono">{debouncedSearchQuery}</Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs ml-2"
                onClick={() => setSearchQuery("")}
              >
                Clear filter
              </Button>
            </span>
          </div>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Users who have been invited but haven't accepted yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingInvitations ? (
                    Array.from({ length: 2 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><div className="h-4 w-48 bg-muted animate-pulse"></div></TableCell>
                        <TableCell><div className="h-8 w-24 bg-muted animate-pulse"></div></TableCell>
                        <TableCell><div className="h-6 w-32 bg-muted animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 w-24 bg-muted animate-pulse"></div></TableCell>
                        <TableCell className="text-right"><div className="h-8 w-8 bg-muted animate-pulse ml-auto"></div></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    pendingInvitations.map((invitation) => {
                      // Format expiration date
                      const expiresAt = new Date(invitation.expiresAt);
                      const now = new Date();
                      const isExpired = expiresAt < now;
                      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 3600 * 24));
                      
                      return (
                        <TableRow key={invitation.id}>
                          <TableCell>{invitation.email}</TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(invitation.role)}>
                              {invitation.role.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {invitation.clientData ? (
                              <div className="flex items-center space-x-2">
                                {invitation.clientData.logoUrl ? (
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={invitation.clientData.logoUrl} alt={invitation.clientData.name} />
                                    <AvatarFallback style={{
                                      backgroundColor: invitation.clientData.primaryColor || '#e2e8f0'
                                    }}>
                                      {getInitials(invitation.clientData.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                                    {getInitials(invitation.clientData.name)}
                                  </div>
                                )}
                                <span>{invitation.clientData.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Platform Access</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : (
                              <span className="text-sm">{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resendInvitation.mutate(invitation.id)}
                              disabled={resendInvitation.isPending}
                            >
                              {resendInvitation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                              )}
                              Resend
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

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
                {isLoadingUsers || isLoadingAssignments ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center space-x-4">
                          <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
                          <div className="h-4 w-32 bg-muted animate-pulse"></div>
                        </div>
                      </TableCell>
                      <TableCell><div className="h-4 w-48 bg-muted animate-pulse"></div></TableCell>
                      <TableCell><div className="h-8 w-24 bg-muted animate-pulse"></div></TableCell>
                      <TableCell><div className="h-6 w-32 bg-muted animate-pulse"></div></TableCell>
                      <TableCell className="text-right"><div className="h-8 w-8 bg-muted animate-pulse ml-auto"></div></TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
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
                        <div className="space-y-2">
                          {/* Client assignments with improved UI */}
                          <div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className={cn(
                                    "w-full justify-start text-left font-normal h-8",
                                    !userClientAssignments[user.id]?.length && "text-muted-foreground"
                                  )}
                                >
                                  <Building2 className="h-4 w-4 mr-2 opacity-70" />
                                  {userClientAssignments[user.id]?.length 
                                    ? `${userClientAssignments[user.id].length} client${userClientAssignments[user.id].length === 1 ? '' : 's'} assigned` 
                                    : "Assign clients"}
                                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search clients..." className="border-none focus:ring-0" autoFocus />
                                  <CommandList>
                                    <CommandEmpty>No clients found</CommandEmpty>
                                    {userClientAssignments[user.id]?.length > 0 && (
                                      <CommandGroup heading="Assigned clients">
                                        {userClientAssignments[user.id]?.map(client => (
                                          <CommandItem
                                            key={client.id}
                                            onSelect={() => {
                                              removeClient.mutate({ userId: user.id, clientId: client.id });
                                            }}
                                            className="bg-secondary/5 text-primary"
                                          >
                                            <Check className="h-4 w-4 mr-2 text-primary" />
                                            <span>{client.name}</span>
                                            <X className="ml-auto h-4 w-4 text-muted-foreground hover:text-destructive" />
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    )}
                                    
                                    <CommandGroup heading="Available clients">
                                      {clients
                                        .filter(client => 
                                          !userClientAssignments[user.id]?.some(c => c.id === client.id)
                                        )
                                        .map(client => (
                                          <CommandItem
                                            key={client.id}
                                            onSelect={() => {
                                              assignClient.mutate({ userId: user.id, clientId: client.id });
                                            }}
                                            className="cursor-pointer"
                                          >
                                            <Building2 className="mr-2 h-4 w-4 opacity-50" />
                                            <span>{client.name}</span>
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          {/* Client chips for quick visual reference */}
                          {userClientAssignments[user.id]?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {userClientAssignments[user.id]?.map(client => (
                                <Badge 
                                  key={client.id} 
                                  variant="outline" 
                                  className="flex items-center gap-1 bg-secondary/10 pl-1.5 pr-0.5 py-0.5 rounded-md border border-secondary/30 hover:border-secondary/50 transition-colors group"
                                >
                                  <Building2 className="h-3 w-3 mr-1 text-muted-foreground" />
                                  <span className="text-xs font-medium">{client.name}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-4 w-4 p-0 ml-1 opacity-60 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded-full transition-all" 
                                    onClick={() => removeClient.mutate({ userId: user.id, clientId: client.id })}
                                  >
                                    <span className="sr-only">Remove</span>
                                    <X className="h-2.5 w-2.5" />
                                  </Button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {/* Check if user has a pending invitation */}
                            {pendingInvitations.some(invite => invite.email === user.email && !invite.used) ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  // Look up the pending invitation for this user by email
                                  const pendingInvite = pendingInvitations.find(
                                    invite => invite.email === user.email && !invite.used
                                  );
                                  
                                  if (pendingInvite) {
                                    resendInvitation.mutate(pendingInvite.id);
                                  }
                                }}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                <span>Resend Invite</span>
                              </DropdownMenuItem>
                            ) : (
                              /* For active users, show Reset Password option */
                              <DropdownMenuItem
                                onClick={() => {
                                  resetPassword.mutate(user.id);
                                }}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                <span>Reset Password</span>
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem
                              className={user.role === UserRole.SUPER_ADMIN ? "text-red-500" : ""}
                            >
                              {user.role === UserRole.SUPER_ADMIN ? (
                                <Shield className="mr-2 h-4 w-4" />
                              ) : user.role === UserRole.ADMIN ? (
                                <UserCheck className="mr-2 h-4 w-4" />
                              ) : (
                                <Users className="mr-2 h-4 w-4" />
                              )}
                              <span>Current Role: {user.role.replace("_", " ")}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="rounded-full bg-muted p-3">
                          <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">No users found</p>
                          <p className="text-sm text-muted-foreground">
                            {debouncedSearchQuery ? 'Try a different search term or clear the filter.' : 'Get started by inviting your first user.'}
                          </p>
                        </div>
                        {debouncedSearchQuery ? (
                          <Button variant="outline" onClick={() => setSearchQuery("")}>Clear filter</Button>
                        ) : (
                          <Button onClick={() => setIsInviteDialogOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Invite User
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
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
        

      </main>
    </div>
  );
}