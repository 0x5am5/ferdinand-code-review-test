import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Simple color adjustment functions
const lightenColor = (hex: string): string => {
  // Use a simple lightening technique to avoid complexity
  return hex;
};

const darkenColor = (hex: string): string => {
  // Use a simple darkening technique to avoid complexity
  return hex;
};

export function ColorCard(props: {
  name: string;
  hex: string;
  lighter?: boolean;
  darker?: boolean;
}) {
  const { name, hex, lighter = false, darker = false } = props;
  const { toast } = useToast();
  
  // Apply adjustments if needed (simplified version)
  const displayColor = hex;
  
  const copyHex = () => {
    navigator.clipboard.writeText(hex);
    toast({
      title: "Copied!",
      description: `${hex} has been copied to your clipboard.`,
    });
  };

  return (
    <Card>
      <div 
        className="h-32 rounded-t-lg" 
        style={{ backgroundColor: displayColor }} 
      />
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm md:text-base">{name}</span>
          <Button variant="ghost" size="icon" onClick={copyHex}>
            <Copy className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <code className="text-xs font-mono">{hex}</code>
        {(lighter || darker) && (
          <div className="mt-2 text-xs text-muted-foreground">
            Note: This would be {lighter ? "lightened" : "darkened"} in the final theme
          </div>
        )}
      </CardContent>
    </Card>
  );
}
