import { LogoType, type BrandAsset, DEFAULT_SECTION_DESCRIPTIONS } from "@shared/schema";

export interface ParsedLogoData {
  type: string;
  format: string;
  hasDarkVariant?: boolean;
  isDarkVariant?: boolean;
  figmaLink?: string;
  fileName?: string;
  description?: string;
}

/**
 * Get default description for a logo type
 * @param type - The logo type (main, vertical, horizontal, square, app_icon, favicon)
 * @returns Default description for the logo section
 */
export function getDefaultLogoDescription(type: string): string {
  const descriptions: Record<string, string> = {
    [LogoType.MAIN]: DEFAULT_SECTION_DESCRIPTIONS.LOGO_MAIN,
    [LogoType.VERTICAL]: DEFAULT_SECTION_DESCRIPTIONS.LOGO_VERTICAL,
    [LogoType.HORIZONTAL]: DEFAULT_SECTION_DESCRIPTIONS.LOGO_HORIZONTAL,
    [LogoType.SQUARE]: DEFAULT_SECTION_DESCRIPTIONS.LOGO_SQUARE,
    [LogoType.APP_ICON]: DEFAULT_SECTION_DESCRIPTIONS.LOGO_APP_ICON,
    [LogoType.FAVICON]: DEFAULT_SECTION_DESCRIPTIONS.LOGO_FAVICON,
  };

  return descriptions[type] || "";
}

export function parseBrandAssetData(logo: BrandAsset): ParsedLogoData | null {
  try {
    if (!logo.data) {
      console.warn("Logo data is missing:", logo);
      return null;
    }
    const data =
      typeof logo.data === "string" ? JSON.parse(logo.data) : logo.data;
    if (!data.type || !data.format) {
      console.warn("Invalid logo data format:", data);
      return null;
    }
    return data as ParsedLogoData;
  } catch (error: unknown) {
    console.error("Error parsing logo data:", error, logo);
    return null;
  }
}

/**
 * Generate a URL for serving BRAND ASSETS (logos, colors, fonts) with optional format conversion
 *
 * IMPORTANT: This function generates URLs for the `/api/assets/:assetId/file` endpoint,
 * which serves BRAND ASSETS ONLY (from `brand_assets` table), NOT file assets.
 *
 * The endpoint provides:
 * - Format conversion (SVG → PNG, JPG, PDF, AI)
 * - Dark/light variant switching for logos
 * - Dynamic image resizing
 * - CDN-friendly caching
 *
 * @param assetId - ID of the brand asset (from brand_assets table)
 * @param clientId - Client ID for permission validation
 * @param options - Optional transformations:
 *   - format: Target format (png, jpg, pdf, ai, svg) - triggers conversion
 *   - size: Maximum dimension in pixels for resizing
 *   - variant: Logo variant ("dark" | "light") - switches between variants
 *   - preserveRatio: Maintain aspect ratio during resize (default: true)
 *   - preserveVector: Keep SVG as vector when resizing (default: false)
 *
 * @returns Full URL with query parameters for brand asset serving
 *
 * @example
 * // Get original logo
 * getSecureAssetUrl(123, 456)
 *
 * @example
 * // Get dark variant as PNG at 200px max dimension
 * getSecureAssetUrl(123, 456, { variant: "dark", format: "png", size: 200 })
 *
 * NOTE: File assets (documents, images from file storage) use `/api/assets/:assetId/download`
 * instead, which provides direct downloads without conversion.
 */
export function getSecureAssetUrl(
  assetId: number,
  clientId: number,
  options: {
    format?: string;
    size?: number;
    variant?: "dark" | "light";
    preserveRatio?: boolean;
    preserveVector?: boolean;
  } = {}
) {
  const {
    format,
    size,
    variant,
    preserveRatio = true,
    preserveVector = false,
  } = options;

  const url = new URL(`/api/assets/${assetId}/file`, window.location.origin);

  url.searchParams.append("clientId", clientId.toString());
  url.searchParams.append("t", Date.now().toString());

  if (variant === "dark") url.searchParams.append("variant", "dark");
  if (format) url.searchParams.append("format", format);
  if (size) {
    url.searchParams.append("size", size.toString());
    url.searchParams.append("preserveRatio", preserveRatio.toString());
  }
  if (preserveVector) url.searchParams.append("preserveVector", "true");

  console.log(`Generated download URL for asset ${assetId}: ${url.toString()}`);
  return url.toString();
}
