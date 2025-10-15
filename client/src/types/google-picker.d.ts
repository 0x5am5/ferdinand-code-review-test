/**
 * TypeScript declarations for Google Picker API
 */

// Google Picker API type definitions
declare global {
  namespace google {
    namespace picker {
      type ViewId = string;

      interface Feature {
        MULTISELECT_ENABLED: number;
        NAV_HIDDEN: number;
        MINE_ONLY: number;
      }

      interface DocsViewMode {
        LIST: ViewId;
        GRID: ViewId;
      }

      interface ViewIdType {
        DOCS: ViewId;
        DOCS_IMAGES: ViewId;
        DOCS_IMAGES_AND_VIDEOS: ViewId;
        DOCS_VIDEOS: ViewId;
        FOLDERS: ViewId;
      }

      interface ActionType {
        PICKED: string;
        CANCEL: string;
      }

      interface DocumentObject {
        id: string;
        name: string;
        mimeType: string;
        url: string;
        sizeBytes?: string | number;
        lastEditedUtc?: number;
        iconUrl?: string;
        description?: string;
        type?: string;
        parentId?: string;
      }

      interface ResponseObject {
        action: string;
        docs?: DocumentObject[];
        viewToken?: string[];
      }

      interface DocsView {
        setIncludeFolders(include: boolean): DocsView;
        setSelectFolderEnabled(enabled: boolean): DocsView;
        setMode(mode: ViewId): DocsView;
        setMimeTypes(mimeTypes: string): DocsView;
        setParent(parentId: string): DocsView;
      }

      interface DocsViewConstructor {
        new (): DocsView;
        new (viewId: ViewId): DocsView;
      }

      interface PickerBuilder {
        setAppId(appId: string): PickerBuilder;
        setOAuthToken(token: string): PickerBuilder;
        setDeveloperKey(key: string): PickerBuilder;
        setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
        addView(view: DocsView): PickerBuilder;
        enableFeature(feature: number | undefined): PickerBuilder;
        setTitle(title: string): PickerBuilder;
        setLocale(locale: string): PickerBuilder;
        setSize(width: number, height: number): PickerBuilder;
        build(): Picker;
      }

      interface PickerBuilderConstructor {
        new (): PickerBuilder;
      }

      interface Picker {
        setVisible(visible: boolean): void;
        dispose(): void;
      }

      const PickerBuilder: PickerBuilderConstructor;
      const DocsView: DocsViewConstructor;
      const DocsViewMode: DocsViewMode;
      const ViewId: ViewIdType;
      const Action: ActionType;
      const Feature: Feature;
    }
  }
}

// Export empty object to make this a module
export {};
