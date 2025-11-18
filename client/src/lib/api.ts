export async function apiRequest<T>(
  method: string,
  path: string,
  data?: unknown,
  options?: { credentials?: RequestCredentials }
): Promise<T> {
  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: options?.credentials || "include",
  };

  if (data && method !== "GET") {
    fetchOptions.body = JSON.stringify(data);
  }

  const response = await fetch(path, fetchOptions);

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      // If response.json() fails, use default error message
    }
    throw new Error(errorMessage);
  }

  // Return null for 204 No Content responses or if the response is empty
  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return null as unknown as T;
  }

  // Check if there's content to parse
  const text = await response.text();
  if (!text) {
    return null as unknown as T;
  }

  try {
    return JSON.parse(text);
  } catch (e: unknown) {
    throw new Error(`Invalid JSON response: ${text} ${(e as Error).message}`);
  }
}

export interface SlackUserStatus {
  linked: boolean;
  slackTeamId?: string;
  teamName?: string;
}

export async function getSlackUserStatus(): Promise<SlackUserStatus> {
  return apiRequest<SlackUserStatus>("GET", "/api/slack/user-status");
}

// Brand Asset API helpers
export const brandAssetApi = {
  updateDescription: (clientId: number, assetId: number, description: string) =>
    apiRequest(
      "PATCH",
      `/api/clients/${clientId}/brand-assets/${assetId}/description`,
      { description }
    ),

  delete: (clientId: number, assetId: number, variant?: "dark" | "light") =>
    apiRequest(
      "DELETE",
      `/api/clients/${clientId}/brand-assets/${assetId}${variant === "dark" ? "?variant=dark" : ""}`
    ),
};
