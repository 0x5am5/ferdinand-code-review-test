/**
 * Gets headers with viewing role for super admin role switching
 */
function getViewingRoleHeaders(): HeadersInit {
  const headers: HeadersInit = {};
  const viewingRole = sessionStorage.getItem("ferdinand_viewing_role");
  if (viewingRole) {
    headers["X-Viewing-Role"] = viewingRole;
  }
  return headers;
}

/**
 * Simple GET request with viewing role header support
 * Use this for queries that need the X-Viewing-Role header
 */
export async function apiFetch<T>(path: string): Promise<T> {
  const headers = getViewingRoleHeaders();

  const response = await fetch(path, {
    method: "GET",
    headers,
    credentials: "include",
  });

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

  return response.json();
}

/**
 * Upload FormData with viewing role header support
 * Use this for file uploads that need the X-Viewing-Role header
 */
export async function apiUpload(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" = "POST"
): Promise<Response> {
  const headers = getViewingRoleHeaders();

  const response = await fetch(path, {
    method,
    headers,
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    let errorMessage = `Upload failed: ${response.statusText}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      // If response.json() fails, use default error message
    }
    throw new Error(errorMessage);
  }

  return response;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  data?: unknown,
  options?: { credentials?: RequestCredentials }
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...getViewingRoleHeaders(),
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
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

// Section Metadata Types
export interface SectionMetadata {
  sectionType: string;
  description?: string;
}

// Section Metadata API helpers
export const sectionMetadataApi = {
  list: (clientId: number) =>
    apiRequest<SectionMetadata[]>(
      "GET",
      `/api/clients/${clientId}/section-metadata`
    ),

  update: (clientId: number, sectionType: string, description: string) =>
    apiRequest(
      "PUT",
      `/api/clients/${clientId}/section-metadata/${sectionType}`,
      { description }
    ),
};

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
