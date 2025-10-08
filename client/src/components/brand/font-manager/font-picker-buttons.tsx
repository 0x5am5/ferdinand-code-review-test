import { Plus, Type } from "lucide-react";
import type { FontPickerButtonsProps } from "./types";

export function FontPickerButtons({
  onGoogleFontClick,
  onAdobeFontClick,
  onCustomFontClick,
}: FontPickerButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <button
        type="button"
        onClick={onGoogleFontClick}
        className="p-6 border rounded-lg bg-white border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer shadow-sm"
        style={{ minHeight: "200px" }}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Type className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-sm">Add Google Font</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Browse Google Fonts
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={onAdobeFontClick}
        className="p-6 border rounded-lg bg-white border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer shadow-sm"
        style={{ minHeight: "200px" }}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Type className="h-6 w-6 text-primary stroke-1" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-sm">Add Adobe Font</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Browse Adobe Fonts
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={onCustomFontClick}
        className="p-6 border rounded-lg bg-white border-dashed flex flex-col items-center justify-center gap-3 transition-colors hover:bg-white/70 cursor-pointer shadow-sm"
        style={{ minHeight: "200px" }}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-sm">Add Custom Font</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Upload font files
          </p>
        </div>
      </button>
    </div>
  );
}
