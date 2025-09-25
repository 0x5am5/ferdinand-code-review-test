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
    slackApp.command("/ferdinand-logo", async ({ command, ack, respond }) => {
      await ack();

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
            text: "No logo assets found for your organization.",
            response_type: "ephemeral",
          });
          return;
        }

        // Build blocks to display logos
        const blocks: any[] = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Brand Logos (${logoAssets.length} logos)*`,
            },
          },
        ];

        logoAssets.forEach((asset) => {
          try {
            const data =
              typeof asset.data === "string"
                ? JSON.parse(asset.data)
                : asset.data;

            const logoType = data?.type || "main";
            const format = data?.format || "unknown";

            blocks.push({
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${asset.name}*\nType: ${logoType}\nFormat: ${format}`,
              },
            });
          } catch (error) {
            console.error("Error parsing logo data:", error);
            blocks.push({
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${asset.name}*\nFormat: Available`,
              },
            });
          }
        });

        await respond({
          blocks: blocks,
          response_type: "ephemeral",
        });
      } catch (error) {
        console.error("Error handling /ferdinand-logo command:", error);
        await respond({
          text: "Sorry, there was an error retrieving your logos. Please try again later.",
          response_type: "ephemeral",
        });
      }
    });

    slackApp.command("/ferdinand-colors", async ({ command, ack, respond }) => {
      await ack();

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
          return;
        }

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
            text: "No color assets found for your organization.",
            response_type: "ephemeral",
          });
          return;
        }

        // Build color blocks for display
        const colorBlocks: any[] = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Brand Colors (${colorAssets.length} colors)*`,
            },
          },
        ];

        colorAssets.forEach((asset) => {
          try {
            const data =
              typeof asset.data === "string"
                ? JSON.parse(asset.data)
                : asset.data;
            if (data?.colors && Array.isArray(data.colors)) {
              const colorInfo = data.colors
                .map((color: any) => `${color.hex}`)
                .join(", ");
              colorBlocks.push({
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${asset.name}*\n${colorInfo}`,
                },
              });
            }
          } catch (error) {
            console.error("Error parsing color data:", error);
          }
        });

        await respond({
          blocks: colorBlocks,
          response_type: "ephemeral",
        });
      } catch (error) {
        console.error("Error handling /ferdinand-colors command:", error);
        await respond({
          text: "Sorry, there was an error retrieving your colors. Please try again later.",
          response_type: "ephemeral",
        });
      }
    });

    slackApp.command("/ferdinand-fonts", async ({ command, ack, respond }) => {
      await ack();

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
          return;
        }

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
            text: "No font assets found for your organization.",
            response_type: "ephemeral",
          });
          return;
        }

        const fontInfo = fontAssets
          .map((asset) => {
            try {
              const data =
                typeof asset.data === "string"
                  ? JSON.parse(asset.data)
                  : asset.data;
              const weights = data?.weights ? data.weights.join(", ") : "400";
              const source = data?.source || "unknown";
              return `*${asset.name}* (${source})\nWeights: ${weights}`;
            } catch {
              return `*${asset.name}*`;
            }
          })
          .join("\n\n");

        await respond({
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Brand Fonts (${fontAssets.length} fonts)*\n\n${fontInfo}`,
              },
            },
          ],
          response_type: "ephemeral",
        });
      } catch (error) {
        console.error("Error handling /ferdinand-fonts command:", error);
        await respond({
          text: "Sorry, there was an error retrieving your fonts. Please try again later.",
          response_type: "ephemeral",
        });
      }
    });

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
