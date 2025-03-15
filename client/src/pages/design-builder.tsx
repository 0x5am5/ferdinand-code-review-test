
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

export default function DesignBuilder() {
  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1>Design Builder</h1>
          <p className="text-muted-foreground">
            Build and customize your brand's design system
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Content will be added here */}
        </CardContent>
      </Card>
    </div>
  );
}
