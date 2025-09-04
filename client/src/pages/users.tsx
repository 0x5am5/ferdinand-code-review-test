import {
  type Client,
  type Invitation,
  USER_ROLES,
  UserRole,
} from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronDown,
  Filter,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { InviteUserDialog } from "@/components/auth/invite-user-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  useClientAssignmentMutations,
  useInviteUserMutation,
  usePendingInvitationsQuery,
  useRemoveInvitationMutation,
  useUpdateUserRoleMutation,
  useUserClientAssignmentsQuery,
  useUsersQuery,
} from "@/lib/queries/users";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// Helper to get badge variant based on role
const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return "destructive";
    case UserRole.ADMIN:
      return "default";
    case UserRole.EDITOR:
      return "secondary";
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
export interface PendingInvitation {
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
  // Move all hooks to the top level
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const { toast } = useToast();

  // Query hooks - use enabled flag to control when they run
  const { data: users = [], isLoading: isLoadingUsers } = useUsersQuery();
  const { data: pendingInvitations = [], isLoading: isLoadingInvitations } =
    usePendingInvitationsQuery();
  const { data: userClientAssignments = {}, isLoading: isLoadingAssignments } =
    useUserClientAssignmentsQuery(users.map((u) => u.id));
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Mutation hooks
  const { mutate: updateUserRole } = useUpdateUserRoleMutation();
  const { assignClient, removeClient } = useClientAssignmentMutations();
  const { mutate: resetPassword } = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest("POST", `/api/users/${userId}/reset-password`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset email sent successfully",
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

  const { mutate: resendInvitation, isPending: isResendingInvitationPending } =
    useInviteUserMutation();
  const { mutate: removeInvitation } = useRemoveInvitationMutation();

  // Effects
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Derived state
  const filteredUsers = debouncedSearchQuery
    ? users.filter((user) => {
        const nameMatch = user.name
          ?.toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase());
        const emailMatch = user.email
          .toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase());
        const roleMatch = user.role
          .toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase());

        // Also match parts of names (first/last name)
        const nameParts = user.name?.toLowerCase().split(" ") || [];
        const namePartsMatch = nameParts.some((part) =>
          part.startsWith(debouncedSearchQuery.toLowerCase())
        );

