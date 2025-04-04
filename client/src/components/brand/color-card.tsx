
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
    <Card className="group w-full">
      <div 
        className="relative h-32 rounded-t-lg" 
        style={{ backgroundColor: displayColor }} 
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 bg-black/20 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={copyHex}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardHeader>
        <CardTitle className="text-sm md:text-base">{name}</CardTitle>
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
