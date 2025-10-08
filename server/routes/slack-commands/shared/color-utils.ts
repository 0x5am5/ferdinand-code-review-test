// Color conversion utilities
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `${r}, ${g}, ${b}`;
}

export function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number = 0;
  let s: number;
  const l: number = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)}°, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
}

export function hexToCmyk(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const k = 1 - Math.max(r, g, b);
  let c = (1 - r - k) / (1 - k);
  let m = (1 - g - k) / (1 - k);
  let y = (1 - b - k) / (1 - k);

  if (k === 1) {
    c = m = y = 0;
  }

  return `${Math.round(c * 100)}%, ${Math.round(m * 100)}%, ${Math.round(y * 100)}%, ${Math.round(k * 100)}%`;
}

// Color block building utilities
export function buildColorBlocks(
  displayAssets: any[],
  filteredColorAssets: any[],
  colorAssets: any[],
  variant: string,
  formatColorInfo: any
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

  // Category order and emojis
  const categoryOrder = ["brand", "neutral", "interactive"];
  const categoryEmojis: Record<string, string> = {
    brand: "🎯",
    neutral: "⚫",
    interactive: "🔗",
    color: "🎨",
  };

  const categoryNames: Record<string, string> = {
    brand: "Brand Colors",
    neutral: "Neutral Colors",
    interactive: "Interactive Colors",
    color: "Other Colors",
  };

  // Process each category in order
  for (const category of categoryOrder) {
    if (!groupedAssets[category] || groupedAssets[category].length === 0)
      continue;

    // Add category header
    colorBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${categoryEmojis[category]} *${categoryNames[category]}*`,
      },
    });

    // Process each asset in this category (show up to 3 palettes)
    for (const asset of groupedAssets[category].slice(0, 3)) {
      const colorInfo = formatColorInfo(asset);

      if (colorInfo.colors.length === 0) {
        continue;
      }

      // Add palette name
      colorBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `   *${colorInfo.title}*`,
        },
      });

      // Add detailed color information with all formats
      const colorDetails = colorInfo.colors
        .map((color: any) => {
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
    if (categoryOrder.includes(category) || assets.length === 0) continue;

    colorBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${categoryEmojis[category] || "🎨"} *${categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1)}*`,
      },
    });

    for (const asset of (assets as any[]).slice(0, 3)) {
      const colorInfo = formatColorInfo(asset);

      if (colorInfo.colors.length === 0) {
        continue;
      }

      colorBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `   *${colorInfo.title}*`,
        },
      });

      const colorDetails = colorInfo.colors
        .map((color: any) => {
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

  if (displayAssets.length > 3) {
    colorBlocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📋 Showing first 3 palettes. Total available: ${displayAssets.length}`,
        },
      ],
    });
  }

  return colorBlocks;
}
