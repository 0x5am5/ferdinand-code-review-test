import type { Express, Request } from "express";

import { registerAuthRoutes } from "./routes/auth";
import { registerUserRoutes } from "./routes/users";
import { registerClientRoutes } from "./routes/clients";
import { registerAssetRoutes } from "./routes/assets";
import { registerInvitationRoutes } from "./routes/invitations";
import { registerDesignSystemRoutes } from "./routes/design-system";
import { registerPersonasRoutes } from "./routes/personas";
import { registerInspirationBoardsRoutes } from "./routes/inspiration-boards";
import { registerHiddenSectionsRoutes } from "./routes/hidden-sections";

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
  // Google Fonts API endpoint
  app.get("/api/google-fonts", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_FONTS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Google Fonts API key not configured" });
      }

      const response = await fetch(
        `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`
      );

      if (!response.ok) {
        throw new Error(`Google Fonts API error: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching Google Fonts:", error);
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
  registerAssetRoutes(app);
  registerInvitationRoutes(app);
  registerDesignSystemRoutes(app);
  registerPersonasRoutes(app);
  registerInspirationBoardsRoutes(app);
  registerHiddenSectionsRoutes(app);
}
