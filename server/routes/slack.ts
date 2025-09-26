import pkg, { LogLevel } from "@slack/bolt";
import type { Express, Response } from "express";

const { App, ExpressReceiver } = pkg;

import {
  brandAssets,
  insertSlackUserMappingSchema,
  slackUserMappings,
} from "@shared/schema";
import * as dotenv from "dotenv";
import { and, eq } from "drizzle-orm";
import { validateClientId } from "server/middlewares/vaildateClientId";
import type { RequestWithClientId } from "server/routes";
import { db } from "../db";
import { storage } from "../storage";
import {
  checkRateLimit,
  filterColorAssetsByVariant,
  filterFontAssetsByVariant,
  findBestLogoMatch,
  formatAssetInfo,
  formatColorInfo,
  formatFontInfo,
  generateAssetDownloadUrl,
  logSlackActivity,
  uploadFileToSlack,
} from "../utils/slack-helpers";

dotenv.config();

// Initialize Slack App (we'll make this conditional based on env vars)
let slackApp: InstanceType<typeof App> | null = null;
let slackReceiver: InstanceType<typeof ExpressReceiver> | null = null;

function initializeSlackApp() {
  if (slackApp) return slackApp; // Already initialized

  console.log("🔍 Slack environment check:");
  console.log(
    "SLACK_BOT_TOKEN:",
    process.env.SLACK_BOT_TOKEN ? "✅ Found" : "❌ Missing"
  );
  console.log(
    "SLACK_SIGNING_SECRET:",
    process.env.SLACK_SIGNING_SECRET ? "✅ Found" : "❌ Missing"
  );

  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET) {
    console.log("🚀 Initializing Slack App...");

    // Create ExpressReceiver instance
    slackReceiver = new ExpressReceiver({
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      endpoints: {
        events: "/api/slack/events",
      },
      processBeforeResponse: true,
    });

    slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      receiver: slackReceiver,
      logLevel: LogLevel.INFO,
    });

    console.log("✅ Slack App initialized successfully");

    // Register Slack command handlers
    slackApp.command(
      "/ferdinand-logo",
      async ({ command, ack, respond, client }) => {
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
          // Find the user mapping
          const [userMapping] = await db
            .select()
            .from(slackUserMappings)
            .where(
              and(
                eq(slackUserMappings.slackUserId, command.user_id),
                eq(slackUserMappings.slackTeamId, command.team_id),
                eq(slackUserMappings.isActive, true)
              )
            );

          if (!userMapping) {
            await respond({
              text: "❌ You need to be connected to a Ferdinand account first. Please contact your admin to set up the integration.",
              response_type: "ephemeral",
            });
            logSlackActivity({ ...auditLog, error: "User mapping not found" });
            return;
          }

          auditLog.clientId = userMapping.clientId;

          // Fetch logo assets for the user's client
          const logoAssets = await db
            .select()
            .from(brandAssets)
            .where(
              and(
                eq(brandAssets.clientId, userMapping.clientId),
                eq(brandAssets.category, "logo")
              )
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

          const baseUrl = process.env.APP_BASE_URL || "http://localhost:3001";

          // Respond immediately to avoid timeout
          await respond({
            text: `🔄 Processing ${matchedLogos.length} logo${matchedLogos.length > 1 ? 's' : ''}${query ? ` (${query} variant)` : ''}...`,
            response_type: "ephemeral",
          });

          // Upload files to Slack for matched logos (in background)
          const uploadPromises = matchedLogos.slice(0, 3).map(async (asset) => {
            const assetInfo = formatAssetInfo(asset);
            const downloadUrl = generateAssetDownloadUrl(
              asset.id,
              userMapping.clientId,
              baseUrl,
              {
                format: "png", // Convert to PNG for better Slack compatibility
              }
            );

            const filename = `${asset.name.replace(/\s+/g, "_")}.png`;

            return uploadFileToSlack(client, {
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

          if (matchedLogos.length > 3) {
            summaryText += `\n💡 Showing first 3 results. Be more specific to narrow down.`;
          }

          summaryText += `\n⏱️ Response time: ${responseTime}ms`;

          await respond({
            text: summaryText,
            response_type: "ephemeral",
          });

          auditLog.success = true;
          logSlackActivity(auditLog);
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
    );

    slackApp.command(
      "/ferdinand-colors",
      async ({ command, ack, respond, client }) => {
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
          command: `/ferdinand-colors ${variant}`,
          assetIds: [] as number[],
          clientId: 0,
          success: false,
          timestamp: new Date(),
        };

        try {
          const [userMapping] = await db
            .select()
            .from(slackUserMappings)
            .where(
              and(
                eq(slackUserMappings.slackUserId, command.user_id),
                eq(slackUserMappings.slackTeamId, command.team_id),
                eq(slackUserMappings.isActive, true)
              )
            );

          if (!userMapping) {
            await respond({
              text: "❌ You need to be connected to a Ferdinand account first. Please contact your admin to set up the integration.",
              response_type: "ephemeral",
            });
            logSlackActivity({ ...auditLog, error: "User mapping not found" });
            return;
          }

          auditLog.clientId = userMapping.clientId;

          const colorAssets = await db
            .select()
            .from(brandAssets)
            .where(
              and(
                eq(brandAssets.clientId, userMapping.clientId),
                eq(brandAssets.category, "color")
              )
            );

          if (colorAssets.length === 0) {
            await respond({
              text: "🎨 No color assets found for your organization. Please add some colors in Ferdinand first.",
              response_type: "ephemeral",
            });
            logSlackActivity({ ...auditLog, error: "No color assets found" });
            return;
          }

          // Filter by variant if specified
          const filteredColorAssets = filterColorAssetsByVariant(
            colorAssets,
            variant
          );

          if (filteredColorAssets.length === 0 && variant) {
            await respond({
              text: `🎨 No color assets found for variant "${variant}". Available palettes: ${colorAssets.map((a) => a.name).join(", ")}.\n\n💡 Try: \`brand\`, \`neutral\`, \`interactive\` or leave empty for all colors.`,
              response_type: "ephemeral",
            });
            logSlackActivity({
              ...auditLog,
              error: `No matches for variant: ${variant}`,
            });
            return;
          }

          const displayAssets =
            filteredColorAssets.length > 0 ? filteredColorAssets : colorAssets;
          auditLog.assetIds = displayAssets.map((asset) => asset.id);

          // Build enhanced color blocks with visual swatches
          let headerText = `🎨 *Brand Color Palette*`;
          if (variant) {
            headerText = `🎨 *${variant.charAt(0).toUpperCase() + variant.slice(1)} Colors*`;
          }
          headerText += ` (${displayAssets.length} palette${displayAssets.length > 1 ? "s" : ""})`;

          if (filteredColorAssets.length < colorAssets.length && variant) {
            headerText += ` from ${colorAssets.length} total`;
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

          for (const asset of displayAssets.slice(0, 3)) {
            // Show up to 3 palettes
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

            // Add color swatch image if available
            if (colorInfo.swatchUrl) {
              colorBlocks.push({
                type: "image",
                image_url: colorInfo.swatchUrl,
                alt_text: `Color palette for ${colorInfo.title}`,
              });
            }

            // Add detailed color information
            const colorDetails = colorInfo.colors
              .map((color) => {
                let details = `🎨 *${color.name}*: \`${color.hex}\``;
                if (color.rgb) {
                  details += ` | RGB: \`${color.rgb}\``;
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

            // Add divider between palettes
            if (
              colorAssets.indexOf(asset) < Math.min(colorAssets.length - 1, 2)
            ) {
              colorBlocks.push({
                type: "divider",
              });
            }
          }

          // Add footer with usage and variant tips
          const usageTips = variant
            ? `💡 *Usage Tips:* Copy hex codes for design tools | Try \`/ferdinand-colors brand\`, \`neutral\`, or \`interactive\` for specific color types`
            : `💡 *Usage Tips:* Copy hex codes for design tools | Try \`/ferdinand-colors brand\`, \`neutral\`, or \`interactive\` for specific color types`;

          colorBlocks.push({
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: usageTips,
              },
            ],
          });

          if (displayAssets.length > 3) {
            colorBlocks.push({
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `📋 Showing first 3 palettes. Total available: ${displayAssets.length}`,
                },
              ],
            });
          }

          await respond({
            blocks: colorBlocks,
            response_type: "ephemeral",
          });

          auditLog.success = true;
          logSlackActivity(auditLog);
        } catch (error) {
          console.error("Error handling /ferdinand-colors command:", error);
          await respond({
            text: "❌ Sorry, there was an error retrieving your colors. Please try again later.",
            response_type: "ephemeral",
          });

          logSlackActivity({
            ...auditLog,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    slackApp.command(
      "/ferdinand-fonts",
      async ({ command, ack, respond, client }) => {
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
          timestamp: new Date(),
        };

        try {
          const [userMapping] = await db
            .select()
            .from(slackUserMappings)
            .where(
              and(
                eq(slackUserMappings.slackUserId, command.user_id),
                eq(slackUserMappings.slackTeamId, command.team_id),
                eq(slackUserMappings.isActive, true)
              )
            );

          if (!userMapping) {
            await respond({
              text: "❌ You need to be connected to a Ferdinand account first. Please contact your admin to set up the integration.",
              response_type: "ephemeral",
            });
            logSlackActivity({ ...auditLog, error: "User mapping not found" });
            return;
          }

          auditLog.clientId = userMapping.clientId;

          const fontAssets = await db
            .select()
            .from(brandAssets)
            .where(
              and(
                eq(brandAssets.clientId, userMapping.clientId),
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
          const filteredFontAssets = filterFontAssetsByVariant(
            fontAssets,
            variant
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

          // Build enhanced font blocks
          let headerText = `📝 *Brand Typography*`;
          if (variant) {
            headerText = `📝 *${variant.charAt(0).toUpperCase() + variant.slice(1)} Fonts*`;
          }
          headerText += ` (${displayAssets.length} font${displayAssets.length > 1 ? "s" : ""})`;

          if (filteredFontAssets.length < fontAssets.length && variant) {
            headerText += ` from ${fontAssets.length} total`;
          }

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

          for (const asset of displayAssets.slice(0, 5)) {
            // Show up to 5 fonts
            const fontInfo = formatFontInfo(asset);

            let fontDetails = `📝 *${fontInfo.title}*`;
            if (fontInfo.source !== "unknown") {
              fontDetails += ` (${fontInfo.source})`;
            }

            fontDetails += `\n• **Weights:** ${fontInfo.weights.join(", ")}`;
            fontDetails += `\n• **Styles:** ${fontInfo.styles.join(", ")}`;

            if (fontInfo.usage) {
              fontDetails += `\n• **Usage:** ${fontInfo.usage}`;
            }

            if (fontInfo.files && fontInfo.files.length > 0) {
              const formats = Array.from(new Set(fontInfo.files.map((f) => f.format)));
              fontDetails += `\n• **Formats:** ${formats.join(", ").toUpperCase()}`;
            }

            fontBlocks.push({
              type: "section",
              text: {
                type: "mrkdwn",
                text: fontDetails,
              },
            });

            // Add divider between fonts (except for the last one)
            if (
              displayAssets.indexOf(asset) <
              Math.min(displayAssets.length - 1, 4)
            ) {
              fontBlocks.push({
                type: "divider",
              });
            }
          }

          // Add footer with usage and variant tips
          const usageTips = variant
            ? `💡 *Usage Tips:* Check font licensing for web use | Try \`/ferdinand-fonts body\` or \`header\` for specific font types`
            : `💡 *Usage Tips:* Check font licensing for web use | Try \`/ferdinand-fonts body\` or \`header\` for specific font types`;

          fontBlocks.push({
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: usageTips,
              },
            ],
          });

          if (displayAssets.length > 5) {
            fontBlocks.push({
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `📋 Showing first 5 fonts. Total available: ${displayAssets.length}`,
                },
              ],
            });
          }

          await respond({
            blocks: fontBlocks,
            response_type: "ephemeral",
          });

          auditLog.success = true;
          logSlackActivity(auditLog);
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
    );

    // Search command
    slackApp.command("/ferdinand-search", async ({ command, ack, respond }) => {
      await ack();

      // Rate limiting
      const rateLimit = checkRateLimit(command.team_id, 15, 60000);
      if (!rateLimit.allowed) {
        await respond({
          text: `⏱️ Rate limit exceeded. You can make ${rateLimit.remaining} more requests after ${new Date(rateLimit.resetTime).toLocaleTimeString()}.`,
          response_type: "ephemeral",
        });
        return;
      }

      const query = command.text.trim();
      if (!query) {
        await respond({
          text: "🔍 Please provide a search term. Example: `/ferdinand-search blue logo`",
          response_type: "ephemeral",
        });
        return;
      }

      try {
        // Find the user mapping
        const [userMapping] = await db
          .select()
          .from(slackUserMappings)
          .where(
            and(
              eq(slackUserMappings.slackUserId, command.user_id),
              eq(slackUserMappings.slackTeamId, command.team_id),
              eq(slackUserMappings.isActive, true)
            )
          );

        if (!userMapping) {
          await respond({
            text: "❌ You need to be connected to a Ferdinand account first. Please contact your admin to set up the integration.",
            response_type: "ephemeral",
          });
          return;
        }

        // Search across all brand assets
        const allAssets = await db
          .select()
          .from(brandAssets)
          .where(eq(brandAssets.clientId, userMapping.clientId));

        if (allAssets.length === 0) {
          await respond({
            text: "📂 No assets found for your organization.",
            response_type: "ephemeral",
          });
          return;
        }

        // Simple text search across name and category
        const searchResults = allAssets.filter((asset) => {
          const searchText = `${asset.name} ${asset.category}`.toLowerCase();
          return searchText.includes(query.toLowerCase());
        });

        if (searchResults.length === 0) {
          await respond({
            text: `🔍 No assets found matching "${query}". Try searching for: logo, color, font, or specific asset names.`,
            response_type: "ephemeral",
          });
          return;
        }

        // Group results by category
        const groupedResults = searchResults.reduce(
          (acc, asset) => {
            if (!acc[asset.category]) {
              acc[asset.category] = [];
            }
            acc[asset.category].push(asset);
            return acc;
          },
          {} as Record<string, typeof searchResults>
        );

        const blocks: any[] = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🔍 **Search Results for "${query}"** (${searchResults.length} matches)`,
            },
          },
        ];

        // Add results by category
        Object.entries(groupedResults).forEach(([category, assets]) => {
          const categoryIcon =
            {
              logo: "🏷️",
              color: "🎨",
              font: "📝",
              typography: "📝",
            }[category] || "📁";

          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${categoryIcon} **${category.toUpperCase()}** (${assets.length})`,
            },
          });

          const assetList = assets
            .slice(0, 5)
            .map((asset) => {
              try {
                const data =
                  typeof asset.data === "string"
                    ? JSON.parse(asset.data)
                    : asset.data;
                const type = data?.type ? ` - ${data.type}` : "";
                return `• ${asset.name}${type}`;
              } catch {
                return `• ${asset.name}`;
              }
            })
            .join("\n");

          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                assetList +
                (assets.length > 5
                  ? `\n... and ${assets.length - 5} more`
                  : ""),
            },
          });
        });

        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `💡 Use specific commands to get files: \`/ferdinand-logo\`, \`/ferdinand-colors\`, \`/ferdinand-fonts\``,
            },
          ],
        });

        await respond({
          blocks: blocks,
          response_type: "ephemeral",
        });

        logSlackActivity({
          userId: command.user_id,
          workspaceId: command.team_id,
          command: `/ferdinand-search ${query}`,
          assetIds: searchResults.map((asset) => asset.id),
          clientId: userMapping.clientId,
          success: true,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Error handling /ferdinand-search command:", error);
        await respond({
          text: "❌ Sorry, there was an error searching your assets. Please try again later.",
          response_type: "ephemeral",
        });
      }
    });

    // Help command
    slackApp.command("/ferdinand-help", async ({ command, ack, respond }) => {
      await ack();

      const helpBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*🎨 Ferdinand Brand Asset Bot*\nAccess your brand assets directly in Slack!",
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*📋 Available Commands:*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🏷️ \`/ferdinand-logo [variant]\`
Get logo files. Optional variants: \`dark\`, \`light\`, \`square\`, \`horizontal\`, \`vertical\`, \`main\`
Example: \`/ferdinand-logo dark\`

🎨 \`/ferdinand-colors [variant]\`
View your brand color palette with visual swatches
Optional variants: \`brand\`, \`neutral\`, \`interactive\` or leave empty for all colors
Example: \`/ferdinand-colors brand\`

📝 \`/ferdinand-fonts [variant]\`
Get typography specifications and font information
Optional variants: \`body\`, \`header\` or leave empty for all fonts
Example: \`/ferdinand-fonts body\`

🔍 \`/ferdinand-search <query>\`
Search across all your brand assets
Example: \`/ferdinand-search blue logo\`

❓ \`/ferdinand-help\`
Show this help message`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*💡 Tips:*\n• **Logo variants:** Use 'dark', 'square', 'horizontal', etc. for specific logo types\n• **Color variants:** Use 'brand', 'neutral', 'interactive' to filter color palettes\n• **Font variants:** Use 'body' for text fonts or 'header' for display fonts\n• **Search:** Try searching by color names, asset types, or specific terms\n• **Files:** Logo files are automatically uploaded to your channel for easy access",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "⚡ Powered by Ferdinand Brand Management System",
            },
          ],
        },
      ];

      await respond({
        blocks: helpBlocks,
        response_type: "ephemeral",
      });

      logSlackActivity({
        userId: command.user_id,
        workspaceId: command.team_id,
        command: "/ferdinand-help",
        assetIds: [],
        clientId: 0,
        success: true,
        timestamp: new Date(),
      });
    });

    // Helper functions for unified /ferdinand command
    const handleColorSubcommand = async ({
      command, respond, client, variant, userMapping, auditLog
    }: {
      command: any;
      respond: any;
      client: any;
      variant: string;
      userMapping: any;
      auditLog: any;
    }) => {
      const colorAssets = await db
        .select()
        .from(brandAssets)
        .where(
          and(
            eq(brandAssets.clientId, userMapping.clientId),
            eq(brandAssets.category, "color")
          )
        );

      if (colorAssets.length === 0) {
        await respond({
          text: "🎨 No color assets found for your organization. Please add some colors in Ferdinand first.",
          response_type: "ephemeral",
        });
        logSlackActivity({ ...auditLog, error: "No color assets found" });
        return;
      }

      // Filter by variant if specified
      const filteredColorAssets = filterColorAssetsByVariant(colorAssets, variant);

      if (filteredColorAssets.length === 0 && variant) {
        await respond({
          text: `🎨 No color assets found for variant "${variant}". Available palettes: ${colorAssets.map((a) => a.name).join(", ")}.\n\n💡 Try: \`brand\`, \`neutral\`, \`interactive\` or leave empty for all colors.`,
          response_type: "ephemeral",
        });
        logSlackActivity({
          ...auditLog,
          error: `No matches for variant: ${variant}`,
        });
        return;
      }

      const displayAssets = filteredColorAssets.length > 0 ? filteredColorAssets : colorAssets;
      auditLog.assetIds = displayAssets.map((asset) => asset.id);

      // Build enhanced color blocks with visual swatches (reuse existing logic)
      let headerText = `🎨 *Brand Color Palette*`;
      if (variant) {
        headerText = `🎨 *${variant.charAt(0).toUpperCase() + variant.slice(1)} Colors*`;
      }
      headerText += ` (${displayAssets.length} palette${displayAssets.length > 1 ? "s" : ""})`;

      if (filteredColorAssets.length < colorAssets.length && variant) {
        headerText += ` from ${colorAssets.length} total`;
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

      for (const asset of displayAssets.slice(0, 3)) {
        const colorInfo = formatColorInfo(asset);

        if (colorInfo.colors.length === 0) {
          continue;
        }

        colorBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${colorInfo.title}*`,
          },
        });

        if (colorInfo.swatchUrl) {
          colorBlocks.push({
            type: "image",
            image_url: colorInfo.swatchUrl,
            alt_text: `Color palette for ${colorInfo.title}`,
          });
        }

        const colorDetails = colorInfo.colors
          .map((color) => {
            let details = `🎨 *${color.name}*: \`${color.hex}\``;
            if (color.rgb) {
              details += ` | RGB: \`${color.rgb}\``;
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

        if (colorAssets.indexOf(asset) < Math.min(colorAssets.length - 1, 2)) {
          colorBlocks.push({
            type: "divider",
          });
        }
      }

      const usageTips = variant
        ? `💡 *Usage Tips:* Copy hex codes for design tools | Try \`/ferdinand color brand\`, \`neutral\`, or \`interactive\` for specific color types`
        : `💡 *Usage Tips:* Copy hex codes for design tools | Try \`/ferdinand color brand\`, \`neutral\`, or \`interactive\` for specific color types`;

      colorBlocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: usageTips,
          },
        ],
      });

      if (displayAssets.length > 3) {
        colorBlocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `📋 Showing first 3 palettes. Total available: ${displayAssets.length}`,
            },
          ],
        });
      }

      await respond({
        blocks: colorBlocks,
        response_type: "ephemeral",
      });
    };

    const handleFontSubcommand = async ({
      command, respond, client, variant, userMapping, auditLog
    }: {
      command: any;
      respond: any;
      client: any;
      variant: string;
      userMapping: any;
      auditLog: any;
    }) => {
      const fontAssets = await db
        .select()
        .from(brandAssets)
        .where(
          and(
            eq(brandAssets.clientId, userMapping.clientId),
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

      const displayAssets = filteredFontAssets.length > 0 ? filteredFontAssets : fontAssets;
      auditLog.assetIds = displayAssets.map((asset) => asset.id);

      // Build enhanced font blocks (reuse existing logic)
      let headerText = `📝 *Brand Typography*`;
      if (variant) {
        headerText = `📝 *${variant.charAt(0).toUpperCase() + variant.slice(1)} Fonts*`;
      }
      headerText += ` (${displayAssets.length} font${displayAssets.length > 1 ? "s" : ""})`;

      if (filteredFontAssets.length < fontAssets.length && variant) {
        headerText += ` from ${fontAssets.length} total`;
      }

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

      for (const asset of displayAssets.slice(0, 5)) {
        const fontInfo = formatFontInfo(asset);

        let fontDetails = `📝 *${fontInfo.title}*`;
        if (fontInfo.source !== "unknown") {
          fontDetails += ` (${fontInfo.source})`;
        }

        fontDetails += `\n• **Weights:** ${fontInfo.weights.join(", ")}`;
        fontDetails += `\n• **Styles:** ${fontInfo.styles.join(", ")}`;

        if (fontInfo.usage) {
          fontDetails += `\n• **Usage:** ${fontInfo.usage}`;
        }

        if (fontInfo.files && fontInfo.files.length > 0) {
          const formats = Array.from(new Set(fontInfo.files.map((f) => f.format)));
          fontDetails += `\n• **Formats:** ${formats.join(", ").toUpperCase()}`;
        }

        fontBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: fontDetails,
          },
        });

        if (displayAssets.indexOf(asset) < Math.min(displayAssets.length - 1, 4)) {
          fontBlocks.push({
            type: "divider",
          });
        }
      }

      const usageTips = variant
        ? `💡 *Usage Tips:* Check font licensing for web use | Try \`/ferdinand font body\` or \`header\` for specific font types`
        : `💡 *Usage Tips:* Check font licensing for web use | Try \`/ferdinand font body\` or \`header\` for specific font types`;

      fontBlocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: usageTips,
          },
        ],
      });

      if (displayAssets.length > 5) {
        fontBlocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `📋 Showing first 5 fonts. Total available: ${displayAssets.length}`,
            },
          ],
        });
      }

      await respond({
        blocks: fontBlocks,
        response_type: "ephemeral",
      });
    };

    const handleLogoSubcommand = async ({
      command, respond, client, variant, userMapping, auditLog
    }: {
      command: any;
      respond: any;
      client: any;
      variant: string;
      userMapping: any;
      auditLog: any;
    }) => {
      const startTime = Date.now();

      // Fetch logo assets for the user's client
      const logoAssets = await db
        .select()
        .from(brandAssets)
        .where(
          and(
            eq(brandAssets.clientId, userMapping.clientId),
            eq(brandAssets.category, "logo")
          )
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

      const baseUrl = process.env.APP_BASE_URL || "http://localhost:3001";

      // Respond immediately to avoid timeout
      await respond({
        text: `🔄 Processing ${matchedLogos.length} logo${matchedLogos.length > 1 ? 's' : ''}${query ? ` (${query} variant)` : ''}...`,
        response_type: "ephemeral",
      });

      // Upload files to Slack for matched logos (in background)
      const uploadPromises = matchedLogos.slice(0, 3).map(async (asset) => {
        const assetInfo = formatAssetInfo(asset);
        const downloadUrl = generateAssetDownloadUrl(
          asset.id,
          userMapping.clientId,
          baseUrl,
          {
            format: "png", // Convert to PNG for better Slack compatibility
          }
        );

        const filename = `${asset.name.replace(/\s+/g, "_")}.png`;

        return uploadFileToSlack(client, {
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

      if (matchedLogos.length > 3) {
        summaryText += `\n💡 Showing first 3 results. Be more specific to narrow down.`;
      }

      summaryText += `\n⏱️ Response time: ${responseTime}ms`;

      await respond({
        text: summaryText,
        response_type: "ephemeral",
      });
    };

    const handleSearchSubcommand = async ({
      command, respond, variant, userMapping, auditLog
    }: {
      command: any;
      respond: any;
      variant: string;
      userMapping: any;
      auditLog: any;
    }) => {
      const query = variant; // variant contains the search query for search subcommand

      // Search across all brand assets
      const allAssets = await db
        .select()
        .from(brandAssets)
        .where(eq(brandAssets.clientId, userMapping.clientId));

      if (allAssets.length === 0) {
        await respond({
          text: "📂 No assets found for your organization.",
          response_type: "ephemeral",
        });
        return;
      }

      // Simple text search across name and category
      const searchResults = allAssets.filter((asset) => {
        const searchText = `${asset.name} ${asset.category}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });

      if (searchResults.length === 0) {
        await respond({
          text: `🔍 No assets found matching "${query}". Try searching for: logo, color, font, or specific asset names.`,
          response_type: "ephemeral",
        });
        return;
      }

      // Group results by category
      const groupedResults = searchResults.reduce(
        (acc, asset) => {
          if (!acc[asset.category]) {
            acc[asset.category] = [];
          }
          acc[asset.category].push(asset);
          return acc;
        },
        {} as Record<string, typeof searchResults>
      );

      const blocks: any[] = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🔍 **Search Results for "${query}"** (${searchResults.length} matches)`,
          },
        },
      ];

      // Add results by category
      Object.entries(groupedResults).forEach(([category, assets]) => {
        const categoryIcon = {
          logo: "🏷️",
          color: "🎨",
          font: "📝",
          typography: "📝",
        }[category] || "📁";

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${categoryIcon} **${category.toUpperCase()}** (${assets.length})`,
          },
        });

        const assetList = assets
          .slice(0, 5)
          .map((asset) => {
            try {
              const data = typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
              const type = data?.type ? ` - ${data.type}` : "";
              return `• ${asset.name}${type}`;
            } catch {
              return `• ${asset.name}`;
            }
          })
          .join("\n");

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: assetList + (assets.length > 5 ? `\n... and ${assets.length - 5} more` : ""),
          },
        });
      });

      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `💡 Use specific commands to get files: \`/ferdinand logo\`, \`/ferdinand color\`, \`/ferdinand font\``,
          },
        ],
      });

      await respond({
        blocks: blocks,
        response_type: "ephemeral",
      });

      auditLog.assetIds = searchResults.map((asset) => asset.id);
    };

    const handleHelpSubcommand = async ({
      command, respond, auditLog
    }: {
      command: any;
      respond: any;
      auditLog: any;
    }) => {
      const helpBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*🎨 Ferdinand Brand Asset Bot*\nAccess your brand assets directly in Slack!",
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*📋 Available Commands:*",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🏷️ \`/ferdinand logo [variant]\`
Get logo files. Optional variants: \`dark\`, \`light\`, \`square\`, \`horizontal\`, \`vertical\`, \`main\`
Example: \`/ferdinand logo dark\`

🎨 \`/ferdinand color [variant]\`
View your brand color palette with visual swatches
Optional variants: \`brand\`, \`neutral\`, \`interactive\` or leave empty for all colors
Example: \`/ferdinand color brand\`

📝 \`/ferdinand font [variant]\`
Get typography specifications and font information
Optional variants: \`body\`, \`header\` or leave empty for all fonts
Example: \`/ferdinand font body\`

🔍 \`/ferdinand search <query>\`
Search across all your brand assets
Example: \`/ferdinand search blue logo\`

❓ \`/ferdinand help\`
Show this help message`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*💡 Tips:*\n• **Logo variants:** Use 'dark', 'square', 'horizontal', etc. for specific logo types\n• **Color variants:** Use 'brand', 'neutral', 'interactive' to filter color palettes\n• **Font variants:** Use 'body' for text fonts or 'header' for display fonts\n• **Search:** Try searching by color names, asset types, or specific terms\n• **Files:** Logo files are automatically uploaded to your channel for easy access",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "⚡ Powered by Ferdinand Brand Management System",
            },
          ],
        },
      ];

      await respond({
        blocks: helpBlocks,
        response_type: "ephemeral",
      });

      auditLog.clientId = 0; // Help doesn't need client ID
    };

    // Unified /ferdinand command
    slackApp.command(
      "/ferdinand",
      async ({ command, ack, respond, client }) => {
        await ack();

        // Rate limiting
        const rateLimit = checkRateLimit(command.team_id, 15, 60000);
        if (!rateLimit.allowed) {
          await respond({
            text: `⏱️ Rate limit exceeded. You can make ${rateLimit.remaining} more requests after ${new Date(rateLimit.resetTime).toLocaleTimeString()}.`,
            response_type: "ephemeral",
          });
          return;
        }

        const input = command.text.trim();
        if (!input) {
          // Show help if no arguments provided
          await respond({
            text: "🎨 **Ferdinand Commands**\n\n" +
                  "• `/ferdinand color [variant]` - Get brand colors (variants: brand, neutral, interactive)\n" +
                  "• `/ferdinand font [variant]` - Get typography info (variants: body, header)\n" +
                  "• `/ferdinand logo [variant]` - Get logo files (variants: dark, light, square, horizontal, vertical, main)\n" +
                  "• `/ferdinand search <query>` - Search all brand assets\n" +
                  "• `/ferdinand help` - Show detailed help\n\n" +
                  "Examples:\n" +
                  "• `/ferdinand color brand`\n" +
                  "• `/ferdinand font body`\n" +
                  "• `/ferdinand logo dark`\n" +
                  "• `/ferdinand search blue`",
            response_type: "ephemeral",
          });
          return;
        }

        // Parse subcommand and variant
        const parts = input.split(/\s+/);
        const subcommand = parts[0].toLowerCase();
        const variant = parts.slice(1).join(" ").trim();

        const auditLog = {
          userId: command.user_id,
          workspaceId: command.team_id,
          command: `/ferdinand ${input}`,
          assetIds: [] as number[],
          clientId: 0,
          success: false,
          timestamp: new Date(),
        };

        try {
          // Find the user mapping (common for all subcommands)
          const [userMapping] = await db
            .select()
            .from(slackUserMappings)
            .where(
              and(
                eq(slackUserMappings.slackUserId, command.user_id),
                eq(slackUserMappings.slackTeamId, command.team_id),
                eq(slackUserMappings.isActive, true)
              )
            );

          if (!userMapping && subcommand !== 'help') {
            await respond({
              text: "❌ You need to be connected to a Ferdinand account first. Please contact your admin to set up the integration.",
              response_type: "ephemeral",
            });
            logSlackActivity({ ...auditLog, error: "User mapping not found" });
            return;
          }

          if (userMapping) {
            auditLog.clientId = userMapping.clientId;
          }

          // Route to appropriate handler based on subcommand
          switch (subcommand) {
            case 'color':
            case 'colors':
              await handleColorSubcommand({ command, respond, client, variant, userMapping, auditLog });
              break;

            case 'font':
            case 'fonts':
              await handleFontSubcommand({ command, respond, client, variant, userMapping, auditLog });
              break;

            case 'logo':
            case 'logos':
              await handleLogoSubcommand({ command, respond, client, variant, userMapping, auditLog });
              break;

            case 'search':
              if (!variant) {
                await respond({
                  text: "🔍 Please provide a search term. Example: `/ferdinand search blue logo`",
                  response_type: "ephemeral",
                });
                return;
              }
              await handleSearchSubcommand({ command, respond, variant, userMapping, auditLog });
              break;

            case 'help':
              await handleHelpSubcommand({ command, respond, auditLog });
              break;

            default:
              await respond({
                text: `❌ Unknown command: "${subcommand}"\n\n` +
                      "Available commands: `color`, `font`, `logo`, `search`, `help`\n" +
                      "Type `/ferdinand` with no arguments to see usage examples.",
                response_type: "ephemeral",
              });
              logSlackActivity({ ...auditLog, error: `Unknown subcommand: ${subcommand}` });
              return;
          }

          auditLog.success = true;
          logSlackActivity(auditLog);

        } catch (error) {
          console.error("Error handling /ferdinand command:", error);
          await respond({
            text: "❌ Sorry, there was an error processing your request. Please try again later.",
            response_type: "ephemeral",
          });

          logSlackActivity({
            ...auditLog,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    );

    return slackApp;
  } else {
    console.log("❌ Slack App not initialized - missing environment variables");
    return null;
  }
}

export function registerSlackRoutes(app: Express) {
  // Initialize Slack app when routes are registered
  const slackAppInstance = initializeSlackApp();

  console.log("🔍 Debug Slack App Instance:");
  console.log("slackAppInstance:", !!slackAppInstance);
  console.log("slackReceiver:", !!slackReceiver);
  console.log("slackReceiver.router:", !!slackReceiver?.router);

  // Use ExpressReceiver's built-in router for Slack events
  if (slackAppInstance && slackReceiver) {
    console.log("✅ Mounting Slack ExpressReceiver router");
    // Mount the ExpressReceiver's router which handles all Slack events
    app.use(slackReceiver.router);
  } else {
    console.log("⚠️ Slack app not initialized, adding fallback handler");
    // Fallback handler when Slack app isn't configured
    app.all("/api/slack/events", (req, res) => {
      console.log("🔍 Slack webhook received, but app not configured");
      console.log("Headers:", req.headers);
      console.log("Body:", req.body);
      res.status(200).json({
        error: "Slack app not configured",
        configured: !!process.env.SLACK_BOT_TOKEN,
        hasSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
      });
    });
  }

  // Test user mapping endpoint (bypasses auth for development)
  app.post("/api/slack/map-user-test", async (req, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      return res
        .status(403)
        .json({ message: "This endpoint is only available in development" });
    }

    try {
      const { slackUserId, slackTeamId, clientId } = req.body;

      if (!slackUserId || !slackTeamId || !clientId) {
        return res.status(400).json({
          message: "slackUserId, slackTeamId, and clientId are required",
        });
      }

      // Create or update the mapping (bypass auth for testing)
      const mappingData = {
        slackUserId,
        slackTeamId,
        ferdinandUserId: null, // Allow null for testing
        clientId,
        isActive: true,
      };

      const parsed = insertSlackUserMappingSchema.safeParse(mappingData);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid mapping data",
          errors: parsed.error.errors,
        });
      }

      // Check if mapping already exists
      const [existingMapping] = await db
        .select()
        .from(slackUserMappings)
        .where(
          and(
            eq(slackUserMappings.slackUserId, slackUserId),
            eq(slackUserMappings.slackTeamId, slackTeamId)
          )
        );

      if (existingMapping) {
        // Update existing mapping
        const [updated] = await db
          .update(slackUserMappings)
          .set({
            clientId,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(slackUserMappings.id, existingMapping.id))
          .returning();

        return res.json(updated);
      } else {
        // Create new mapping
        const [created] = await db
          .insert(slackUserMappings)
          .values(parsed.data)
          .returning();

        return res.status(201).json(created);
      }
    } catch (error) {
      console.error("Error mapping Slack user:", error);
      res.status(500).json({ message: "Error creating user mapping" });
    }
  });

  // Manual user mapping endpoint (for testing)
  app.post("/api/slack/map-user", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { slackUserId, slackTeamId, clientId } = req.body;

      if (!slackUserId || !slackTeamId || !clientId) {
        return res.status(400).json({
          message: "slackUserId, slackTeamId, and clientId are required",
        });
      }

      // Verify the user has access to this client
      const userClients = await storage.getUserClients(req.session.userId);
      const hasAccess = userClients.some((uc) => uc.id === clientId);

      if (!hasAccess) {
        return res.status(403).json({
          message: "You don't have access to this client",
        });
      }

      // Create or update the mapping
      const mappingData = {
        slackUserId,
        slackTeamId,
        ferdinandUserId: req.session.userId,
        clientId,
        isActive: true,
      };

      const parsed = insertSlackUserMappingSchema.safeParse(mappingData);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid mapping data",
          errors: parsed.error.errors,
        });
      }

      // Check if mapping already exists
      const [existingMapping] = await db
        .select()
        .from(slackUserMappings)
        .where(
          and(
            eq(slackUserMappings.slackUserId, slackUserId),
            eq(slackUserMappings.slackTeamId, slackTeamId)
          )
        );

      if (existingMapping) {
        // Update existing mapping
        const [updated] = await db
          .update(slackUserMappings)
          .set({
            ferdinandUserId: req.session.userId,
            clientId,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(slackUserMappings.id, existingMapping.id))
          .returning();

        return res.json(updated);
      } else {
        // Create new mapping
        const [created] = await db
          .insert(slackUserMappings)
          .values(parsed.data)
          .returning();

        return res.status(201).json(created);
      }
    } catch (error) {
      console.error("Error mapping Slack user:", error);
      res.status(500).json({ message: "Error creating user mapping" });
    }
  });

  // Get Slack mappings for a client
  app.get(
    "/api/clients/:clientId/slack/mappings",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const mappings = await db
          .select()
          .from(slackUserMappings)
          .where(
            and(
              eq(slackUserMappings.clientId, clientId),
              eq(slackUserMappings.isActive, true)
            )
          );

        res.json(mappings);
      } catch (error) {
        console.error("Error fetching Slack mappings:", error);
        res.status(500).json({ message: "Error fetching mappings" });
      }
    }
  );

  // Health check for Slack integration
  app.get("/api/slack/health", (_req, res: Response) => {
    const isConfigured = !!(
      process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET
    );
    res.json({
      configured: isConfigured,
      appInitialized: !!slackApp,
    });
  });
}
