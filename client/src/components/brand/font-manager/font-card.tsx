import { FontSource } from "@shared/schema";
import { Edit2, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { FontCardProps } from "./types";
import { generateGoogleFontUrl } from "./utils";

export function FontCard({ font, onEdit, onDelete }: FontCardProps) {
  const [selectedWeight, setSelectedWeight] = useState("400");
  const { user } = useAuth();
  const isAbleToEdit =
    user && ["super_admin", "admin", "editor"].includes(user.role as string);

  // Set default weight to the first available weight or 400
  React.useEffect(() => {
    if (font.weights.length > 0) {
      const defaultWeight = font.weights.includes("400")
        ? "400"
        : font.weights[0];
      setSelectedWeight(defaultWeight);
    }
  }, [font.weights]);

  // Load font for preview
  React.useEffect(() => {
    if (font.source === FontSource.GOOGLE) {
      // Generate URL with all available weights for preview
      const fontUrl =
        font.sourceData?.url ||
        generateGoogleFontUrl(font.name, font.weights, font.styles);

      const link = document.createElement("link");
      link.href = fontUrl;
      link.rel = "stylesheet";
      link.id = `font-${font.name.replace(/\s+/g, "-")}`;

      // Remove existing font link if it exists
      const existingLink = document.head.querySelector(
        `#font-${font.name.replace(/\s+/g, "-")}`
      );
      if (!existingLink) {
        document.head.appendChild(link);
      }
    } else if (font.source === FontSource.ADOBE && font.sourceData?.url) {
      const link = document.createElement("link");
      link.href = font.sourceData.url;
      link.rel = "stylesheet";
      link.id = `font-${font.name.replace(/\s+/g, "-")}`;

      // Remove existing font link if it exists
      const existingLink = document.head.querySelector(
        `#font-${font.name.replace(/\s+/g, "-")}`
      );
      if (!existingLink) {
        document.head.appendChild(link);
      }
    } else if (font.source === FontSource.FILE && font.id) {
      // Handle custom uploaded fonts
      const fontId = `font-${font.name.replace(/\s+/g, "-")}`;

      // Remove existing font face rules if they exist
      const existingStyle = document.head.querySelector(`#${fontId}`);
      if (existingStyle) {
        existingStyle.remove();
      }

      // Create @font-face CSS rules for custom fonts
      const style = document.createElement("style");
      style.id = fontId;

      let cssRules = "";

      // Generate @font-face rules for each weight
      font.weights.forEach((weight) => {
        font.styles.forEach((fontStyle) => {
          // Build font URLs for different formats
          const fontUrls = [
            `url('/api/assets/${font.id}/file?format=woff2') format('woff2')`,
            `url('/api/assets/${font.id}/file?format=woff') format('woff')`,
            `url('/api/assets/${font.id}/file?format=ttf') format('truetype')`,
            `url('/api/assets/${font.id}/file') format('truetype')`, // fallback to original
          ];

          cssRules += `
            @font-face {
              font-family: '${font.name}';
              src: ${fontUrls.join(", ")};
              font-weight: ${weight};
              font-style: ${fontStyle};
              font-display: swap;
            }
          `;
        });
      });

      style.textContent = cssRules;
      document.head.appendChild(style);
    }
  }, [
    font.name,
    font.source,
    font.sourceData,
    font.weights,
    font.styles,
    font.id,
  ]);

  return (
    <div className="p-4 mb-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-16 overflow-hidden">
          <h3 className="font-medium text-sm mb-0">{font.name}</h3>
          <p className="text-xs text-muted-foreground capitalize">
            {font.source} Font
          </p>

          {/* Font Preview Section */}
          <div className="text-left mb-4 mt-3 overflow-hidden">
            <div
              style={{
                fontFamily: `'${font.name}', monospace`,
                fontSize: "1.75rem",
                lineHeight: "1.4",
                fontWeight: selectedWeight,
                wordBreak: "break-all",
                overflowWrap: "break-word",
              }}
            >
              ABCDEFGHIJKLMNOPQRSTUVWXYZ
              <br />
              abcdefghijklmnopqrstuvwxyz 1234567890
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {font.weights.map((weight) => (
              <Badge
                key={weight}
                variant={selectedWeight === weight ? "default" : "outline"}
                className="text-xs cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => setSelectedWeight(weight)}
              >
                {weight}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      {isAbleToEdit && (
        <div className="absolute top-4 right-4 flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 w-8 p-0"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
