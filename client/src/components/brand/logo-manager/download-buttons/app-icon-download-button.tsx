import type { BrandAsset } from "@shared/schema";
import { Download, ExternalLink, FileType, Folder } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { ParsedLogoData } from "../logo-utils";

interface AppIconDownloadButtonProps {
  logo: BrandAsset;
  imageUrl: string;
  variant: "light" | "dark";
  parsedData: ParsedLogoData;
}

export function AppIconDownloadButton({
  logo,
  imageUrl,
  variant,
  parsedData,
}: AppIconDownloadButtonProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [originalWidth, setOriginalWidth] = useState<number>(300);
  const { toast } = useToast();

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setOriginalWidth(img.width);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const getDownloadUrl = (size: number, format: string) => {
    const baseUrl =
      variant === "dark" && parsedData.hasDarkVariant
        ? `/api/assets/${logo.id}/file?variant=dark`
        : `/api/assets/${logo.id}/file`;

    const separator = baseUrl.includes("?") ? "&" : "?";

    return `${baseUrl}${separator}size=${size}&preserveRatio=true${format !== parsedData.format ? `&format=${format}` : ""}`;
  };

  const downloadAppIconPackage = async () => {
    try {
      toast({
        title: "Preparing app icon package",
        description: "Creating ZIP file with all app icon sizes...",
      });

      const sizes: number[] = [192, 512, 1024];

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const pngFolder = zip.folder("PNG");
      const vectorFolder = zip.folder("Vector");

      if (!pngFolder || !vectorFolder) {
        throw new Error("Failed to create folders in zip file");
      }

      const fetchPromises: Promise<void>[] = [];

      for (const size of sizes) {
        const sizePercentage = Math.min(100, (size / originalWidth) * 100);

        fetchPromises.push(
          fetch(getDownloadUrl(sizePercentage, "png"))
            .then((response) => response.arrayBuffer())
            .then((data) => {
              pngFolder.file(
                `${logo.name}${variant === "dark" ? "-Dark" : ""}-${size}px.png`,
                data
              );
            })
            .catch((err) => {
              console.error(`Error fetching PNG for size ${size}:`, err);
            })
        );
      }

      fetchPromises.push(
        fetch(getDownloadUrl(100, "svg"))
          .then((response) => response.arrayBuffer())
          .then((data) => {
            vectorFolder.file(
              `${logo.name}${variant === "dark" ? "-Dark" : ""}.svg`,
              data
            );
          })
          .catch((err) => {
            console.error("Error fetching SVG:", err);
          })
      );

      await Promise.all(fetchPromises);

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const zipUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = zipUrl;
      downloadLink.download = `${logo.name}${variant === "dark" ? "-Dark" : ""}-app-icon-package.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(zipUrl);
        setOpen(false);

        toast({
          title: "Download ready",
          description: "App icon package has been downloaded successfully.",
        });
      }, 100);
    } catch (error: unknown) {
      console.error(
        "Error creating app icon package:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Download failed",
        description:
          "There was an error creating the app icon package. Please try downloading individual files instead.",
        variant: "destructive",
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="logo-display__preview-action-button">
          <Download className="h-3 w-3" />
          <span>Download</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="logo-download__popover">
        <div className="logo-download__content">
          <h4 className="logo-download__heading">App Icon Download Options</h4>

          <div className="logo-download__options">
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">App Icon Package</h5>
              <p className="logo-download__description">
                Standard app icon sizes (512×512, 1024×1024) in PNG format
              </p>
              <button
                type="button"
                className="logo-download__link"
                onClick={downloadAppIconPackage}
              >
                <Folder className="logo-download__icon" />
                Download app icon package
              </button>
            </div>

            <div className="logo-download__section">
              <h5 className="logo-download__section-title">
                Editable Design Files
              </h5>
              <p className="logo-download__description">
                Vector formats for editing
              </p>
              <div className="logo-download__links">
                {parsedData.figmaLink && (
                  <a
                    href={parsedData.figmaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="logo-download__link"
                  >
                    <ExternalLink className="logo-download__icon" />
                    Open in Figma
                  </a>
                )}
                <button
                  type="button"
                  className="logo-download__link"
                  onClick={() => {
                    const container = document.createElement("div");
                    container.style.display = "none";
                    document.body.appendChild(container);

                    const link = document.createElement("a");
                    link.href = getDownloadUrl(100, "svg");
                    link.download = `${logo.name}${variant === "dark" ? "-Dark" : ""}.svg`;
                    container.appendChild(link);
                    link.click();

                    setTimeout(() => {
                      document.body.removeChild(container);
                      setOpen(false);
                    }, 100);
                  }}
                >
                  <FileType className="logo-download__icon" />
                  Download SVG logo
                </button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
