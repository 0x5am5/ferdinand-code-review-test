
import { and, eq } from "drizzle-orm";
import { brandAssets } from "@shared/schema";
import { db } from "../../../db";
import {
  filterColorAssetsByVariant,
  formatColorInfo,
  logSlackActivity,
} from "../../../utils/slack-helpers";

export async function handleColorSubcommand({
  command,
  respond,
  client,
  variant,
  workspace,
  auditLog,
}: {
  command: any;
  respond: any;
  client: any;
  variant: string;
  workspace: any;
  auditLog: any;
}) {
  const colorAssets = await db
    .select()
    .from(brandAssets)
    .where(
      and(
        eq(brandAssets.clientId, workspace.clientId),
        eq(brandAssets.category, "color"),
      ),
    );

  if (colorAssets.length === 0) {
    await respond({
      text: "🎨 No color assets found for your organization. Please add some colors in Ferdinand first.",
      response_type: "ephemeral",
    });
    logSlackActivity({ ...auditLog, error: "No color assets found" });
    return;
  }

  // Filter by variant if specified
  const filteredColorAssets = filterColorAssetsByVariant(
    colorAssets,
    variant,
  );

  if (filteredColorAssets.length === 0 && variant) {
    await respond({
      text: `🎨 No color assets found for variant "${variant}". Available palettes: ${colorAssets.map((a) => a.name).join(", ")}.\n\n💡 Try: \`brand\`, \`neutral\`, \`interactive\` or leave empty for all colors.`,
      response_type: "ephemeral",
    });
    logSlackActivity({
      ...auditLog,
      error: `No matches for variant: ${variant}`,
    });
    return;
  }

  const displayAssets =
    filteredColorAssets.length > 0 ? filteredColorAssets : colorAssets;
  auditLog.assetIds = displayAssets.map((asset) => asset.id);

  // Build enhanced color blocks with visual swatches (reuse existing logic)
  let headerText = `🎨 *Brand Color Palette*`;
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

  for (const asset of displayAssets.slice(0, 3)) {
    const colorInfo = formatColorInfo(asset);

    if (colorInfo.colors.length === 0) {
      continue;
    }

    colorBlocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${colorInfo.title}*`,
      },
    });

    // Skip image blocks for now to avoid Slack validation errors
    // if (colorInfo.swatchUrl) {
    //   colorBlocks.push({
    //     type: "image",
    //     image_url: colorInfo.swatchUrl,
    //     alt_text: `Color palette for ${colorInfo.title}`,
    //   });
    // }

    const colorDetails = colorInfo.colors
      .map((color) => {
        let details = `🎨 *${color.name}*: \`${color.hex}\``;
        if (color.rgb) {
          details += ` | RGB: \`${color.rgb}\``;
        }
        if (color.usage) {
          details += `\n   _Usage: ${color.usage}_`;
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

    if (colorAssets.indexOf(asset) < Math.min(colorAssets.length - 1, 2)) {
      colorBlocks.push({
        type: "divider",
      });
    }
  }

  const usageTips = variant
    ? `💡 *Usage Tips:* Copy hex codes for design tools | Try \`/ferdinand color brand\`, \`neutral\`, or \`interactive\` for specific color types`
    : `💡 *Usage Tips:* Copy hex codes for design tools | Try \`/ferdinand color brand\`, \`neutral\`, or \`interactive\` for specific color types`;

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

  await respond({
    blocks: colorBlocks,
    response_type: "ephemeral",
  });
}
