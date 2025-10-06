import { type User, UserRole } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, SearchIcon, UserPlusIcon, XCircle } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserManagerProps {
  clientId: number;
}

export function UserManager({ clientId }: UserManagerProps) {
  const emailInputId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>(UserRole.STANDARD);

  // Fetch users for this client
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/clients", clientId, "users"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/users`);
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
    enabled: !!clientId,
  });

  // Create invitation mutation
  const createInvitation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      // The API expects a name field and lowercase role values
      const response = await apiRequest("POST", "/api/invitations", {
        email,
        name: email.split("@")[0], // Generate a default name from the email
        role: role.toLowerCase(), // Make sure role is lowercase to match the enum in schema
        clientIds: [clientId],
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: `Invitation has been created for ${inviteEmail}. In development, emails are saved to the 'generated-emails' directory.`,
        duration: 5000,
      });
      // Only close the dialog after a delay to give the user time to see the success message
      setTimeout(() => {
        setInviteDialogOpen(false);
        setInviteEmail("");
      }, 1500);

      // Refresh the user list after inviting a new user
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", clientId, "users"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  // Remove user from client mutation
  const removeUserFromClient = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/user-clients/${userId}/${clientId}`);
    },
    onSuccess: () => {
      toast({
        title: "User removed",
        description: "User has been removed from this client",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", clientId, "users"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "User role has been updated successfully",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", clientId, "users"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast({
        title: "Email required",
        description: "Please enter an email address for the invitation",
        variant: "destructive",
      });
      return;
    }

    createInvitation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const handleRemoveUser = (userId: number) => {
    if (confirm("Are you sure you want to remove this user from the client?")) {
      removeUserFromClient.mutate(userId);
    }
  };

  const handleRoleChange = (userId: number, newRole: string) => {
    updateUserRole.mutate({ userId, role: newRole });
  };

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
        const nameMatch = (user.name as string)
          ?.toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase());
        const emailMatch = (user.email as string)
          .toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase());
        const roleMatch = (user.role as string)
          .toLowerCase()
          .includes(debouncedSearchQuery.toLowerCase());

        // Also match parts of names (first/last name)
        const nameParts = (user.name as string)?.toLowerCase().split(" ") || [];
        const namePartsMatch = nameParts.some((part: string) =>
          part.startsWith(debouncedSearchQuery.toLowerCase())
        );

        return nameMatch || emailMatch || roleMatch || namePartsMatch;
      })
    : users;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search users..."
            className="pl-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => setInviteDialogOpen(true)}>
          <UserPlusIcon className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Users ({users ? users.length : 0})</span>
            {filteredUsers.length > 0 && searchQuery && (
              <Badge variant="outline" className="ml-2 flex items-center gap-1">
                <span>Filter: {searchQuery}</span>
                <XCircle
                  className="h-3.5 w-3.5 cursor-pointer"
                  onClick={() => setSearchQuery("")}
                />
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[160px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              {searchQuery ? (
                <>
                  <SearchIcon className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-medium">
                    No users match your search
                  </h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    Try a different search term or clear the filter
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                </>
              ) : (
                <>
                  <UserPlusIcon className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-medium">
                    No users assigned to this client yet
                  </h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                    Invite team members to collaborate on this client
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setInviteDialogOpen(true)}
                  >
                    Invite Users
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user: User) => (
                  <TableRow key={user.id as number}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          {(user.name as string)
                            ? (user.name as string).charAt(0).toUpperCase()
                            : (user.email as string).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">
                            {user.name as string}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Mail className="mr-1 h-3 w-3" />
                            {user.email as string}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge
                        role={user.role as string}
                        onChange={(newRole) =>
                          handleRoleChange(user.id as number, newRole)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveUser(user.id as number)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={inviteDialogOpen}
        onOpenChange={(open) => {
          // When closing the dialog, we want to reset the state
          if (!open) {
            setInviteEmail("");
            setInviteRole(UserRole.STANDARD);
          }
          setInviteDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new user to this client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id={emailInputId}
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex flex-wrap gap-2">
                {Object.values(UserRole).map((role) => (
                  <Badge
                    key={role}
                    className={`cursor-pointer ${inviteRole === role ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                    onClick={() => setInviteRole(role)}
                  >
                    {role.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(false);
                setInviteEmail("");
                setInviteRole(UserRole.STANDARD);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInvite();
              }}
              disabled={createInvitation.isPending || !inviteEmail}
            >
              {createInvitation.isPending ? (
                "Sending invitation..."
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleBadge({
  role,
  onChange,
}: {
  role: string;
  onChange: (role: string) => void;
}) {
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [confirmingRole, setConfirmingRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Define role-specific properties
  const getRoleProperties = (roleName: string) => {
    switch (roleName) {
      case UserRole.SUPER_ADMIN:
        return {
          color:
            "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300",
          description: "Full access to all features and settings",
          icon: "👑",
        };
      case UserRole.ADMIN:
        return {
          color: "bg-red-100 text-red-800 hover:bg-red-200 border-red-300",
          description: "Can manage users and all client data",
          icon: "⚙️",
        };
      case UserRole.STANDARD:
        return {
          color: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300",
          description: "Can view and edit client data",
          icon: "✏️",
        };
      case UserRole.GUEST:
        return {
          color: "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300",
          description: "View-only access to client data",
          icon: "👁️",
        };
      default:
        return {
          color: "bg-secondary text-secondary-foreground",
          description: "Custom role",
          icon: "🔹",
        };
    }
  };

  const handleRoleSelect = (newRole: string) => {
    if (newRole !== role) {
      setConfirmingRole(newRole);
    } else {
      // If clicking the current role, just close the selector
      setIsChangingRole(false);
    }
  };

  const confirmRoleChange = async () => {
    if (confirmingRole) {
      setIsLoading(true);
      try {
        await onChange(confirmingRole);
        // Success is handled by the parent component's onSuccess
      } catch (error: unknown) {
        // Error is handled by the parent component's onError
        console.error(
          "Error changing role:",
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setIsLoading(false);
        setConfirmingRole(null);
        setIsChangingRole(false);
      }
    }
  };

  const cancelRoleChange = () => {
    setConfirmingRole(null);
    setIsChangingRole(false);
  };

  // Role selection view
  if (isChangingRole) {
    return (
      <div className="space-y-3 py-1">
        <div className="text-xs text-muted-foreground mb-1 flex items-center">
          <span>Select a role:</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(UserRole).map((r) => {
            const { color, description, icon } = getRoleProperties(r);
            const isSelected = confirmingRole === r;
            const isCurrentRole = role === r;

            return (
              <button
                type="button"
                key={r}
                className={`
                  border rounded-md p-2 transition-all cursor-pointer text-left w-full
                  ${isSelected ? `${color} border-2` : "border bg-background hover:bg-muted"}
                  ${isCurrentRole && !isSelected ? "border-primary border-dashed" : ""}
                `}
                onClick={() => handleRoleSelect(r)}
                aria-label={`Select ${r.replace("_", " ")} role`}
              >
                <div className="font-medium text-sm flex items-center">
                  <span className="mr-1">{icon}</span>
                  {r.replace("_", " ")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {description}
                </div>
              </button>
            );
          })}
        </div>

        {confirmingRole && (
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancelRoleChange}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmRoleChange}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-label="Loading"
                  >
                    <title>Loading</title>
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Updating...
                </span>
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Default badge view
  const { color, icon } = getRoleProperties(role);
  return (
    <Badge
      className={`cursor-pointer border ${color} flex items-center gap-1 hover:scale-105 transition-transform`}
      onClick={() => setIsChangingRole(true)}
    >
      <span>{icon}</span>
      <span>{role.replace("_", " ")}</span>
    </Badge>
  );
}
