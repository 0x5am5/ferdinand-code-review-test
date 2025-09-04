import { Moon, Sun } from "lucide-react";
import { useState } from "react";

interface AssetDisplayProps {
  renderActions: (variant: "light" | "dark") => React.ReactNode;
  _onFileUpload: (file: File, variant: "light" | "dark") => void;
  renderAsset: (variant: "light" | "dark") => React.ReactNode;
  supportsVariants?: boolean;
  description: string;
  className: string;
}

export function AssetDisplay({
  renderActions,
  _onFileUpload,
  renderAsset,
  supportsVariants = true,
  description,
  className,
}: AssetDisplayProps) {
  const [variant, setVariant] = useState<"light" | "dark">("light");

  return (
    <div className={`asset-display ${className}`}>
      <div className="asset-display__info">
        <p className="asset-display__info-description">{description}</p>
      </div>

      <div className="asset-display__preview">
        <div
          className={`asset-display__preview-container ${
            variant === "light"
              ? "asset-display__preview-container--light"
              : "asset-display__preview-container--dark"
          }`}
        >
          <div className="asset-display__preview-nav">
            {supportsVariants && (
              <div className="asset-display__preview-background-toggle">
                <div className="asset-display__preview-background-toggle-tabs">
                  <button
                    type="button"
                    data-state={variant === "light" ? "active" : "inactive"}
                    onClick={() => setVariant("light")}
                  >
                    <Sun className="h-4 w-4" />
                    Light Background
                  </button>
                  <button
                    type="button"
                    data-state={variant === "dark" ? "active" : "inactive"}
                    onClick={() => setVariant("dark")}
                  >
                    <Moon className="h-4 w-4" />
                    Dark Background
                  </button>
                </div>
              </div>
            )}

            <div
              className={`asset-display__preview-controls ${variant === "light" ? "light" : "dark"}`}
            >
              {renderActions(variant)}
            </div>
          </div>

          {renderAsset(variant)}
        </div>
      </div>
    </div>
  );
}
