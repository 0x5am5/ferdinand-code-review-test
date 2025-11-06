import type { BrandAsset } from "@shared/schema";
import { FILE_FORMATS } from "@shared/schema";
import type { QueryClient } from "@tanstack/react-query";
import { Copy, Upload } from "lucide-react";
import type { DragEvent } from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "./file-upload";
import type { ParsedLogoData } from "./logo-utils";

interface DarkVariantUploaderProps {
  logo: BrandAsset;
  parsedData: ParsedLogoData;
  type: string;
  clientId: number;
  queryClient: QueryClient;
  isDarkVariantDragging: boolean;
  onDragEnter: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: (e: DragEvent<HTMLElement>) => void;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

export function DarkVariantUploader({
  logo,
  parsedData,
  type,
  clientId,
  queryClient,
  isDarkVariantDragging,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: DarkVariantUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyLightAsDark = async () => {
    try {
      const fileResponse = await fetch(`/api/assets/${logo.id}/file`);
      if (!fileResponse.ok)
        throw new Error("Failed to fetch light variant file");

      const fileBlob = await fileResponse.blob();
      const fileName = `${type}_logo_dark.${parsedData.format}`;
      const file = new File([fileBlob], fileName, {
        type: fileResponse.headers.get("content-type") || "image/svg+xml",
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "name",
        `${type.charAt(0).toUpperCase() + type.slice(1)} Logo (Dark)`
      );
      formData.append("type", type);
      formData.append("category", "logo");
      formData.append("isDarkVariant", "true");
      formData.append(
        "data",
        JSON.stringify({
          type,
          format: parsedData.format,
          hasDarkVariant: true,
          isDarkVariant: true,
        })
      );

      const response = await fetch(
        `/api/clients/${clientId}/brand-assets/${logo.id}?variant=dark`,
        {
          method: "PATCH",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      parsedData.hasDarkVariant = true;
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/assets/${logo.id}`],
      });
    } catch (error: unknown) {
      console.error(
        "Error copying light variant as dark:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  const convertToWhite = async () => {
    try {
      const fileResponse = await fetch(`/api/assets/${logo.id}/file`);
      if (!fileResponse.ok)
        throw new Error("Failed to fetch light variant file");

      const svgContent = await fileResponse.text();

      const whiteSvgContent = svgContent
        .replace(/fill="[^"]*"/gi, 'fill="white"')
        .replace(/fill='[^']*'/gi, "fill='white'")
        .replace(/stroke="[^"]*"/gi, 'stroke="white"')
        .replace(/stroke='[^']*'/gi, "stroke='white'")
        .replace(/style="([^"]*)"/gi, (_match, styleContent) => {
          const updatedStyle = styleContent
            .replace(/fill\s*:\s*[^;]+/gi, "fill:white")
            .replace(/stroke\s*:\s*[^;]+/gi, "stroke:white")
            .replace(/color\s*:\s*[^;]+/gi, "color:white")
            .replace(/stop-color\s*:\s*[^;]+/gi, "stop-color:white");
          return `style="${updatedStyle}"`;
        })
        .replace(/style='([^']*)'/gi, (_match, styleContent) => {
          const updatedStyle = styleContent
            .replace(/fill\s*:\s*[^;]+/gi, "fill:white")
            .replace(/stroke\s*:\s*[^;]+/gi, "stroke:white")
            .replace(/color\s*:\s*[^;]+/gi, "color:white")
            .replace(/stop-color\s*:\s*[^;]+/gi, "stop-color:white");
          return `style='${updatedStyle}'`;
        })
        .replace(/fill\s*:\s*[^;}\\s]+/gi, "fill:white")
        .replace(/stroke\s*:\s*[^;}\\s]+/gi, "stroke:white")
        .replace(/color\s*:\s*[^;}\\s]+/gi, "color:white")
        .replace(/stop-color="[^"]*"/gi, 'stop-color="white"')
        .replace(/stop-color='[^']*'/gi, "stop-color='white'")
        .replace(/fill="none"/gi, 'fill="white"')
        .replace(/fill='none'/gi, "fill='white'")
        .replace(/#[0-9a-fA-F]{3,8}/g, "white")
        .replace(/rgb\\([^)]+\\)/gi, "white")
        .replace(/rgba\\([^)]+\\)/gi, "white")
        .replace(/hsl\\([^)]+\\)/gi, "white")
        .replace(/hsla\\([^)]+\\)/gi, "white")
        .replace(/=["']?black["']?/gi, '="white"')
        .replace(/=["']?#000000["']?/gi, '="white"')
        .replace(/=["']?#000["']?/gi, '="white"');

      const svgBlob = new Blob([whiteSvgContent], {
        type: "image/svg+xml",
      });
      const fileName = `${type}_logo_dark.svg`;
      const file = new File([svgBlob], fileName, {
        type: "image/svg+xml",
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "name",
        `${type.charAt(0).toUpperCase() + type.slice(1)} Logo (Dark)`
      );
      formData.append("type", type);
      formData.append("category", "logo");
      formData.append("isDarkVariant", "true");
      formData.append(
        "data",
        JSON.stringify({
          type,
          format: parsedData.format,
          hasDarkVariant: true,
          isDarkVariant: true,
        })
      );

      console.log("Converting light SVG logo to white for dark variant");
      const response = await fetch(
        `/api/clients/${clientId}/brand-assets/${logo.id}?variant=dark`,
        {
          method: "PATCH",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      parsedData.hasDarkVariant = true;
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/assets/${logo.id}`],
      });

      toast({
        title: "Success",
        description: "Logo converted to white for dark variant",
      });
    } catch (error: unknown) {
      console.error(
        "Error converting logo to white:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to convert logo to white",
        variant: "destructive",
      });
    }
  };

  const isSvg =
    parsedData?.format === "svg" ||
    parsedData?.format === "image/svg+xml" ||
    logo.mimeType === "image/svg+xml" ||
    logo.mimeType?.includes("svg") ||
    parsedData?.format?.includes("svg");

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6 mb-[2rem] pr-[5vh] pl-[5vh]">
      <div className="flex flex-col items-center gap-2 mt-[2rem]">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={copyLightAsDark}
        >
          <Copy className="h-4 w-4" />
          Use light logo for dark variant
        </Button>

        {isSvg && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={convertToWhite}
          >
            <Copy className="h-4 w-4" />
            Make logo all white
          </Button>
        )}

