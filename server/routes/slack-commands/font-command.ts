
import { WebClient } from "@slack/web-api";
import { and, eq } from "drizzle-orm";
import { brandAssets, slackWorkspaces } from "@shared/schema";
import { db } from "../../db";
import {
  checkRateLimit,
  decryptBotToken,
  filterFontAssetsByVariant,
  formatFontInfo,
  generateAssetDownloadUrl,
  logSlackActivity,
  uploadFileToSlack,
} from "../../utils/slack-helpers";
import {
  hasUploadableFiles,
  generateGoogleFontCSS,
  generateAdobeFontCSS,
} from "../../utils/font-helpers";
import { buildFontBlocks } from "../../utils/font-display";

export async function handleFontCommand({ command, ack, respond, client }: any) {
  const startTime = Date.now();
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
    command: `/ferdinand-fonts ${variant}`,
    assetIds: [] as number[],
    clientId: 0,
    success: false,
    responseTimeMs: 0,
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

    const fontAssets = await db
      .select()
      .from(brandAssets)
      .where(
        and(
          eq(brandAssets.clientId, workspace.clientId),
          eq(brandAssets.category, "font"),
        ),
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
    const filteredFontAssets = filterFontAssetsByVariant(
      fontAssets,
      variant,
    );

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
    if (displayAssets.length > 3) {
      const confirmationBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📝 Found **${displayAssets.length} fonts**${variant ? ` for "${variant}"` : ""}.`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📋 This is a large number of fonts to process. Would you like to:\n\n• **Process all ${displayAssets.length} fonts** (files and usage code)\n• **Narrow your search** with more specific terms like "brand", "body", or "header"\n• **Process just the first 3** for a quick overview`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: `Process All ${displayAssets.length}`,
              },
              style: "primary",
              action_id: "process_all_fonts",
              value: `${workspace.clientId}|${variant || ""}|all`,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Process First 3",
              },
              action_id: "process_limited_fonts",
              value: `${workspace.clientId}|${variant || ""}|3`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💡 *Tip:* Try `/ferdinand-fonts brand` or `/ferdinand-fonts body` for more targeted results.",
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

    // Build font blocks using unified display system
    const fontBlocks = buildFontBlocks(
      displayAssets,
      filteredFontAssets,
      fontAssets,
      variant,
    );

    // Send the organized font information first - this must happen within 3 seconds
    await respond({
      blocks: fontBlocks,
      response_type: "ephemeral",
    });

    // Process fonts asynchronously
    setImmediate(async () => {
      let botToken: string | undefined;
      try {
        const decryptedToken = decryptBotToken(workspace.botToken);
        botToken = decryptedToken;

        // Create WebClient with workspace token
        const workspaceClient = new WebClient(decryptedToken);

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
                baseUrl,
              );

              const filename = `${asset.name.replace(/\s+/g, "_")}_fonts.zip`;

              const uploaded = await uploadFileToSlack(decryptedToken, {
                channelId: command.channel_id,
                userId: command.user_id,
                fileUrl: downloadUrl,
                filename,
                title: `${fontInfo.title} - Font Files`,
                initialComment: `📝 **${fontInfo.title}** - Custom Font Files\n• **Weights:** ${fontInfo.weights.join(", ")}\n• **Styles:** ${fontInfo.styles.join(", ")}\n• **Source:** Custom Upload\n• **Formats:** ${fontInfo.files?.map((f) => f.format.toUpperCase()).join(", ") || "Various"}`,
              });

              if (uploaded) uploadedFiles++;
            } else {
              // For Google/Adobe fonts, send usage code
              let codeBlock = "";
              let fontDescription = `📝 **${fontInfo.title}**\n• **Weights:** ${fontInfo.weights.join(", ")}\n• **Styles:** ${fontInfo.styles.join(", ")}`;

              if (fontInfo.source === "google") {
                codeBlock = generateGoogleFontCSS(
                  fontInfo.title,
                  fontInfo.weights,
                );
                fontDescription += `\n• **Source:** Google Fonts`;
              } else if (fontInfo.source === "adobe") {
                const data =
                  typeof asset.data === "string"
                    ? JSON.parse(asset.data)
                    : asset.data;
                const projectId =
                  data?.sourceData?.projectId || "your-project-id";
                codeBlock = generateAdobeFontCSS(
                  projectId,
                  fontInfo.title,
                );
                fontDescription += `\n• **Source:** Adobe Fonts (Typekit)`;
              } else {
                codeBlock = `/* Font: ${fontInfo.title} */
.your-element {
  font-family: '${fontInfo.title}', sans-serif;
  font-weight: ${fontInfo.weights[0] || "400"};
}`;
                fontDescription += `\n• **Source:** ${fontInfo.source}`;
              }

              // Send code block as a message
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
            }
          } catch (fontError) {
            console.error(
              `Failed to process font ${asset.name}:`,
              fontError,
            );
          }
        }

        const responseTime = Date.now() - startTime;

        // Send summary message
        let summaryText = `✅ **Font processing complete!**\n`;

        if (uploadedFiles > 0) {
          summaryText += `📁 ${uploadedFiles} font file${uploadedFiles > 1 ? "s" : ""} uploaded\n`;
        }

        if (sentCodeBlocks > 0) {
          summaryText += `💻 ${sentCodeBlocks} usage code${sentCodeBlocks > 1 ? "s" : ""} provided\n`;
        }

        if (variant) {
          summaryText += `🔍 Filtered by: "${variant}"\n`;
        }

        

        summaryText += `⏱️ Response time: ${responseTime}ms`;

        try {
          await workspaceClient.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: summaryText,
          });
        } catch (ephemeralError) {
          console.log(
            "Could not send summary message via ephemeral, trying DM...",
          );

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
                text: summaryText,
              });
            }
          } catch (dmError) {
            console.log(
              "Could not send summary message via DM either:",
              dmError,
            );
          }
        }

        auditLog.success = true;
        auditLog.responseTimeMs = responseTime;
        logSlackActivity(auditLog);
      } catch (backgroundError) {
        console.error(
          "Background font processing error:",
          backgroundError,
        );

        // Try to send error message
        if (botToken) {
          try {
            const workspaceClient = new WebClient(botToken);

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
                text: "❌ An error occurred while processing your /ferdinand-fonts request. The bot might need additional permissions. Please try:\n• Inviting the bot to the channel: `/invite @Ferdinand`\n• Or contact your workspace admin to check bot permissions",
              });
            }
          } catch (dmError) {
            console.log("Could not send error message via DM:", dmError);
          }
        }

        logSlackActivity({
          ...auditLog,
          error: "Background processing failed",
        });
      }
    });
  } catch (error) {
    console.error("Error handling /ferdinand-fonts command:", error);
    await respond({
      text: "❌ Sorry, there was an error retrieving your fonts. Please try again later.",
      response_type: "ephemeral",
    });

    logSlackActivity({
      ...auditLog,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
