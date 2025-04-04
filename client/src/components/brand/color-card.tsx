import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { lightenColor, darkenColor } from "@/lib/utils";

export function ColorCard(props: {
  name: string;
  hex: string;
  lighter?: boolean;
  darker?: boolean;
  amount?: number;
}) {
  const { name, hex, lighter = false, darker = false, amount = 20 } = props;
  const { toast } = useToast();
  
  // Apply adjustments if needed
  let displayColor = hex;
  if (lighter) {
    displayColor = lightenColor(hex, amount);
  } else if (darker) {
    displayColor = darkenColor(hex, amount);
  }
  
  const copyHex = () => {
    navigator.clipboard.writeText(displayColor);
    toast({
      title: "Copied!",
      description: `${displayColor} has been copied to your clipboard.`,
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
        <code className="text-xs font-mono">{displayColor}</code>
        {(lighter || darker) && (
          <div className="mt-2 text-xs text-muted-foreground">
            {lighter && `${amount}% lighter than ${hex}`}
            {darker && `${amount}% darker than ${hex}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
