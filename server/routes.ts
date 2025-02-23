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
      await adminAuth.verifyIdToken(token);
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

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json(user);
  });

  // Client routes
  app.get("/api/clients", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    const client = await storage.getClient(clientId);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Only allow access if user is admin or assigned to this client
    if (user.role !== "admin" && user.clientId !== clientId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid client data" });
    }

    const client = await storage.createClient(parsed.data);
    res.json(client);
  });

  app.get("/api/clients/current", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.clientId) {
      return res.status(404).json({ message: "No client assigned" });
    }

    const client = await storage.getClient(user.clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json(client);
  });

  app.get("/api/clients/:id/assets", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const clientId = parseInt(req.params.id);

    // Only allow access if user is admin or assigned to this client
    if (user.role !== "admin" && user.clientId !== clientId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const assets = await storage.getBrandAssets(clientId);
    res.json(assets);
  });

  return httpServer;
}