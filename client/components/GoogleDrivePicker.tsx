import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

interface GoogleDrivePickerProps {
  onSelect: (fileIds: string[]) => void;
  onError: (error: Error) => void;
}

const GOOGLE_PICKER_SCRIPT = 'https://apis.google.com/js/api.js';
const GAPI_LOADER_SCRIPT = 'https://apis.google.com/js/platform.js';

export const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({
  onSelect,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load the required Google APIs
  useEffect(() => {
    const loadGoogleScripts = async () => {
      try {
        await loadScript(GOOGLE_PICKER_SCRIPT);
        await loadScript(GAPI_LOADER_SCRIPT);
        setIsLoading(false);
      } catch (error) {
        onError(new Error('Failed to load Google APIs'));
      }
    };

    loadGoogleScripts();
  }, [onError]);

  // Handle Google OAuth and picker
  const handleAuthClick = useCallback(async () => {
    try {
      // Get auth URL from backend
      const response = await axios.get('/api/drive/auth-url');
      const { authUrl } = response.data;

      // Redirect to Google auth
      window.location.href = authUrl;
    } catch (error) {
      onError(new Error('Failed to initialize Google authentication'));
    }
  }, [onError]);

  // Initialize and show picker after authentication
  const showPicker = useCallback(() => {
    if (!window.google || !window.google.picker) {
      onError(new Error('Google Picker API not loaded'));
      return;
    }

    const picker = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsView())
      .addView(new window.google.picker.FolderView())
      .setOAuthToken(accessToken) // Set from your auth flow
      .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
      .setCallback((data: any) => {
        if (data.action === 'picked') {
          const fileIds = data.docs.map((doc: any) => doc.id);
          onSelect(fileIds);
        }
      })
      .build();

    picker.setVisible(true);
  }, [onSelect, onError]);

  if (isLoading) {
    return <div>Loading Google Drive integration...</div>;
  }

  return (
    <div>
      {!isAuthenticated ? (
        <button
          onClick={handleAuthClick}
          className="btn btn-primary"
        >
          Connect Google Drive
        </button>
      ) : (
        <button
          onClick={showPicker}
          className="btn btn-secondary"
        >
          Select from Drive
        </button>
      )}
    </div>
  );
};

// Helper function to load scripts
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.body.appendChild(script);
  });
};