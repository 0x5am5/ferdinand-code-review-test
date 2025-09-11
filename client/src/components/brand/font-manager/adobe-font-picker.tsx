import { motion } from "framer-motion";
import { Type } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type {
  AdobeFontData,
  AdobeFontPickerProps,
  AdobeFontsResponse,
} from "./types";

export function AdobeFontPicker({
  onFontSubmit,
  isLoading,
}: AdobeFontPickerProps) {
  const _projectIdInputId = useId();
  const [projectId, setProjectId] = useState("");
  const [isLoadingFonts, setIsLoadingFonts] = useState(false);
  const [availableFonts, setAvailableFonts] = useState<AdobeFontData[]>([]);
  const [selectedFonts, setSelectedFonts] = useState<AdobeFontData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { toast } = useToast();

  const loadProjectFonts = async () => {
    if (!projectId.trim()) {
      setError("Please enter a Project ID");
      return;
    }

    setIsLoadingFonts(true);
    setError(null);
    setAvailableFonts([]);
    setSelectedFonts([]);

    try {
      const response = await fetch(`/api/adobe-fonts/${projectId.trim()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to load fonts");
      }

      const data: AdobeFontsResponse = await response.json();
      setAvailableFonts(data.fonts);

      if (data.fonts.length === 0) {
        setError(
          "No fonts found in this project. Please check your Project ID."
        );
      } else {
        toast({
          title: "Success",
          description: `Found ${data.fonts.length} fonts in your Adobe Fonts project`,
        });
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load fonts";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingFonts(false);
    }
  };

  const handleFontSelection = (font: AdobeFontData, selected: boolean) => {
    if (selected) {
      setSelectedFonts([...selectedFonts, font]);
    } else {
      setSelectedFonts(selectedFonts.filter((f) => f.family !== font.family));
    }
  };

  const handleSubmitSelected = () => {
    if (selectedFonts.length === 0) {
      toast({
        title: "No fonts selected",
        description: "Please select at least one font to add",
        variant: "destructive",
      });
      return;
    }

    // Submit each selected font
    selectedFonts.forEach((font) => {
      onFontSubmit({
        projectId: projectId.trim(),
        fontFamily: font.family,
        weights: font.weights,
      });
    });

    // Reset form
    setProjectId("");
    setAvailableFonts([]);
    setSelectedFonts([]);
    setError(null);
  };

  const filteredFonts = availableFonts.filter(
    (font) =>
      font.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      font.family.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border rounded-lg bg-white/50 border-dashed space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Type className="h-6 w-6 text-primary stroke-1" />
        </div>
        <div>
          <h3 className="font-medium">Add Adobe Font</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Adobe Fonts project
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Project ID Input */}
        <div>
          <Label htmlFor="projectId" className="text-sm font-medium">
            Adobe Fonts Project ID
          </Label>
          <div className="flex gap-2 mt-1">
            <Input
              id={_projectIdInputId}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="e.g., abc1234"
              disabled={isLoading || isLoadingFonts}
              onKeyDown={(e) => e.key === "Enter" && loadProjectFonts()}
            />
            <Button
              onClick={loadProjectFonts}
              disabled={!projectId.trim() || isLoading || isLoadingFonts}
              size="sm"
              className="px-4"
            >
              {isLoadingFonts ? "Loading..." : "Load"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Find this in your Adobe Fonts project URL or embed code
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Font Selection */}
        {availableFonts.length > 0 && (
          <>
            <div>
              <Label className="text-sm font-medium">
                Available Fonts ({availableFonts.length})
              </Label>
              {availableFonts.length > 5 && (
                <Input
                  placeholder="Search fonts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredFonts.map((font) => (
                <div
                  key={font.family}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedFonts.some(
                      (f) => f.family === font.family
                    )}
                    onCheckedChange={(checked) =>
                      handleFontSelection(font, !!checked)
                    }
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">
                        {font.displayName}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {font.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {font.weights.length} weights • {font.foundry}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {font.weights.slice(0, 5).map((weight) => (
                        <Badge
                          key={weight}
                          variant="outline"
                          className="text-xs"
                        >
                          {weight}
                        </Badge>
                      ))}
                      {font.weights.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{font.weights.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedFonts.length > 0 && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                <p className="text-sm font-medium">
                  {selectedFonts.length} font
                  {selectedFonts.length > 1 ? "s" : ""} selected
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedFonts.map((font) => (
                    <Badge
                      key={font.family}
                      variant="default"
                      className="text-xs"
                    >
                      {font.displayName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleSubmitSelected}
              disabled={selectedFonts.length === 0 || isLoading}
              className="w-full"
            >
              {isLoading
                ? "Adding Fonts..."
                : `Add ${selectedFonts.length || ""} Font${selectedFonts.length !== 1 ? "s" : ""}`}
            </Button>
          </>
        )}

        {/* Initial Load Button */}
        {availableFonts.length === 0 &&
          !error &&
          !isLoadingFonts &&
          projectId.trim() && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Enter your Project ID and click Load to see available fonts
              </p>
            </div>
          )}
      </div>
    </motion.div>
  );
}
