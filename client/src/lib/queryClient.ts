import { QueryClient, type QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      // Clone the response so we can read it multiple times if needed
      const responseClone = res.clone();
      const errorData = await responseClone.json();
      
      // Check if it's our standardized error format
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else {
        errorMessage = JSON.stringify(errorData) || errorMessage;
      }
    } catch (jsonError: unknown) {
      console.error(
        "Error parsing JSON:",
        jsonError instanceof Error ? jsonError.message : "Unknown error"
      );
      try {
        // If JSON parsing fails, try to read as text using the original response
        const text = await res.text();
        errorMessage = text || res.statusText || errorMessage;
      } catch (textError: unknown) {
        console.error(
          "Error reading response text:",
          textError instanceof Error ? textError.message : "Unknown error"
        );
        // Keep the HTTP status message as fallback
      }
    }
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // Data becomes stale immediately, allowing invalidateQueries to work properly
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
