/**
 * CRITICAL FIX: Secure URL Generation for Logo Downloads
 * 
 * This utility ensures that client IDs are always included in asset URLs
 * to prevent the issue where clients download the Summa logo instead of 
 * their own logo.
 */

/**
 * Creates a secure URL for downloading assets with client ID verification
 */
export function createSecureAssetUrl(assetId: number, clientId: number, options: {
  format?: string;
  size?: number;
  variant?: 'dark' | 'light';
  preserveRatio?: boolean;
  preserveVector?: boolean;
} = {}) {
  const { format, size, variant, preserveRatio = true, preserveVector = false } = options;
  
  // CRITICAL FIX: Build URL parameters using URLSearchParams
  const params = new URLSearchParams();
  
  // CRITICAL FIX: Always include client ID first to ensure the correct logo is downloaded
  params.append('clientId', clientId.toString());
  
  // Add variant as a direct parameter if it's 'dark'
  if (variant === 'dark') params.append('variant', 'dark');
  
  // Add all other parameters
  if (format) params.append('format', format);
  if (size) params.append('size', size.toString());
  if (preserveRatio) params.append('preserveRatio', 'true');
  if (preserveVector) params.append('preserveVector', 'true');
  
  // Add cache buster to prevent browser caching
  params.append('t', Date.now().toString());
  
  // CRITICAL FIX: Return the complete URL ensuring parameters are properly formatted
  // This ensures client ID is always included in download requests
  return `/api/assets/${assetId}/file?${params.toString()}`;
}

/**
 * Downloads a file directly using a secure URL with client ID verification
 */
export function downloadAssetFile(
  assetId: number,
  clientId: number,
  fileName: string,
  options: {
    format?: string;
    size?: number;
    variant?: 'dark' | 'light';
    preserveRatio?: boolean; 
    preserveVector?: boolean;
  } = {}
) {
  // Create the secure URL with client ID
  const url = createSecureAssetUrl(assetId, clientId, options);
  
  // Log the request for debugging purposes
  console.log(
    `Downloading ${options.format || 'file'} for ID: ${assetId}, ` +
    `Name: ${fileName}, Client: ${clientId}, Size: ${options.size || 'original'}`
  );
  
  // Create a hidden download link
  const container = document.createElement('div');
  container.style.display = 'none';
  document.body.appendChild(container);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  container.appendChild(link);
  link.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(container);
  }, 100);
  
  return true;
}