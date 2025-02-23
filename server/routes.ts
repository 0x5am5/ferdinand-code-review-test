import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { adminAuth } from "./firebase";
import { insertUserSchema, insertClientSchema, insertBrandAssetSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";

const upload = multer();

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

  // File upload endpoint for brand assets
  app.post("/api/clients/:id/assets", upload.single('file'), async (req, res) => {
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      // Convert file buffer to base64
      const fileData = req.file.buffer.toString('base64');

      // Validate the incoming data
      const parsed = insertBrandAssetSchema.safeParse({
        ...req.body,
        clientId,
        fileData,
        mimeType: req.file.mimetype,
      });

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid asset data" });
      }

      const asset = await storage.createBrandAsset(parsed.data);
      res.json(asset);
    } catch (error) {
      console.error("Error creating brand asset:", error);
      res.status(500).json({ message: "Error creating brand asset" });
    }
  });

  // Endpoint to get brand asset file
  app.get("/api/assets/:id/file", async (req, res) => {
    const assetId = parseInt(req.params.id);
    if (isNaN(assetId)) {
      return res.status(400).json({ message: "Invalid asset ID" });
    }

    const asset = await storage.getBrandAsset(assetId);
    if (!asset || !asset.fileData) {
      return res.status(404).json({ message: "Asset not found" });
    }

    const buffer = Buffer.from(asset.fileData, 'base64');
    res.setHeader('Content-Type', asset.mimeType);
    res.send(buffer);
  });

  return httpServer;
}