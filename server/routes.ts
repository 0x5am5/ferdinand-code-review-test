import type { Express } from "express";
import { storage } from "./storage";
import { insertClientSchema, LogoType } from "@shared/schema";
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

  // Client assets endpoint with enhanced logging
  app.get("/api/clients/:clientId/assets", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const assets = await storage.getClientAssets(clientId);

      // Validate and parse logo data
      const processedAssets = assets.map(asset => {
        if (asset.category === 'logo') {
          try {
            const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
            console.log('Processing logo asset:', {
              id: asset.id,
              name: asset.name,
              type: data.type,
              format: data.format,
              hasFileData: !!asset.fileData
            });

            // Validate logo type
            if (!Object.values(LogoType).includes(data.type)) {
              console.error('Invalid logo type:', data.type);
              return null;
            }

            return {
              ...asset,
              data: typeof data === 'string' ? JSON.parse(data) : data
            };
          } catch (error) {
            console.error('Invalid logo data for asset:', asset.id, error);
            return null;
          }
        }
        return asset;
      }).filter(Boolean);

      res.json(processedAssets);
    } catch (error) {
      console.error("Error fetching client assets:", error);
      res.status(500).json({ message: "Error fetching client assets" });
    }
  });

  // Handle file uploads with enhanced validation
  app.post("/api/clients/:clientId/assets", upload.single('file'), async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { name, type } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate logo type
      if (!Object.values(LogoType).includes(type)) {
        return res.status(400).json({ message: "Invalid logo type" });
      }

      // Parse the file extension from the original filename
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

      const assetData = {
        type,
        format: fileExtension || 'png',
        fileName: file.originalname,
      };

      const asset = await storage.createAsset({
        clientId,
        name,
        category: 'logo',
        data: assetData,
        fileData: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      });

      console.log('Created logo asset:', {
        id: asset.id,
        name: asset.name,
        type: assetData.type,
        format: assetData.format,
        hasFileData: !!asset.fileData
      });

      res.status(201).json(asset);
    } catch (error) {
      console.error("Error uploading asset:", error);
      res.status(500).json({ message: "Error uploading asset" });
    }
  });

  // Serve asset files with enhanced error handling
  app.get("/api/assets/:assetId/file", async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const asset = await storage.getAsset(assetId);

      if (!asset || !asset.fileData) {
        console.error('Asset not found or missing file data:', assetId);
        return res.status(404).json({ message: "Asset not found" });
      }

      const buffer = Buffer.from(asset.fileData, 'base64');
      res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error) {
      console.error("Error serving asset file:", error);
      res.status(500).json({ message: "Error serving asset file" });
    }
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
}