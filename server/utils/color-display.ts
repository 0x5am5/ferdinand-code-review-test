import { hexToRgb, hexToHsl, hexToCmyk } from "./color-conversion";
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

// Build color blocks for Slack display
export function buildColorBlocks(
  displayAssets: any[],
  filteredColorAssets: any[],
  colorAssets: any[],
  variant?: string,
) {
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
        if (!groups["color"]) {
          groups["color"] = [];
        }
        groups["color"].push(asset);
        return groups;
      }
    },
    {},
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

  const colorBlocks: any[] = [
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