/**
 * CRITICAL FIX: Secure logo download utility
 * This provides secure download functions that always include the client ID in URLs
 * to ensure clients always download their own logos rather than default/Summa logos
 */
import { BrandAsset } from '@shared/schema';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { toast } from '@/hooks/use-toast';

/**
 * Helper function to get a secure URL for downloading assets
 * This ensures the client ID is always included to prevent downloading the wrong logo
 */
export function getSecureAssetUrl(assetId: number, clientId: number, options: {
  format?: string;
  size?: number;
  variant?: 'light' | 'dark';
  preserveRatio?: boolean;
  preserveVector?: boolean;
} = {}) {
  // Create URLSearchParams for proper parameter encoding
  const params = new URLSearchParams();
  
  // CRITICAL FIX: Always include clientId parameter first
  params.append('clientId', clientId.toString());
  
  // Add variant parameter if provided
  if (options.variant === 'dark') {
    params.append('variant', 'dark');
  }
  
  // Add all other optional parameters
  if (options.format) params.append('format', options.format);
  if (options.size) params.append('size', options.size.toString());
  if (options.preserveRatio) params.append('preserveRatio', 'true');
  if (options.preserveVector) params.append('preserveVector', 'true');
  
  // Add cache busting parameter to prevent browsers from using cached versions
  params.append('t', Date.now().toString());
  
  // Build the final URL with proper encoding
  return `/api/assets/${assetId}/file?${params.toString()}`;
}

/**
 * Function to download a specific file format (SVG, EPS, AI, etc.)
 */
export function downloadLogoFile(logo: BrandAsset, format: string, variant: 'light' | 'dark' = 'light') {
  try {
    console.log(`Downloading ${format} file for logo ID: ${logo.id}, Name: ${logo.name}, Client: ${logo.clientId}`);
    
    // Create download container
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);
    
    // Create secure URL that includes client ID
    const url = getSecureAssetUrl(logo.id, logo.clientId, {
      format,
      variant,
      preserveVector: true
    });
    
    // Create and trigger download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;
    container.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(container);
    }, 100);
  } catch (error) {
    console.error(`Error downloading ${format} file:`, error);
    toast({
      title: "Download failed",
      description: `There was an error downloading the ${format.toUpperCase()} file.`,
      variant: "destructive"
    });
  }
}

/**
 * Function to download a specific PNG size
 */
export function downloadLogoSize(logo: BrandAsset, size: number, variant: 'light' | 'dark' = 'light') {
  try {
    console.log(`Downloading ${size}px PNG for logo ID: ${logo.id}, Name: ${logo.name}, Client: ${logo.clientId}`);
    
    // Create download container
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);
    
    // Create secure URL that includes client ID
    const url = getSecureAssetUrl(logo.id, logo.clientId, {
      format: 'png',
      size,
      variant,
      preserveRatio: true
    });
    
    // Create and trigger download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `${logo.name}-${size}px${variant === 'dark' ? '-Dark' : ''}.png`;
    container.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(container);
    }, 100);
  } catch (error) {
    console.error(`Error downloading ${size}px PNG:`, error);
    toast({
      title: "Download failed",
      description: `There was an error downloading the ${size}px PNG file.`,
      variant: "destructive"
    });
  }
}

/**
 * Function to download all logo sizes and formats as a ZIP package
 */
export async function downloadLogoPackage(logo: BrandAsset, variant: 'light' | 'dark' = 'light') {
  try {
    // Show loading toast
    toast({
      title: "Preparing download package",
      description: "Creating ZIP file with all logo sizes...",
    });
    
    // Define sizes to include
    const sizes = [300, 800, 2000];
    console.log(`Creating download package for logo: ID ${logo.id}, Name: ${logo.name}, Client ID: ${logo.clientId}`);
    
    // Create a ZIP archive
    const zip = new JSZip();
    
    // Create a folder structure with client name
    const clientName = logo.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const pngFolder = zip.folder("PNG");
    const vectorFolder = zip.folder("Vector");
    
    if (!pngFolder || !vectorFolder) {
      throw new Error("Failed to create folders in ZIP archive");
    }
    
    // Fetch promises for all files
    const fetchPromises = [];
    
    // Add PNG files in different sizes
    for (const size of sizes) {
      const url = getSecureAssetUrl(logo.id, logo.clientId, {
        format: 'png',
        size,
        variant,
        preserveRatio: true
      });
      
      const filename = `${logo.name}-${size}px${variant === 'dark' ? '-Dark' : ''}.png`;
      
      fetchPromises.push(
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
            }
            return response.arrayBuffer();
          })
          .then(buffer => {
            // Verify buffer size to prevent empty files
            if (buffer.byteLength < 100) {
              console.warn(`Warning: Small file size (${buffer.byteLength} bytes) for ${filename}`);
            }
            pngFolder.file(filename, buffer);
          })
      );
    }
    
    // Add vector files (SVG, EPS, AI)
    const vectorFormats = ['svg', 'eps', 'ai'];
    for (const format of vectorFormats) {
      const url = getSecureAssetUrl(logo.id, logo.clientId, {
        format,
        variant,
        preserveVector: true
      });
      
      const filename = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;
      
      fetchPromises.push(
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
            }
            return response.arrayBuffer();
          })
          .then(buffer => {
            // Verify buffer size to prevent empty files
            if (buffer.byteLength < 100) {
              console.warn(`Warning: Small file size (${buffer.byteLength} bytes) for ${filename}`);
            }
            vectorFolder.file(filename, buffer);
          })
      );
    }
    
    // Wait for all fetches to complete
    await Promise.all(fetchPromises);
    
    // Generate the ZIP file
    const content = await zip.generateAsync({ type: "blob" });
    
    // Trigger download
    saveAs(content, `${clientName}-logos${variant === 'dark' ? '-dark' : ''}.zip`);
    
    toast({
      title: "Download complete",
      description: "Your logo package has been downloaded successfully.",
    });
  } catch (error) {
    console.error("Error creating download package:", error);
    toast({
      title: "Download failed",
      description: "There was an error creating your logo package. Please try again.",
      variant: "destructive"
    });
  }
}