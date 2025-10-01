
// Font helper utilities shared between font commands

// Helper functions
export function hasUploadableFiles(asset: any): boolean {
  try {
    const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
    return data?.source === "file" && data?.sourceData?.files && data.sourceData.files.length > 0;
  } catch {
    return false;
  }
}

export function generateGoogleFontCSS(fontFamily: string, weights: string[]): string {
  const weightParam = weights.join(";");
  return `/* Google Font: ${fontFamily} */
@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@${weightParam}&display=swap');

.your-element {
  font-family: '${fontFamily}', sans-serif;
  font-weight: ${weights[0] || "400"};
}`;
}

export function generateAdobeFontCSS(projectId: string, fontFamily: string): string {
  return `/* Adobe Font: ${fontFamily} */
<link rel="stylesheet" href="https://use.typekit.net/${projectId}.css">

.your-element {
  font-family: '${fontFamily}', sans-serif;
}`;
}

// Font processing constants
export const FONT_CATEGORY_ORDER = ['brand', 'body', 'header', 'other'];

export const FONT_CATEGORY_EMOJIS: Record<string, string> = {
  brand: '🎯',
  body: '📖',
  header: '📰',
  other: '📝'
};

export const FONT_CATEGORY_NAMES: Record<string, string> = {
  brand: 'Brand Fonts',
  body: 'Body Fonts',
  header: 'Header Fonts',
  other: 'Other Fonts'
};
