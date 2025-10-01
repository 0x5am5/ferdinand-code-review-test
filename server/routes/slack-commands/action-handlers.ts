
import { and, eq } from "drizzle-orm";
import { brandAssets, slackWorkspaces } from "@shared/schema";
import { db } from "../../db";
import {
  filterColorAssetsByVariant,
  formatColorInfo,
  logSlackActivity,
  findBestLogoMatch,
  formatAssetInfo,
  generateAssetDownloadUrl,
  uploadFileToSlack,
  decryptBotToken,
  filterFontAssetsByVariant,
  formatFontInfo,
} from "../../utils/slack-helpers";
import { WebClient } from "@slack/web-api";

export async function handleColorSubcommandWithLimit(
  body: any,
  respond: any,
  variant: string,
  clientId: number,
  limit: number | "all"
) {
  try {
    // Find workspace by client ID
    const [workspace] = await db
      .select()
      .from(slackWorkspaces)
      .where(
        and(
          eq(slackWorkspaces.clientId, clientId),
          eq(slackWorkspaces.isActive, true),
        ),
      );

    if (!workspace) {
      await respond({
        text: "❌ Workspace configuration not found.",
        response_type: "ephemeral",
      });
      return;
    }

    const auditLog = {
      userId: body.user.id,
      workspaceId: body.team.id,
      command: `/ferdinand color ${variant} (${limit === "all" ? "show all" : `limit ${limit}`})`,
      assetIds: [] as number[],
      clientId,
      success: false,
      timestamp: new Date(),
    };

    // Get color assets
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
        text: "🎨 No color assets found for your organization.",
        response_type: "ephemeral",
      });
      return;
    }

    // Filter by variant if specified
    const filteredColorAssets = filterColorAssetsByVariant(colorAssets, variant);
    const displayAssets = filteredColorAssets.length > 0 ? filteredColorAssets : colorAssets;
    
    // Apply limit
    const assetsToShow = limit === "all" ? displayAssets : displayAssets.slice(0, limit as number);
    auditLog.assetIds = assetsToShow.map((asset) => asset.id);

    // Build color blocks
    let headerText = `🎨 *Color Palette${variant ? ` - ${variant.charAt(0).toUpperCase() + variant.slice(1)}` : ""}*`;
    headerText += ` (${assetsToShow.length} palette${assetsToShow.length > 1 ? "s" : ""})`;

    if (limit !== "all" && displayAssets.length > (limit as number)) {
      headerText += ` from ${displayAssets.length} total`;
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

    for (const asset of assetsToShow) {
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

      // Add divider between palettes (except last one)
      if (assetsToShow.indexOf(asset) < assetsToShow.length - 1) {
        colorBlocks.push({
          type: "divider",
        });
      }
    }

    // Add footer
    const usageTips = `💡 *Usage Tips:* Copy hex codes for design tools | Try specific variants like \`brand\`, \`neutral\`, or \`interactive\``;

    colorBlocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: usageTips,
        },
      ],
    });

    await respond({
      blocks: colorBlocks,
      response_type: "ephemeral",
      replace_original: true,
    });

    auditLog.success = true;
    logSlackActivity(auditLog);
  } catch (error) {
    console.error("Error in handleColorSubcommandWithLimit:", error);
    await respond({
      text: "❌ An error occurred while processing your request.",
      response_type: "ephemeral",
    });
  }
}

export async function handleLogoSubcommandWithLimit(
  body: any,
  respond: any,
  query: string,
  clientId: number,
  limit: number | "all"
) {
  try {
    // Find workspace by client ID
    const [workspace] = await db
      .select()
      .from(slackWorkspaces)
      .where(
        and(
          eq(slackWorkspaces.clientId, clientId),
          eq(slackWorkspaces.isActive, true),
        ),
      );

    if (!workspace) {
      await respond({
        text: "❌ Workspace configuration not found.",
        response_type: "ephemeral",
      });
      return;
    }

    const auditLog = {
      userId: body.user.id,
      workspaceId: body.team.id,
      command: `/ferdinand logo ${query} (${limit === "all" ? "upload all" : `limit ${limit}`})`,
      assetIds: [] as number[],
      clientId,
      success: false,
      timestamp: new Date(),
    };

    // Get logo assets
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
        text: "🏷️ No logo assets found for your organization.",
        response_type: "ephemeral",
      });
      return;
    }

    // Find matching logos
    const matchedLogos = findBestLogoMatch(logoAssets, query);
    
    // Apply limit
    const logosToUpload = limit === "all" ? matchedLogos : matchedLogos.slice(0, limit as number);
    auditLog.assetIds = logosToUpload.map((asset) => asset.id);

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

    // Update the original message
    await respond({
      text: `🔄 Processing ${logosToUpload.length} logo${logosToUpload.length > 1 ? "s" : ""}${query ? ` (${query} variant)` : ""}...`,
      response_type: "ephemeral",
      replace_original: true,
    });

    // Process uploads asynchronously
    setImmediate(async () => {
      try {
        const botToken = decryptBotToken(workspace.botToken);
        const workspaceClient = new WebClient(botToken);

        let uploadedFiles = 0;

        for (const asset of logosToUpload) {
          const assetInfo = formatAssetInfo(asset);
          const downloadUrl = generateAssetDownloadUrl(
            asset.id,
            workspace.clientId,
            baseUrl,
            { format: "png" }
          );

          const filename = `${asset.name.replace(/\s+/g, "_")}.png`;

          const uploaded = await uploadFileToSlack(botToken, {
            channelId: body.channel.id,
            userId: body.user.id,
            fileUrl: downloadUrl,
            filename,
            title: assetInfo.title,
            initialComment: `📋 **${assetInfo.title}**\n${assetInfo.description}\n• Type: ${assetInfo.type}\n• Format: ${assetInfo.format}`,
          });

          if (uploaded) uploadedFiles++;
        }

        // Send summary
        let summaryText = `✅ **${uploadedFiles} logo${uploadedFiles > 1 ? "s" : ""} uploaded successfully!**`;
        if (query) {
          summaryText += `\n🔍 Search: "${query}" (${matchedLogos.length} match${matchedLogos.length > 1 ? "es" : ""})`;
        }
        if (limit !== "all" && matchedLogos.length > (limit as number)) {
          summaryText += `\n💡 Showing ${limit} of ${matchedLogos.length} results.`;
        }

        await workspaceClient.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: summaryText,
        });

        auditLog.success = true;
        logSlackActivity(auditLog);
      } catch (error) {
        console.error("Error in logo upload:", error);
      }
    });
  } catch (error) {
    console.error("Error in handleLogoSubcommandWithLimit:", error);
    await respond({
      text: "❌ An error occurred while processing your request.",
      response_type: "ephemeral",
    });
  }
}

