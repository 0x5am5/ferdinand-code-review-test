import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { WeightStyleSelectorProps } from "./types";

export function WeightStyleSelector({
  selectedWeights,
  selectedStyles,
  onWeightChange,
  onStyleChange,
  availableWeights,
}: WeightStyleSelectorProps) {
  const allWeights = [
    "100",
    "200",
    "300",
    "400",
    "500",
    "600",
    "700",
    "800",
    "900",
  ];
  const availableStyles = ["normal", "italic"];

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Font Weights</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {allWeights.map((weight) => {
            const isAvailable = availableWeights.includes(weight);
            const isSelected = selectedWeights.includes(weight);

            return (
              <div key={weight} className="flex items-center space-x-2">
                <Checkbox
                  id={`weight-${weight}`}
                  checked={isSelected}
                  disabled={!isAvailable}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onWeightChange([...selectedWeights, weight]);
                    } else {
                      onWeightChange(
                        selectedWeights.filter((w) => w !== weight)
                      );
                    }
                  }}
                />
                <Label
                  htmlFor={`weight-${weight}`}
                  className={`text-sm ${!isAvailable ? "text-muted-foreground" : ""}`}
                >
                  {weight}
                </Label>
                {!isAvailable && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Font Styles</Label>
        <div className="flex gap-4 mt-2">
          {availableStyles.map((style) => (
            <div key={style} className="flex items-center space-x-2">
              <Checkbox
                id={`style-${style}`}
                checked={selectedStyles.includes(style)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onStyleChange([...selectedStyles, style]);
                  } else {
                    onStyleChange(selectedStyles.filter((s) => s !== style));
                  }
                }}
              />
              <Label htmlFor={`style-${style}`} className="text-sm capitalize">
                {style}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
