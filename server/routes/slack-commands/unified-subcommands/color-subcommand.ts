import { brandAssets } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  buildColorBlocks,
  buildColorConfirmationBlocks,
  shouldShowColorConfirmation,
} from "../../../utils/color-display";
import {
  filterColorAssetsByVariant,
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
  const filteredColorAssets = filterColorAssetsByVariant(colorAssets, variant);

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
}
