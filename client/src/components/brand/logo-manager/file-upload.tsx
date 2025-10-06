import { FILE_FORMATS } from "@shared/schema";
import { type QueryClient, useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useCallback,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export interface FileUploadProps {
  type: string;
  clientId: number;
  onSuccess: () => void;
  isDarkVariant?: boolean;
  parentLogoId?: number;
  queryClient: QueryClient;
  className?: string;
  buttonOnly?: boolean;
  children?: ReactNode;
}

export function FileUpload({
  type,
  clientId,
  onSuccess,
  queryClient,
  isDarkVariant,
  parentLogoId,
  buttonOnly = false,
  children,
  className,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const createLogo = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append(
        "name",
        `${type.charAt(0).toUpperCase() + type.slice(1)} Logo`
      );
      formData.append("type", type);
      formData.append("category", "logo");

      const fileFormat = selectedFile.name.split(".").pop()?.toLowerCase();

      if (isDarkVariant && parentLogoId) {
        const logoData = {
          type,
          format: fileFormat,
          hasDarkVariant: true,
          isDarkVariant: true,
        };
        formData.append("data", JSON.stringify(logoData));
        formData.append("category", "logo");
        formData.append(
          "name",
          `${type.charAt(0).toUpperCase() + type.slice(1)} Logo (Dark)`
        );

        const response = await fetch(
          `/api/clients/${clientId}/assets/${parentLogoId}?variant=dark`,
          {
            method: "PATCH",
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to update logo");
        }

        return await response.json();
      } else {
        formData.append(
          "data",
          JSON.stringify({
            type,
            format: fileFormat,
            hasDarkVariant: false,
          })
        );

        const response = await fetch(`/api/clients/${clientId}/assets`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to upload logo");
        }

        return await response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`],
      });
      toast({
        title: "Success",
        description: "Logo added successfully",
      });
      setSelectedFile(null);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

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

        setSelectedFile(file);
        setTimeout(() => createLogo.mutate(), 0);
      }
    },
    [toast, createLogo]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

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

      setSelectedFile(file);
      setTimeout(() => createLogo.mutate(), 0);
    },
    [toast, createLogo]
  );

  if (buttonOnly) {
    const inputId = `file-input-${Math.random().toString(36).substring(7)}`;
    return (
      <div>
        <Input
          id={inputId}
          type="file"
          accept={Object.values(FILE_FORMATS)
            .map((format) => `.${format}`)
            .join(",")}
          onChange={(e) => {
            handleFileChange(e);
            if (e.target.files?.[0]) {
              createLogo.mutate();
            }
          }}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          className={className}
          type="button"
          onClick={() => {
            document.getElementById(inputId)?.click();
          }}
          aria-label="Upload logo file"
        >
          {children}
        </Button>
      </div>
    );
  }

  return (
    <div className="logo-upload">
      {(() => {
        const dropzoneInputId = `dropzone-file-input-${type}-${Math.random().toString(36).substring(7)}`;
        return (
          <>
            <Input
              id={dropzoneInputId}
              type="file"
              accept={Object.values(FILE_FORMATS)
                .map((format) => `.${format}`)
                .join(",")}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              className={`logo-upload__dropzone ${isDragging ? "logo-upload__dropzone--active" : ""} ${createLogo.isPending ? "logo-upload__dropzone--loading" : ""}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => {
                document.getElementById(dropzoneInputId)?.click();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  document.getElementById(dropzoneInputId)?.click();
                }
              }}
              aria-label="Drag and drop logo file or click to browse"
            >
              {createLogo.isPending ? (
                <>
                  <div className="logo-upload__dropzone-icon logo-upload__dropzone-icon--loading">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                  <div className="logo-upload__dropzone-file-info">
                    <h4>Uploading logo...</h4>
                    <p>Please wait while your file is being processed</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="logo-upload__dropzone-icon">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h4 className="logo-upload__dropzone-heading">
                    Upload {type.charAt(0).toUpperCase() + type.slice(1)} Logo
                  </h4>
                  <p className="logo-upload__dropzone-text">
                    Drag and drop your logo file here, or click to browse.
                    <br />
                    Supported formats: {Object.values(FILE_FORMATS).join(", ")}
                  </p>
                  <div className="logo-upload__dropzone-actions">
                    <div className="cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer">
                      Browse Files
                    </div>
                  </div>
                </>
              )}
            </button>
          </>
        );
      })()}
    </div>
  );
}
