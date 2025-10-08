import type { BrandAsset } from "@shared/schema";
import { hexToCmyk, hexToHsl, hexToRgb } from "./color-conversion";
import { formatColorInfo } from "./slack-helpers";

// Color display constants
export const COLOR_CATEGORY_ORDER = ["brand", "neutral", "interactive"];

export const COLOR_CATEGORY_EMOJIS: Record<string, string> = {
  brand: "🎯",
  neutral: "⚫",
  interactive: "🔗",
  color: "🎨",
};

export const COLOR_CATEGORY_NAMES: Record<string, string> = {
  brand: "Brand Colors",
  neutral: "Neutral Colors",
  interactive: "Interactive Colors",
  color: "Other Colors",
};

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  elements?: Array<{
    type: string;
    text?: string | { type: string; text: string };
    style?: string;
    action_id?: string;
    value?: string;
  }>;
}

// Build color blocks for Slack display
export function buildColorBlocks(
  displayAssets: BrandAsset[],
  filteredColorAssets: BrandAsset[],
  colorAssets: BrandAsset[],
  variant?: string
): SlackBlock[] {
  // Group assets by category for better organization
  const groupedAssets = displayAssets.reduce(
    (groups: Record<string, typeof displayAssets>, asset) => {
      try {
        const data =
          typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
        const category = data?.category || "color";
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(asset);
        return groups;
      } catch {
        if (!groups.color) {
          groups.color = [];
        }
        groups.color.push(asset);
        return groups;
      }
    },
    {}
  );

  // Build enhanced color blocks organized by category
  let headerText = `🎨 *Brand Color System*`;
  if (variant) {
    headerText = `🎨 *${variant.charAt(0).toUpperCase() + variant.slice(1)} Colors*`;
  }
  headerText += ` (${displayAssets.length} palette${displayAssets.length > 1 ? "s" : ""})`;

  if (filteredColorAssets.length < colorAssets.length && variant) {
    headerText += ` from ${colorAssets.length} total`;
  }

  const colorBlocks: SlackBlock[] = [
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
  for (const category of COLOR_CATEGORY_ORDER) {
    if (!groupedAssets[category] || groupedAssets[category].length === 0)
      continue;

    // Add category header
    colorBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${COLOR_CATEGORY_EMOJIS[category]} *${COLOR_CATEGORY_NAMES[category]}*`,
      },
    });

    // Process each asset in this category
    for (const asset of groupedAssets[category]) {
      const colorInfo = formatColorInfo(asset);

      if (colorInfo.colors.length === 0) {
        continue;
      }

      // Add palette name
      colorBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `   *${colorInfo.title}* ${colorInfo.colors[0].hex}`,
        },
      });

      // Add detailed color information with all formats
      const colorDetails = colorInfo.colors
        .map((color) => {
          const rgb = hexToRgb(color.hex);
          const hsl = hexToHsl(color.hex);
          const cmyk = hexToCmyk(color.hex);

          let details = `• *HEX:* \`${color.hex}\`\n`;
          details += `• *RGB:* \`${rgb}\`\n`;
          details += `• *HSL:* \`${hsl}\`\n`;
          details += `• *CMYK:* \`${cmyk}\``;

          // Add Pantone if available
          if (color.pantone) {
            details += `\n• *Pantone:* \`${color.pantone}\``;
          }

          if (color.usage) {
            details += `\n      _${color.usage}_`;
          }
          return details;
        })
        .join("\n\n");

      colorBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: colorDetails,
        },
      });
    }

    // Add spacing between categories
    colorBlocks.push({
      type: "divider",
    });
  }

  // Handle any remaining categories not in the main order
  for (const [category, assets] of Object.entries(groupedAssets)) {
    if (COLOR_CATEGORY_ORDER.includes(category) || assets.length === 0)
      continue;

    colorBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${COLOR_CATEGORY_EMOJIS[category] || "🎨"} *${COLOR_CATEGORY_NAMES[category] || category.charAt(0).toUpperCase() + category.slice(1)}*`,
      },
    });

    for (const asset of assets) {
      const colorInfo = formatColorInfo(asset);

      if (colorInfo.colors.length === 0) {
        continue;
      }

      colorBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `   *${colorInfo.title}* ${colorInfo.colors[0].hex}`,
        },
      });

      const colorDetails = colorInfo.colors
        .map((color) => {
          const rgb = hexToRgb(color.hex);
          const hsl = hexToHsl(color.hex);
          const cmyk = hexToCmyk(color.hex);

          let details = `• *HEX:* \`${color.hex}\`\n`;
          details += `• *RGB:* \`${rgb}\`\n`;
          details += `• *HSL:* \`${hsl}\`\n`;
          details += `• *CMYK:* \`${cmyk}\``;

          // Add Pantone if available
          if (color.pantone) {
            details += `\n• *Pantone:* \`${color.pantone}\``;
          }

          if (color.usage) {
            details += `\n      _${color.usage}_`;
          }
          return details;
        })
        .join("\n\n");

      colorBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: colorDetails,
        },
      });
    }

    colorBlocks.push({
      type: "divider",
    });
  }

  // Add footer with usage and variant tips
  const usageTips = variant
    ? `💡 *Usage Tips:* Copy color values (HEX, RGB, HSL, CMYK) for design tools | Try \`/ferdinand color brand\`, \`neutral\`, or \`interactive\` for specific color types`
    : `💡 *Usage Tips:* Copy color values (HEX, RGB, HSL, CMYK) for design tools | Try \`/ferdinand color brand\`, \`neutral\`, or \`interactive\` for specific color types`;

  colorBlocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: usageTips,
      },
    ],
  });

  // Remove the "showing first 3" message since we now show all palettes

  return colorBlocks;
}

