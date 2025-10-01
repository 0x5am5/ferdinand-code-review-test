import { WebClient } from "@slack/web-api";
import { and, eq } from "drizzle-orm";
import { brandAssets } from "@shared/schema";
import { db } from "../../../db";
import {
  decryptBotToken,
  findBestLogoMatch,
  formatAssetInfo,
  generateAssetDownloadUrl,
  logSlackActivity,
  uploadFileToSlack,
} from "../../../utils/slack-helpers";
import {
  buildLogoConfirmationBlocks,
  buildLogoProcessingMessage,
  buildLogoSummaryMessage,
  shouldShowLogoConfirmation,
} from "../../../utils/logo-display";

export async function handleLogoSubcommand({
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
  const startTime = Date.now();

  // Fetch logo assets for the workspace's client
  const logoAssets = await db
    .select()
    .from(brandAssets)
    .where(
      and(
        eq(brandAssets.clientId, workspace.clientId),
        eq(brandAssets.category, "logo"),
      ),
    );

  if (logoAssets.length === 0) {
    await respond({
      text: "📂 No logo assets found for your organization. Please upload some logos in Ferdinand first.",
      response_type: "ephemeral",
    });
    logSlackActivity({ ...auditLog, error: "No logo assets found" });
    return;
  }

  // Find matching logos based on the query
  const query = variant.trim();
  const matchedLogos = findBestLogoMatch(logoAssets, query);
  auditLog.assetIds = matchedLogos.map((asset) => asset.id);

  if (matchedLogos.length === 0) {
    await respond({
      text: `🔍 No logos found matching "${query}". Available types: main, horizontal, vertical, square, app_icon, favicon`,
      response_type: "ephemeral",
    });
    logSlackActivity({
      ...auditLog,
      error: `No matches for query: ${query}`,
    });
    return;
  }

  // Check if we have many results and should ask for confirmation
  if (shouldShowLogoConfirmation(matchedLogos.length)) {
    const confirmationBlocks = buildLogoConfirmationBlocks(
      matchedLogos,
      query,
      workspace.clientId,
    );

    await respond({
      blocks: confirmationBlocks,
      response_type: "ephemeral",
    });
    return;
  }

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

  // Respond immediately to avoid timeout
  const processingMessage = buildLogoProcessingMessage(matchedLogos, query);
  await respond({
    text: processingMessage,
    response_type: "ephemeral",
  });

  // Decrypt the workspace-specific bot token
  const botToken = decryptBotToken(workspace.botToken);

  // Upload files to Slack for matched logos (in background)
  const uploadPromises = matchedLogos.map(async (asset) => {
    const assetInfo = formatAssetInfo(asset);

    // Check if we should upload dark variant
    const isDarkQuery =
      query.toLowerCase() === "dark" ||
      query.toLowerCase() === "white" ||
      query.toLowerCase() === "inverse";
    const data =
      typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
    const hasDarkVariant = data?.hasDarkVariant === true;
    
    console.log(`[DARK VARIANT] Asset ${asset.id} (${asset.name}): isDarkQuery=${isDarkQuery}, hasDarkVariant=${hasDarkVariant}, query="${query}"`);
    if (isDarkQuery && !hasDarkVariant) {
      console.log(`[DARK VARIANT] Asset ${asset.id} requested as dark but has no dark variant, skipping dark upload`);
    }

    // Build download URL with variant parameter if needed
    const downloadParams: any = {
      format: "png", // Convert to PNG for better Slack compatibility
    };

    if (isDarkQuery && hasDarkVariant) {
      downloadParams.variant = "dark";
    }

    const downloadUrl = generateAssetDownloadUrl(
      asset.id,
      workspace.clientId,
      baseUrl,
      downloadParams,
    );

    const variantSuffix = isDarkQuery && hasDarkVariant ? "_dark" : "";
    const filename = `${asset.name.replace(/\s+/g, "_")}${variantSuffix}.png`;

    const variantNote = isDarkQuery && hasDarkVariant ? " (Dark Variant)" : "";
    const title = `${assetInfo.title}${variantNote}`;

    return uploadFileToSlack(botToken, {
      channelId: command.channel_id,
      userId: command.user_id,
      fileUrl: downloadUrl,
      filename,
      title,
      initialComment: `📋 *${title}*\n${assetInfo.description}\n• Type: ${assetInfo.type}\n• Format: ${assetInfo.format}${variantNote ? `\n• Variant: Dark` : ""}`,
    });
  });

  const uploadResults = await Promise.all(uploadPromises);
  const successfulUploads = uploadResults.filter(Boolean).length;

  if (successfulUploads === 0) {
    await respond({
      text: "❌ Failed to upload logo files. Please try again later.",
      response_type: "ephemeral",
    });
    logSlackActivity({ ...auditLog, error: "All file uploads failed" });
    return;
  }

  // Show summary message
  const responseTime = Date.now() - startTime;
  const summaryText = buildLogoSummaryMessage(
    successfulUploads,
    matchedLogos.length,
    query,
    responseTime,
  );

  await respond({
    text: summaryText,
    response_type: "ephemeral",
  });
}
