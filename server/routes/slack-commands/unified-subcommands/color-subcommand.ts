import { and, eq } from "drizzle-orm";
import { brandAssets } from "@shared/schema";
import { db } from "../../../db";
import {
  filterColorAssetsByVariant,
  logSlackActivity,
} from "../../../utils/slack-helpers";
import { buildColorBlocks } from "../../../utils/color-display";

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

  // Check if we have many results and should ask for confirmation
  if (displayAssets.length > 5) {
    const confirmationBlocks = [
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
            value: `${workspace.clientId}|${variant || ""}|all`,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Show First 3",
            },
            action_id: "show_limited_colors",
            value: `${workspace.clientId}|${variant || ""}|3`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 *Tip:* Try `/ferdinand color brand` or `/ferdinand color neutral` for more targeted results.",
          },
        ],
      },
    ];

    await respond({
      blocks: confirmationBlocks,
      response_type: "ephemeral",
    });
    return;
  }

  // Build color blocks using shared utility
  const colorBlocks = buildColorBlocks(
    displayAssets,
    filteredColorAssets,
    colorAssets,
    variant
  );

  await respond({
    blocks: colorBlocks,
    response_type: "ephemeral",
  });
}