export interface ColorDisplayOptions {
  variant?: string;
  showConfirmation?: boolean;
  workspaceClientId: number;
}

// Build confirmation blocks for large color result sets
export function buildColorConfirmationBlocks(
  displayAssets: BrandAsset[],
  variant: string,
  workspaceClientId: number
): SlackBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎨 Found **${displayAssets.length} color palettes**${variant ? ` for "${variant}"` : ""}.`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📋 This is a large number of results. Would you like to:\n\n• **See all ${displayAssets.length} palettes** (may be overwhelming)\n• **Narrow your search** with more specific terms like "brand", "neutral", or "interactive"\n• **See just the first 3** for a quick overview`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: `Show All ${displayAssets.length}`,
          },
          style: "primary",
          action_id: "show_all_colors",
          value: `${workspaceClientId}|${variant || ""}|all`,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Show First 3",
          },
          action_id: "show_limited_colors",
          value: `${workspaceClientId}|${variant || ""}|3`,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "💡 *Tip:* Try `/ferdinand-color brand` or `/ferdinand-color neutral` for more targeted results.",
        },
      ],
    },
  ];
}

// Build processing message for color display
export function buildColorProcessingMessage(
  displayAssets: BrandAsset[],
  variant?: string
): string {
  return variant
    ? `🎨 Processing *${displayAssets.length} color palettes* for "${variant}"...`
    : `🎨 Processing *${displayAssets.length} color palettes*...`;
}

// Build summary message after color display
export function buildColorSummaryMessage(
  displayedCount: number,
  totalCount: number,
  variant?: string,
  responseTime?: number
): string {
  let summaryText = `✅ *${displayedCount} color palette${displayedCount > 1 ? "s" : ""} displayed successfully!*`;

  if (variant) {
    summaryText += `\n🔍 Filtered by: "${variant}"`;
  }

  if (displayedCount < totalCount) {
    summaryText += `\n💡 Showing ${displayedCount} of ${totalCount} results.`;
  }

  if (responseTime) {
    summaryText += `\n⏱️ Response time: ${responseTime}ms`;
  }

  return summaryText;
}

// Check if we should show confirmation for large result sets
export function shouldShowColorConfirmation(colorCount: number): boolean {
  return colorCount > 5;
}
