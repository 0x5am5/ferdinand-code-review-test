import type { Express, Request } from "express";
import { registerApiTokenRoutes } from "./routes/api-tokens";
import { registerAssetRoutes } from "./routes/assets";
import { registerAuthRoutes } from "./routes/auth";
import { registerClientRoutes } from "./routes/clients";
import { registerDesignSystemRoutes } from "./routes/design-system";
import { registerFigmaRoutes } from "./routes/figma";
import { registerFileAssetCategoryRoutes } from "./routes/file-asset-categories";
import { registerFileAssetTagRoutes } from "./routes/file-asset-tags";
import { registerFileAssetRoutes } from "./routes/file-assets";
import { registerHiddenSectionsRoutes } from "./routes/hidden-sections";
import { registerInspirationBoardsRoutes } from "./routes/inspiration-boards";
import { registerInvitationRoutes } from "./routes/invitations";
import { registerPersonasRoutes } from "./routes/personas";
import { registerSlackRoutes } from "./routes/slack";
import { registerSlackOAuthRoutes } from "./routes/slack-oauth";
import { registerTypeScalesRoutes } from "./routes/type-scales";
import { registerUserRoutes } from "./routes/users";

// Add session augmentation for TypeScript
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

// Add request augmentation for clientId parameter
export interface RequestWithClientId extends Request {
  clientId?: number;
}

export function registerRoutes(app: Express) {
  // Google Fonts API endpoint - must be registered first
  app.get("/api/google-fonts", async (_req, res) => {
    try {
      console.log("Google Fonts API endpoint called");
      const apiKey = process.env.GOOGLE_FONTS_API_KEY;
      if (!apiKey) {
        console.error("Google Fonts API key not found");
        return res
          .status(500)
          .json({ error: "Google Fonts API key not configured" });
      }

      const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`;
      console.log("Fetching from Google Fonts API...");

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Google Fonts API error: ${response.status}`);
        throw new Error(`Google Fonts API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(
        `Successfully fetched ${data.items?.length || 0} fonts from Google Fonts API`
      );

      // Set proper headers
      res.setHeader("Content-Type", "application/json");
      res.json(data);
    } catch (error: unknown) {
      console.error(
        "Error fetching Google Fonts:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ error: "Failed to fetch Google Fonts" });
    }
  });
  // Basic test route
  app.get("/api/test", (_req, res) => {
    res.json({ message: "API is working" });
  });

  // Register modular routes
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerClientRoutes(app);
  // Register file asset routes BEFORE old asset routes to avoid path conflicts
  // The new file assets system uses /api/assets/* while old system uses /api/clients/:clientId/assets/*
  registerFileAssetRoutes(app);
  registerFileAssetCategoryRoutes(app);
  registerFileAssetTagRoutes(app);
  registerAssetRoutes(app);
  registerInvitationRoutes(app);
  registerDesignSystemRoutes(app);
  registerPersonasRoutes(app);
  registerInspirationBoardsRoutes(app);
  registerHiddenSectionsRoutes(app);
  registerTypeScalesRoutes(app);
  registerFigmaRoutes(app);
  registerSlackRoutes(app);
  registerSlackOAuthRoutes(app);
  registerApiTokenRoutes(app);
}
