import { brandAssets, slackWorkspaces } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import type { SlackCommandArgs } from "../../types/slack-types";
import {
  buildColorBlocks,
  buildColorConfirmationBlocks,
  shouldShowColorConfirmation,
} from "../../utils/color-display";
import {
  checkRateLimit,
  filterColorAssetsByVariant,
  logSlackActivity,
} from "../../utils/slack-helpers";

export async function handleColorCommand({
  command,
  ack,
  respond,
}: SlackCommandArgs) {
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
          eq(slackWorkspaces.isActive, true)
        )
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
          eq(brandAssets.category, "color")
        )
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
      variant
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
    if (shouldShowColorConfirmation(displayAssets.length)) {
      const confirmationBlocks = buildColorConfirmationBlocks(
        displayAssets,
        variant,
        workspace.clientId
      );

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
