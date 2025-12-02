import type {
  Client,
  Invitation,
  InviteUserForm,
  UpdateUserRoleForm,
  User,
} from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { getUserFriendlyErrorMessage } from "@/lib/errorMessages";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Get all users
export function useUsersQuery() {
  return useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiFetch<User[]>("/api/users"),
  });
}

// Get pending invitations
export function usePendingInvitationsQuery() {
  return useQuery<Invitation[]>({
    queryKey: ["/api/invitations"],
    queryFn: async () => {
      try {
        return await apiFetch<Invitation[]>("/api/invitations");
      } catch (error: unknown) {
        // Return empty array for 403 (forbidden) errors
        if (error instanceof Error && error.message.includes("403")) {
          return [];
        }
        throw error;
      }
    },
  });
}

// Get client assignments for users
export function useUserClientAssignmentsQuery(userIds: number[]) {
  return useQuery<Record<number, Client[]>>({
    queryKey: ["/api/users/client-assignments"],
    queryFn: async () => {
      try {
        return await apiFetch<Record<number, Client[]>>(
          "/api/users/client-assignments"
        );
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
