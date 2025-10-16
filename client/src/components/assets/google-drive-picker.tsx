import { FileIcon, FolderIcon } from "lucide-react";
import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface GoogleDrivePickerProps {
  clientId: string;
  appId: string;
  oauthToken?: string;
  onFilesSelected?: (files: google.picker.DocumentObject[]) => void;
  allowFolders?: boolean;
  allowMultiple?: boolean;
  mimeTypes?: string[];
  children?: ReactNode;
}

// Extend window to include google and gapi
declare global {
  interface Window {
    google?: {
      picker: {
        PickerBuilder: new () => google.picker.PickerBuilder;
        DocsView: new () => google.picker.DocsView;
        DocsViewMode: {
          LIST: google.picker.ViewId;
          GRID: google.picker.ViewId;
        };
        ViewId: {
          DOCS: google.picker.ViewId;
        };
        Action: {
          PICKED: string;
          CANCEL: string;
        };
        Feature: {
          MULTISELECT_ENABLED: number;
          NAV_HIDDEN: number;
          MINE_ONLY: number;
        };
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

/**
 * Google Drive Picker Component
 * Uses the native Google Picker API to allow users to select files from their Drive
 */
export const GoogleDrivePicker: FC<GoogleDrivePickerProps> = ({
  appId,
  oauthToken,
  onFilesSelected,
  allowFolders = true,
  allowMultiple = true,
  mimeTypes,
  children,
}) => {
  const [isPickerLoaded, setIsPickerLoaded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<
    google.picker.DocumentObject[]
  >([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Load Google Picker API
  useEffect(() => {
    const loadPickerApi = () => {
      if (window.gapi) {
        window.gapi.load("picker", () => {
          setIsPickerLoaded(true);
        });
      } else {
        // Load the GAPI script if not already loaded
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.onload = () => {
          window.gapi?.load("picker", () => {
            setIsPickerLoaded(true);
          });
        };
        document.body.appendChild(script);
      }
    };

    loadPickerApi();
  }, []);

  const handleOpenPicker = () => {
    if (!oauthToken) {
      toast({
        title: "Authentication Required",
        description: "Please connect your Google Drive account first",
        variant: "destructive",
      });
      return;
    }

    if (!isPickerLoaded || !window.google) {
      toast({
        title: "Loading",
        description: "Google Picker is still loading. Please try again.",
      });
      return;
    }

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(appId)
      .setOAuthToken(oauthToken)
      .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY || "")
      .setCallback(pickerCallback);

    // Enable multiselect if allowed
    if (allowMultiple) {
      picker.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
    }

    // Only show files from the authenticated user's Drive
    picker.enableFeature(window.google.picker.Feature.MINE_ONLY);

    // Add docs view
    const docsView = new window.google.picker.DocsView()
      .setIncludeFolders(allowFolders)
      .setSelectFolderEnabled(allowFolders)
      .setMode(
        allowMultiple
          ? window.google.picker.DocsViewMode.LIST
          : window.google.picker.DocsViewMode.GRID
      );

    if (mimeTypes && mimeTypes.length > 0) {
      docsView.setMimeTypes(mimeTypes.join(","));
    }

    picker.addView(docsView);
    picker.build().setVisible(true);
  };

  const pickerCallback = (data: google.picker.ResponseObject) => {
    if (data.action === window.google?.picker.Action.PICKED) {
      const docs = data.docs || [];
      setSelectedFiles(docs);
      setConfirmDialogOpen(true);
    } else if (data.action === window.google?.picker.Action.CANCEL) {
      toast({
        title: "Cancelled",
        description: "File selection was cancelled",
      });
    }
  };

  const handleConfirmSelection = () => {
    if (onFilesSelected) {
      onFilesSelected(selectedFiles);
    }
    setConfirmDialogOpen(false);
    setSelectedFiles([]);
  };

  const handleCancelSelection = () => {
    setConfirmDialogOpen(false);
    setSelectedFiles([]);
  };

  const getFileIcon = (mimeType: string) => {
    if (
      mimeType === "application/vnd.google-apps.folder" ||
      mimeType.includes("folder")
    ) {
      return <FolderIcon className="h-4 w-4" />;
    }
    return <FileIcon className="h-4 w-4" />;
  };

  return (
    <>
      {children ? (
        // biome-ignore lint/a11y/useSemanticElements: Cannot use button element as it wraps another button component
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpenPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpenPicker();
            }
          }}
          className="inline-block cursor-pointer"
        >
          {children}
        </div>
      ) : (
        <Button
          onClick={handleOpenPicker}
          variant="outline"
          disabled={!oauthToken || !isPickerLoaded}
        >
          Select from Google Drive
        </Button>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Selection</DialogTitle>
            <DialogDescription>
              You have selected {selectedFiles.length} item(s) from Google
              Drive. Click confirm to import them.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50"
              >
                {getFileIcon(file.mimeType)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {file.mimeType}
                  </p>
                  {file.sizeBytes && (
                    <p className="text-xs text-muted-foreground">
                      {(Number(file.sizeBytes) / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelSelection}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSelection}>
              Confirm Import ({selectedFiles.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
