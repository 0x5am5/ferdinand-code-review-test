/**
 * Client Theme Manager
 * 
 * This utility manages client-specific theming by dynamically
 * adding and removing client-specific CSS classes to the document body.
 */

// Maps client IDs to their respective CSS class names
const clientClassMap: Record<number, string> = {
  1: 'client-example-corp',
  2: 'client-acme-inc',
  // Add more mappings as needed
};

/**
 * Applies client-specific theming by adding the appropriate CSS class to the body
 * @param clientId The ID of the client whose theme should be applied
 * @returns Boolean indicating whether a client theme was applied
 */
export function applyClientTheme(clientId: number | null): boolean {
  // First, clear any existing client themes
  clearClientThemes();
  
  // If no clientId is provided, or it doesn't exist in our map, exit
  if (!clientId || !clientClassMap[clientId]) {
    return false;
  }
  
  // Apply the client-specific class to the body
  document.body.classList.add(clientClassMap[clientId]);
  
  return true;
}

/**
 * Removes all client-specific theme classes from the body
 */
export function clearClientThemes(): void {
  // Get all possible client theme classes
  const allClientClasses = Object.values(clientClassMap);
  
  // Remove each class from the body
  allClientClasses.forEach(className => {
    document.body.classList.remove(className);
  });
}

/**
 * Gets the current active client theme class name
 * @returns The active client theme class name or null if none is active
 */
export function getActiveClientTheme(): string | null {
  const allClientClasses = Object.values(clientClassMap);
  
  for (const className of allClientClasses) {
    if (document.body.classList.contains(className)) {
      return className;
    }
  }
  
  return null;
}

/**
 * Gets the client ID associated with the active theme
 * @returns The client ID or null if no client theme is active
 */
export function getActiveClientId(): number | null {
  const activeClass = getActiveClientTheme();
  
  if (!activeClass) {
    return null;
  }
  
  // Find the client ID that maps to this class
  const entries = Object.entries(clientClassMap);
  const entry = entries.find(([_, className]) => className === activeClass);
  
  return entry ? parseInt(entry[0], 10) : null;
}