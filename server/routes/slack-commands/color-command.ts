
import { and, eq } from "drizzle-orm";
import { brandAssets, slackWorkspaces } from "@shared/schema";
import { db } from "../../db";
import {
  checkRateLimit,
  filterColorAssetsByVariant,
  formatColorInfo,
  logSlackActivity,
} from "../../utils/slack-helpers";

export async function handleColorCommand({ command, ack, respond, client }: any) {
  await ack();

  // Rate limiting
  const rateLimit = checkRateLimit(command.team_id, 10, 60000);
  if (!rateLimit.allowed) {
    await respond({
      text: `⏱️ Rate limit exceeded. You can make ${rateLimit.remaining} more requests after ${new Date(rateLimit.resetTime).toLocaleTimeString()}.`,
      response_type: "ephemeral",
    });
    return;
  }

  const variant = command.text.trim();
  const auditLog = {
    userId: command.user_id,
    workspaceId: command.team_id,
    command: `/ferdinand-colors ${variant}`,
    assetIds: [] as number[],
    clientId: 0,
    success: false,
    timestamp: new Date(),
  };

  try {
    // Find the workspace
    const [workspace] = await db
      .select()
      .from(slackWorkspaces)
      .where(
        and(
          eq(slackWorkspaces.slackTeamId, command.team_id),
          eq(slackWorkspaces.isActive, true),
        ),
      );

    if (!workspace) {
      await respond({
        text: "❌ This Slack workspace is not connected to Ferdinand. Please contact your admin to set up the integration.",
        response_type: "ephemeral",
      });
      logSlackActivity({ ...auditLog, error: "Workspace not found" });
      return;
    }

    auditLog.clientId = workspace.clientId;

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

    // Build enhanced color blocks with visual swatches
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
      // Show up to 3 palettes
      const colorInfo = formatColorInfo(asset);

      if (colorInfo.colors.length === 0) {
        continue;
      }

      // Add palette title
      colorBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${colorInfo.title}*`,
        },
      });

      // Add color swatch image if available (but skip for now to avoid Slack errors)
      // Slack has strict requirements for image URLs
      // if (colorInfo.swatchUrl) {
      //   colorBlocks.push({
      //     type: "image",
      //     image_url: colorInfo.swatchUrl,
      //     alt_text: `Color palette for ${colorInfo.title}`,
      //   });
      // }

      // Add detailed color information
      const colorDetails = colorInfo.colors
        .map((color) => {
          let details = `🎨 *${color.name}*: ${color.hex}`;
          if (color.rgb) {
            details += ` | RGB: ${color.rgb}`;
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

      // Add divider between palettes
      if (
        colorAssets.indexOf(asset) < Math.min(colorAssets.length - 1, 2)
      ) {
        colorBlocks.push({
          type: "divider",
        });
      }
    }

    // Add footer with usage and variant tips
    const usageTips = variant
      ? `💡 *Usage Tips:* Copy hex codes for design tools | Try \`/ferdinand-colors brand\`, \`neutral\`, or \`interactive\` for specific color types`
      : `💡 *Usage Tips:* Copy hex codes for design tools | Try \`/ferdinand-colors brand\`, \`neutral\`, or \`interactive\` for specific color types`;

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

    auditLog.success = true;
    logSlackActivity(auditLog);
  } catch (error) {
    console.error("Error handling /ferdinand-colors command:", error);
    await respond({
      text: "❌ Sorry, there was an error retrieving your colors. Please try again later.",
      response_type: "ephemeral",
    });

    logSlackActivity({
      ...auditLog,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
