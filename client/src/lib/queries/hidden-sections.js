import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
export const useHiddenSections = (clientId) => {
    return useQuery({
        queryKey: [`/api/clients/${clientId}/hidden-sections`],
        enabled: !!clientId,
    });
};
export const useAddHiddenSection = (clientId) => {
    return useMutation({
        mutationFn: async (sectionType) => {
            return apiRequest("POST", `/api/clients/${clientId}/hidden-sections`, {
                sectionType,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [`/api/clients/${clientId}/hidden-sections`],
            });
        },
    });
};
export const useRemoveHiddenSection = (clientId) => {
    return useMutation({
        mutationFn: async (sectionType) => {
            return apiRequest("DELETE", `/api/clients/${clientId}/hidden-sections/${sectionType}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [`/api/clients/${clientId}/hidden-sections`],
            });
        },
    });
};
