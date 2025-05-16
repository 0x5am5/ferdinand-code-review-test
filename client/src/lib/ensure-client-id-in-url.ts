/**
 * CRITICAL FIX: Utility to ensure client ID is always included in asset URLs
 * 
 * This helps prevent the issue where clients download the Summa logo 
 * instead of their own logo by ensuring all asset URLs contain client IDs.
 */

/**
 * Helper function that ensures a URL for downloading assets always includes a client ID
 * 
 * @param url The original URL
 * @param clientId The client ID to include
 * @returns A new URL with the client ID included
 */
export function ensureClientIdInUrl(url: string, clientId: number): string {
  try {
    // Parse the URL to manipulate it properly
    const urlObj = new URL(url, window.location.origin);
    
    // Check if this is an asset URL
    if (urlObj.pathname.includes('/api/assets/') && urlObj.pathname.includes('/file')) {
      // Check if a client ID is already included
      if (!urlObj.searchParams.has('clientId')) {
        // Add the client ID parameter
        urlObj.searchParams.append('clientId', clientId.toString());
        
        // Add cache buster to prevent browser caching
        urlObj.searchParams.append('t', Date.now().toString());
        
        console.log(`Fixed asset URL by adding client ID ${clientId}`);
      }
    }
    
    return urlObj.toString();
  } catch (error) {
    console.error('Error adding client ID to URL:', error);
    return url;
  }
}

/**
 * Global function to patch fetch calls to ensure client IDs in asset URLs
 * Call this once at app initialization
 */
export function patchFetchForClientIds(): void {
  // Store the original fetch function
  const originalFetch = window.fetch;
  
  // Replace fetch with our patched version
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Get the current client ID from the global state or localStorage
    const currentClientId = window.__CURRENT_CLIENT_ID__ || 
                           parseInt(localStorage.getItem('currentClientId') || '0', 10);
    
    if (!currentClientId) {
      return originalFetch.call(window, input, init);
    }
    
    // Patch URLs to include client ID
    if (typeof input === 'string') {
      input = ensureClientIdInUrl(input, currentClientId);
    } else if (input instanceof URL) {
      input = new URL(ensureClientIdInUrl(input.toString(), currentClientId));
    } else if (input instanceof Request) {
      // For Request objects, create a new request with the patched URL
      const url = ensureClientIdInUrl(input.url, currentClientId);
      const newRequest = new Request(url, input);
      input = newRequest;
    }
    
    // Call the original fetch with the patched input
    return originalFetch.call(window, input, init);
  };
  
  console.log('Patched fetch API to ensure client IDs in asset URLs');
}

/**
 * Set the current client ID in global state and localStorage
 */
export function setCurrentClientId(clientId: number): void {
  if (!clientId) return;
  
  // Store in global state
  window.__CURRENT_CLIENT_ID__ = clientId;
  
  // Store in localStorage for persistence
  localStorage.setItem('currentClientId', clientId.toString());
  
  console.log(`Set current client ID to ${clientId}`);
}

// Add type declaration for the global window property
declare global {
  interface Window {
    __CURRENT_CLIENT_ID__?: number;
  }
}