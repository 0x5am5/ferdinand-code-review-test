import pkg, {
  type BlockAction,
  LogLevel,
  type SlackActionMiddlewareArgs,
} from "@slack/bolt";
import type { Express, Response } from "express";

const { App, ExpressReceiver } = pkg;

type ActionMiddlewareArgs = SlackActionMiddlewareArgs<BlockAction>;

import {
  insertSlackUserMappingSchema,
  slackUserMappings,
  slackWorkspaces,
} from "@shared/schema";
import * as dotenv from "dotenv";
import { and, eq, or } from "drizzle-orm";
import { validateClientId } from "server/middlewares/vaildateClientId";
import type { RequestWithClientId } from "server/routes";
import { db } from "../db";
import { storage } from "../storage";
import {
  handleColorSubcommandWithLimit,
  handleFontSubcommandWithLimit,
  handleLogoSubcommandWithLimit,
} from "./slack-commands/action-handlers";
import { handleColorCommand } from "./slack-commands/color-command";
import { handleFontCommand } from "./slack-commands/font-command";
import { handleHelpCommand } from "./slack-commands/help-command";
// Import command handlers
import { handleLogoCommand } from "./slack-commands/logo-command";
import { handleSearchCommand } from "./slack-commands/search-command";
import { handleUnifiedCommand } from "./slack-commands/unified-command";

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
      // Ensure proper request handling
      customPropertiesExtractor: (req: unknown) => {
        const reqObj = req as Record<string, unknown>;
        return {
          headers: reqObj.headers,
          rawBody: reqObj.rawBody,
        };
      },
    });

    slackApp = new App({
      token: process.env.SLACK_BOT_TOKEN,
      receiver: slackReceiver,
      logLevel: LogLevel.INFO,
    });

    console.log("✅ Slack App initialized successfully");

    // Register Slack command handlers
    slackApp.command("/ferdinand-logos", handleLogoCommand);
    slackApp.command("/ferdinand-colors", handleColorCommand);
    slackApp.command("/ferdinand-fonts", handleFontCommand);
    slackApp.command("/ferdinand-search", handleSearchCommand);
    slackApp.command("/ferdinand-help", handleHelpCommand);
    slackApp.command("/ferdinand", handleUnifiedCommand);

    // Register interactive button handlers
    slackApp.action(
      "show_all_colors",
      async ({ ack, body, respond }: ActionMiddlewareArgs) => {
        await ack();
        const [clientId, variant] = body.actions[0].value.split("|");
        // Re-trigger color command with override to show all
        await handleColorSubcommandWithLimit(
          body,
          respond,
          variant,
          parseInt(clientId, 10),
          "all"
        );
      }
    );

    slackApp.action(
      "show_limited_colors",
      async ({ ack, body, respond }: ActionMiddlewareArgs) => {
        await ack();
        const [clientId, variant] = body.actions[0].value.split("|");
        // Re-trigger color command with limit of 3
        await handleColorSubcommandWithLimit(
          body,
          respond,
          variant,
          parseInt(clientId, 10),
          3
        );
      }
    );

    slackApp.action(
      "upload_all_logos",
      async ({ ack, body, respond }: ActionMiddlewareArgs) => {
        await ack();
        const [clientId, query] = body.actions[0].value.split("|");
        // Re-trigger logo command with override to upload all
        await handleLogoSubcommandWithLimit(
          body,
          respond,
          query,
          parseInt(clientId, 10),
          "all"
        );
      }
    );

    slackApp.action(
      "upload_limited_logos",
      async ({ ack, body, respond }: ActionMiddlewareArgs) => {
        await ack();
        const [clientId, query] = body.actions[0].value.split("|");
        // Re-trigger logo command with limit of 3
        await handleLogoSubcommandWithLimit(
          body,
          respond,
          query,
          parseInt(clientId, 10),
          3
        );
      }
    );

    slackApp.action(
      "process_all_fonts",
      async ({ ack, body, respond }: ActionMiddlewareArgs) => {
        await ack();
        const [clientId, variant] = body.actions[0].value.split("|");
        // Re-trigger font command with override to process all
        await handleFontSubcommandWithLimit(
          body,
          respond,
          variant,
          parseInt(clientId, 10),
          "all"
        );
      }
    );

    slackApp.action(
      "process_limited_fonts",
      async ({ ack, body, respond }: ActionMiddlewareArgs) => {
        await ack();
        const [clientId, variant] = body.actions[0].value.split("|");
        // Re-trigger font command with limit of 3
        await handleFontSubcommandWithLimit(
          body,
          respond,
          variant,
          parseInt(clientId, 10),
          3
        );
      }
    );

    // Unified action handler to manage all interactive button events
    slackApp.action(
      /.*/,
      async ({ ack, body, respond }: ActionMiddlewareArgs) => {
        await ack();
        const actionId = body.actions[0].action_id;
        const actionValue = body.actions[0].value;

        if (
          actionId === "show_all_colors" ||
          actionId === "show_limited_colors"
        ) {
          const [clientId, variant, limit] = actionValue.split("|");
          await handleColorSubcommandWithLimit(
            body,
            respond,
            variant,
            parseInt(clientId, 10),
            limit === "all" ? "all" : parseInt(limit, 10)
          );
        } else if (
          actionId === "show_all_logos" ||
          actionId === "show_limited_logos"
        ) {
          const [clientId, query, limit] = actionValue.split("|");
          await handleLogoSubcommandWithLimit(
            body,
            respond,
            query,
            parseInt(clientId, 10),
            limit === "all" ? "all" : parseInt(limit, 10)
          );
        } else if (
          actionId === "process_all_fonts" ||
          actionId === "process_limited_fonts"
        ) {
          const [clientId, variant, limit] = actionValue.split("|");
          await handleFontSubcommandWithLimit(
            body,
            respond,
            variant,
            parseInt(clientId, 10),
            limit === "all" ? "all" : parseInt(limit, 10)
          );
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
      const { slackUserId, slackTeamId, clientId, ferdinandUserId } = req.body;

      console.log("Test mapping request:", {
        slackUserId,
        slackTeamId,
        clientId,
        ferdinandUserId,
      });

      if (!slackUserId || !slackTeamId || !clientId) {
        return res.status(400).json({
          message: "slackUserId, slackTeamId, and clientId are required",
        });
      }

      // Create or update the mapping (bypass auth for testing)
      const mappingData = {
        slackUserId,
        slackTeamId,
        ferdinandUserId: ferdinandUserId || null, // Allow null for testing, but use provided value if available
        clientId,
        isActive: true,
      };

      console.log("Mapping data:", mappingData);

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
            ferdinandUserId: ferdinandUserId || null,
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

  // Check if current user's clients have Slack integration linked
  app.get("/api/slack/user-status", async (req, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.json({ linked: false });
      }

      // Get user's clients and check if any have active Slack workspaces
      const userClients = await storage.getUserClients(req.session.userId);
      const clientIds = userClients.map((uc) => uc.id);

      if (clientIds.length === 0) {
        return res.json({ linked: false });
      }

      const [workspace] = await db
        .select()
        .from(slackWorkspaces)
        .where(
          and(
            eq(slackWorkspaces.isActive, true),
            // Check if any of user's clients have a workspace
            clientIds.length === 1
              ? eq(slackWorkspaces.clientId, clientIds[0])
              : or(
                  ...clientIds.map((clientId) =>
                    eq(slackWorkspaces.clientId, clientId)
                  )
                )
          )
        )
        .limit(1);

      res.json({
        linked: !!workspace,
        slackTeamId: workspace?.slackTeamId,
        teamName: workspace?.teamName,
      });
    } catch (error) {
      console.error("Error checking Slack user status:", error);
      res.status(500).json({ message: "Error checking Slack status" });
    }
  });

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
