import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor } from "lucide-react";

interface TypeStyle {
  level: string;
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

    // Check for individual header styles
    const individualStyle = typeScale.individualHeaderStyles?.[style.level as keyof typeof typeScale.individualHeaderStyles];

    return {
      fontSize: size,
      fontWeight: individualStyle?.fontWeight || style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: `${individualStyle?.letterSpacing !== undefined ? individualStyle.letterSpacing : style.letterSpacing}em`,
      color: individualStyle?.color || style.color,
      fontFamily: individualStyle?.fontFamily || (isHeader 
        ? (typeScale.headerFontFamily || 'inherit')
        : (typeScale.bodyFontFamily || 'inherit')),
      margin: 0,
      padding: 0
    };
  };

  const sampleText = {
    h1: "The quick brown fox jumps over the lazy dog",
    h2: "Typography creates meaning and emotion",
    h3: "Good design is good business",
    h4: "Design is not just what it looks like",
    h5: "Simplicity is the ultimate sophistication",
    h6: "Less is more when you know what matters",
    body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
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
                  <Badge variant="outline">{style.level.toUpperCase()}</Badge>
                  <span className="text-sm text-muted-foreground">{style.name}</span>
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