        <div className="text-sm text-muted-foreground">- or -</div>
      </div>

      <button
        type="button"
        aria-label="Drag and drop logo file or click to browse"
        className={`logo-upload__dropzone logo-upload__dropzone--dark flex flex-col items-center justify-center ${
          isDarkVariantDragging ? "logo-upload__dropzone--active" : ""
        }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="logo-upload__dropzone-icon">
          <Upload className="h-8 w-8" />
        </div>
        <h4 className="logo-upload__dropzone-heading">
          Upload {type.charAt(0).toUpperCase() + type.slice(1)} Logo for Dark
          Background
        </h4>
        <p className="logo-upload__dropzone-text text-center">
          Drag and drop your logo file here, or click to browse.
          <br />
          Supported formats: {Object.values(FILE_FORMATS).join(", ")}
        </p>
        <div className="logo-upload__dropzone-actions mt-4">
          <FileUpload
            type={type}
            clientId={clientId}
            isDarkVariant={true}
            parentLogoId={logo.id}
            queryClient={queryClient}
            buttonOnly={true}
            className="min-w-32 text-black"
            inputRef={fileInputRef}
            onSuccess={() => {
              parsedData.hasDarkVariant = true;
              queryClient.invalidateQueries({
                queryKey: [`/api/clients/${clientId}/brand-assets`],
              });
              queryClient.invalidateQueries({
                queryKey: [`/api/assets/${logo.id}`],
              });
            }}
          >
            Browse Files
          </FileUpload>
        </div>
      </button>
    </div>
  );
}
