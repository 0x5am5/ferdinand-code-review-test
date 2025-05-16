/**
 * CRITICAL FIX: Asset URL Interceptor
 * 
 * This patches the fetch API to ensure that all requests to asset download endpoints
 * always include client ID parameters to prevent the issue where clients download
 * the Summa logo instead of their own logos.
 */

// Original fetch function
const originalFetch = window.fetch;

// Get the current client ID from the global context
function getCurrentClientId(): number | null {
  // Try to get client ID from global state management
  // This assumes there's a clientId stored somewhere in the global state
  const clientIdFromStore = window.__CLIENT_ID__ || null;
  
  // Check if client ID is stored in sessionStorage as a fallback
  if (!clientIdFromStore) {
    const storedClientId = sessionStorage.getItem('current_client_id');
    return storedClientId ? parseInt(storedClientId, 10) : null;
  }
  
  return clientIdFromStore;
}

// Apply client ID to asset URLs
function ensureClientIdInAssetUrl(url: string | URL): string {
  // Check if this is an asset URL
  const urlStr = url.toString();
  if (!urlStr.includes('/api/assets/') || !urlStr.includes('/file')) {
    return urlStr; // Not an asset URL, return unchanged
  }
  
  // Get the client ID
  const clientId = getCurrentClientId();
  if (!clientId) {
    console.warn('Client ID not found when downloading assets. This may cause incorrect logo downloads.');
    return urlStr;
  }
  
  try {
    // Parse the URL
    const parsedUrl = new URL(urlStr, window.location.origin);
    
    // Check if clientId parameter is already present
    if (!parsedUrl.searchParams.has('clientId')) {
      // Add the client ID parameter
      parsedUrl.searchParams.append('clientId', clientId.toString());
      
      // Add cache buster to prevent caching issues
      parsedUrl.searchParams.append('t', Date.now().toString());
      
      console.log(`Added client ID ${clientId} to asset URL: ${parsedUrl.toString()}`);
      return parsedUrl.toString();
    }
    
    return urlStr;
  } catch (error) {
    console.error('Error applying client ID to asset URL:', error);
    return urlStr;
  }
}

// Monkey patch the fetch API
window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Ensure URL includes client ID for asset requests
  if (typeof input === 'string' || input instanceof URL) {
    input = ensureClientIdInAssetUrl(input);
  } else if (input instanceof Request) {
    // For Request objects, create a new request with the modified URL
    const url = ensureClientIdInAssetUrl(input.url);
    const newRequest = new Request(url, input);
    input = newRequest;
  }
  
  // Call the original fetch with the patched URL
  return originalFetch.call(window, input, init);
};

/**
 * Initialize the asset URL interceptor by setting the client ID in session storage
 */
export function initAssetUrlInterceptor(clientId: number): void {
  // Store client ID in session storage for persistence
  sessionStorage.setItem('current_client_id', clientId.toString());
  
  // Also expose on window for easier access
  window.__CLIENT_ID__ = clientId;
  
  console.log(`Asset URL interceptor initialized with client ID: ${clientId}`);
}

// Declare global window property
declare global {
  interface Window {
    __CLIENT_ID__?: number;
  }
}