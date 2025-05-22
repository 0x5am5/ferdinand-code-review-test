
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sun, Moon, Upload, Download } from "lucide-react";
import { useState } from "react";

interface AssetDisplayProps {
  renderActions: (variant: 'light' | 'dark') => React.ReactNode;
  onFileUpload: (file: File, variant: 'light' | 'dark') => void;
  renderAsset: (variant: 'light' | 'dark') => React.ReactNode;
  supportsVariants?: boolean;
  description: string;
}

export function AssetDisplay({
  renderActions,
  onFileUpload,
  renderAsset,
  supportsVariants = true,
  description
}: AssetDisplayProps) {
  const [variant, setVariant] = useState<'light' | 'dark'>('light');

  return (
    <div className="asset-display">
      <div className="asset-display__info">
        <p className="asset-display__info-description">
          {description}
        </p>
      </div>

      <div className="asset-display__preview">
        <div 
          className={`asset-display__preview-container ${
            variant === 'light' 
              ? 'asset-display__preview-container--light' 
              : 'asset-display__preview-container--dark'
          }`}
        >
          <div className="asset-display__preview-nav">
            {supportsVariants && (
              <div className="asset-display__preview-background-toggle">
                <div className="asset-display__preview-background-toggle-tabs">
                  <button 
                    data-state={variant === 'light' ? 'active' : 'inactive'} 
                    onClick={() => setVariant('light')}
                  >
                    <Sun className="h-4 w-4" />
                    Light Background
                  </button>
                  <button 
                    data-state={variant === 'dark' ? 'active' : 'inactive'} 
                    onClick={() => setVariant('dark')}
                  >
                    <Moon className="h-4 w-4" />
                    Dark Background
                  </button>
                </div>
              </div>
            )}

            <div className={`asset-display__preview-controls ${variant === 'light' ? 'light' : 'dark'}`}>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onFileUpload(file, variant);
                      }
                    }}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="asset-display__preview-action-button"
                    type="button"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Replace
                  </Button>
                </label>
                <div className="flex gap-2">
                  {renderActions(variant)}
                </div>
              </div>
            </div>
          </div>

          {renderAsset(variant)}
        </div>
      </div>
    </div>
  );
}
