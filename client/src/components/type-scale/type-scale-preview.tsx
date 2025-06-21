import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor } from "lucide-react";

type TypographyLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | 
                     "body-large" | "body" | "body-small" | 
                     "caption" | "quote" | "code" | "small";

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
    headerFontFamily?: string;
    headerFontWeight?: string;
    headerLetterSpacing?: number;
    headerColor?: string;
    individualHeaderStyles?: {
      h1?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      h2?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      h3?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      h4?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      h5?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      h6?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
    };
    individualBodyStyles?: {
      "body-large"?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      "body"?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      "body-small"?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      "caption"?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      "quote"?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
      "code"?: {
        fontWeight?: string;
        letterSpacing?: number;
        color?: string;
        fontFamily?: string;
      };
    };
  };
}

export function TypeScalePreview({ typeScale }: TypeScalePreviewProps) {
  const typeStyles = typeScale.typeStyles || [];
  const baseSize = typeScale.baseSize || 16;
  const ratio = (typeScale.scaleRatio || 1250) / 1000;
  const unit = typeScale.unit || "px";

  const calculateFontSize = (step: number) => {
    const size = Math.round(baseSize * Math.pow(ratio, step) * 100) / 100;
    return `${size}${unit}`;
  };

  const getStyleForLevel = (style: TypeStyle) => {
    const size = calculateFontSize(style.size);
    const isHeader = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(style.level);
    const isBodyType = ["body-large", "body", "body-small", "caption", "quote", "code"].includes(style.level);
    const isCode = style.level === "code";
    const isQuote = style.level === "quote";

    // Check for individual header styles
    const individualHeaderStyle = isHeader ? typeScale.individualHeaderStyles?.[style.level as keyof typeof typeScale.individualHeaderStyles] : null;

    // Check for individual body styles
    const individualBodyStyle = isBodyType ? typeScale.individualBodyStyles?.[style.level as keyof typeof typeScale.individualBodyStyles] : null;

    // Determine base styles from type scale settings
    const baseFontFamily = isHeader ? typeScale.headerFontFamily : typeScale.bodyFontFamily;
    const baseFontWeight = isHeader ? typeScale.headerFontWeight : typeScale.bodyFontWeight;
    const baseLetterSpacing = isHeader ? typeScale.headerLetterSpacing : typeScale.bodyLetterSpacing;
    const baseColor = isHeader ? typeScale.headerColor : typeScale.bodyColor;

    // Apply individual overrides
    const finalFontFamily = individualHeaderStyle?.fontFamily || individualBodyStyle?.fontFamily || baseFontFamily || 'inherit';
    const finalFontWeight = individualHeaderStyle?.fontWeight || individualBodyStyle?.fontWeight || baseFontWeight || '400';
    const finalLetterSpacing = individualHeaderStyle?.letterSpacing !== undefined ? individualHeaderStyle.letterSpacing : 
                               individualBodyStyle?.letterSpacing !== undefined ? individualBodyStyle.letterSpacing : 
                               baseLetterSpacing || 0;
    const finalColor = individualHeaderStyle?.color || individualBodyStyle?.color || baseColor || '#000000';

    return {
      fontSize: size,
      fontFamily: finalFontFamily,
      fontWeight: finalFontWeight,
      letterSpacing: `${finalLetterSpacing}em`,
      color: finalColor,
      lineHeight: style.lineHeight,
      ...(isCode && {
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        border: '1px solid rgba(0, 0, 0, 0.1)',
      }),
      ...(isQuote && {
        fontStyle: 'italic',
        borderLeft: '4px solid rgba(0, 0, 0, 0.1)',
        paddingLeft: '1rem',
        margin: '1rem 0',
      }),
    };
  };

  const sampleText = {
    h1: "The quick brown fox jumps over the lazy dog",
    h2: "Typography creates meaning and emotion",
    h3: "Good design is good business",
    h4: "Design is not just what it looks like",
    h5: "Simplicity is the ultimate sophistication",
    h6: "Less is more when you know what matters",
    "body-large": "This is large body text for emphasis and important content that needs more visual weight than regular body text.",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    "body-small": "This is small body text for secondary information, captions, and supporting details.",
    caption: "Photo credit: Unsplash",
    quote: "\"Design is not just what it looks like and feels like. Design is how it works.\" - Steve Jobs",
    code: "const calculateFontSize = (step) => Math.round(baseSize * Math.pow(ratio, step))",
    small: "Additional information and fine print details"
  };

  return (
    <div className="space-y-6">
      <Card>
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
                  <Badge variant="outline">{style.level.toUpperCase().replace('-', ' ')}</Badge>
                  <span className="text-sm text-muted-foreground">{style.name}</span>
                  {/* Show individual customization indicator */}
                  {(typeScale.individualHeaderStyles?.[style.level as keyof typeof typeScale.individualHeaderStyles] ||
                    typeScale.individualBodyStyles?.[style.level as keyof typeof typeScale.individualBodyStyles]) && (
                    <Badge variant="secondary" className="text-xs">Custom</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {calculateFontSize(style.size)}
                </div>
              </div>
              <div
                style={getStyleForLevel(style)}
                className="transition-all duration-200"
              >
                {sampleText[style.level as keyof typeof sampleText] || "Sample text"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}