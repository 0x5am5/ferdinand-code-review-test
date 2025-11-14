import { FileIcon, FolderIcon } from "lucide-react";
import type { FC, PropsWithChildren } from "react";
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

// Declare google picker types
declare global {
  namespace google {
    namespace picker {
      interface PickerBuilder {
        setAppId(appId: string): PickerBuilder;
        setOAuthToken(token: string): PickerBuilder;
        setDeveloperKey(key: string): PickerBuilder;
        setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
        enableFeature(feature: number): PickerBuilder;
        addView(view: DocsView | FolderView): PickerBuilder;
        build(): Picker;
      }

      interface Picker {
        setVisible(visible: boolean): void;
      }

      interface DocsView {
        setIncludeFolders(include: boolean): DocsView;
        setSelectFolderEnabled(enabled: boolean): DocsView;
        setMode(mode: string): DocsView;
        setMimeTypes(mimeTypes: string): DocsView;
      }

      interface FolderView {
        setIncludeFolders(include: boolean): FolderView;
        setSelectFolderEnabled(enabled: boolean): FolderView;
        setMode(mode: string): FolderView;
      }

      interface DocumentObject {
        id: string;
        name: string;
        mimeType: string;
        sizeBytes?: string | number;
      }

      interface ResponseObject {
        action: string;
        docs?: DocumentObject[];
      }
    }
  }

  interface Window {
    google?: {
      picker: {
        PickerBuilder: new () => google.picker.PickerBuilder;
        DocsView: new () => google.picker.DocsView;
        FolderView: new () => google.picker.FolderView;
        DocsViewMode: {
          LIST: string;
          GRID: string;
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

interface GoogleDrivePickerProps {
  clientId: string;
  appId: string;
  oauthToken?: string;
  onFilesSelected?: (files: google.picker.DocumentObject[]) => void;
  allowFolders?: boolean;
  allowMultiple?: boolean;
  mimeTypes?: string[];
}

/**
 * Google Drive Picker Component
 * Uses the native Google Picker API to allow users to select files from their Drive
 */
export const GoogleDrivePicker: FC<
  PropsWithChildren<GoogleDrivePickerProps>
> = ({
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

  const isGoogleWorkspaceFile = (mimeType: string) => {
    const googleWorkspaceMimeTypes = [
      "application/vnd.google-apps.document",
      "application/vnd.google-apps.spreadsheet",
      "application/vnd.google-apps.presentation",
      "application/vnd.google-apps.drawing",
      "application/vnd.google-apps.forms",
      "application/vnd.google-apps.script",
      "application/vnd.google-apps.site",
      "application/vnd.google-apps.fusiontable",
      "application/vnd.google-apps.map",
    ];
    return googleWorkspaceMimeTypes.includes(mimeType);
  };

  const getFileTypeDescription = (mimeType: string) => {
    if (isGoogleWorkspaceFile(mimeType)) {
      return "Reference-only (will be linked, not downloaded)";
    }
    return "Will be downloaded and stored";
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
          Download from Google Drive
        </Button>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Selection</DialogTitle>
            <DialogDescription>
              You have selected {selectedFiles.length} item(s) from Google
              Drive. These files will be downloaded and stored in your Ferdinand
              account. Click confirm to import them.
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
                  <p className="text-xs text-blue-600 font-medium">
                    {getFileTypeDescription(file.mimeType)}
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

          {/* Information about reference assets */}
          {selectedFiles.some((file) =>
            isGoogleWorkspaceFile(file.mimeType)
          ) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-blue-900 mb-2">
                About Google Workspace Files
              </h4>
              <p className="text-sm text-blue-800 mb-2">
                Google Workspace files (Docs, Sheets, Slides, etc.) will be
                imported as reference-only assets. This means:
              </p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>The file will not be downloaded to Ferdinand</li>
                <li>Users will open the file directly in Google Drive</li>
                <li>
                  File permissions will be set to "anyone with link can view"
                </li>
                <li>The original file remains in your Google Drive</li>
              </ul>
              <p className="text-sm text-blue-700 font-medium">
                This allows you to reference Google Workspace files without
                consuming storage space.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelSelection}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSelection}>
              Download & Import ({selectedFiles.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
