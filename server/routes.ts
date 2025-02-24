import type { Express } from "express";
import { storage } from "./storage";
import { insertClientSchema } from "@shared/schema";
import multer from "multer";

const upload = multer();

export function registerRoutes(app: Express) {
  // Basic test route
  app.get("/api/test", (_req, res) => {
    res.json({ message: "API is working" });
  });

  // Auth routes - simplified for testing
  app.get("/api/auth/me", async (_req, res) => {
    res.json({
      id: 1,
      email: "admin@example.com",
      name: "Admin User",
      role: "admin"
    });
  });

  // Client routes
  app.get("/api/clients", async (_req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Error fetching clients" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid client data",
          errors: parsed.error.errors
        });
      }

      const client = await storage.createClient(parsed.data);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Error creating client" });
    }
  });

  // Asset routes
  app.get("/api/clients/:clientId/assets", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const assets = await storage.getClientAssets(clientId);
      console.log('Fetched assets:', assets); // Debug log
      res.json(assets);
    } catch (error) {
      console.error("Error fetching client assets:", error);
      res.status(500).json({ message: "Error fetching client assets" });
    }
  });

  // Handle file uploads with multer
  app.post("/api/clients/:clientId/assets", upload.single('file'), async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { name, type } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const asset = await storage.createAsset({
        clientId,
        name,
        category: 'logo',
        data: {
          type,
          format: file.originalname.split('.').pop(),
          fileName: file.originalname,
        },
        fileData: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      });

      res.status(201).json(asset);
    } catch (error) {
      console.error("Error uploading asset:", error);
      res.status(500).json({ message: "Error uploading asset" });
    }
  });

  // Serve asset files
  app.get("/api/assets/:assetId/file", async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const asset = await storage.getAsset(assetId);
      console.log('Fetching asset:', assetId, asset); // Debug log

      if (!asset || !asset.fileData) {
        return res.status(404).json({ message: "Asset not found" });
      }

      res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
      res.send(Buffer.from(asset.fileData, 'base64'));
    } catch (error) {
      console.error("Error serving asset file:", error);
      res.status(500).json({ message: "Error serving asset file" });
    }
  });
}