
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

// Helper functions
function hasUploadableFiles(asset: any): boolean {
  try {
    const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
    return data?.source === "custom" && data?.files && data.files.length > 0;
  } catch {
    return false;
  }
}

function generateGoogleFontCSS(fontFamily: string, weights: string[]): string {
  const weightParam = weights.join(";");
  return `/* Google Font: ${fontFamily} */
@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@${weightParam}&display=swap');

.your-element {
  font-family: '${fontFamily}', sans-serif;
  font-weight: ${weights[0] || "400"};
}`;
}

function generateAdobeFontCSS(projectId: string, fontFamily: string): string {
  return `/* Adobe Font: ${fontFamily} */
<link rel="stylesheet" href="https://use.typekit.net/${projectId}.css">

.your-element {
  font-family: '${fontFamily}', sans-serif;
}`;
}

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

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

    // Respond immediately to avoid timeout
    await respond({
      text: `🔄 Preparing ${displayAssets.length} font${displayAssets.length > 1 ? "s" : ""}${variant ? ` for "${variant}"` : ""}... Files and usage instructions will appear shortly!`,
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
