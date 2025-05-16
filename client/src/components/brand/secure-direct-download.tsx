/**
 * CRITICAL FIX: Direct Secure Download Component
 * 
 * This component provides a standalone solution that ensures client IDs 
 * are properly included in all logo download URLs.
 */

import { BrandAsset } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SecureDownloadProps {
  logo: BrandAsset;
  format?: string;
  size?: number;
  variant?: 'light' | 'dark';
  children?: React.ReactNode;
  className?: string;
}

/**
 * Creates a secure URL for downloading a logo with proper client ID
 */
export function createSecureUrl(
  logo: BrandAsset, 
  options: {
    format?: string;
    size?: number;
    variant?: 'light' | 'dark';
    preserveVector?: boolean;
  } = {}
): string {
  // Build a secure URL that always includes client ID parameter
  const params = new URLSearchParams();
  
  // Always include client ID as the first parameter
  params.append('clientId', logo.clientId.toString());
  
  // Add variant parameter
  if (options.variant === 'dark') {
    params.append('variant', 'dark');
  }
  
  // Add other parameters as needed
  if (options.format) {
    params.append('format', options.format);
  }
  
  if (options.size) {
    params.append('size', options.size.toString());
  }
  
  // Vector preservation is important for maintaining quality
  if (options.preserveVector) {
    params.append('preserveVector', 'true');
  }
  
  // Always preserve ratio and add cache buster
  params.append('preserveRatio', 'true');
  params.append('t', Date.now().toString());
  
  // Return properly formatted URL
  return `/api/assets/${logo.id}/file?${params.toString()}`;
}

/**
 * Direct download component that ensures client IDs are included in URLs
 */
export function SecureDirectDownload({ 
  logo, 
  format = 'svg', 
  size, 
  variant = 'light',
  children,
  className
}: SecureDownloadProps) {
  const { toast } = useToast();
  
  const handleDownload = () => {
    try {
      // Log the download action for debugging
      console.log(`Securely downloading logo: ID ${logo.id}, Client ${logo.clientId}, Format ${format}, Size ${size || 'original'}`);
      
      // Create container for download link
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);
      
      // Create secure URL with client ID
      const url = createSecureUrl(logo, {
        format,
        size,
        variant,
        preserveVector: !size // Preserve vector quality if no size specified
      });
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      
      // Set appropriate filename
      if (size) {
        link.download = `${logo.name}-${size}px${variant === 'dark' ? '-Dark' : ''}.${format}`;
      } else {
        link.download = `${logo.name}${variant === 'dark' ? '-Dark' : ''}.${format}`;
      }
      
      // Trigger the download
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
        description: `There was an error downloading the file.`,
        variant: "destructive"
      });
    }
  };
  
  return (
    <Button variant="outline" size="sm" className={className} onClick={handleDownload}>
      {children || (
        <>
          <Download className="mr-2 h-4 w-4" />
          Download {format.toUpperCase()}
        </>
      )}
    </Button>
  );
}