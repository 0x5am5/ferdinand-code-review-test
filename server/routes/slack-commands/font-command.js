import { brandAssets, slackWorkspaces } from "@shared/schema";
import { WebClient } from "@slack/web-api";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { buildFontConfirmationBlocks, buildFontProcessingMessage, buildFontSummaryMessage, shouldShowFontConfirmation, } from "../../utils/font-display";
import { generateAdobeFontCSS, generateGoogleFontCSS, hasUploadableFiles, } from "../../utils/font-helpers";
import { checkRateLimit, decryptBotToken, filterFontAssetsByVariant, formatFontInfo, generateAssetDownloadUrl, logSlackActivity, uploadFileToSlack, } from "../../utils/slack-helpers";
export async function handleFontCommand({ command, ack, respond, }) {
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
        assetIds: [],
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
            .where(and(eq(slackWorkspaces.slackTeamId, command.team_id), eq(slackWorkspaces.isActive, true)));
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
            .where(and(eq(brandAssets.clientId, workspace.clientId), eq(brandAssets.category, "font")));
        console.log(`[FONT DEBUG] Found ${fontAssets.length} total font assets for client ${workspace.clientId}`);
        console.log(`[FONT DEBUG] Font assets:`, fontAssets.map((f) => {
            // Parse data to get source for better debugging
            let source = "unknown";
            try {
                const data = typeof f.data === "string" ? JSON.parse(f.data) : f.data;
                source = data?.source || "custom";
                // If source is not explicitly set, try to infer from the data structure or name
                if (source === "custom" || !source) {
                    const fontName = f.name.toLowerCase();
                    const commonGoogleFonts = [
                        "inter",
                        "roboto",
                        "open sans",
                        "lato",
                        "montserrat",
                        "poppins",
                        "source sans pro",
                        "raleway",
                        "nunito",
                        "ubuntu",
                    ];
                    if (commonGoogleFonts.some((gFont) => fontName.includes(gFont))) {
                        source = "google";
                    }
                    else if (data?.sourceData?.projectId) {
                        source = "adobe";
                    }
                    else if (data?.sourceData?.files &&
                        data.sourceData.files.length > 0) {
                        source = "file";
                    }
                }
            }
            catch (error) {
                console.error(`[FONT DEBUG] Error parsing font data for ${f.name}:`, error);
            }
            return { id: f.id, name: f.name, category: f.category, source };
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
        const displayAssets = filteredFontAssets.length > 0 ? filteredFontAssets : fontAssets;
        auditLog.assetIds = displayAssets.map((asset) => asset.id);
        // Check if we have many results and should ask for confirmation
        if (shouldShowFontConfirmation(displayAssets.length)) {
            const confirmationBlocks = buildFontConfirmationBlocks(displayAssets, variant, workspace.clientId);
            await respond({
                blocks: confirmationBlocks,
                response_type: "ephemeral",
            });
            return;
        }
        const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
        // Use utility function for processing message
        const processingMessage = buildFontProcessingMessage(displayAssets, variant);
        // Send simple response first - matching color command pattern
        await respond({
            text: processingMessage,
            response_type: "ephemeral",
        });
        // Process fonts asynchronously
        setImmediate(async () => {
            let botToken;
            try {
                const decryptedToken = decryptBotToken(workspace.botToken);
                botToken = decryptedToken;
                // Create WebClient with workspace token
                const workspaceClient = new WebClient(decryptedToken);
                let uploadedFiles = 0;
                let sentCodeBlocks = 0;
                for (const asset of displayAssets) {
                    const fontInfo = formatFontInfo(asset);
                    console.log(`[FONT DEBUG] Processing asset ${asset.name} (ID: ${asset.id})`);
                    console.log(`[FONT DEBUG] Font info:`, {
                        source: fontInfo.source,
                        hasUploadableFiles: hasUploadableFiles(asset),
                    });
                    try {
                        // Check if font has uploadable files (custom fonts)
                        if (hasUploadableFiles(asset)) {
                            // Upload actual font files for custom fonts
                            const downloadUrl = generateAssetDownloadUrl(asset.id, workspace.clientId, baseUrl);
                            const filename = `${asset.name.replace(/\s+/g, "_")}_fonts.zip`;
                            const uploaded = await uploadFileToSlack(decryptedToken, {
                                channelId: command.channel_id,
                                userId: command.user_id,
                                fileUrl: downloadUrl,
                                filename,
                                title: `${fontInfo.title} - Font Files`,
                                initialComment: `📝 *${fontInfo.title}* - Custom Font Files\n• *Weights:* ${fontInfo.weights.join(", ")}\n• *Styles:* ${fontInfo.styles.join(", ")}\n• *Source:* Custom Upload\n• *Formats:* ${fontInfo.files?.map((f) => f.format.toUpperCase()).join(", ") || "Various"}`,
                            });
                            if (uploaded)
                                uploadedFiles++;
                        }
                        else {
                            // For Google/Adobe fonts, send usage code
                            let codeBlock = "";
                            let fontDescription = `📝 *${fontInfo.title}*\n• *Weights:* ${fontInfo.weights.join(", ")}\n• *Styles:* ${fontInfo.styles.join(", ")}`;
                            console.log(`[FONT DEBUG] Processing ${fontInfo.title} with source: ${fontInfo.source}`);
                            if (fontInfo.source === "google") {
                                console.log(`[FONT DEBUG] Generating Google Font CSS for ${fontInfo.title} with weights: ${fontInfo.weights.join(",")}`);
                                codeBlock = generateGoogleFontCSS(fontInfo.title, fontInfo.weights);
                                fontDescription += `\n• *Source:* Google Fonts`;
                            }
                            else if (fontInfo.source === "adobe") {
                                const data = typeof asset.data === "string"
                                    ? JSON.parse(asset.data)
                                    : asset.data;
                                const projectId = data?.sourceData?.projectId || "your-project-id";
                                console.log(`[FONT DEBUG] Generating Adobe Font CSS for ${fontInfo.title} with project ID: ${projectId}`);
                                codeBlock = generateAdobeFontCSS(projectId, fontInfo.title);
                                fontDescription += `\n• *Source:* Adobe Fonts (Typekit)`;
                            }
                            else {
                                console.log(`[FONT DEBUG] Generating generic CSS for ${fontInfo.title}`);
                                codeBlock = `/* Font: ${fontInfo.title} */
.your-element {
  font-family: '${fontInfo.title}', sans-serif;
  font-weight: ${fontInfo.weights[0] || "400"};
}`;
                                fontDescription += `\n• *Source:* ${fontInfo.source}`;
                            }
                            console.log(`[FONT DEBUG] Generated CSS block:`, codeBlock);
                            // Try to send via ephemeral message first (more reliable)
                            try {
                                await workspaceClient.chat.postEphemeral({
                                    channel: command.channel_id,
                                    user: command.user_id,
                                    text: `${fontDescription}\n\n\`\`\`css\n${codeBlock}\n\`\`\``,
                                });
                                sentCodeBlocks++;
                                console.log(`[FONT DEBUG] Sent CSS via ephemeral message for ${fontInfo.title}`);
                            }
                            catch (_ephemeralError) {
                                console.log(`[FONT DEBUG] Ephemeral message failed, trying DM...`);
                                // Fallback to DM
                                try {
                                    const conversationResponse = await workspaceClient.conversations.open({
                                        users: command.user_id,
                                    });
                                    if (conversationResponse.ok &&
                                        conversationResponse.channel?.id) {
                                        await workspaceClient.chat.postMessage({
                                            channel: conversationResponse.channel.id,
                                            text: `${fontDescription}\n\n\`\`\`css\n${codeBlock}\n\`\`\``,
                                        });
                                        sentCodeBlocks++;
                                        console.log(`[FONT DEBUG] Sent CSS via DM for ${fontInfo.title}`);
                                    }
                                    else {
                                        console.error(`[FONT DEBUG] Failed to open conversation:`, conversationResponse);
                                    }
                                }
                                catch (dmError) {
                                    console.error(`[FONT DEBUG] DM failed for ${fontInfo.title}:`, dmError);
                                }
                            }
                        }
                    }
                    catch (fontError) {
                        console.error(`Failed to process font ${asset.name}:`, fontError);
                    }
                }
                const responseTime = Date.now() - startTime;
                // Use utility function for summary message
                const summaryText = buildFontSummaryMessage(uploadedFiles, sentCodeBlocks, variant, responseTime);
                try {
                    await workspaceClient.chat.postEphemeral({
                        channel: command.channel_id,
                        user: command.user_id,
                        text: summaryText,
                    });
                }
                catch (_ephemeralError) {
                    console.log("Could not send summary message via ephemeral, trying DM...");
                    try {
                        const conversationResponse = await workspaceClient.conversations.open({
                            users: command.user_id,
                        });
                        if (conversationResponse.ok && conversationResponse.channel?.id) {
                            await workspaceClient.chat.postMessage({
                                channel: conversationResponse.channel.id,
                                text: summaryText,
                            });
                        }
                    }
                    catch (dmError) {
                        console.log("Could not send summary message via DM either:", dmError);
                    }
                }
                auditLog.success = true;
                auditLog.responseTimeMs = responseTime;
                logSlackActivity(auditLog);
            }
            catch (backgroundError) {
                console.error("Background font processing error:", backgroundError);
                // Try to send error message
                if (botToken) {
                    try {
                        const workspaceClient = new WebClient(botToken);
                        const conversationResponse = await workspaceClient.conversations.open({
                            users: command.user_id,
                        });
                        if (conversationResponse.ok && conversationResponse.channel?.id) {
                            await workspaceClient.chat.postMessage({
                                channel: conversationResponse.channel.id,
                                text: "❌ An error occurred while processing your /ferdinand-fonts request. The bot might need additional permissions. Please try:\n• Inviting the bot to the channel: `/invite @Ferdinand`\n• Or contact your workspace admin to check bot permissions",
                            });
                        }
                    }
                    catch (dmError) {
                        console.log("Could not send error message via DM:", dmError);
                    }
                }
                logSlackActivity({
                    ...auditLog,
                    error: "Background processing failed",
                });
            }
        });
    }
    catch (error) {
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
