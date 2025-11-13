import type { BrandAsset, FontSource } from "@shared/schema";

// Google Fonts interface
export interface GoogleFont {
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
}

export interface GoogleFontsResponse {
  kind: string;
  items: GoogleFont[];
}

export interface ProcessedGoogleFont {
  name: string;
  category: string;
  weights: string[];
}

// Adobe Fonts interface
export interface AdobeFontData {
  family: string;
  displayName: string;
  weights: string[];
  styles: string[];
  cssUrl: string;
  category: string;
  foundry: string;
}

export interface AdobeFontsResponse {
  projectId: string;
  fonts: AdobeFontData[];
}

// Font source data interface
export interface FontSourceData {
  projectId?: string;
  url?: string;
  fontFamily?: string;
  category?: string;
  files?: Array<{
    weight: string;
    style: string;
    format: string;
    fileName: string;
    fileData: string;
  }>;
}

// Main font data interface
export interface FontData {
  id?: number;
  name: string;
  source: (typeof FontSource)[keyof typeof FontSource];
  weights: string[];
  styles: string[];
  sourceData: FontSourceData;
  description?: string;
}

// Component prop interfaces
export interface FontManagerProps {
  clientId: number;
  fonts: BrandAsset[];
}

export interface FontPickerButtonsProps {
  onGoogleFontClick: () => void;
  onAdobeFontClick: () => void;
  onCustomFontClick: () => void;
}

export interface GoogleFontPickerProps {
  onFontSelect: (fontName: string) => void;
  isLoading: boolean;
  googleFonts: ProcessedGoogleFont[];
  isFontsLoading: boolean;
}

export interface AdobeFontPickerProps {
  onFontSubmit: (data: {
    projectId: string;
    fontFamily: string;
    weights: string[];
  }) => void;
  isLoading: boolean;
}

export interface CustomFontPickerProps {
  onFontUpload: (files: FileList, fontName: string, weights: string[]) => void;
  isLoading: boolean;
}

export interface FontCardProps {
  font: FontData;
  onEdit: () => void;
  onDelete: () => void;
  clientId: number;
}

export interface WeightStyleSelectorProps {
  selectedWeights: string[];
  selectedStyles: string[];
  onWeightChange: (weights: string[]) => void;
  onStyleChange: (styles: string[]) => void;
  availableWeights: string[];
}

export interface EditFontDialogProps {
  editingFont: FontData | null;
  setEditingFont: (
    font: FontData | null | ((prev: FontData | null) => FontData | null)
  ) => void;
  selectedWeights: string[];
  selectedStyles: string[];
  setSelectedWeights: (weights: string[]) => void;
  setSelectedStyles: (styles: string[]) => void;
  onUpdateFont: () => void;
  isUpdating: boolean;
}
