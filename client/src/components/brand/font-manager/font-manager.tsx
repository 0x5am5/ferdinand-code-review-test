import { FontSource } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Type } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useFontMutations } from "@/hooks/use-font-mutations";
import { useToast } from "@/hooks/use-toast";
import { TypeScaleManager } from "../../type-scale/type-scale-manager";
import { AssetSection } from "../logo-manager/asset-section";
import { AdobeFontPicker } from "./adobe-font-picker";
import { CustomFontPicker } from "./custom-font-picker";
import { EditFontDialog } from "./edit-font-dialog";
import { FontCard } from "./font-card";
import { FontPickerButtons } from "./font-picker-buttons";
import { GoogleFontPicker } from "./google-font-picker";
import type {
  FontData,
  FontManagerProps,
  GoogleFont,
  GoogleFontsResponse,
  ProcessedGoogleFont,
} from "./types";
import {
  convertGoogleFontCategory,
  convertGoogleFontVariants,
  generateGoogleFontUrl,
  parseFontAsset,
} from "./utils";

export function FontManager({ clientId, fonts }: FontManagerProps) {
  const { toast } = useToast();
  const [editingFont, setEditingFont] = useState<FontData | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<string[]>(["400"]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["normal"]);
  const { user } = useAuth();
  const [showGoogleFontPicker, setShowGoogleFontPicker] = useState(false);
  const [showAdobeFontPicker, setShowAdobeFontPicker] = useState(false);
  const [showCustomFontPicker, setShowCustomFontPicker] = useState(false);

  // Font mutations
  const { addFont, editFont, deleteFont } = useFontMutations(clientId);

  // Fetch Google Fonts
  const { data: googleFontsData, isLoading: isFontsLoading } = useQuery({
    queryKey: ["/api/google-fonts"],
    enabled: true,
    retry: false,
    throwOnError: false,
  });

  if (!user) return null;

  // Validate clientId is available
  if (!clientId) {
    return (
      <div>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Typography System
            </h1>
            <p className="text-muted-foreground text-red-500 mt-1">
              Error: Client ID is missing. Please refresh the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isAbleToEdit = user
    ? ["super_admin", "admin", "editor"].includes(user.role as string)
    : false;

  // Fallback Google Fonts data
  const allGoogleFonts: ProcessedGoogleFont[] = [
    {
      name: "Inter",
      category: "Sans Serif",
      weights: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
    },
    {
      name: "Roboto",
      category: "Sans Serif",
      weights: ["100", "300", "400", "500", "700", "900"],
    },
    {
      name: "Open Sans",
      category: "Sans Serif",
      weights: ["300", "400", "500", "600", "700", "800"],
    },
  ];

  // Use API data if available and valid, otherwise use comprehensive fallback
  const googleFonts: ProcessedGoogleFont[] =
    googleFontsData &&
    (googleFontsData as GoogleFontsResponse)?.items?.length > 0
      ? (googleFontsData as GoogleFontsResponse).items.map(
          (font: GoogleFont) => ({
            name: font.family,
            category: convertGoogleFontCategory(font.category),
            weights: convertGoogleFontVariants(font.variants),
          })
        )
      : allGoogleFonts;

  // Google Font handler with proper validation
  const handleGoogleFontSelect = (fontName: string) => {
    if (!fontName?.trim()) {
      toast({
        title: "Error",
        description: "Invalid font name",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Error",
        description: "Client ID is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    // Find the font in our Google Fonts list to get available weights
    const selectedFont = googleFonts?.find((font) => font.name === fontName);
    const availableWeights = selectedFont?.weights || ["400", "700"];
    // Use ALL available weights instead of limiting to first 3
    const allWeights = availableWeights;

    console.log(`Creating Google Font: ${fontName} with weights:`, allWeights);

    // Create proper font data structure
    const fontData = {
      source: FontSource.GOOGLE,
      weights: allWeights,
      styles: ["normal"],
      sourceData: {
        url: generateGoogleFontUrl(fontName, allWeights, ["normal"]),
        fontFamily: fontName,
        category: selectedFont?.category || "Sans Serif",
      },
    };

    console.log("Sending font data to server for client:", clientId);
    console.log("Font data structure:", JSON.stringify(fontData, null, 2));

    const formData = new FormData();
    formData.append("name", fontName.trim());
    formData.append("category", "font");
    formData.append("subcategory", "google");
    formData.append("data", JSON.stringify(fontData));

    addFont.mutate(formData);
  };

  // Adobe Font handler
  const handleAdobeFontSubmit = (adobeFontData: {
    projectId: string;
    fontFamily: string;
    weights: string[];
  }) => {
    if (!adobeFontData.projectId?.trim() || !adobeFontData.fontFamily?.trim()) {
      toast({
        title: "Error",
        description: "Please provide both Project ID and Font Family name",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Error",
        description: "Client ID is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    console.log(
      `Creating Adobe Font: ${adobeFontData.fontFamily} with weights:`,
      adobeFontData.weights
    );

    // Create proper font data structure for Adobe fonts
    const fontData = {
      source: FontSource.ADOBE,
      weights:
        adobeFontData.weights.length > 0 ? adobeFontData.weights : ["400"],
      styles: ["normal"],
      sourceData: {
        projectId: adobeFontData.projectId.trim(),
        fontFamily: adobeFontData.fontFamily.trim(),
        url: `https://use.typekit.net/${adobeFontData.projectId}.css`,
      },
    };

    console.log("Sending Adobe font data to server for client:", clientId);
    console.log(
      "Adobe font data structure:",
      JSON.stringify(fontData, null, 2)
    );

    const formData = new FormData();
    formData.append("name", adobeFontData.fontFamily.trim());
    formData.append("category", "font");
    formData.append("subcategory", "adobe");
    formData.append("data", JSON.stringify(fontData));

    addFont.mutate(formData);
  };

  // Custom Font upload handler
  const handleCustomFontUpload = (
    files: FileList,
    fontName: string,
    weights: string[]
  ) => {
    if (!files || files.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one font file",
        variant: "destructive",
      });
      return;
    }

    if (!fontName.trim()) {
      toast({
        title: "Error",
        description: "Please provide a font name",
        variant: "destructive",
      });
      return;
    }

    if (!clientId) {
      toast({
        title: "Error",
        description: "Client ID is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    // Validate file formats
    const allowedFormats = ["otf", "ttf", "woff", "woff2", "eot", "svg", "cff"];
    const validFiles = Array.from(files).filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      return extension && allowedFormats.includes(extension);
    });

    if (validFiles.length === 0) {
      toast({
        title: "Invalid file format",
        description:
          "Please upload only font files (OTF, TTF, WOFF, WOFF2, EOT, SVG, CFF)",
        variant: "destructive",
      });
      return;
    }

    if (validFiles.length !== files.length) {
      toast({
        title: "Some files skipped",
        description: `Only ${validFiles.length} of ${files.length} files are valid font formats`,
        variant: "destructive",
      });
    }

    // Process files and create FormData
    const formData = new FormData();
    formData.append("name", fontName.trim());
    formData.append("category", "font");
    formData.append("subcategory", "custom");

    // For custom fonts, the server expects individual fields, not a data JSON object
    formData.append("source", FontSource.FILE);
    formData.append(
      "weights",
      JSON.stringify(weights.length > 0 ? weights : ["400"])
    );
    formData.append("styles", JSON.stringify(["normal"]));

    // Add each file to FormData
    validFiles.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    addFont.mutate(formData);
  };

  const handleEditFont = (font: FontData) => {
    setEditingFont(font);
    setSelectedWeights(font.weights);
    setSelectedStyles(font.styles);
  };

  const handleUpdateFont = async () => {
    if (!editingFont || !editingFont.id) return;

    const updateData = {
      name: editingFont.name,
      category: "font",
      data: {
        source: editingFont.source,
        weights: selectedWeights,
        styles: selectedStyles,
        sourceData: editingFont.sourceData,
      },
    };

    editFont.mutate({ id: editingFont.id, data: updateData });
    setEditingFont(null);
  };

  const transformedFonts = fonts
    .filter((asset) => asset.category === "font")
    .map(parseFontAsset)
    .filter((font): font is FontData => font !== null);

  const renderFontPicker = () => {
    if (showGoogleFontPicker) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Add Google Font</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGoogleFontPicker(false)}
            >
              Cancel
            </Button>
          </div>
          <GoogleFontPicker
            onFontSelect={(fontName) => {
              handleGoogleFontSelect(fontName);
              setShowGoogleFontPicker(false);
            }}
            isLoading={addFont.isPending}
            googleFonts={googleFonts}
            isFontsLoading={isFontsLoading}
          />
        </div>
      );
    }

    if (showAdobeFontPicker) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Add Adobe Font</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdobeFontPicker(false)}
            >
              Cancel
            </Button>
          </div>
          <AdobeFontPicker
            onFontSubmit={(data) => {
              handleAdobeFontSubmit(data);
              setShowAdobeFontPicker(false);
            }}
            isLoading={addFont.isPending}
          />
        </div>
      );
    }

    if (showCustomFontPicker) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Upload Custom Font</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomFontPicker(false)}
            >
              Cancel
            </Button>
          </div>
          <CustomFontPicker
            onFontUpload={(files, fontName, weights) => {
              handleCustomFontUpload(files, fontName, weights);
              setShowCustomFontPicker(false);
            }}
            isLoading={addFont.isPending}
          />
        </div>
      );
    }

    return (
      <FontPickerButtons
        onGoogleFontClick={() => setShowGoogleFontPicker(true)}
        onAdobeFontClick={() => setShowAdobeFontPicker(true)}
        onCustomFontClick={() => setShowCustomFontPicker(true)}
      />
    );
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Typography System
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage fonts and typography for this brand
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <AssetSection
          title="Brand Fonts"
          description="Typography assets that define the brand's visual identity and should be used consistently across all materials."
          isEmpty={transformedFonts.length === 0}
          sectionType="brand-fonts"
          emptyPlaceholder={
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Type className="h-8 w-8" />
              </div>
              <p>No fonts yet</p>
              <p className="text-sm">Contact an admin to add brand fonts</p>
            </div>
          }
          uploadComponent={isAbleToEdit ? renderFontPicker() : null}
        >
          <div className="asset-display">
            <div className="asset-display__info">
              Typography assets that define the brand's visual identity and
              should be used consistently across all materials.
            </div>
            <div className="asset-display__preview">
              {transformedFonts.map((font) => (
                <FontCard
                  key={font.id}
                  font={font}
                  onEdit={() => handleEditFont(font)}
                  onDelete={() => font.id && deleteFont.mutate(font.id)}
                />
              ))}

              {/* Show add font buttons when there are existing fonts */}
              {isAbleToEdit && transformedFonts.length > 0 && (
                <div className="mt-6">{renderFontPicker()}</div>
              )}
            </div>
          </div>
        </AssetSection>

        {/* Type Scale Manager - as specified in PRD, below font definitions */}
        <div>
          <TypeScaleManager clientId={clientId} />
        </div>
      </div>

      {/* Edit Font Dialog */}
      {isAbleToEdit && (
        <EditFontDialog
          editingFont={editingFont}
          setEditingFont={setEditingFont}
          selectedWeights={selectedWeights}
          selectedStyles={selectedStyles}
          setSelectedWeights={setSelectedWeights}
          setSelectedStyles={setSelectedStyles}
          onUpdateFont={handleUpdateFont}
          isUpdating={editFont.isPending}
        />
      )}
    </div>
  );
}
