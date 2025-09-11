import { Monitor } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TypographyLevel =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body-large"
  | "body"
  | "body-small"
  | "caption"
  | "quote"
  | "code"
  | "small";

interface TypeStyle {
  level: TypographyLevel | string;
  name: string;
  size: number;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  backgroundColor?: string;
  textDecoration?: string;
  fontStyle?: string;
}

interface TypeScalePreviewProps {
  typeScale: {
    typeStyles?: TypeStyle[];
    baseSize?: number;
    scaleRatio?: number;
    unit?: string;
    bodyFontFamily?: string;
    bodyFontWeight?: string;
    bodyLetterSpacing?: number;
    bodyColor?: string;
    bodyTextTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
    bodyFontStyle?: "normal" | "italic" | "oblique";
    bodyTextDecoration?: "none" | "underline" | "overline" | "line-through";
    headerFontFamily?: string;
    headerFontWeight?: string;
    headerLetterSpacing?: number;
    headerColor?: string;
    headerTextTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
    headerFontStyle?: "normal" | "italic" | "oblique";
    headerTextDecoration?: "none" | "underline" | "overline" | "line-through";
    individualHeaderStyles?: {
      h1?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      h2?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      h3?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      h4?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      h5?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      h6?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
    };
    individualBodyStyles?: {
      "body-large"?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      body?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      "body-small"?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      caption?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      quote?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
      code?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
        fontSize?: string;
        textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
        fontStyle?: "normal" | "italic" | "oblique";
        textDecoration?: "none" | "underline" | "overline" | "line-through";
      };
    };
  };
}

