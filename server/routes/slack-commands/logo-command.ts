import { WebClient } from "@slack/web-api";
import { and, eq } from "drizzle-orm";
import { brandAssets, slackWorkspaces } from "@shared/schema";
import { db } from "../../db";
import {
  checkRateLimit,
  decryptBotToken,
  findBestLogoMatch,
  formatAssetInfo,
  generateAssetDownloadUrl,
  logSlackActivity,
  uploadFileToSlack,
} from "../../utils/slack-helpers";
import {
  buildLogoConfirmationBlocks,
  buildLogoProcessingMessage,
  buildLogoSummaryMessage,
  shouldShowLogoConfirmation,
} from "../../utils/logo-display";

export async function handleLogoCommand({
  command,
  ack,
  respond,
  client,
}: any) {
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

  const auditLog = {
    userId: command.user_id,
    workspaceId: command.team_id,
    ferdinandUserId: undefined as number | undefined,
    command: `/ferdinand-logo ${command.text}`,
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
    const query = command.text.trim();
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

    const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

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

    // Respond immediately to avoid timeout
    const processingMessage = buildLogoProcessingMessage(matchedLogos, query);
    await respond({
      text: processingMessage,
      response_type: "ephemeral",
    });

    // Process file uploads asynchronously (don't wait for completion)
    setImmediate(async () => {
      // Decrypt the workspace-specific bot token (outside try so it's in scope for error handling)
      let botToken: string | undefined;
      try {
        const decryptedToken = decryptBotToken(workspace.botToken);
        botToken = decryptedToken;

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
          
          // Build download URL with variant parameter if needed
          const downloadParams: any = {
            format: "png", // Convert to PNG for better Slack compatibility
          };

          if (isDarkQuery && hasDarkVariant) {
            downloadParams.variant = "dark";
            console.log(`[DARK VARIANT] Adding dark variant parameter to download URL for asset ${asset.id}`);
            console.log(`[DARK VARIANT] Full downloadParams being passed:`, downloadParams);
          } else if (isDarkQuery && !hasDarkVariant) {
            console.log(`[DARK VARIANT] Asset ${asset.id} requested as dark but has no dark variant, using light variant`);
          }

          const downloadUrl = generateAssetDownloadUrl(
            asset.id,
            workspace.clientId,
            baseUrl,
            downloadParams,
          );

          console.log(`[DARK VARIANT] Generated download URL for asset ${asset.id}: ${downloadUrl}`);
          console.log(`[DARK VARIANT] Download params:`, downloadParams);

          const variantSuffix = isDarkQuery && hasDarkVariant ? "_dark" : "";
          const filename = `${asset.name.replace(/\s+/g, "_")}${variantSuffix}.png`;
          
          const variantNote = isDarkQuery && hasDarkVariant ? " (Dark Variant)" : "";
          const title = `${assetInfo.title}${variantNote}`;

          try {
            return await uploadFileToSlack(decryptedToken, {
              channelId: command.channel_id,
              userId: command.user_id,
              fileUrl: downloadUrl,
              filename,
              title,
              initialComment: `📋 *${title}*\n${assetInfo.description}\n• Type: ${assetInfo.type}\n• Format: ${assetInfo.format}${variantNote ? `\n• Variant: Dark` : ""}`,
            });
          } catch (uploadError) {
            console.error(`Failed to upload ${asset.name}:`, uploadError);
            return false;
          }
        });

        const uploadResults = await Promise.all(uploadPromises);
        const successfulUploads = uploadResults.filter(Boolean).length;
        const responseTime = Date.now() - startTime;

        // Create WebClient with workspace token for follow-up messages
        const workspaceClient = new WebClient(decryptedToken);

        // Send follow-up message with results
        if (successfulUploads === 0) {
          // Try to send error message via channel first, then DM
          try {
            await workspaceClient.chat.postEphemeral({
              channel: command.channel_id,
              user: command.user_id,
              text: "❌ Failed to upload logo files. Check your DMs for the files or download links.",
            });
          } catch (ephemeralError: any) {
            console.log("Could not send ephemeral error message, trying DM...");

            try {
              const conversationResponse =
                await workspaceClient.conversations.open({
                  users: command.user_id,
                });

              if (conversationResponse.ok && conversationResponse.channel?.id) {
                await workspaceClient.chat.postMessage({
                  channel: conversationResponse.channel.id,
                  text: "❌ Failed to upload logo files to the channel. This might be due to bot permissions. Please check with your admin or try inviting the bot to the channel with `/invite @Ferdinand`.",
                });
              }
            } catch (dmError) {
              console.log(
                "Could not send error message via DM either:",
                dmError,
              );
            }
          }

          logSlackActivity({
            ...auditLog,
            error: "All file uploads failed",
          });
          console.log("[SLACK ERROR] All file uploads failed");
        } else {
          // Success - files were uploaded successfully
          const summaryText = buildLogoSummaryMessage(
            successfulUploads,
            matchedLogos.length,
            query,
            responseTime,
          );

          try {
            await workspaceClient.chat.postEphemeral({
              channel: command.channel_id,
              user: command.user_id,
              text: summaryText,
            });
          } catch (ephemeralError) {
            console.log(
              "Could not send success message via ephemeral, trying DM...",
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
                "Could not send success message via DM either:",
                dmError,
              );
            }
          }

          auditLog.success = true;
          auditLog.responseTimeMs = responseTime;
          logSlackActivity(auditLog);
        }
      } catch (backgroundError) {
        console.error("Background processing error:", backgroundError);

        // Try to send error message, but don't crash if this fails too
        if (botToken) {
          try {
            const workspaceClient = new WebClient(botToken);

            // Try to send error via DM first since channel access might have failed
            const conversationResponse =
              await workspaceClient.conversations.open({
                users: command.user_id,
              });

            if (conversationResponse.ok && conversationResponse.channel?.id) {
              await workspaceClient.chat.postMessage({
                channel: conversationResponse.channel.id,
                text: "❌ An error occurred while processing your /ferdinand-logo request. The bot might need additional permissions. Please try:\n• Inviting the bot to the channel: `/invite @Ferdinand`\n• Or contact your workspace admin to check bot permissions",
              });
            } else {
              console.log("Could not open DM conversation with user");
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

    // Command acknowledged successfully - actual processing happens in background
  } catch (error) {
    console.error("Error handling /ferdinand-logo command:", error);
    await respond({
      text: "❌ Sorry, there was an error retrieving your logos. Please try again later.",
      response_type: "ephemeral",
    });

    logSlackActivity({
      ...auditLog,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
