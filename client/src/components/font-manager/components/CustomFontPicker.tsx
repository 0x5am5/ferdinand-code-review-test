import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import React, { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomFontPickerProps } from "../types";

export function CustomFontPicker({
  onFontUpload,
  isLoading,
}: CustomFontPickerProps) {
  const _customFontNameId = useId();
  const _fontUploadId = useId();
  const [fontName, setFontName] = useState("");
  const [selectedWeights, setSelectedWeights] = useState<string[]>(["400"]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleSubmit = () => {
    if (!selectedFiles || selectedFiles.length === 0 || !fontName.trim()) {
      return;
    }
    onFontUpload(selectedFiles, fontName.trim(), selectedWeights);
    setFontName("");
    setSelectedWeights(["400"]);
    setSelectedFiles(null);
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };

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
  const allowedFormats = ["OTF", "TTF", "WOFF", "WOFF2", "EOT", "SVG", "CFF"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border rounded-lg bg-white/50 border-dashed space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Upload Custom Font</h3>
          <p className="text-sm text-muted-foreground">
            Upload your own font files
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="customFontName" className="text-sm font-medium">
            Font Name
          </Label>
          <Input
            id={_customFontNameId}
            value={fontName}
            onChange={(e) => setFontName(e.target.value)}
            placeholder="e.g., My Custom Font"
            className="mt-1"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Upload Font Files</Label>
          <button
            type="button"
            className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById(_fontUploadId)?.click()}
            aria-label="Drag and drop font files or click to upload"
          >
            <input
              type="file"
              multiple
              accept=".otf,.ttf,.woff,.woff2,.eot,.svg,.cff"
              onChange={handleFileChange}
              className="hidden"
              id={_fontUploadId}
              disabled={isLoading}
            />
            <label htmlFor={_fontUploadId} className="cursor-pointer">
              <div className="space-y-2">
                <Plus className="h-8 w-8 mx-auto text-gray-400" />
                <div>
                  <p className="text-sm font-medium">
                    {selectedFiles && selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected`
                      : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: {allowedFormats.join(", ")}
                  </p>
                </div>
              </div>
            </label>

            {selectedFiles && selectedFiles.length > 0 && (
              <div className="mt-3 text-left">
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Selected files:
                </p>
                {Array.from(selectedFiles).map((file) => (
                  <div
                    key={`${file.name}-${file.size}`}
                    className="text-xs text-gray-500 truncate"
                  >
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                ))}
              </div>
            )}
          </button>
        </div>

        <div>
          <Label className="text-sm font-medium">Font Weights</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {allWeights.map((weight) => (
              <div key={weight} className="flex items-center space-x-2">
                <Checkbox
                  id={`custom-weight-${weight}`}
                  checked={selectedWeights.includes(weight)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedWeights([...selectedWeights, weight]);
                    } else {
                      setSelectedWeights(
                        selectedWeights.filter((w) => w !== weight)
                      );
                    }
                  }}
                  disabled={isLoading}
                />
                <Label htmlFor={`custom-weight-${weight}`} className="text-sm">
                  {weight}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={
            !selectedFiles ||
            selectedFiles.length === 0 ||
            !fontName.trim() ||
            isLoading
          }
          className="w-full"
        >
          {isLoading ? "Uploading Font..." : "Upload Custom Font"}
        </Button>
      </div>
    </motion.div>
  );
}