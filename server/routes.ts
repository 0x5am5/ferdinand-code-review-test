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
