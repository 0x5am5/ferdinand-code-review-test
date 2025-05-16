/**
 * CRITICAL FIX: Asset URL Interceptor
 * 
 * This patches the fetch API to ensure that all requests to asset download endpoints
 * always include client ID parameters to prevent the issue where clients download
 * the Summa logo instead of their own logos.
 */

import { getCurrentClientId } from './getCurrentClientId';

// Original fetch function
const originalFetch = window.fetch;

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

// Override the fetch function to intercept asset URLs
window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' || input instanceof URL) {
    // Apply client ID to the URL if it's an asset URL
    const modifiedUrl = ensureClientIdInAssetUrl(input);
    
    // Call the original fetch with the modified URL
    return originalFetch(modifiedUrl, init);
  }
  
  // For Request objects, we need to extract the URL, modify it, and create a new Request
  if (input instanceof Request) {
    const modifiedUrl = ensureClientIdInAssetUrl(input.url);
    
    // If URL wasn't modified, use original request
    if (modifiedUrl === input.url) {
      return originalFetch(input, init);
    }
    
    // Create a new request with the modified URL
    const newRequest = new Request(modifiedUrl, {
      method: input.method,
      headers: input.headers,
      body: input.body,
      mode: input.mode,
      credentials: input.credentials,
      cache: input.cache,
      redirect: input.redirect,
      referrer: input.referrer,
      integrity: input.integrity,
    });
    
    return originalFetch(newRequest, init);
  }
  
  // Default case
  return originalFetch(input, init);
};

// Export a dummy function to make this a valid module
export const initAssetUrlInterceptor = () => {
  console.log('Asset URL interceptor initialized');
};