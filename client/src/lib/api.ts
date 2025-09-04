export async function apiRequest<T>(
  method: string,
  path: string,
  data?: unknown
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data && method !== "GET") {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(path, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
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
