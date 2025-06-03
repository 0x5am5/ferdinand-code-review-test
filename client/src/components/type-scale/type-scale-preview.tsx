import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Monitor, Tablet, Smartphone } from "lucide-react";

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
  const getStyleForLevel = (style: TypeStyle) => ({
    fontSize: calculateFontSize(style.size),
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}px`,
    color: style.color,
    backgroundColor: style.backgroundColor || 'transparent',
    textDecoration: style.textDecoration || 'none',
    fontStyle: style.fontStyle || 'normal',
  });

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

  const landingPageSample = `
    <h1>Welcome to Our Brand</h1>
    <h2>Discover the Power of Typography</h2>
    <p>Our carefully crafted type scale ensures perfect hierarchy and readability across all devices. Every element works in harmony to create an exceptional user experience.</p>
    
    <h3>Why Typography Matters</h3>
    <p>Typography is more than just choosing fonts - it's about creating meaningful connections between your brand and your audience. A well-designed type scale provides consistency and professionalism.</p>
    
    <h4>Key Benefits</h4>
    <ul>
      <li>Improved readability and user experience</li>
      <li>Consistent brand presentation</li>
      <li>Better accessibility and inclusivity</li>
      <li>Professional appearance across all platforms</li>
    </ul>
    
    <h5>Getting Started</h5>
    <p>Start implementing your type scale today by downloading the CSS or SCSS files. Our generated code is ready to use in your projects.</p>
    
    <h6>Additional Resources</h6>
    <small>For more information about typography best practices, visit our documentation.</small>
  `;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="hierarchy" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hierarchy">Type Hierarchy</TabsTrigger>
          <TabsTrigger value="landing">Landing Page Preview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="hierarchy" className="space-y-4">
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
        </TabsContent>
        
        <TabsContent value="landing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Landing Page Simulation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'h1') || typeStyles[0])}
                  className="mb-4"
                >
                  Welcome to Our Brand
                </div>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'h2') || typeStyles[1])}
                  className="mb-4"
                >
                  Discover the Power of Typography
                </div>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'body') || typeStyles[6])}
                  className="mb-6"
                >
                  Our carefully crafted type scale ensures perfect hierarchy and readability across all devices. Every element works in harmony to create an exceptional user experience.
                </div>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'h3') || typeStyles[2])}
                  className="mb-3"
                >
                  Why Typography Matters
                </div>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'body') || typeStyles[6])}
                  className="mb-6"
                >
                  Typography is more than just choosing fonts - it's about creating meaningful connections between your brand and your audience. A well-designed type scale provides consistency and professionalism.
                </div>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'h4') || typeStyles[3])}
                  className="mb-3"
                >
                  Key Benefits
                </div>
                
                <ul className="mb-6 space-y-2">
                  {[
                    "Improved readability and user experience",
                    "Consistent brand presentation", 
                    "Better accessibility and inclusivity",
                    "Professional appearance across all platforms"
                  ].map((item, index) => (
                    <li
                      key={index}
                      style={getStyleForLevel(typeStyles.find(s => s.level === 'body') || typeStyles[6])}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'h5') || typeStyles[4])}
                  className="mb-3"
                >
                  Getting Started
                </div>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'body') || typeStyles[6])}
                  className="mb-6"
                >
                  Start implementing your type scale today by downloading the CSS or SCSS files. Our generated code is ready to use in your projects.
                </div>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'h6') || typeStyles[5])}
                  className="mb-2"
                >
                  Additional Resources
                </div>
                
                <div
                  style={getStyleForLevel(typeStyles.find(s => s.level === 'small') || typeStyles[7])}
                >
                  For more information about typography best practices, visit our documentation.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}