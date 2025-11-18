import type React from "react";
import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useState } from "react";

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

export const GoogleDrivePicker: React.FC<
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
  const [isLoading, setIsLoading] = useState(true);

  // Load Google Picker API
  useEffect(() => {
    const loadPickerApi = () => {
      if (window.gapi) {
        window.gapi.load("picker", () => {
          // Picker loaded
        });
      } else {
        // Load the GAPI script if not already loaded
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.onload = () => {
          window.gapi?.load("picker", () => {
            // Picker loaded
          });
        };
        document.body.appendChild(script);
      }
      setIsLoading(false);
    };

    loadPickerApi();
  }, []);

  // Initialize and show picker
  const handleOpenPicker = useCallback(() => {
    if (!window.google || !window.google.picker) {
      console.error("Google Picker API not loaded");
      return;
    }

    if (!oauthToken) {
      console.error("No OAuth token available");
      return;
    }

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(appId)
      .setOAuthToken(oauthToken)
      .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY || "")
      .setCallback((data: google.picker.ResponseObject) => {
        if (data.action === "picked") {
          onFilesSelected?.(data.docs || []);
        }
      });

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
  }, [
    appId,
    oauthToken,
    onFilesSelected,
    allowFolders,
    allowMultiple,
    mimeTypes,
  ]);

  if (isLoading) {
    return <div>Loading Google Drive integration...</div>;
  }

  // If children is provided, render as wrapper around children
  if (children) {
    return (
      <button
        type="button"
        onClick={handleOpenPicker}
        className="appearance-none border-0 bg-transparent p-0 cursor-pointer"
      >
        {children}
      </button>
    );
  }

  // Otherwise render nothing (children prop should be required)
  return null;
};

// Helper function to load scripts
const _loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};
