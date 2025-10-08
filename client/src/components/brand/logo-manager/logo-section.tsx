import type { BrandAsset } from "@shared/schema";
import { FILE_FORMATS } from "@shared/schema";
import type { QueryClient } from "@tanstack/react-query";
import { FileType, Trash2, Upload } from "lucide-react";
import { type DragEvent, useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AssetDisplay } from "../asset-display";
import { AssetSection } from "./asset-section";
import { DarkVariantUploader } from "./dark-variant-uploader";
import { LogoDownloadButton } from "./download-buttons/logo-download-button";
import { FileUpload } from "./file-upload";
import { logoDescriptions, logoUsageGuidance } from "./logo-constants";
import { LogoPreview } from "./logo-preview";
import { type ParsedLogoData, parseBrandAssetData } from "./logo-utils";

interface LogoSectionProps {
  type: string;
  logos: BrandAsset[];
  clientId: number;
  onDeleteLogo: (logoId: number, variant: "light" | "dark") => void;
  queryClient: QueryClient;
  onRemoveSection?: (type: string) => void;
}

export function LogoSection({
  type,
  logos,
  clientId,
  onDeleteLogo,
  queryClient,
  onRemoveSection,
}: LogoSectionProps) {
  const { toast } = useToast();
  const hasLogos = logos.length > 0;
  const [isDarkVariantDragging, setIsDarkVariantDragging] = useState(false);
  const currentType = type;

  const handleDarkVariantDragEnter = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDarkVariantDragging(true);
    },
    []
  );

  const handleDarkVariantDragLeave = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDarkVariantDragging(false);
    },
    []
  );

  const handleDarkVariantDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDarkVariantDragging(true);
  }, []);

  const handleFileUpload = async (
    file: File,
    variant: "light" | "dark",
    parsedData: ParsedLogoData,
    logo: BrandAsset
  ) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "name",
        `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Logo`
      );
      formData.append("currentType", currentType);
      formData.append("category", "logo");

      if (variant === "dark") {
        formData.append("isDarkVariant", "true");
        formData.append(
          "data",
          JSON.stringify({
            type: currentType,
            format: file.name.split(".").pop()?.toLowerCase(),
            hasDarkVariant: true,
            isDarkVariant: true,
          })
        );
        formData.append(
          "name",
          `${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Logo (Dark)`
        );
      } else if (parsedData) {
        formData.append("isDarkVariant", "false");
        formData.append(
          "data",
          JSON.stringify({
            type: currentType,
            format: file.name.split(".").pop()?.toLowerCase(),
            hasDarkVariant: parsedData.hasDarkVariant || false,
          })
        );
      }

      const endpoint =
        variant === "dark"
          ? `/api/clients/${clientId}/assets/${logo.id}?variant=dark`
          : `/api/clients/${clientId}/assets/${logo.id}`;

      const response = await fetch(endpoint, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/assets/${logo.id}`],
      });

      toast({
        title: "Success",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} logo ${variant === "dark" ? "dark variant" : ""} updated successfully`,
      });
    } catch (error: unknown) {
      console.error(
        "Error updating logo:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update logo",
        variant: "destructive",
      });
    }
  };

  const handleDarkVariantDrop = (
    e: DragEvent<HTMLElement>,
    parsedData: ParsedLogoData,
    logo: BrandAsset
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDarkVariantDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (
        !fileExtension ||
        !Object.values(FILE_FORMATS)
          .map((f) => f.toLowerCase())
          .includes(fileExtension)
      ) {
        toast({
          title: "Invalid file type",
          description: `File must be one of: ${Object.values(FILE_FORMATS).join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      handleFileUpload(file, "dark", parsedData, logo);
    }
  };

  return (
    <AssetSection
      title={`${type.charAt(0).toUpperCase() + type.slice(1)} Logo`}
      description={logoDescriptions[type as keyof typeof logoDescriptions]}
      isEmpty={!hasLogos}
      onRemoveSection={onRemoveSection}
      sectionType={type}
      uploadComponent={
        <FileUpload
          type={type}
          clientId={clientId}
          onSuccess={() => {}}
          queryClient={queryClient}
        />
      }
      emptyPlaceholder={
        <div className="logo-section__empty-placeholder">
          <FileType className="logo-section__empty-placeholder-icon h-10 w-10" />
          <p>No {type.toLowerCase()} logo uploaded yet</p>
        </div>
      }
    >
      {hasLogos &&
        logos.map((logo) => {
          const parsedData = parseBrandAssetData(logo);
          if (!parsedData) return null;
          const imageUrl = `/api/assets/${logo.id}/file`;

          return (
            <AssetDisplay
              key={logo.id}
              renderActions={(variant) => (
                <>
                  <label className="cursor-pointer">
                    <Input
                      type="file"
                      accept={Object.values(FILE_FORMATS)
                        .map((format) => `.${format}`)
                        .join(",")}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(
                            e.target.files[0],
                            variant,
                            parsedData,
                            logo
                          );
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      className="asset-display__preview-action-button"
                      type="button"
                      onClick={(e) => {
                        const fileInput = e.currentTarget
                          .closest("label")
                          ?.querySelector('input[type="file"]');
                        if (fileInput) {
                          (fileInput as HTMLInputElement).click();
                        }
                      }}
                    >
                      <Upload className="h-3 w-3" />
                      <span>Replace</span>
                    </button>
                  </label>

                  <LogoDownloadButton
                    logo={logo}
                    imageUrl={imageUrl}
                    variant={variant}
                    parsedData={parsedData}
                  />

                  {((variant === "dark" && parsedData.hasDarkVariant) ||
                    variant === "light") && (
                    <button
                      type="button"
                      className="asset-display__preview-action-button"
                      onClick={() => onDeleteLogo(logo.id, variant)}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  )}
                </>
              )}
              renderAsset={(variant) =>
                variant === "dark" && !parsedData.hasDarkVariant ? (
                  <DarkVariantUploader
                    logo={logo}
                    parsedData={parsedData}
                    type={type}
                    clientId={clientId}
                    queryClient={queryClient}
                    isDarkVariantDragging={isDarkVariantDragging}
                    onDragEnter={handleDarkVariantDragEnter}
                    onDragLeave={handleDarkVariantDragLeave}
                    onDragOver={handleDarkVariantDragOver}
                    onDrop={(e) => handleDarkVariantDrop(e, parsedData, logo)}
                  />
                ) : (
                  <LogoPreview
                    logo={logo}
                    parsedData={parsedData}
                    variant={variant}
                    imageUrl={imageUrl}
                  />
                )
              }
              description={
                logoUsageGuidance[type as keyof typeof logoUsageGuidance]
              }
              supportsVariants={true}
              className=""
            />
          );
        })}
    </AssetSection>
  );
}
