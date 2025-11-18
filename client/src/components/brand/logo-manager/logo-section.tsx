import { PermissionAction, Resource } from "@shared/permissions";
import type { BrandAsset } from "@shared/schema";
import {
  descriptionValidationSchema,
  FILE_FORMATS,
  UserRole,
} from "@shared/schema";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { FileType, Trash2, Upload } from "lucide-react";
import { type DragEvent, useCallback, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { InlineEditable } from "@/components/ui/inline-editable";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
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
  sectionDescription?: string;
  onSectionDescriptionUpdate?: (value: string) => void;
}

export function LogoSection({
  type,
  logos,
  clientId,
  onDeleteLogo,
  queryClient,
  onRemoveSection,
  sectionDescription,
  onSectionDescriptionUpdate,
}: LogoSectionProps) {
  const { toast } = useToast();
  const { user = null } = useAuth();
  const hasLogos = logos.length > 0;
  const [isDarkVariantDragging, setIsDarkVariantDragging] = useState(false);
  const currentType = type;

  // Check if user can edit descriptions
  const canEditDescriptions =
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.EDITOR;

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
          ? `/api/clients/${clientId}/brand-assets/${logo.id}?variant=dark`
          : `/api/clients/${clientId}/brand-assets/${logo.id}`;

      const response = await fetch(endpoint, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
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

  // Mutation for updating logo descriptions
  const updateDescriptionMutation = useMutation({
    mutationFn: async ({
      assetId,
      description,
    }: {
      assetId: number;
      description: string;
    }) => {
      const response = await fetch(
        `/api/clients/${clientId}/brand-assets/${assetId}/description`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update description");
      }

      return response.json();
    },
    onMutate: async ({ assetId, description }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });

      // Snapshot the previous value
      const previousAssets = queryClient.getQueryData([
        `/api/clients/${clientId}/brand-assets`,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        [`/api/clients/${clientId}/brand-assets`],
        (old: BrandAsset[] | undefined) => {
          if (!old) return old;
          return old.map((asset) => {
            if (asset.id !== assetId) return asset;

            const data =
              typeof asset.data === "string"
                ? JSON.parse(asset.data)
                : asset.data;

            const updatedData = { ...data, description };

            return {
              ...asset,
              data: updatedData,
            };
          });
        }
      );

      // Return a context object with the snapshotted value
      return { previousAssets };
    },
    onError: (error: Error, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(
        [`/api/clients/${clientId}/brand-assets`],
        context?.previousAssets
      );
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });
      toast({
        title: "Description saved",
        description: "Logo description has been updated successfully.",
      });
    },
  });

  const handleDescriptionUpdate = (assetId: number, value: string) => {
    updateDescriptionMutation.mutate({
      assetId,
      description: value,
    });
  };

  // Validation function for descriptions
  const validateDescription = (value: string): string | null => {
    const result = descriptionValidationSchema.safeParse(value);
    if (!result.success) {
      return result.error.errors[0]?.message || "Invalid description";
    }
    return null;
  };

  // Handle validation errors with toast
  const handleValidationError = (error: string) => {
    toast({
      title: "Validation Error",
      description: error,
      variant: "destructive",
    });
  };

  return (
    <AssetSection
      title={`${type.charAt(0).toUpperCase() + type.slice(1)} Logo`}
      description={
        sectionDescription ||
        logoDescriptions[type as keyof typeof logoDescriptions]
      }
      isEmpty={!hasLogos}
      onRemoveSection={onRemoveSection}
      sectionType={type}
      enableEditableDescription={true}
      onDescriptionUpdate={onSectionDescriptionUpdate}
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
                  <PermissionGate
                    action={PermissionAction.UPDATE}
                    resource={Resource.BRAND_ASSETS}
                  >
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
                  </PermissionGate>

                  <LogoDownloadButton
                    logo={logo}
                    imageUrl={imageUrl}
                    variant={variant}
                    parsedData={parsedData}
                  />

                  <PermissionGate
                    action={PermissionAction.DELETE}
                    resource={Resource.BRAND_ASSETS}
                  >
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
                  </PermissionGate>
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
              renderDescription={(_variant) => {
                // Use the same description for both light and dark variants
                const currentDescription = parsedData.description;
                const fallbackDescription =
                  logoUsageGuidance[type as keyof typeof logoUsageGuidance];

                if (canEditDescriptions) {
                  return (
                    <InlineEditable
                      value={currentDescription || fallbackDescription || ""}
                      onSave={(value) =>
                        handleDescriptionUpdate(logo.id, value)
                      }
                      inputType="textarea"
                      placeholder={
                        fallbackDescription || "Add a description..."
                      }
                      showControls={true}
                      validate={validateDescription}
                      onValidationError={handleValidationError}
                      ariaLabel="Logo description"
                      className="asset-display__info-description"
                    />
                  );
                }

                return (
                  <p className="asset-display__info-description">
                    {currentDescription || fallbackDescription}
                  </p>
                );
              }}
              supportsVariants={true}
              className=""
            />
          );
        })}
    </AssetSection>
  );
}