        return nameMatch || emailMatch || roleMatch || namePartsMatch;
      })
    : users;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Users</h1>
        <Button
          onClick={() => setIsInviteDialogOpen(true)}
          variant="default"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
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
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["/api/users"] })
                }
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
            Found <strong>{filteredUsers.length}</strong>{" "}
            {filteredUsers.length === 1 ? "user" : "users"}
            {filteredUsers.length > 0 ? " matching " : " matching search term "}
            <Badge variant="outline" className="mx-1 font-mono">
              {debouncedSearchQuery}
            </Badge>
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
                {isLoadingInvitations
                  ? Array.from({ length: 2 }, (_, index) => (
                      <TableRow
                        key={`invitation-skeleton-${Date.now()}-${index}`}
                      >
                        <TableCell>
                          <div className="h-4 w-48 bg-muted animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-8 w-24 bg-muted animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-32 bg-muted animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-24 bg-muted animate-pulse"></div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="h-8 w-8 bg-muted animate-pulse ml-auto"></div>
                        </TableCell>
                      </TableRow>
                    ))
                  : pendingInvitations.length > 0 &&
                    pendingInvitations.map((invitation: Invitation) => {
                      // Format expiration date
                      const expiresAt = new Date(invitation.expiresAt);
                      const now = new Date();
                      const isExpired = expiresAt < now;
                      const daysLeft = Math.ceil(
                        (expiresAt.getTime() - now.getTime()) /
                          (1000 * 3600 * 24)
                      );

                      return (
                        <TableRow key={invitation.id}>
                          <TableCell>{invitation.email}</TableCell>
                          <TableCell>
                            <Badge
                              variant={getRoleBadgeVariant(invitation.role)}
                            >
                              {invitation.role.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {invitation ? (
                              <div className="flex items-center space-x-2">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                                  {getInitials(invitation.name)}
                                </div>
                                <span>{invitation.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Platform Access
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : (
                              <span className="text-sm">
                                {daysLeft} {daysLeft === 1 ? "day" : "days"}{" "}
                                left
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() =>
                                    resendInvitation(invitation.id)
                                  }
                                  disabled={isResendingInvitationPending}
                                >
                                  {isResendingInvitationPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                  )}
                                  <span>Resend Invitation</span>
                                </DropdownMenuItem>

                                {(currentUser?.role === UserRole.SUPER_ADMIN ||
                                  currentUser?.role === UserRole.ADMIN) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        removeInvitation(invitation.id)
                                      }
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <X className="mr-2 h-4 w-4" />
                                      <span>Remove Invitation</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage your users and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[200px]">Role</TableHead>
                {currentUser?.role === UserRole.SUPER_ADMIN && (
                  <TableHead>Assigned Clients</TableHead>
                )}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingUsers || isLoadingAssignments ? (
                Array.from({ length: 3 }, () => crypto.randomUUID()).map(
                  (id) => (
                    <TableRow key={id}>
                      <TableCell>
                        <div className="flex items-center space-x-4">
                          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                          <div className="h-4 w-32 bg-muted animate-pulse" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-48 bg-muted animate-pulse" />
                      </TableCell>
                      <TableCell>
                        <div className="h-8 w-24 bg-muted animate-pulse" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 w-32 bg-muted animate-pulse" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="h-8 w-8 bg-muted animate-pulse ml-auto" />
                      </TableCell>
                    </TableRow>
                  )
                )
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-4">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        defaultValue={user.role}
                        disabled={
                          // Disable if current user is not super admin and target user is super admin
                          (currentUser?.role !== UserRole.SUPER_ADMIN &&
                            user.role === UserRole.SUPER_ADMIN) ||
                          // Disable if current user is admin and trying to modify their own role
                          (currentUser?.role === UserRole.ADMIN &&
                            user.id === currentUser.id)
                        }
                        onValueChange={(value) => {
                          // Prevent non-super admins from performing any actions on super admins
                          if (
                            currentUser?.role !== UserRole.SUPER_ADMIN &&
                            user.role === UserRole.SUPER_ADMIN
                          ) {
                            toast({
                              title: "Permission denied",
                              description:
                                "Only super admins can modify super admin roles",
                              variant: "destructive",
                            });
                            return;
                          }

                          // Prevent non-super admins from assigning admin roles
                          if (
                            currentUser?.role !== UserRole.SUPER_ADMIN &&
                            ["SUPER_ADMIN", "ADMIN"].includes(value)
                          ) {
                            toast({
                              title: "Permission denied",
                              description:
                                "Only super admins can assign admin roles",
                              variant: "destructive",
                            });
                            return;
                          }

                          // Prevent admins from changing their own role
                          if (
                            currentUser?.role === UserRole.ADMIN &&
                            user.id === currentUser.id
                          ) {
                            toast({
                              title: "Permission denied",
                              description: "You cannot change your own role",
                              variant: "destructive",
                            });
                            return;
                          }

                          updateUserRole({
                            id: user.id,
                            role: value as (typeof UserRole)[keyof typeof UserRole],
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <SelectValue>
                            <Badge
                              variant={getRoleBadgeVariant(user.role)}
                              className="bg-secondary/10 text-secondary"
                            >
                              {" "}
                              {/*Updated Color*/}
                              {user.role.replace("_", " ")}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {USER_ROLES.filter((role) => {
                            // Only super admins can see/assign super_admin role
                            if (
                              role === "super_admin" &&
                              currentUser?.role !== "super_admin"
                            ) {
                              return false;
                            }

                            // Admins cannot assign admin role to others
                            if (
                              role === "admin" &&
                              currentUser?.role === "admin"
                            ) {
                              return false;
                            }

                            return true;
                          }).map((role) => (
                            <SelectItem key={role} value={role}>
                              <Badge
                                variant={getRoleBadgeVariant(role)}
                                className="bg-secondary/10 text-secondary"
                              >
                                {" "}
                                {role.replace("_", " ")}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {currentUser?.role === UserRole.SUPER_ADMIN && (
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
                                    !userClientAssignments[user.id]?.length &&
                                      "text-muted-foreground"
                                  )}
                                >
                                  <Building2 className="h-4 w-4 mr-2 opacity-70" />
                                  {userClientAssignments[user.id]?.length
                                    ? `${userClientAssignments[user.id].length} client${userClientAssignments[user.id].length === 1 ? "" : "s"} assigned`
                                    : "Assign clients"}
                                  <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-80 p-0"
                                align="start"
                              >
                                <Command>
                                  <CommandInput
                                    placeholder="Search clients..."
                                    className="border-none focus:ring-0"
                                    autoFocus
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      No clients found
                                    </CommandEmpty>
                                    {userClientAssignments[user.id]?.length >
                                      0 && (
                                      <CommandGroup heading="Assigned clients">
                                        {userClientAssignments[user.id]?.map(
                                          (client: Client) => (
                                            <CommandItem
                                              key={client.id}
                                              onSelect={() => {
                                                removeClient.mutate({
                                                  userId: user.id,
                                                  clientId: client.id,
                                                });
                                              }}
                                              className="bg-secondary/5 text-primary"
                                            >
                                              <Check className="h-4 w-4 mr-2 text-primary" />
                                              <span>{client.name}</span>
                                              <X className="ml-auto h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            </CommandItem>
                                          )
                                        )}
                                      </CommandGroup>
                                    )}

                                    <CommandGroup heading="Available clients">
                                      {clients
                                        .filter(
                                          (client) =>
                                            !userClientAssignments[
                                              user.id
                                            ]?.some(
                                              (c: Client) => c.id === client.id
                                            )
                                        )
                                        .map((client) => (
                                          <CommandItem
                                            key={client.id}
                                            onSelect={() => {
                                              assignClient.mutate({
                                                userId: user.id,
                                                clientId: client.id,
                                              });
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
                            {/* Client chips for quick visual reference */}
                            {userClientAssignments[user.id]?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {userClientAssignments[user.id]?.map(
                                  (client: Client) => (
                                    <Badge
                                      key={client.id}
                                      variant="outline"
                                      className="flex items-center gap-1 bg-secondary/10 pl-1.5 pr-0.5 py-0.5 rounded-md border border-secondary/30 hover:border-secondary/50 transition-colors group"
                                    >
                                      <Building2 className="h-3 w-3 mr-1 text-muted-foreground" />
                                      <span className="text-xs font-medium">
                                        {client.name}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 ml-1 opacity-60 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded-full transition-all"
                                        onClick={() =>
                                          removeClient.mutate({
                                            userId: user.id,
                                            clientId: client.id,
                                          })
                                        }
                                      >
                                        <span className="sr-only">Remove</span>
                                        <X className="h-2.5 w-2.5" />
                                      </Button>
                                    </Badge>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={
                              // Disable actions for super admins when current user is not super admin
                              currentUser?.role !== UserRole.SUPER_ADMIN &&
                              user.role === UserRole.SUPER_ADMIN
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {/* Only show actions if current user can perform actions on this user */}
                          {(currentUser?.role === UserRole.SUPER_ADMIN ||
                            user.role !== UserRole.SUPER_ADMIN) && (
                            <>
                              {/* Check if user has a pending invitation */}
                              {pendingInvitations.some(
                                (invite: Invitation) =>
                                  invite.email === user.email && !invite.used
                              ) ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    // Look up the pending invitation for this user by email
                                    const pendingInvite =
                                      pendingInvitations.find(
                                        (invite: Invitation) =>
                                          invite.email === user.email &&
                                          !invite.used
                                      );

                                    if (pendingInvite) {
                                      resendInvitation(pendingInvite.id);
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
                                    resetPassword(user.id);
                                  }}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  <span>Reset Password</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                            </>
                          )}

                          <DropdownMenuItem
                            className={
                              user.role === UserRole.SUPER_ADMIN
                                ? "text-red-500"
                                : ""
                            }
                          >
                            {user.role === UserRole.SUPER_ADMIN ? (
                              <Shield className="mr-2 h-4 w-4" />
                            ) : user.role === UserRole.ADMIN ? (
                              <UserCheck className="mr-2 h-4 w-4" />
                            ) : (
                              <Users className="mr-2 h-4 w-4" />
                            )}
                            <span>
                              Current Role: {user.role.replace("_", " ")}
                            </span>
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
                          {debouncedSearchQuery
                            ? "Try a different search term or clear the filter."
                            : "Get started by inviting your first user."}
                        </p>
                      </div>
                      {debouncedSearchQuery ? (
                        <Button
                          variant="outline"
                          onClick={() => setSearchQuery("")}
                        >
                          Clear filter
                        </Button>
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

      {currentUser && (
        <InviteUserDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          currentUser={currentUser}
          clients={clients}
        />
      )}
    </div>
  );
}
