
import { useMutation, useQuery } from "@tanstack/react-query";
import { User, Client, UpdateUserRoleForm, InviteUserForm } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
      } catch (error) {
        console.error("Failed to fetch client assignments:", error);
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
}

// Invite user mutation
export function useInviteUserMutation() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: InviteUserForm) => {
      return await apiRequest("POST", "/api/users", data);
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
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Client assignment mutations
export function useClientAssignmentMutations() {
  const { toast } = useToast();

  const assignClient = useMutation({
    mutationFn: async ({ userId, clientId }: { userId: number; clientId: number }) => {
      return await apiRequest("POST", `/api/user-clients`, { userId, clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeClient = useMutation({
    mutationFn: async ({ userId, clientId }: { userId: number; clientId: number }) => {
      return await apiRequest("DELETE", `/api/user-clients/${userId}/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return { assignClient, removeClient };
}