export async function handleFontSubcommandWithLimit(
  body: any,
  respond: any,
  variant: string,
  clientId: number,
  limit: number | "all"
) {
  try {
    // Find workspace by client ID
    const [workspace] = await db
      .select()
      .from(slackWorkspaces)
      .where(
        and(
          eq(slackWorkspaces.clientId, clientId),
          eq(slackWorkspaces.isActive, true),
        ),
      );

    if (!workspace) {
      await respond({
        text: "❌ Workspace configuration not found.",
        response_type: "ephemeral",
      });
      return;
    }

    const auditLog = {
      userId: body.user.id,
      workspaceId: body.team.id,
      command: `/ferdinand font ${variant} (${limit === "all" ? "process all" : `limit ${limit}`})`,
      assetIds: [] as number[],
      clientId,
      success: false,
      timestamp: new Date(),
    };

    // Get font assets
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
        text: "📝 No font assets found for your organization.",
        response_type: "ephemeral",
      });
      return;
    }

    // Filter by variant if specified
    const filteredFontAssets = filterFontAssetsByVariant(fontAssets, variant);
    const displayAssets = filteredFontAssets.length > 0 ? filteredFontAssets : fontAssets;
    
    // Apply limit
    const assetsToShow = limit === "all" ? displayAssets : displayAssets.slice(0, limit as number);
    auditLog.assetIds = assetsToShow.map((asset) => asset.id);

    // Update the original message
    await respond({
      text: `🔄 Processing ${assetsToShow.length} font${assetsToShow.length > 1 ? "s" : ""}${variant ? ` (${variant} variant)` : ""}...`,
      response_type: "ephemeral",
      replace_original: true,
    });

    // Process fonts asynchronously
    setImmediate(async () => {
      try {
        const botToken = decryptBotToken(workspace.botToken);
        const workspaceClient = new WebClient(botToken);

        let processedFonts = 0;

        for (const asset of assetsToShow) {
          const fontInfo = formatFontInfo(asset);

          // Send font information as a message
          let fontDescription = `📝 **${fontInfo.title}**\n• **Weights:** ${fontInfo.weights.join(", ")}\n• **Styles:** ${fontInfo.styles.join(", ")}\n• **Source:** ${fontInfo.source}`;

          // Generate CSS code based on source
          let codeBlock = "";
          if (fontInfo.source === "google") {
            const weightParam = fontInfo.weights.join(";");
            const familyParam = fontInfo.title.replace(/\s+/g, "+");
            codeBlock = `/* Google Font: ${fontInfo.title} */
@import url('https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weightParam}&display=swap');

.your-element {
  font-family: '${fontInfo.title}', sans-serif;
  font-weight: ${fontInfo.weights[0] || "400"};
}`;
          } else if (fontInfo.source === "adobe") {
            codeBlock = `/* Adobe Font: ${fontInfo.title} */
<link rel="stylesheet" href="https://use.typekit.net/your-project-id.css">

.your-element {
  font-family: '${fontInfo.title}', sans-serif;
}`;
          } else {
            codeBlock = `/* Font: ${fontInfo.title} */
.your-element {
  font-family: '${fontInfo.title}', sans-serif;
  font-weight: ${fontInfo.weights[0] || "400"};
}`;
          }

          // Send to DM
          const conversationResponse = await workspaceClient.conversations.open({
            users: body.user.id,
          });

          if (conversationResponse.ok && conversationResponse.channel?.id) {
            await workspaceClient.chat.postMessage({
              channel: conversationResponse.channel.id,
              text: `${fontDescription}\n\n\`\`\`css\n${codeBlock}\n\`\`\``,
            });
            processedFonts++;
          }
        }

        // Send summary
        let summaryText = `✅ **Font processing complete!**\n📝 ${processedFonts} font${processedFonts > 1 ? "s" : ""} processed`;
        if (variant) {
          summaryText += `\n🔍 Filtered by: "${variant}"`;
        }
        if (limit !== "all" && displayAssets.length > (limit as number)) {
          summaryText += `\n💡 Showing ${limit} of ${displayAssets.length} results.`;
        }

        await workspaceClient.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: summaryText,
        });

        auditLog.success = true;
        logSlackActivity(auditLog);
      } catch (error) {
        console.error("Error in font processing:", error);
      }
    });
  } catch (error) {
    console.error("Error in handleFontSubcommandWithLimit:", error);
    await respond({
      text: "❌ An error occurred while processing your request.",
      response_type: "ephemeral",
    });
  }
}
