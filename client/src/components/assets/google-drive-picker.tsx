import { FileIcon, FolderIcon } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import "@googleworkspace/drive-picker-element";
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
import type {
  PickerAuthenticatedEvent,
  PickerCanceledEvent,
  PickerDocument,
  PickerPickedEvent,
} from "@/types/google-picker";

interface GoogleDrivePickerProps {
  clientId: string;
  appId: string;
  oauthToken?: string;
  onFilesSelected?: (files: PickerDocument[]) => void;
  allowFolders?: boolean;
  allowMultiple?: boolean;
  mimeTypes?: string[];
  children?: React.ReactNode;
}

/**
 * Google Drive Picker Component
 * Embeds Google Picker API to allow users to select files and folders from their Drive
 */
export const GoogleDrivePicker: FC<GoogleDrivePickerProps> = ({
  clientId,
  appId,
  oauthToken: initialOauthToken,
  onFilesSelected,
  allowFolders = true,
  allowMultiple = true,
  mimeTypes,
  children,
}) => {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [oauthToken, setOauthToken] = useState(initialOauthToken);
  const [selectedFiles, setSelectedFiles] = useState<PickerDocument[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const pickerRef = useRef<HTMLElement>(null);

  // Import the web component
  useEffect(() => {
    import("@googleworkspace/drive-picker-element");
  }, []);

  // Set up event listeners
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;

    const handleAuthenticated = (event: Event) => {
      const customEvent = event as PickerAuthenticatedEvent;
      setOauthToken(customEvent.detail.token);
      toast({
        title: "Authenticated",
        description: "Successfully authenticated with Google Drive",
      });
    };

    const handlePicked = (event: Event) => {
      const customEvent = event as PickerPickedEvent;
      const docs = customEvent.detail.docs || [];
      setSelectedFiles(docs);
      setConfirmDialogOpen(true);
    };

    const handleCanceled = (event: Event) => {
      const customEvent = event as PickerCanceledEvent;
      setIsPickerVisible(false);
      toast({
        title: "Cancelled",
        description: "File selection was cancelled",
      });
    };

    picker.addEventListener("picker:authenticated", handleAuthenticated);
    picker.addEventListener("picker:picked", handlePicked);
    picker.addEventListener("picker:canceled", handleCanceled);

    return () => {
      picker.removeEventListener("picker:authenticated", handleAuthenticated);
      picker.removeEventListener("picker:picked", handlePicked);
      picker.removeEventListener("picker:canceled", handleCanceled);
    };
  }, []);

  const handleOpenPicker = () => {
    setIsPickerVisible(true);
    if (pickerRef.current) {
      // @ts-expect-error - web component property
      pickerRef.current.visible = true;
    }
  };

  const handleConfirmSelection = () => {
    if (onFilesSelected) {
      onFilesSelected(selectedFiles);
    }
    setConfirmDialogOpen(false);
    setIsPickerVisible(false);
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
        <div onClick={handleOpenPicker}>{children}</div>
      ) : (
        <Button onClick={handleOpenPicker} variant="outline">
          Select from Google Drive
        </Button>
      )}

      {/* Google Drive Picker Web Component */}
      <drive-picker
        ref={pickerRef}
        client-id={clientId}
        app-id={appId}
        oauth-token={oauthToken}
        style={{ display: isPickerVisible ? "block" : "none" }}
      >
        <drive-picker-docs-view
          include-folders={allowFolders ? "true" : "false"}
          select-folder-enabled={allowFolders ? "true" : "false"}
          mode={allowMultiple ? "list" : "grid"}
          mime-types={mimeTypes?.join(",")}
        />
      </drive-picker>

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
                      {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
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
