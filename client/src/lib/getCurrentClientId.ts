/**
 * Utility function to get the current client ID from various sources
 * This helps prevent clients from downloading the Summa logo instead of their own
 */

// Add global type declaration
declare global {
  interface Window {
    __CLIENT_ID__?: number;
    __CLIENT_STATE__?: { id?: number };
    __APP_STATE__?: { currentClient?: { id?: number } };
  }
}

/**
 * Get the current client ID from various possible sources
 * This function tries multiple strategies to find the correct client ID
 */
export function getCurrentClientId(): number | null {
  // Try to get from explicit global client ID
  if (typeof window.__CLIENT_ID__ === 'number') {
    return window.__CLIENT_ID__;
  }
  
  // Try to get from client state
  if (window.__CLIENT_STATE__?.id) {
    return window.__CLIENT_STATE__.id;
  }
  
  // Try to get from app state
  if (window.__APP_STATE__?.currentClient?.id) {
    return window.__APP_STATE__.currentClient.id;
  }
  
  // Try to get from sessionStorage
  const storedClientId = sessionStorage.getItem('current_client_id');
  if (storedClientId) {
    const parsedId = parseInt(storedClientId, 10);
    if (!isNaN(parsedId)) {
      return parsedId;
    }
  }
  
  // Try to get from localStorage
  const localClientId = localStorage.getItem('current_client_id');
  if (localClientId) {
    const parsedId = parseInt(localClientId, 10);
    if (!isNaN(parsedId)) {
      return parsedId;
    }
  }
  
  // Try to extract from URL path
  // This works for URLs like /clients/123/...
  try {
    const pathMatch = window.location.pathname.match(/\/clients\/(\d+)/);
    if (pathMatch && pathMatch[1]) {
      return parseInt(pathMatch[1], 10);
    }
  } catch (e) {
    console.error("Error parsing client ID from URL:", e);
  }
  
  // No client ID found
  return null;
}