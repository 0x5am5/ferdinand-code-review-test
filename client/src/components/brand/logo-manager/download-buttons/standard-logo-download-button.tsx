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
import { getSecureAssetUrl } from "../logo-utils";

interface StandardLogoDownloadButtonProps {
  logo: BrandAsset;
  imageUrl: string;
  variant: "light" | "dark";
  parsedData: ParsedLogoData;
}

export function StandardLogoDownloadButton({
  logo,
  imageUrl,
  variant,
  parsedData,
}: StandardLogoDownloadButtonProps) {
  const [open, setOpen] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
  }, [imageUrl]);

  const downloadAllLogos = async () => {
    try {
      toast({
        title: "Preparing download package",
        description: "Creating ZIP file with all logo sizes...",
      });

      const sizes: number[] = [300, 800, 2000];

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const pngFolder = zip.folder("PNG");
      const vectorFolder = zip.folder("Vector");

      if (!pngFolder || !vectorFolder) {
        throw new Error("Failed to create folders in zip file");
      }

      const fetchPromises: Promise<void>[] = [];

      for (const size of sizes) {
        const url = `/api/assets/${logo.id}/file?clientId=${logo.clientId}&size=${size}&format=png${variant === "dark" ? "&variant=dark" : ""}&preserveRatio=true`;

        const filename = `${logo.name}${variant === "dark" ? "-Dark" : ""}-${size}px.png`;

        const pngFolderRef = pngFolder;
        fetchPromises.push(
          fetch(url, {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch ${size}px PNG: ${response.status} ${response.statusText}`
                );
              }
              return response.arrayBuffer();
            })
            .then((data) => {
              pngFolderRef.file(filename, data);
            })
            .catch((err) => {
              console.error(`Error with ${size}px PNG:`, err);
            })
        );
      }

      const vectorFormats: string[] = ["svg", "pdf"];
      const vectorFolderRef = vectorFolder;
      for (const format of vectorFormats) {
        const url = getSecureAssetUrl(logo.id, logo.clientId, {
          format,
          variant: variant === "dark" ? "dark" : undefined,
          preserveVector: true,
        });
        const filename = `${logo.name}${variant === "dark" ? "-Dark" : ""}.${format}`;

        console.log(`Fetching ${format} logo from: ${url}`);

        fetchPromises.push(
          fetch(url, {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
            },
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch ${format}: ${response.status} ${response.statusText}`
                );
              }
              return response.arrayBuffer();
            })
            .then((data) => {
              vectorFolderRef.file(filename, data);
            })
            .catch((err) => {
              console.error(`Error with ${format}:`, err);
            })
        );
      }

      await Promise.all(fetchPromises);

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const zipUrl = URL.createObjectURL(zipBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = zipUrl;
      downloadLink.download = `${logo.name}${variant === "dark" ? "-Dark" : ""}-package.zip`;
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(zipUrl);
        setOpen(false);

        toast({
          title: "Download ready",
          description: "Logo package has been downloaded successfully.",
        });
      }, 100);
    } catch (error: unknown) {
      console.error(
        "Error creating download package:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Download failed",
        description:
          "There was an error creating the logo package. Please try downloading individual files instead.",
        variant: "destructive",
      });
    }
  };

  const downloadSpecificSize = (size: number) => {
    try {
      if (!logo.id || !logo.clientId) {
        throw new Error("Missing required logo data");
      }

      const downloadUrl = getSecureAssetUrl(logo.id, logo.clientId, {
        format: "png",
        size,
        variant: variant === "dark" ? "dark" : undefined,
        preserveRatio: true,
        preserveVector: false,
      });

      const container = document.createElement("div");
      container.style.display = "none";
      document.body.appendChild(container);

      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl.toString();
      downloadLink.download = `${logo.name}${variant === "dark" ? "-Dark" : ""}-${size}px.png`;

      container.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(container);
        setOpen(false);
      }, 100);
    } catch (error: unknown) {
      console.error(
        "Download failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      toast({
        title: "Download failed",
        description:
          error instanceof Error ? error.message : "Failed to download logo",
        variant: "destructive",
      });
    }
  };

  const downloadEditableFiles = (format: string) => {
    try {
      const container = document.createElement("div");
      container.style.display = "none";
      document.body.appendChild(container);

      const downloadUrlWithClientId = getSecureAssetUrl(
        logo.id,
        logo.clientId,
        {
          format,
          variant: variant === "dark" ? "dark" : undefined,
          preserveVector: true,
        }
      );

      const link = document.createElement("a");
      link.href = downloadUrlWithClientId;
      link.download = `${logo.name}${variant === "dark" ? "-Dark" : ""}.${format}`;
      container.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(container);
        setOpen(false);
      }, 100);
    } catch (error: unknown) {
      console.error(`Error downloading ${format} file:`, error);
      toast({
        title: "Download failed",
        description: `There was an error downloading the ${format.toUpperCase()} file.`,
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
          <h4 className="logo-download__heading">Download Options</h4>

          <div className="logo-download__options">
            <div className="logo-download__section">
              <h5 className="logo-download__section-title">PNG File Options</h5>
              <p className="logo-download__description">
                Standard PNG formats with transparent background
              </p>
              <div className="logo-download__links">
                <button
                  type="button"
                  className="logo-download__link"
                  onClick={downloadAllLogos}
                >
                  <Folder className="logo-download__icon" />
                  Logo Package (small, medium, large)
                </button>
                <button
                  type="button"
                  className="logo-download__link"
                  onClick={() => downloadSpecificSize(300)}
                >
                  <FileType className="logo-download__icon" />
                  Small (300px wide)
                </button>
                <button
                  type="button"
                  className="logo-download__link"
                  onClick={() => downloadSpecificSize(800)}
                >
                  <FileType className="logo-download__icon" />
                  Medium (800px wide)
                </button>
                <button
                  type="button"
                  className="logo-download__link"
                  onClick={() => downloadSpecificSize(2000)}
                >
                  <FileType className="logo-download__icon" />
                  Large (2000px wide)
                </button>
              </div>
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
                  onClick={() => downloadEditableFiles("svg")}
                >
                  <FileType className="logo-download__icon" />
                  Download SVG logo
                </button>
                <button
                  type="button"
                  className="logo-download__link"
                  onClick={() => downloadEditableFiles("pdf")}
                >
                  <FileType className="logo-download__icon" />
                  Download PDF logo
                </button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
