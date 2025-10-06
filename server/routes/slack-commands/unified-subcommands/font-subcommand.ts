import { brandAssets } from "@shared/schema";
import { WebClient } from "@slack/web-api";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  buildFontConfirmationBlocks,
  buildFontProcessingMessage,
  buildFontSummaryMessage,
  shouldShowFontConfirmation,
} from "../../../utils/font-display";
import {
  generateAdobeFontCSS,
  generateGoogleFontCSS,
  hasUploadableFiles,
} from "../../../utils/font-helpers";
import {
  decryptBotToken,
  filterFontAssetsByVariant,
  formatFontInfo,
  generateAssetDownloadUrl,
  logSlackActivity,
  uploadFileToSlack,
} from "../../../utils/slack-helpers";

export async function handleFontSubcommand({
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

  // Fetch font assets for the workspace's client
  const fontAssets = await db
    .select()
    .from(brandAssets)
    .where(
      and(
        eq(brandAssets.clientId, workspace.clientId),
        eq(brandAssets.category, "font")
      )
    );

  if (fontAssets.length === 0) {
    await respond({
      text: "📝 No font assets found for your organization. Please add some fonts in Ferdinand first.",
      response_type: "ephemeral",
    });
    logSlackActivity({ ...auditLog, error: "No font assets found" });
    return;
  }

  // Filter by variant if specified
  const filteredFontAssets = filterFontAssetsByVariant(fontAssets, variant);

  if (filteredFontAssets.length === 0 && variant) {
    await respond({
      text: `📝 No font assets found for variant "${variant}". Available fonts: ${fontAssets.map((a) => a.name).join(", ")}.\n\n💡 Try: \`body\`, \`header\` or leave empty for all fonts.`,
      response_type: "ephemeral",
    });
    logSlackActivity({
      ...auditLog,
      error: `No matches for variant: ${variant}`,
    });
    return;
  }

  const displayAssets =
    filteredFontAssets.length > 0 ? filteredFontAssets : fontAssets;
  auditLog.assetIds = displayAssets.map((asset) => asset.id);

  // Check if we have many results and should ask for confirmation
  if (shouldShowFontConfirmation(displayAssets.length)) {
    const confirmationBlocks = buildFontConfirmationBlocks(
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

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

  // Respond immediately to avoid timeout
  const processingMessage = buildFontProcessingMessage(displayAssets, variant);
  await respond({
    text: processingMessage,
    response_type: "ephemeral",
  });

  // Decrypt the workspace-specific bot token
  const botToken = decryptBotToken(workspace.botToken);

  // Process fonts asynchronously
  setImmediate(async () => {
    try {
      const workspaceClient = new WebClient(botToken);
      let uploadedFiles = 0;
      let sentCodeBlocks = 0;

      for (const asset of displayAssets) {
        const fontInfo = formatFontInfo(asset);

        try {
          // Check if font has uploadable files (custom fonts)
          if (hasUploadableFiles(asset)) {
            // Upload actual font files for custom fonts
            const downloadUrl = generateAssetDownloadUrl(
              asset.id,
              workspace.clientId,
              baseUrl
            );

            const filename = `${asset.name.replace(/\s+/g, "_")}_fonts.zip`;

            const uploaded = await uploadFileToSlack(botToken, {
              channelId: command.channel_id,
              userId: command.user_id,
              fileUrl: downloadUrl,
              filename,
              title: `${fontInfo.title} - Font Files`,
              initialComment: `📝 *${fontInfo.title}* - Custom Font Files\n• *Weights:* ${fontInfo.weights.join(", ")}\n• *Styles:* ${fontInfo.styles.join(", ")}\n• *Source:* Custom Upload\n• *Formats:* ${fontInfo.files?.map((f) => f.format.toUpperCase()).join(", ") || "Various"}`,
            });

            if (uploaded) uploadedFiles++;
          } else {
            // For Google/Adobe fonts, send usage code
            let codeBlock = "";
            let fontDescription = `📝 *${fontInfo.title}*\n• *Weights:* ${fontInfo.weights.join(", ")}\n• *Styles:* ${fontInfo.styles.join(", ")}`;

            if (fontInfo.source === "google") {
              codeBlock = generateGoogleFontCSS(
                fontInfo.title,
                fontInfo.weights
              );
              fontDescription += `\n• *Source:* Google Fonts`;
            } else if (fontInfo.source === "adobe") {
              const data =
                typeof asset.data === "string"
                  ? JSON.parse(asset.data)
                  : asset.data;
              const projectId =
                data?.sourceData?.projectId || "your-project-id";
              codeBlock = generateAdobeFontCSS(projectId, fontInfo.title);
              fontDescription += `\n• *Source:* Adobe Fonts (Typekit)`;
            } else {
              codeBlock = `/* Font: ${fontInfo.title} */
.your-element {
  font-family: '${fontInfo.title}', sans-serif;
  font-weight: ${fontInfo.weights[0] || "400"};
}`;
              fontDescription += `\n• *Source:* ${fontInfo.source}`;
            }

            // Try to send via ephemeral message first
            try {
              await workspaceClient.chat.postEphemeral({
                channel: command.channel_id,
                user: command.user_id,
                text: `${fontDescription}\n\n\`\`\`css\n${codeBlock}\n\`\`\``,
              });
              sentCodeBlocks++;
            } catch (_ephemeralError) {
              // Fallback to DM
              try {
                const conversationResponse =
                  await workspaceClient.conversations.open({
                    users: command.user_id,
                  });

                if (
                  conversationResponse.ok &&
                  conversationResponse.channel?.id
                ) {
                  await workspaceClient.chat.postMessage({
                    channel: conversationResponse.channel.id,
                    text: `${fontDescription}\n\n\`\`\`css\n${codeBlock}\n\`\`\``,
                  });
                  sentCodeBlocks++;
                }
              } catch (dmError) {
                console.error(
                  `Failed to send font code via DM for ${fontInfo.title}:`,
                  dmError
                );
              }
            }
          }
        } catch (fontError) {
          console.error(`Failed to process font ${asset.name}:`, fontError);
        }
      }

      const responseTime = Date.now() - startTime;

      // Use utility function for summary message
      const summaryText = buildFontSummaryMessage(
        uploadedFiles,
        sentCodeBlocks,
        variant,
        responseTime
      );

      await workspaceClient.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: summaryText,
      });

      auditLog.success = true;
      auditLog.responseTimeMs = responseTime;
      logSlackActivity(auditLog);
    } catch (error) {
      console.error("Error in font processing:", error);
      logSlackActivity({ ...auditLog, error: "Background processing failed" });
    }
  });
}
