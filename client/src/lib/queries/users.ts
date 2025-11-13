import type { InviteUserForm, UpdateUserRoleForm, User } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyErrorMessage } from "@/lib/errorMessages";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Get all users
export function useUsersQuery() {
  return useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
  });
}

// Get pending invitations
export function usePendingInvitationsQuery() {
  return useQuery({
    queryKey: ["/api/invitations"],
    queryFn: async () => {
      const response = await fetch("/api/invitations");
      if (!response.ok) {
        if (response.status === 403) {
          return [];
        }
        throw new Error("Failed to fetch pending invitations");
      }
      return response.json();
    },
  });
}

// Get client assignments for users
export function useUserClientAssignmentsQuery(userIds: number[]) {
  return useQuery({
    queryKey: ["/api/users/client-assignments"],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/users/client-assignments`);
        if (!response.ok) {
          throw new Error("Failed to fetch client assignments");
        }
        return await response.json();
      } catch (error: unknown) {
        console.error(
          "Failed to fetch client assignments:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return {};
      }
    },
    enabled: userIds.length > 0,
  });
}

// Update user role mutation
export function useUpdateUserRoleMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateUserRoleForm) => {
      return await apiRequest("PATCH", `/api/users/${data.id}/role`, {
        role: data.role,
      });
    },
    onSuccess: () => {
      // Invalidate all user-related queries to update UI everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/clients/") &&
          query.queryKey[0].includes("/users"),
      });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

// Invite user mutation
export function useInviteUserMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InviteUserForm | number) => {
      if (typeof data === "number") {
        // Resend invitation
        return await apiRequest("POST", `/api/invitations/${data}/resend`);
      } else {
        // New invitation
        return await apiRequest("POST", "/api/users", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: "Success",
        description: "User invited successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

// Remove invitation mutation
export function useRemoveInvitationMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (invitationId: number) => {
      return await apiRequest("DELETE", `/api/invitations/${invitationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: "Success",
        description: "Invitation removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

// Client assignment mutations
export function useClientAssignmentMutations() {
  const { toast } = useToast();

  const assignClient = useMutation({
    mutationFn: async ({
      userId,
      clientId,
    }: {
      userId: number;
      clientId: number;
    }) => {
      return await apiRequest("POST", `/api/user-clients`, {
        userId,
        clientId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const removeClient = useMutation({
    mutationFn: async ({
      userId,
      clientId,
    }: {
      userId: number;
      clientId: number;
    }) => {
      return await apiRequest(
        "DELETE",
        `/api/user-clients/${userId}/${clientId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  return { assignClient, removeClient };
}
