import {
  type Invitation,
  USER_ROLES,
  type User,
  UserRole,
} from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
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
import { Link, useParams } from "wouter";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { useClientAccess } from "@/hooks/use-client-access";
import { useToast } from "@/hooks/use-toast";
import { useClientsById } from "@/lib/queries/clients";
import {
  useInviteUserMutation,
  useRemoveInvitationMutation,
  useUpdateUserRoleMutation,
} from "@/lib/queries/users";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Helper to get badge variant based on role
const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return "superadmin";
    case UserRole.ADMIN:
      return "admin";
    case UserRole.EDITOR:
      return "editor";
    case UserRole.STANDARD:
      return "standard";
    case UserRole.GUEST:
      return "guest";
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

export default function ClientUsersPage() {
  const { id } = useParams();
  const clientId = id ? parseInt(id, 10) : null;
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const { toast } = useToast();

  // Check client access and redirect if unauthorized
  const { isLoading: isLoadingAccess } = useClientAccess(clientId);

  // Get client details
  const { data: client, isLoading: isLoadingClient } = useClientsById(clientId);

  // Query hooks for client-specific data
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: [`/api/clients/${clientId}/users`],
    enabled: !!clientId,
  });

  const { data: pendingInvitations = [], isLoading: isLoadingInvitations } =
    useQuery<Invitation[]>({
      queryKey: [`/api/clients/${clientId}/invitations`],
      enabled: !!clientId,
    });

  // Mutation hooks
  const { mutate: updateUserRole } = useUpdateUserRoleMutation();
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

  if (!clientId || Number.isNaN(clientId)) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Invalid Client ID</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAuthLoading || isLoadingClient || isLoadingAccess) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>Client Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter users based on search query
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
        const namePartsMatch = nameParts.some((part: string) =>
          part.startsWith(debouncedSearchQuery.toLowerCase())
        );

        return nameMatch || emailMatch || roleMatch || namePartsMatch;
      })
    : users;

  return (
    <div className="p-8 pt-4">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">
            Managing users for {client.name}
          </p>
        </div>
        <Button
          onClick={() => setIsInviteDialogOpen(true)}
          variant="default"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <div className="space-y-8">
        {/* Search Bar */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
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
                    queryClient.invalidateQueries({
                      queryKey: [`/api/clients/${clientId}/users`],
                    })
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
          <div className="flex items-center text-sm">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>
              Found <strong>{filteredUsers.length}</strong>{" "}
              {filteredUsers.length === 1 ? "user" : "users"}
              {filteredUsers.length > 0
                ? " matching "
                : " matching search term "}
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
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Users who have been invited to {client.name} but haven't
                accepted yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
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
                            <div className="h-4 w-24 bg-muted animate-pulse"></div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="h-8 w-8 bg-muted animate-pulse ml-auto"></div>
                          </TableCell>
                        </TableRow>
                      ))
                    : pendingInvitations.map((invitation: Invitation) => {
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
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48"
                                >
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

                                  {(currentUser?.role ===
                                    UserRole.SUPER_ADMIN ||
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
            <CardTitle>Client Users</CardTitle>
            <CardDescription>
              Manage users assigned to {client.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[200px]">Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  Array.from({ length: 3 }, (_, i) => i).map((id) => (
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
                      <TableCell className="text-right">
                        <div className="h-8 w-8 bg-muted animate-pulse ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
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
                            // Disable if trying to modify your own role
                            user.id === currentUser?.id
                          }
                          onValueChange={(value) => {
                            // Check if user is trying to modify their own role
                            if (user.id === currentUser?.id) {
                              toast({
                                title: "Permission denied",
                                description: "You cannot change your own role",
                                variant: "destructive",
                              });
                              return;
                            }

                            // Permission checks similar to main users page
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

                            updateUserRole({
                              id: user.id,
                              role: value as (typeof UserRole)[keyof typeof UserRole],
                            });
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
                                <Badge variant={getRoleBadgeVariant(role)}>
                                  {role.replace("_", " ")}
                                </Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={
                                currentUser?.role !== UserRole.SUPER_ADMIN &&
                                user.role === UserRole.SUPER_ADMIN
                              }
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {(currentUser?.role === UserRole.SUPER_ADMIN ||
                              user.role !== UserRole.SUPER_ADMIN) && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    resetPassword(user.id);
                                  }}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  <span>Reset Password</span>
                                </DropdownMenuItem>
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
                    <TableCell colSpan={4} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="rounded-full bg-muted p-3">
                          <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">No users found</p>
                          <p className="text-sm text-muted-foreground">
                            {debouncedSearchQuery
                              ? "Try a different search term or clear the filter."
                              : "Get started by inviting your first user to this client."}
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
            clients={[client]} // Only pass the current client
            preSelectedClientId={clientId}
          />
        )}
      </div>
    </div>
  );
}
