import type { Express, Response, Request } from "express";
import { eq, and } from "drizzle-orm";
import { slackWorkspaces, slackUserMappings, insertSlackWorkspaceSchema } from "@shared/schema";
import { db } from "../db";
import { validateClientId } from "../middlewares/vaildateClientId";
import { requireAdminRole } from "../middlewares/requireAdminRole";
import type { RequestWithClientId } from "../routes";
import { encrypt, decrypt, generateSecureRandom } from "../utils/crypto";
import fetch from "node-fetch";

interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  scope?: string;
  user_id?: string;
  team?: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
  };
  bot_user_id?: string;
  error?: string;
}

// Store temporary state for OAuth flow
const oauthStateStore = new Map<string, {
  clientId: number;
  userId: number;
  expiresAt: number;
}>();

// Clean up expired OAuth states
setInterval(() => {
  const now = Date.now();
  Array.from(oauthStateStore.entries()).forEach(([state, data]) => {
    if (now > data.expiresAt) {
      oauthStateStore.delete(state);
    }
  });
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Register Slack OAuth routes
 */
export function registerSlackOAuthRoutes(app: Express) {
  // Initiate OAuth flow - redirect to Slack (admin only)
  app.get(
    "/api/clients/:clientId/slack/oauth/install",
    validateClientId,
    requireAdminRole,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        if (!process.env.SLACK_CLIENT_ID) {
          return res.status(500).json({
            message: "Slack OAuth not configured - missing SLACK_CLIENT_ID"
          });
        }

        if (!process.env.SLACK_CLIENT_SECRET) {
          return res.status(500).json({
            message: "Slack OAuth not configured - missing SLACK_CLIENT_SECRET"
          });
        }

        // Generate unique state parameter to prevent CSRF
        const state = generateSecureRandom(32);
        const stateData = {
          clientId,
          userId: req.session.userId,
          expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
        };

        oauthStateStore.set(state, stateData);

        // Required scopes for the Slack bot
        const scopes = [
          "commands",        // Slash commands
          "files:write",     // Upload files
          "chat:write",      // Send messages to channels
          "im:write",        // Send DMs to users
          "users:read",      // Read user info for mapping
          "channels:read",   // Read channel info
          "groups:read",     // Read private channel info
          "im:read",         // Read DM info
        ];

        const redirectUri = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/slack/oauth/callback`;

        // Build Slack OAuth URL
        const slackOAuthUrl = new URL("https://slack.com/oauth/v2/authorize");
        slackOAuthUrl.searchParams.append("client_id", process.env.SLACK_CLIENT_ID);
        slackOAuthUrl.searchParams.append("scope", scopes.join(","));
        slackOAuthUrl.searchParams.append("redirect_uri", redirectUri);
        slackOAuthUrl.searchParams.append("state", state);
        slackOAuthUrl.searchParams.append("user_scope", ""); // No user scopes needed

        res.json({
          authUrl: slackOAuthUrl.toString(),
          state,
          message: "Redirect user to authUrl to complete Slack installation"
        });

      } catch (error) {
        console.error("Error initiating Slack OAuth:", error);
        res.status(500).json({ message: "Error initiating OAuth flow" });
      }
    }
  );

  // Handle OAuth callback from Slack
  app.get("/api/slack/oauth/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;
      
      // Debug logging
      console.log("=== SLACK OAUTH CALLBACK ===");
      console.log("Query params:", req.query);
      console.log("Code:", code ? `Present (${typeof code})` : "Missing");
      console.log("State:", state ? `Present (${typeof state})` : `Missing/Empty - value: "${state}"`);
      console.log("Error:", error);

      if (error) {
        console.error("Slack OAuth error:", error);
        return res.status(400).send(`
          <html>
            <body>
              <h1>Slack Installation Failed</h1>
              <p>Error: ${error}</p>
              <p>Please try again or contact support.</p>
            </body>
          </html>
        `);
      }

      if (!code || !state) {
        console.error("Missing OAuth parameters - Code:", !!code, "State:", !!state, "State value:", state);
        return res.status(400).send(`
          <html>
            <body>
              <h1>Invalid OAuth Response</h1>
              <p>Missing required parameters from Slack.</p>
              <p><strong>Debug Info:</strong></p>
              <ul>
                <li>Code: ${code ? 'Present' : 'Missing'}</li>
                <li>State: ${state ? `Present (${state})` : 'Missing/Empty'}</li>
              </ul>
              <p>This usually means the OAuth initiation was incomplete. Please try reinstalling from the Ferdinand dashboard.</p>
            </body>
          </html>
        `);
      }

      // Verify state parameter
      const stateData = oauthStateStore.get(state as string);
      if (!stateData) {
        return res.status(400).send(`
          <html>
            <body>
              <h1>Invalid or Expired OAuth Request</h1>
              <p>The OAuth state is invalid or has expired. Please try again.</p>
            </body>
          </html>
        `);
      }

      // Clean up used state
      oauthStateStore.delete(state as string);

      if (Date.now() > stateData.expiresAt) {
        return res.status(400).send(`
          <html>
            <body>
              <h1>OAuth Request Expired</h1>
              <p>The OAuth request has expired. Please try again.</p>
            </body>
          </html>
        `);
      }

      // Exchange code for token
      const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.SLACK_CLIENT_ID!,
          client_secret: process.env.SLACK_CLIENT_SECRET!,
          code: code as string,
          redirect_uri: `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/slack/oauth/callback`,
        }),
      });

      const tokenData = await tokenResponse.json() as SlackOAuthResponse;

      if (!tokenData.ok) {
        console.error("Slack OAuth token exchange failed:", tokenData.error);
        return res.status(400).send(`
          <html>
            <body>
              <h1>Slack Installation Failed</h1>
              <p>Error: ${tokenData.error}</p>
              <p>Please try again or contact support.</p>
            </body>
          </html>
        `);
      }

      if (!tokenData.access_token || !tokenData.team || !tokenData.bot_user_id) {
        return res.status(400).send(`
          <html>
            <body>
              <h1>Incomplete OAuth Response</h1>
              <p>Missing required data from Slack OAuth response.</p>
            </body>
          </html>
        `);
      }

      // Encrypt the bot token for storage
      const encryptedToken = encrypt(tokenData.access_token);
      const encryptedTokenString = JSON.stringify(encryptedToken);

      // Check if workspace is already registered
      const [existingWorkspace] = await db
        .select()
        .from(slackWorkspaces)
        .where(eq(slackWorkspaces.slackTeamId, tokenData.team.id));

      if (existingWorkspace) {
        // Update existing workspace
        const [updated] = await db
          .update(slackWorkspaces)
          .set({
            teamName: tokenData.team.name,
            botToken: encryptedTokenString,
            botUserId: tokenData.bot_user_id,
            clientId: stateData.clientId,
            installedBy: stateData.userId,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(slackWorkspaces.id, existingWorkspace.id))
          .returning();

        console.log(`Updated Slack workspace: ${tokenData.team.name} (${tokenData.team.id})`);
      } else {
        // Create new workspace installation
        const workspaceData = {
          clientId: stateData.clientId,
          slackTeamId: tokenData.team.id,
          teamName: tokenData.team.name,
          botToken: encryptedTokenString,
          botUserId: tokenData.bot_user_id,
          installedBy: stateData.userId,
          isActive: true,
        };

        const parsed = insertSlackWorkspaceSchema.safeParse(workspaceData);
        if (!parsed.success) {
          console.error("Invalid workspace data:", parsed.error.errors);
          return res.status(500).send(`
            <html>
              <body>
                <h1>Installation Error</h1>
                <p>Failed to save workspace configuration.</p>
              </body>
            </html>
          `);
        }

        const [created] = await db
          .insert(slackWorkspaces)
          .values(parsed.data)
          .returning();

        console.log(`Created new Slack workspace: ${tokenData.team.name} (${tokenData.team.id})`);
      }

      // Success page
      res.send(`
        <html>
          <head>
            <title>Slack Installation Successful</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
              .success { color: #28a745; }
              .info { background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .commands { text-align: left; background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: monospace; }
            </style>
          </head>
          <body>
            <h1 class="success">✅ Slack Installation Successful!</h1>
            <p><strong>${tokenData.team.name}</strong> workspace is now connected to Ferdinand.</p>

            <div class="info">
              <h3>Next Steps:</h3>
              <ol style="text-align: left;">
                <li>All users in your Slack workspace can now access Ferdinand commands</li>
                <li>No individual user setup is required</li>
                <li>Start using Ferdinand commands in any channel where the bot is invited</li>
              </ol>
            </div>

            <div class="info">
              <h3>Available Commands:</h3>
              <div class="commands">
/ferdinand logo [variant]  - Get brand logos<br>
/ferdinand color [variant] - View color palettes<br>
/ferdinand font [variant]  - Get typography info<br>
/ferdinand search &lt;query&gt;  - Search all assets<br>
/ferdinand help           - Show help
              </div>
            </div>

            <p><small>You can now close this window and return to your Ferdinand dashboard.</small></p>
          </body>
        </html>
      `);

    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send(`
        <html>
          <body>
            <h1>Installation Error</h1>
            <p>An unexpected error occurred during installation.</p>
            <p>Please try again or contact support.</p>
          </body>
        </html>
      `);
    }
  });

  // Get workspace installation status
  app.get(
    "/api/clients/:clientId/slack/workspaces",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const workspaces = await db
          .select({
            id: slackWorkspaces.id,
            slackTeamId: slackWorkspaces.slackTeamId,
            teamName: slackWorkspaces.teamName,
            botUserId: slackWorkspaces.botUserId,
            installedBy: slackWorkspaces.installedBy,
            isActive: slackWorkspaces.isActive,
            createdAt: slackWorkspaces.createdAt,
            updatedAt: slackWorkspaces.updatedAt,
            // Don't return the encrypted bot token
          })
          .from(slackWorkspaces)
          .where(eq(slackWorkspaces.clientId, clientId));

        res.json(workspaces);
      } catch (error) {
        console.error("Error fetching Slack workspaces:", error);
        res.status(500).json({ message: "Error fetching workspaces" });
      }
    }
  );

  // Deactivate workspace installation
  app.delete(
    "/api/clients/:clientId/slack/workspaces/:workspaceId",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        const workspaceId = parseInt(req.params.workspaceId);

        if (!clientId || !workspaceId) {
          return res.status(400).json({ message: "Client ID and workspace ID are required" });
        }

        // Verify workspace belongs to this client
        const [workspace] = await db
          .select()
          .from(slackWorkspaces)
          .where(
            and(
              eq(slackWorkspaces.id, workspaceId),
              eq(slackWorkspaces.clientId, clientId)
            )
          );

        if (!workspace) {
          return res.status(404).json({ message: "Workspace not found" });
        }

        // Soft delete by deactivating
        const [deactivated] = await db
          .update(slackWorkspaces)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(slackWorkspaces.id, workspaceId))
          .returning({
            id: slackWorkspaces.id,
            teamName: slackWorkspaces.teamName,
            isActive: slackWorkspaces.isActive,
          });

        res.json({
          message: "Workspace deactivated successfully",
          workspace: deactivated,
        });

      } catch (error) {
        console.error("Error deactivating workspace:", error);
        res.status(500).json({ message: "Error deactivating workspace" });
      }
    }
  );

  // Reactivate workspace installation
  app.post(
    "/api/clients/:clientId/slack/workspaces/:workspaceId/reactivate",
    validateClientId,
    requireAdminRole,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        const workspaceId = parseInt(req.params.workspaceId);

        if (!clientId || !workspaceId) {
          return res.status(400).json({ message: "Client ID and workspace ID are required" });
        }

        // Verify workspace belongs to this client
        const [workspace] = await db
          .select()
          .from(slackWorkspaces)
          .where(
            and(
              eq(slackWorkspaces.id, workspaceId),
              eq(slackWorkspaces.clientId, clientId)
            )
          );

        if (!workspace) {
          return res.status(404).json({ message: "Workspace not found" });
        }

        // Reactivate the workspace
        const [reactivated] = await db
          .update(slackWorkspaces)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(slackWorkspaces.id, workspaceId))
          .returning({
            id: slackWorkspaces.id,
            teamName: slackWorkspaces.teamName,
            isActive: slackWorkspaces.isActive,
          });

        res.json({
          message: "Workspace reactivated successfully",
          workspace: reactivated,
        });

      } catch (error) {
        console.error("Error reactivating workspace:", error);
        res.status(500).json({ message: "Error reactivating workspace" });
      }
    }
  );
}