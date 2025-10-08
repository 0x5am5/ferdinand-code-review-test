import type { BrandAsset } from "@shared/schema";
import type { ParsedLogoData } from "../logo-utils";
import { AppIconDownloadButton } from "./app-icon-download-button";
import { FaviconDownloadButton } from "./favicon-download-button";
import { StandardLogoDownloadButton } from "./standard-logo-download-button";

interface LogoDownloadButtonProps {
  logo: BrandAsset;
  imageUrl: string;
  variant: "light" | "dark";
  parsedData: ParsedLogoData;
}

export function LogoDownloadButton({
  logo,
  imageUrl,
  variant,
  parsedData,
}: LogoDownloadButtonProps) {
  if (parsedData.type === "favicon") {
    return (
      <FaviconDownloadButton
        logo={logo}
        imageUrl={imageUrl}
        variant={variant}
        parsedData={parsedData}
      />
    );
  }

  if (parsedData.type === "app-icon") {
    return (
      <AppIconDownloadButton
        logo={logo}
        imageUrl={imageUrl}
        variant={variant}
        parsedData={parsedData}
      />
    );
  }

  return (
    <StandardLogoDownloadButton
      logo={logo}
      imageUrl={imageUrl}
      variant={variant}
      parsedData={parsedData}
    />
  );
}
