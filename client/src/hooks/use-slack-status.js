import { useQuery } from "@tanstack/react-query";
import { getSlackUserStatus } from "@/lib/api";
export function useSlackStatus(options = {}) {
    const { enabled = true } = options;
    return useQuery({
        queryKey: ["slack-user-status"],
        queryFn: getSlackUserStatus,
        enabled,
        refetchInterval: 3000,
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true, // Don't refetch on window focus
        staleTime: 0, // Always consider stale to ensure fresh data
        gcTime: 5000, // Short garbage collection time
        networkMode: "always", // Continue even when offline
    });
}
// Hook for polling only when user is actively linking Slack
export function useSlackStatusPolling(isLinking) {
    const query = useSlackStatus({
        enabled: isLinking,
    });
    return query;
}
