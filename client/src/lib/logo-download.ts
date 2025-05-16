/**
 * CRITICAL FIX: Logo Download Utility
 * 
 * This utility ensures that client IDs are always included in logo download URLs
 * to prevent the issue where clients download the Summa logo instead of their own logo.
 */

import { BrandAsset } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { createSecureAssetUrl } from "./secure-asset-url";

/**
 * Creates a secure URL for downloading a logo with client ID verification
 */
export function createSecureLogoUrl(
  logo: BrandAsset, 
  options: {
    format?: string;
    size?: number;
    variant?: 'light' | 'dark';
    preserveVector?: boolean;
  } = {}
): string {
  // CRITICAL FIX: Use the central secure asset URL generator 
  // This ensures client ID is always included in the URL
  return createSecureAssetUrl(logo.id, logo.clientId, {
    format: options.format,
    size: options.size,
    variant: options.variant,
    preserveVector: options.preserveVector,
    preserveRatio: true
  });
}

/**
 * Initiates the download of a logo file with the specified format
 */
export function downloadLogoFile(
  logo: BrandAsset,
  format: string,
  variant: 'light' | 'dark' = 'light'
): void {
  try {
    console.log(`Downloading ${format} for logo ID: ${logo.id}, Name: ${logo.name}, Client ID: ${logo.clientId}`);
    
    // Create the download container
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);
    
    // Create and trigger the download link with secure URL that includes clientId
    const link = document.createElement('a');
    link.href = createSecureLogoUrl(logo, { format, variant, preserveVector: true });
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
 * Downloads a specific PNG size of a logo
 */
export function downloadLogoSize(
  logo: BrandAsset,
  size: number,
  variant: 'light' | 'dark' = 'light'
): void {
  try {
    console.log(`Downloading ${size}px PNG for ID: ${logo.id}, Name: ${logo.name}, Client: ${logo.clientId}`);
    
    // Create the download container
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);
    
    // Create and trigger the download link with secure URL that includes clientId
    const link = document.createElement('a');
    link.href = createSecureLogoUrl(logo, { format: 'png', size, variant });
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
 * Downloads a ZIP package containing multiple logo sizes and formats
 */
export async function downloadLogoPackage(
  logo: BrandAsset,
  variant: 'light' | 'dark' = 'light'
): Promise<void> {
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
    
    // Create a folder structure
    const clientName = logo.name.replace(/[^a-z0-9]/gi, '-').toLowerCase(); 
    const pngFolder = zip.folder("PNG");
    const vectorFolder = zip.folder("Vector");
    
    if (!pngFolder || !vectorFolder) {
      throw new Error("Failed to create folders in ZIP archive");
    }
    
    // Fetch promises for all the files
    const fetchPromises = [];
    
    // Add PNG files in different sizes
    for (const size of sizes) {
      // Use secure URL that includes clientId
      const url = createSecureLogoUrl(logo, { format: 'png', size, variant });
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
            // Verify buffer size to ensure we're not saving an empty or corrupt file
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
      // Use secure URL that includes clientId
      const url = createSecureLogoUrl(logo, { format, variant, preserveVector: true });
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
            // Verify buffer size to ensure we're not saving an empty or corrupt file
            if (buffer.byteLength < 100) {
              console.warn(`Warning: Small file size (${buffer.byteLength} bytes) for ${filename}`);
            }
            vectorFolder.file(filename, buffer);
          })
      );
    }
    
    try {
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
      console.error("Error in file processing:", error);
      toast({
        title: "Download failed",
        description: "There was an error processing some files for your logo package.",
        variant: "destructive"
      });
    }
  } catch (error) {
    console.error("Error creating download package:", error);
    toast({
      title: "Download failed",
      description: "There was an error creating your logo package. Please try again.",
      variant: "destructive"
    });
  }
}