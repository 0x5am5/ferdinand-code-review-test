import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ColorCardProps {
  name: string;
  hex: string;
}

export function ColorCard({ name, hex }: ColorCardProps) {
  const { toast } = useToast();

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
        style={{ backgroundColor: hex }} 
      />
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{name}</span>
          <Button variant="ghost" size="icon" onClick={copyHex}>
            <Copy className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <code className="text-sm font-mono">{hex}</code>
      </CardContent>
    </Card>
  );
}
