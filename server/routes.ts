import type { Express, Request } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { auth as firebaseAuth } from "./firebase";
import { emailService } from "./email-service";
import * as schema from "@shared/schema";
import {
  insertClientSchema,
  insertUserSchema,
  UserRole,
  User,
  insertFontAssetSchema,
  insertColorAssetSchema,
  insertUserPersonaSchema,
  userClients,
  insertUserClientSchema,
  insertInvitationSchema,
  users,
  invitations,
  clients,
} from "@shared/schema";
import multer from "multer";
import {
  insertInspirationSectionSchema,
  insertInspirationImageSchema,
} from "@shared/schema";
import { updateClientOrderSchema } from "@shared/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import * as fs from "fs";
import { registerAuthRoutes } from "./routes/auth";
import { registerUserRoutes } from "./routes/users";
import { registerClientRoutes } from "./routes/clients";
import { registerAssetRoutes } from "./routes/assets";
import { registerInvitationRoutes } from "./routes/invitations";
import { registerDesignSystemRoutes } from "./routes/design-system";

// Add session augmentation for TypeScript
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

// Add request augmentation for clientId parameter
interface RequestWithClientId extends Request {
  clientId?: number;
}

const upload = multer();

// Design system type
interface DesignSystem {
  theme: {
    variant: "professional" | "tint" | "vibrant";
    primary: string;
    appearance: "light" | "dark" | "system";
    radius: number;
    animation: string;
  };
  typography: {
    primary: string;
    heading: string;
  };
  colors: {
    primary: string;
    background: string;
    foreground: string;
    muted: string;
    "muted-foreground": string;
    card: string;
    "card-foreground": string;
    accent: string;
    "accent-foreground": string;
    destructive: string;
    "destructive-foreground": string;
    border: string;
    ring: string;
  };
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
}