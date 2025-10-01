
import { WebClient } from "@slack/web-api";
import { and, eq } from "drizzle-orm";
import { brandAssets } from "@shared/schema";
import { db } from "../../../db";
import {
  decryptBotToken,
  filterFontAssetsByVariant,
  formatFontInfo,
  generateAssetDownloadUrl,
  logSlackActivity,
  uploadFileToSlack,
} from "../../../utils/slack-helpers";
import {
  hasUploadableFiles,
  generateGoogleFontCSS,
  generateAdobeFontCSS,
} from "../../../utils/font-helpers";
import { buildFontBlocks } from "../../../utils/font-display";

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

  const fontAssets = await db
    .select()
    .from(brandAssets)
    .where(
      and(
        eq(brandAssets.clientId, workspace.clientId),
        eq(brandAssets.category, "font"),
      ),
    );

  console.log(`[FONT SUBCOMMAND DEBUG] Found ${fontAssets.length} total font assets for client ${workspace.clientId}`);
  console.log(`[FONT SUBCOMMAND DEBUG] Font assets:`, fontAssets.map(f => {
    // Parse data to get source for better debugging
    let source = 'unknown';
    try {
      const data = typeof f.data === "string" ? JSON.parse(f.data) : f.data;
      source = data?.source || 'custom';
      
      // If source is not explicitly set, try to infer from the data structure or name
      if (source === 'custom' || !source) {
        const fontName = f.name.toLowerCase();
        const commonGoogleFonts = ['inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins', 'source sans pro', 'raleway', 'nunito', 'ubuntu'];
        
        if (commonGoogleFonts.some(gFont => fontName.includes(gFont))) {
          source = 'google';
        } else if (data?.sourceData?.projectId) {
          source = 'adobe';
        } else if (data?.sourceData?.files && data.sourceData.files.length > 0) {
          source = 'file';
        }
      }
    } catch (error) {
      console.error(`[FONT SUBCOMMAND DEBUG] Error parsing font data for ${f.name}:`, error);
    }
    
    return { id: f.id, name: f.name, subcategory: f.subcategory, source };
  }));

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

  console.log(`[FONT SUBCOMMAND DEBUG] After filtering by variant "${variant}": ${filteredFontAssets.length} fonts`);
  console.log(`[FONT SUBCOMMAND DEBUG] Filtered fonts:`, filteredFontAssets.map(f => {
    // Parse data to get source for filtered results
    let source = 'unknown';
    try {
      const data = typeof f.data === "string" ? JSON.parse(f.data) : f.data;
      source = data?.source || 'custom';
      
      // If source is not explicitly set, try to infer from the data structure or name
      if (source === 'custom' || !source) {
        const fontName = f.name.toLowerCase();
        const commonGoogleFonts = ['inter', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins', 'source sans pro', 'raleway', 'nunito', 'ubuntu'];
        
        if (commonGoogleFonts.some(gFont => fontName.includes(gFont))) {
          source = 'google';
        } else if (data?.sourceData?.projectId) {
          source = 'adobe';
        } else if (data?.sourceData?.files && data.sourceData.files.length > 0) {
          source = 'file';
        }
      }
    } catch (error) {
      console.error(`[FONT SUBCOMMAND DEBUG] Error parsing filtered font data for ${f.name}:`, error);
    }
    
    return { id: f.id, name: f.name, source };
  }));

  if (filteredFontAssets.length === 0 && variant) {
    await respond({
      text: `📝 No font assets found for variant "${variant}". Available fonts: ${fontAssets.map((a) => a.name).join(", ")}.\n\n💡 Try: \`/ferdinand font body\` or \`header\` for specific font types.`,
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
            text: "💡 *Tip:* Try `/ferdinand font brand` or `/ferdinand font body` for more targeted results.",
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

  // Simple response like color command - just show count and names
  const fontNames = displayAssets.map(asset => asset.name).join(", ");
  const responseText = variant 
    ? `📝 Found **${displayAssets.length} fonts** for "${variant}": ${fontNames}\n\n🔄 Processing font files and usage code...`
    : `📝 Found **${displayAssets.length} fonts**: ${fontNames}\n\n🔄 Processing font files and usage code...`;

  // Send simple response first - matching color command pattern
  await respond({
    text: responseText,
    response_type: "ephemeral",
  });

  // For all font requests, immediately start processing asynchronously
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

  // Process fonts asynchronously
  setImmediate(async () => {
    try {
      // Decrypt the workspace-specific bot token
      const botToken = decryptBotToken(workspace.botToken);
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
              baseUrl,
            );

            const filename = `${asset.name.replace(/\s+/g, "_")}_fonts.zip`;

            const uploaded = await uploadFileToSlack(botToken, {
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
              codeBlock = generateAdobeFontCSS(projectId, fontInfo.title);
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
          console.error(`Failed to process font ${asset.name}:`, fontError);
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

          if (conversationResponse.ok && conversationResponse.channel?.id) {
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
    } catch (backgroundError) {
      console.error("Background font processing error:", backgroundError);
      logSlackActivity({
        ...auditLog,
        error: "Background processing failed",
      });
    }
  });
}
