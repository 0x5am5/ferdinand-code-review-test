
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
  FONT_CATEGORY_ORDER,
  FONT_CATEGORY_EMOJIS,
  FONT_CATEGORY_NAMES,
} from "../../utils/font-helpers";

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

    // Group fonts by category for better organization
    const groupedFonts = displayAssets.reduce((groups: Record<string, typeof displayAssets>, asset) => {
      const fontInfo = formatFontInfo(asset);
      const category = fontInfo.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(asset);
      return groups;
    }, {});

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

    // Build enhanced font blocks organized by category
    let headerText = `📝 *Brand Typography System*`;
    if (variant) {
      headerText = `📝 *${variant.charAt(0).toUpperCase() + variant.slice(1)} Fonts*`;
    }
    headerText += ` (${displayAssets.length} font${displayAssets.length > 1 ? "s" : ""})`;

    const fontBlocks: any[] = [
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

    // Process each category in order
    for (const category of FONT_CATEGORY_ORDER) {
      if (!groupedFonts[category] || groupedFonts[category].length === 0) continue;

      // Add category header
      fontBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${FONT_CATEGORY_EMOJIS[category]} *${FONT_CATEGORY_NAMES[category]}*`,
        },
      });

      // Process each font in this category
      for (const asset of groupedFonts[category]) {
        const fontInfo = formatFontInfo(asset);

        // Add font details
        let fontDetails = `   📝 *${fontInfo.title}*\n`;
        fontDetails += `   • **Source:** ${fontInfo.source.charAt(0).toUpperCase() + fontInfo.source.slice(1)}\n`;
        fontDetails += `   • **Weights:** ${fontInfo.weights.join(", ")}\n`;
        fontDetails += `   • **Styles:** ${fontInfo.styles.join(", ")}`;
        
        if (fontInfo.usage) {
          fontDetails += `\n   • **Usage:** ${fontInfo.usage}`;
        }

        fontBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: fontDetails,
          },
        });
      }

      // Add spacing between categories
      fontBlocks.push({
        type: "divider",
      });
    }

    // Add footer with usage tips
    const usageTips = variant
      ? `💡 *Usage Tips:* Font files and CSS will be processed separately | Try \`/ferdinand-fonts brand\`, \`body\`, or \`header\` for specific font types`
      : `💡 *Usage Tips:* Font files and CSS will be processed separately | Try \`/ferdinand-fonts brand\`, \`body\`, or \`header\` for specific font types`;

    fontBlocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: usageTips,
        },
      ],
    });

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

        for (const asset of displayAssets.slice(0, 3)) {
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

        if (displayAssets.length > 3) {
          summaryText += `💡 Showing first 3 results. Be more specific to narrow down.\n`;
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