export function TypeScalePreview({ typeScale }: TypeScalePreviewProps) {
  const typeStyles = typeScale.typeStyles || [];
  const baseSize = typeScale.baseSize || 16;
  const ratio = (typeScale.scaleRatio || 1250) / 1000;
  const unit = typeScale.unit || "px";

  const calculateFontSize = (level: string) => {
    let size: number;

    switch (level) {
      case "h6":
        size = baseSize * 0.8;
        break;
      case "h5":
        size = baseSize;
        break;
      case "h4":
        size = baseSize * ratio;
        break;
      case "h3":
        size = baseSize * ratio * ratio;
        break;
      case "h2":
        size = baseSize * ratio * ratio * ratio;
        break;
      case "h1":
        size = baseSize * ratio * ratio * ratio * ratio;
        break;
      case "body-large":
        size = baseSize * 1.125;
        break;
      case "body":
        size = baseSize;
        break;
      case "body-small":
        size = baseSize * 0.875;
        break;
      case "caption":
        size = baseSize * 0.75;
        break;
      case "quote":
        size = baseSize * 1.25;
        break;
      case "code":
        size = baseSize * 0.875;
        break;
      default:
        size = baseSize;
    }

    return `${Math.round(size * 100) / 100}${unit}`;
  };

  const getStyleForLevel = (style: TypeStyle): React.CSSProperties => {
    const isHeader = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(style.level);
    const isBody = [
      "body-large",
      "body",
      "body-small",
      "caption",
      "quote",
      "code",
    ].includes(style.level);

    // Get individual customizations
    const individualHeaderStyle = isHeader
      ? typeScale.individualHeaderStyles?.[
          style.level as keyof typeof typeScale.individualHeaderStyles
        ]
      : undefined;
    const individualBodyStyle = isBody
      ? typeScale.individualBodyStyles?.[
          style.level as keyof typeof typeScale.individualBodyStyles
        ]
      : undefined;

    // Use global font weights from typeScale, not from the style object
    const globalFontWeight = isHeader
      ? typeScale.headerFontWeight || "700"
      : typeScale.bodyFontWeight || "400";
    const globalLetterSpacing = isHeader
      ? typeScale.headerLetterSpacing || 0
      : typeScale.bodyLetterSpacing || 0;
    const globalColor = isHeader
      ? typeScale.headerColor || "#000000"
      : typeScale.bodyColor || "#000000";

    const baseStyle: React.CSSProperties = {
      fontSize: calculateFontSize(style.level),
      fontWeight: globalFontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: `${globalLetterSpacing}em`,
      color: globalColor,
      margin: 0,
      padding: "8px 0",
    };

    // Apply font family
    if (isHeader) {
      baseStyle.fontFamily =
        individualHeaderStyle?.fontFamily ||
        typeScale.headerFontFamily ||
        "inherit";
    } else {
      baseStyle.fontFamily =
        individualBodyStyle?.fontFamily ||
        typeScale.bodyFontFamily ||
        "inherit";
    }

    // Apply global header/body styles
    if (isHeader) {
      baseStyle.fontWeight = typeScale.headerFontWeight || "700";
      baseStyle.letterSpacing = `${typeScale.headerLetterSpacing || 0}em`;
      baseStyle.color = typeScale.headerColor || "#000000";
      if (typeScale.headerTextTransform)
        baseStyle.textTransform = typeScale.headerTextTransform;
      if (typeScale.headerFontStyle)
        baseStyle.fontStyle = typeScale.headerFontStyle;
      if (typeScale.headerTextDecoration)
        baseStyle.textDecoration = typeScale.headerTextDecoration;
    } else {
      baseStyle.fontWeight = typeScale.bodyFontWeight || "400";
      baseStyle.letterSpacing = `${typeScale.bodyLetterSpacing || 0}em`;
      baseStyle.color = typeScale.bodyColor || "#000000";
      if (typeScale.bodyTextTransform)
        baseStyle.textTransform = typeScale.bodyTextTransform;
      if (typeScale.bodyFontStyle)
        baseStyle.fontStyle = typeScale.bodyFontStyle;
      if (typeScale.bodyTextDecoration)
        baseStyle.textDecoration = typeScale.bodyTextDecoration;
    }

    // Apply individual customizations for headers
    if (individualHeaderStyle) {
      if (individualHeaderStyle.fontWeight)
        baseStyle.fontWeight = individualHeaderStyle.fontWeight;
      if (individualHeaderStyle.letterSpacing !== undefined)
        baseStyle.letterSpacing = `${individualHeaderStyle.letterSpacing}em`;
      if (individualHeaderStyle.color)
        baseStyle.color = individualHeaderStyle.color;
      if (individualHeaderStyle.fontSize)
        baseStyle.fontSize = individualHeaderStyle.fontSize;
      if (individualHeaderStyle.textTransform)
        baseStyle.textTransform = individualHeaderStyle.textTransform;
      if (individualHeaderStyle.fontStyle)
        baseStyle.fontStyle = individualHeaderStyle.fontStyle;
      if (individualHeaderStyle.textDecoration)
        baseStyle.textDecoration = individualHeaderStyle.textDecoration;
    }

    // Apply individual customizations for body
    if (individualBodyStyle) {
      if (individualBodyStyle.fontWeight)
        baseStyle.fontWeight = individualBodyStyle.fontWeight;
      if (individualBodyStyle.letterSpacing !== undefined)
        baseStyle.letterSpacing = `${individualBodyStyle.letterSpacing}em`;
      if (individualBodyStyle.color)
        baseStyle.color = individualBodyStyle.color;
      if (individualBodyStyle.fontSize)
        baseStyle.fontSize = individualBodyStyle.fontSize;
      if (individualBodyStyle.textTransform)
        baseStyle.textTransform = individualBodyStyle.textTransform;
      if (individualBodyStyle.fontStyle)
        baseStyle.fontStyle = individualBodyStyle.fontStyle;
      if (individualBodyStyle.textDecoration)
        baseStyle.textDecoration = individualBodyStyle.textDecoration;
    }

    return baseStyle;
  };

  const sampleText = {
    h1: "The quick brown fox jumps over the lazy dog",
    h2: "Typography creates meaning and emotion",
    h3: "Good design is good business",
    h4: "Design is not just what it looks like",
    h5: "Simplicity is the ultimate sophistication",
    h6: "Less is more when you know what matters",
    "body-large":
      "This is large body text for emphasis and important content that needs more visual weight than regular body text.",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    "body-small":
      "This is small body text for secondary information, captions, and supporting details.",
    caption: "Photo credit: Unsplash",
    quote:
      '"Design is not just what it looks like and feels like. Design is how it works." - Steve Jobs',
    code: "const calculateFontSize = (step) => Math.round(baseSize * Math.pow(ratio, step))",
    small: "Additional information and fine print details",
  };

  return (
    <div className="space-y-6">
      <Card className="preview-container">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Type Scale Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {typeStyles.map((style) => (
            <div key={style.level} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {style.level.toUpperCase().replace("-", " ")}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {style.name}
                  </span>
                  {/* Show individual customization indicator */}
                  {(typeScale.individualHeaderStyles?.[
                    style.level as keyof typeof typeScale.individualHeaderStyles
                  ] ||
                    typeScale.individualBodyStyles?.[
                      style.level as keyof typeof typeScale.individualBodyStyles
                    ]) && (
                    <Badge variant="secondary" className="text-xs">
                      Custom
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {calculateFontSize(style.level)}
                </div>
              </div>
              <div
                style={getStyleForLevel(style)}
                className="transition-all duration-200"
              >
                {sampleText[style.level as keyof typeof sampleText] ||
                  "Sample text"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
