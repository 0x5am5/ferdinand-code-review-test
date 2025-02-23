import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { adminAuth } from "./firebase";
import { insertUserSchema, insertClientSchema } from "@shared/schema";

// Extend Express Request type to include session
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { token, email, name } = req.body;

    try {
      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }
      const decodedToken = await adminAuth.verifyIdToken(token);
      if (!decodedToken) {
        return res.status(401).json({ message: "Invalid token" });
      }
      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        req.session.userId = existingUser.id;
        return res.json(existingUser);
      }

      const user = await storage.createUser({
        email,
        name,
        role: "client",
      });

      req.session.userId = user.id;
      res.json(user);
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Temporarily bypass auth check for development
  app.get("/api/auth/me", async (req, res) => {
    // Return a mock admin user for development
    res.json({
      id: 1,
      email: "admin@example.com",
      name: "Admin User",
      role: "admin"
    });
  });

  // Client routes - temporarily bypass auth checks
  app.get("/api/clients", async (_req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.post("/api/clients", async (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid client data" });
    }

    const client = await storage.createClient(parsed.data);
    res.json(client);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }

    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json(client);
  });

  app.get("/api/clients/current", async (req, res) => {
    // For development, return null to show the "No Client Assigned" view
    res.json(null);
  });

  app.get("/api/clients/:id/assets", async (req, res) => {
    const clientId = parseInt(req.params.id);
    const assets = await storage.getBrandAssets(clientId);
    res.json(assets);
  });

  return httpServer;
}