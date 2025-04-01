import { Button } from "@/components/ui/button";
import { useContext, useCallback } from "react";
import { generateCoreScssVariables, DesignSystem } from "@/utils/design-system-mapper";
import { ThemeContext } from "@/contexts/ThemeContext";
import { toast } from "@/hooks/use-toast";

/**
 * VariablesExporter Component
 * 
 * Allows users to export the current design system as SCSS variables
 * that can be used in a structured SCSS system
 */
export function VariablesExporter() {
  const { designSystem, draftDesignSystem } = useContext(ThemeContext);
  
  // Use the draft system if available, otherwise use the current design system
  const activeSystem: DesignSystem = draftDesignSystem || designSystem;
  
  const handleExport = useCallback(() => {
    // Generate the SCSS variables string
    const scssVariables = generateCoreScssVariables(activeSystem);
    
    // Create a blob with the SCSS content
    const blob = new Blob([scssVariables], { type: 'text/scss' });
    
    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a link element
    const a = document.createElement('a');
    a.href = url;
    a.download = '_core-generated.scss';
    
    // Append the link to the body
    document.body.appendChild(a);
    
    // Click the link to trigger the download
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "SCSS Variables Exported",
      description: "Your design system variables have been exported as SCSS variables",
    });
  }, [activeSystem]);
  
  const copyToClipboard = useCallback(() => {
    // Generate the SCSS variables string
    const scssVariables = generateCoreScssVariables(activeSystem);
    
    // Copy to clipboard
    navigator.clipboard.writeText(scssVariables).then(() => {
      toast({
        title: "Copied to Clipboard",
        description: "SCSS variables have been copied to your clipboard",
      });
    }, (err) => {
      console.error('Failed to copy text: ', err);
      toast({
        title: "Copy Failed",
        description: "Failed to copy variables to clipboard",
        variant: "destructive",
      });
    });
  }, [activeSystem]);
  
  return (
    <div className="rounded-md border p-4 space-y-4">
      <h3 className="text-lg font-medium">Export Design Tokens</h3>
      <p className="text-sm text-muted-foreground">
        Export your design system as SCSS variables for use in your codebase.
        These variables will maintain the structured approach to styling.
      </p>
      <div className="flex gap-2">
        <Button onClick={handleExport} variant="default">
          Export as SCSS
        </Button>
        <Button onClick={copyToClipboard} variant="outline">
          Copy to Clipboard
        </Button>
      </div>
    </div>
  );
}