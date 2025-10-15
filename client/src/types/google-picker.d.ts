/**
 * TypeScript declarations for Google Drive Picker web component
 */

import type {
  DrivePickerElement,
  DrivePickerDocsViewElement,
  DrivePickerElementProps,
  DrivePickerDocsViewElementProps,
} from "@googleworkspace/drive-picker-element";

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      "drive-picker": React.DetailedHTMLProps<
        React.HTMLAttributes<DrivePickerElement> & DrivePickerElementProps,
        DrivePickerElement
      >;
      "drive-picker-docs-view": React.DetailedHTMLProps<
        React.HTMLAttributes<DrivePickerDocsViewElement> &
          DrivePickerDocsViewElementProps,
        DrivePickerDocsViewElement
      >;
    }
  }
}

// Event types for Google Picker
export interface PickerDocument {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  sizeBytes?: number;
  lastEditedUtc?: number;
  iconUrl?: string;
  description?: string;
  type?: string;
  parentId?: string;
}

export interface PickerResponseObject {
  action: "picked" | "cancel";
  docs?: PickerDocument[];
}

export interface PickerAuthenticatedEvent extends CustomEvent {
  detail: {
    token: string;
  };
}

export interface PickerPickedEvent extends CustomEvent {
  detail: PickerResponseObject;
}

export interface PickerCanceledEvent extends CustomEvent {
  detail: PickerResponseObject;
}
