
import { formatFontInfo } from "./slack-helpers";

// Font display constants
export const FONT_CATEGORY_ORDER = ["brand", "body", "header", "other"];

export const FONT_CATEGORY_EMOJIS: Record<string, string> = {
  brand: "🎯",
  body: "📖", 
  header: "📰",
  other: "📝",
};

export const FONT_CATEGORY_NAMES: Record<string, string> = {
  brand: "Brand Fonts",
  body: "Body Fonts", 
  header: "Header Fonts",
  other: "Other Fonts",
};

// Build font blocks for Slack display
export function buildFontBlocks(
  displayAssets: any[],
  filteredFontAssets: any[],
  fontAssets: any[],
  variant?: string,
) {
  // Group assets by category for better organization
  const groupedAssets = displayAssets.reduce(
    (groups: Record<string, typeof displayAssets>, asset) => {
      try {
        const fontInfo = formatFontInfo(asset);
        const category = fontInfo.category || "other";
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(asset);
        return groups;
      } catch {
        if (!groups["other"]) {
          groups["other"] = [];
        }
        groups["other"].push(asset);
        return groups;
      }
    },
    {},
  );

  // Build enhanced font blocks organized by category
  let headerText = `📝 *Brand Typography System*`;
  if (variant) {
    headerText = `📝 *${variant.charAt(0).toUpperCase() + variant.slice(1)} Fonts*`;
  }
  headerText += ` (${displayAssets.length} font${displayAssets.length > 1 ? "s" : ""})`;

  if (filteredFontAssets.length < fontAssets.length && variant) {
    headerText += ` from ${fontAssets.length} total`;
  }

  const fontBlocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: headerText,
      },
    },
    {
      type: "divider",
    },
  ];

  // Process each category in order
  for (const category of FONT_CATEGORY_ORDER) {
    if (!groupedAssets[category] || groupedAssets[category].length === 0)
      continue;

    // Add category header
    fontBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${FONT_CATEGORY_EMOJIS[category]} *${FONT_CATEGORY_NAMES[category]}*`,
      },
    });

    // Process each asset in this category
    for (const asset of groupedAssets[category]) {
      const fontInfo = formatFontInfo(asset);

      // Add font details
      let fontDetails = `   📝 *${fontInfo.title}*\n`;
      fontDetails += `   • **Source:** ${fontInfo.source.charAt(0).toUpperCase() + fontInfo.source.slice(1)}\n`;
      fontDetails += `   • **Weights:** ${fontInfo.weights.join(", ")}\n`;
      fontDetails += `   • **Styles:** ${fontInfo.styles.join(", ")}`;
      
      if (fontInfo.usage) {
        fontDetails += `\n   • **Usage:** ${fontInfo.usage}`;
      }

      fontBlocks.push({
        type: "section", 
        text: {
          type: "mrkdwn",
          text: fontDetails,
        },
      });
    }

    // Add spacing between categories
    fontBlocks.push({
      type: "divider",
    });
  }

  // Handle any remaining categories not in the main order
  for (const [category, assets] of Object.entries(groupedAssets)) {
    if (FONT_CATEGORY_ORDER.includes(category) || assets.length === 0)
      continue;

    fontBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${FONT_CATEGORY_EMOJIS[category] || "📝"} *${FONT_CATEGORY_NAMES[category] || category.charAt(0).toUpperCase() + category.slice(1)}*`,
      },
    });

    for (const asset of assets) {
      const fontInfo = formatFontInfo(asset);

      let fontDetails = `   📝 *${fontInfo.title}*\n`;
      fontDetails += `   • **Source:** ${fontInfo.source.charAt(0).toUpperCase() + fontInfo.source.slice(1)}\n`;
      fontDetails += `   • **Weights:** ${fontInfo.weights.join(", ")}\n`;
      fontDetails += `   • **Styles:** ${fontInfo.styles.join(", ")}`;
      
      if (fontInfo.usage) {
        fontDetails += `\n   • **Usage:** ${fontInfo.usage}`;
      }

      fontBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn", 
          text: fontDetails,
        },
      });
    }

    fontBlocks.push({
      type: "divider",
    });
  }

  // Add footer with usage and variant tips
  const usageTips = variant
    ? `💡 *Usage Tips:* Font files and CSS will be processed separately | Try \`/ferdinand-fonts brand\`, \`body\`, or \`header\` for specific font types`
    : `💡 *Usage Tips:* Font files and CSS will be processed separately | Try \`/ferdinand-fonts brand\`, \`body\`, or \`header\` for specific font types`;

  fontBlocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: usageTips,
      },
    ],
  });

  return fontBlocks;
}
