/**
 * CRITICAL FIX: Secure Logo Download Component
 * 
 * This component ensures that client IDs are always included in logo download URLs
 * to prevent the issue where clients download the Summa logo instead of their own logo.
 */

import { useState } from "react";
import { BrandAsset } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface LogoDownloadProps {
  logo: BrandAsset;
  variant: 'light' | 'dark';
  buttonText?: string;
  className?: string;
}

/**
 * Creates a secure URL for downloading a logo file with client ID verification
 */
function createSecureLogoUrl(
  logo: BrandAsset, 
  options: {
    format?: string;
    size?: number;
    variant?: 'light' | 'dark';
    preserveVector?: boolean;
  } = {}
): string {
  // Build URL parameters with URLSearchParams for proper encoding
  const params = new URLSearchParams();
  
  // CRITICAL FIX: Always include clientId parameter first
  params.append('clientId', logo.clientId.toString());
  
  // Add variant parameter if provided
  if (options.variant === 'dark') {
    params.append('variant', 'dark');
  }
  
  // Add format parameter if provided
  if (options.format) {
    params.append('format', options.format);
  }
  
  // Add size parameter if provided
  if (options.size) {
    params.append('size', options.size.toString());
  }
  
  // Add preserveVector parameter if true
  if (options.preserveVector) {
    params.append('preserveVector', 'true');
  }
  
  // Always preserve aspect ratio
  params.append('preserveRatio', 'true');
  
  // Add cache busting parameter
  params.append('t', Date.now().toString());
  
  // Return the complete URL
  return `/api/assets/${logo.id}/file?${params.toString()}`;
}

/**
 * Securely download a single logo file with proper client ID
 */
export function FixedLogoDownload({ logo, variant, buttonText = "Download", className }: LogoDownloadProps) {
  const { toast } = useToast();
  
  const downloadLogo = (format: string = 'svg', size?: number) => {
    try {
      // Log download information for debugging
      console.log(`Downloading ${format} format of logo: ID ${logo.id}, Name: ${logo.name}, Client: ${logo.clientId}`);
      
      // Create an invisible container for the download link
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);
      
      // Create the secure URL with client ID
      const url = createSecureLogoUrl(logo, {
        format,
        size,
        variant,
        preserveVector: !size // Preserve vector format if no specific size
      });
      
      // Create and trigger the download link
      const link = document.createElement('a');
      link.href = url;
      
      // Set filename based on format and size
      if (size) {
        link.download = `${logo.name}-${size}px${variant === 'dark' ? '-Dark' : ''}.${format}`;
      } else {
        link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;
      }
      
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
  };
  
  // Function to download a package with all logo sizes and formats
  const downloadAllLogos = async () => {
    try {
      toast({
        title: "Preparing download package",
        description: "Creating ZIP file with all logo sizes...",
      });
      
      // Define sizes to include
      const sizes = [300, 800, 2000];
      
      // Create ZIP archive
      const zip = new JSZip();
      
      // Create folder structure
      const clientName = logo.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const pngFolder = zip.folder("PNG");
      const vectorFolder = zip.folder("Vector");
      
      if (!pngFolder || !vectorFolder) {
        throw new Error("Failed to create folders in ZIP archive");
      }
      
      // Fetch promises for different files
      const fetchPromises = [];
      
      // Add PNG files in different sizes
      for (const size of sizes) {
        const url = createSecureLogoUrl(logo, {
          format: 'png',
          size,
          variant
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
              pngFolder.file(filename, buffer);
            })
        );
      }
      
      // Add vector files
      const vectorFormats = ['svg', 'eps', 'ai'];
      for (const format of vectorFormats) {
        const url = createSecureLogoUrl(logo, {
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
              vectorFolder.file(filename, buffer);
            })
        );
      }
      
      // Wait for all fetches to complete
      await Promise.all(fetchPromises);
      
      // Generate and download the ZIP file
      const content = await zip.generateAsync({ type: "blob" });
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
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => downloadLogo()}
    >
      <Download className="mr-2 h-4 w-4" />
      {buttonText}
    </Button>
  );
}

/**
 * Download a specific logo size as PNG
 */
export function FixedLogoSizeDownload({ logo, variant, size, className }: LogoDownloadProps & { size: number }) {
  const { toast } = useToast();
  
  const downloadSize = () => {
    try {
      // Log download information for debugging
      console.log(`Downloading ${size}px PNG of logo: ID ${logo.id}, Name: ${logo.name}, Client: ${logo.clientId}`);
      
      // Create an invisible container for the download link
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);
      
      // Create the secure URL with client ID
      const url = createSecureLogoUrl(logo, {
        format: 'png',
        size,
        variant
      });
      
      // Create and trigger the download link
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
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={downloadSize}
    >
      <Download className="mr-2 h-4 w-4" />
      {size}px
    </Button>
  );
}

/**
 * Download all logo files as a ZIP package
 */
export function FixedLogoPackageDownload({ logo, variant, className }: LogoDownloadProps) {
  const { toast } = useToast();
  
  const downloadPackage = async () => {
    try {
      toast({
        title: "Preparing download package",
        description: "Creating ZIP file with all logo sizes...",
      });
      
      // Define sizes to include
      const sizes = [300, 800, 2000];
      
      // Create ZIP archive
      const zip = new JSZip();
      
      // Create folder structure
      const clientName = logo.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const pngFolder = zip.folder("PNG");
      const vectorFolder = zip.folder("Vector");
      
      if (!pngFolder || !vectorFolder) {
        throw new Error("Failed to create folders in ZIP archive");
      }
      
      // Fetch promises for different files
      const fetchPromises = [];
      
      // Add PNG files in different sizes
      for (const size of sizes) {
        const url = createSecureLogoUrl(logo, {
          format: 'png',
          size,
          variant
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
              pngFolder.file(filename, buffer);
            })
        );
      }
      
      // Add vector files
      const vectorFormats = ['svg', 'eps', 'ai'];
      for (const format of vectorFormats) {
        const url = createSecureLogoUrl(logo, {
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
              vectorFolder.file(filename, buffer);
            })
        );
      }
      
      // Wait for all fetches to complete
      await Promise.all(fetchPromises);
      
      // Generate and download the ZIP file
      const content = await zip.generateAsync({ type: "blob" });
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
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={downloadPackage}
    >
      <Download className="mr-2 h-4 w-4" />
      Download All
    </Button>
  );
}