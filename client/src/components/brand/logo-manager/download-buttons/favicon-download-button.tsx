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

interface FaviconDownloadButtonProps {
  logo: BrandAsset;
  imageUrl: string;
  variant: "light" | "dark";
  parsedData: ParsedLogoData;
}

export function FaviconDownloadButton({
  logo,
  imageUrl,
  variant,
  parsedData,
}: FaviconDownloadButtonProps) {
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

  const downloadFaviconPackage = async () => {
    try {
      toast({
        title: "Preparing favicon package",
        description: "Creating ZIP file with all favicon sizes...",
      });

      const sizes: number[] = [16, 32, 48, 64];

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const icoFolder = zip.folder("ICO");
      const pngFolder = zip.folder("PNG");
      const vectorFolder = zip.folder("Vector");

      if (!icoFolder || !pngFolder || !vectorFolder) {
        throw new Error("Failed to create folders in zip file");
      }

      const fetchPromises: Promise<void>[] = [];

      for (const size of sizes) {
        const sizePercentage = Math.min(100, (size / originalWidth) * 100);

        const icoFolderRef = icoFolder;
        fetchPromises.push(
          fetch(getDownloadUrl(sizePercentage, "ico"))
            .then((response) => response.arrayBuffer())
            .then((data) => {
              icoFolderRef.file(
                `${logo.name}${variant === "dark" ? "-Dark" : ""}-${size}px.ico`,
                data
              );
            })
            .catch((err) => {
              console.error(`Error fetching ICO for size ${size}:`, err);
            })
        );

        const pngFolderRef = pngFolder;
        fetchPromises.push(
          fetch(getDownloadUrl(sizePercentage, "png"))
            .then((response) => response.arrayBuffer())
            .then((data) => {
              pngFolderRef.file(
                `${logo.name}${variant === "dark" ? "-Dark" : ""}-${size}px.png`,
                data
              );
            })
            .catch((err) => {
              console.error(`Error fetching PNG for size ${size}:`, err);
            })
        );
      }

      const vectorFolderRef = vectorFolder;
      fetchPromises.push(
        fetch(getDownloadUrl(100, "svg"))
          .then((response) => response.arrayBuffer())
          .then((data) => {
            vectorFolderRef.file(
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
      downloadLink.download = `${logo.name}${variant === "dark" ? "-Dark" : ""}-favicon-package.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(zipUrl);
        setOpen(false);

        toast({
          title: "Download ready",
          description: "Favicon package has been downloaded successfully.",
        });
      }, 100);
    } catch (error: unknown) {
      console.error(
        "Error creating favicon package:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Download failed",
        description:
          "There was an error creating the favicon package. Please try downloading individual files instead.",
        variant: "destructive",
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="asset-display__preview-action-button">
          <Download className="h-3 w-3" />
          <span>Download</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="logo-download__popover">
        <div className="logo-download__content">
          <h4 className="logo-download__heading">Favicon Download Options</h4>

          <div className="logo-download__options">
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">Favicon Package</h5>
              <p className="logo-download__description">
                Standard favicon sizes (16×16, 32×32, 48×48) in ICO and PNG
                formats
              </p>
              <button
                type="button"
                className="logo-download__link"
                onClick={downloadFaviconPackage}
              >
                <Folder className="logo-download__icon" />
                Download favicon package
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