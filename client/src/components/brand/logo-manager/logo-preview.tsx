import type { BrandAsset } from "@shared/schema";
import type { ParsedLogoData } from "./logo-utils";

interface LogoPreviewProps {
    logo: BrandAsset;
    parsedData: ParsedLogoData;
    variant: "light" | "dark";
    imageUrl: string;
  }
  
  export function LogoPreview({
    logo,
    parsedData,
    variant,
    imageUrl,
  }: LogoPreviewProps) {
    return (
      <div className="asset-display__preview-image-container">
        {parsedData.format === "svg" ? (
          <object
            data={
              variant === "dark" && parsedData.hasDarkVariant
                ? `/api/assets/${logo.id}/file?variant=dark`
                : imageUrl
            }
            type="image/svg+xml"
            className="asset-display__preview-image"
          >
            <img
              src={
                variant === "dark" && parsedData.hasDarkVariant
                  ? `/api/assets/${logo.id}/file?variant=dark`
                  : imageUrl
              }
              className="asset-display__preview-image"
              alt={logo.name || "SVG Logo"}
              onError={(e) => {
                console.error("Error loading SVG:", imageUrl);
                e.currentTarget.src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="m9.88 9.88 4.24 4.24"/%3E%3Cpath d="m9.88 14.12 4.24-4.24"/%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E';
              }}
            />
          </object>
        ) : (
          <img
            src={
              variant === "dark" && parsedData.hasDarkVariant
                ? `/api/assets/${logo.id}/file?variant=dark`
                : imageUrl
            }
            alt={logo.name}
            className="asset-display__preview-image"
            style={{
              filter:
                variant === "dark" && !parsedData.hasDarkVariant
                  ? "invert(1) brightness(1.5)"
                  : "none",
            }}
            onError={(e) => {
              console.error("Error loading image:", imageUrl);
              e.currentTarget.src =
                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Cpath d="m9.88 9.88 4.24 4.24"/%3E%3Cpath d="m9.88 14.12 4.24-4.24"/%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E';
            }}
          />
        )}
      </div>
    );
  }