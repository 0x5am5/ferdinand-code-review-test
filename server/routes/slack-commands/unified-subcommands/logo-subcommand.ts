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
  if (matchedLogos.length > 5) {
    const confirmationBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🏷️ Found **${matchedLogos.length} logo files**${query ? ` matching "${query}"` : ""}.`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📁 This will upload many files to your channel. Would you like to:\n\n• **Upload all ${matchedLogos.length} logos** (may flood the channel)\n• **Narrow your search** with terms like "dark", "square", "horizontal"\n• **Upload just the first 3** for a quick preview`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: `Upload All ${matchedLogos.length}`,
            },
            style: "primary",
            action_id: "upload_all_logos",
            value: `${workspace.clientId}|${query || ""}|all`,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Upload First 3",
            },
            action_id: "upload_limited_logos",
            value: `${workspace.clientId}|${query || ""}|3`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 *Tip:* Try `/ferdinand logo dark` or `/ferdinand logo square` for more specific results.",
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

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

  // Respond immediately to avoid timeout
  await respond({
    text: `🔄 Processing ${matchedLogos.length} logo${matchedLogos.length > 1 ? "s" : ""}${query ? ` (${query} variant)` : ""}...`,
    response_type: "ephemeral",
  });

  // Decrypt the workspace-specific bot token
  const botToken = decryptBotToken(workspace.botToken);

  // Upload files to Slack for matched logos (in background)
  const uploadPromises = matchedLogos.slice(0, 3).map(async (asset) => {
    const assetInfo = formatAssetInfo(asset);
    const downloadUrl = generateAssetDownloadUrl(
      asset.id,
      workspace.clientId,
      baseUrl,
      {
        format: "png", // Convert to PNG for better Slack compatibility
      },
    );

    const filename = `${asset.name.replace(/\s+/g, "_")}.png`;

    return uploadFileToSlack(botToken, {
      channelId: command.channel_id,
      userId: command.user_id,
      fileUrl: downloadUrl,
      filename,
      title: assetInfo.title,
      initialComment: `📋 **${assetInfo.title}**\n${assetInfo.description}\n• Type: ${assetInfo.type}\n• Format: ${assetInfo.format}`,
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
  let summaryText = `✅ **${successfulUploads} logo${successfulUploads > 1 ? "s" : ""} uploaded successfully!**`;

  if (query) {
    summaryText += `\n🔍 Search: "${query}" (${matchedLogos.length} match${matchedLogos.length > 1 ? "es" : ""})`;
  }

  if (successfulUploads < matchedLogos.length) {
    summaryText += `\n💡 Some uploads may have failed. Try narrowing your search for better results.`;
  }

  summaryText += `\n⏱️ Response time: ${responseTime}ms`;

  await respond({
    text: summaryText,
    response_type: "ephemeral",
  });
}