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
import { buildColorBlocks } from "../../utils/color-display";
import { WebClient } from "@slack/web-api";
import {
  hasUploadableFiles,
  generateGoogleFontCSS,
  generateAdobeFontCSS,
} from "../../utils/font-helpers";
import { buildFontBlocks } from "../../utils/font-display";

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

    // Build color blocks using the same shared utility as the main commands
    const colorBlocks = buildColorBlocks(
      assetsToShow,
      filteredColorAssets.length > 0 ? filteredColorAssets.slice(0, assetsToShow.length) : assetsToShow,
      colorAssets,
      variant
    );

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

    // Build font blocks using unified display system
    const fontBlocks = buildFontBlocks(
      assetsToShow,
      assetsToShow, // filtered and display are the same in this context
      displayAssets, // all available assets
      variant,
    );

    await respond({
      blocks: fontBlocks,
      response_type: "ephemeral",
      replace_original: true,
    });

    // Process fonts asynchronously
    setImmediate(async () => {
      try {
        const botToken = decryptBotToken(workspace.botToken);
        const workspaceClient = new WebClient(botToken);

        let uploadedFiles = 0;
        let sentCodeBlocks = 0;
        const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

        for (const asset of assetsToShow) {
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
                channelId: body.channel.id,
                userId: body.user.id,
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
                  users: body.user.id,
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

        // Send summary
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

        if (limit !== "all" && displayAssets.length > (limit as number)) {
          summaryText += `💡 Showing ${limit} of ${displayAssets.length} results.\n`;
        }

        summaryText += `⏱️ Total fonts processed: ${uploadedFiles + sentCodeBlocks}`;

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

// Helper function needed for action handlers
function hasUploadableFiles(asset: any): boolean {
  try {
    const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
    return data?.source === "file" && data?.sourceData?.files && data.sourceData.files.length > 0;
  } catch {
    return false;
  }
}