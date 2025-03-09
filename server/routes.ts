import type { Express } from "express";
import { storage } from "./storage";
import { insertClientSchema, insertColorAssetSchema, insertFontAssetSchema } from "@shared/schema";
import multer from "multer";
import { convertFont, extractFontMetadata } from "./utils/font-converter";

const upload = multer();

export function registerRoutes(app: Express) {
  // Basic test route
  app.get("/api/test", (_req, res) => {
    res.json({ message: "API is working" });
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

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid client ID format" });
      }

      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Error fetching client" });
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
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID format" });
      }

      const assets = await storage.getClientAssets(clientId);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching client assets:", error);
      res.status(500).json({ message: "Error fetching client assets" });
    }
  });

  // Handle font, color, and other asset uploads
  app.post("/api/clients/:clientId/assets", upload.array('files'), async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID format" });
      }

      const { category } = req.body;

      if (category === 'color') {
        // Handle color asset
        const parsed = insertColorAssetSchema.safeParse({
          ...req.body,
          clientId,
        });

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid color data",
            errors: parsed.error.errors
          });
        }

        const asset = await storage.createAsset(parsed.data);
        return res.status(201).json(asset);
      }

      if (category === 'typography') {
        const parsed = insertFontAssetSchema.safeParse({
          ...req.body,
          clientId,
        });

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid font data",
            errors: parsed.error.errors
          });
        }

        // Handle font file upload and conversion
        if (req.files && Array.isArray(req.files)) {
          const fontFiles = req.files as Express.Multer.File[];
          const convertedFonts: Record<string, string>[] = [];

          for (const file of fontFiles) {
            // Extract metadata from the font file
            const metadata = await extractFontMetadata(file.buffer, file.originalname.split('.').pop() || '');

            // Convert font to all supported formats
            const convertedFormats = await convertFont(file.buffer, file.originalname.split('.').pop() || '');

            convertedFonts.push({
              ...convertedFormats,
              originalFormat: file.originalname.split('.').pop() || '',
              metadata,
            });
          }

          // Update the font data with converted files
          const fontData = {
            ...parsed.data,
            data: {
              ...parsed.data.data,
              files: convertedFonts.map(font => ({
                ...font.metadata,
                fileData: font,
              })),
            },
          };

          const asset = await storage.createAsset(fontData);
          return res.status(201).json(asset);
        }

        // Handle Google Fonts or Adobe Fonts integration without file upload
        const asset = await storage.createAsset(parsed.data);
        return res.status(201).json(asset);
      }

      // Handle logo and other file uploads
      const { name, type } = req.body;
      const file = req.files?.[0];

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

      const asset = await storage.createAsset({
        clientId,
        name,
        category: 'logo',
        data: {
          type,
          format: fileExtension || 'png',
          fileName: file.originalname,
        },
        fileData: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      });

      res.status(201).json(asset);
    } catch (error) {
      console.error("Error creating asset:", error);
      res.status(500).json({ message: "Error creating asset" });
    }
  });

  // Update asset endpoint
  app.patch("/api/clients/:clientId/assets/:assetId", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const assetId = parseInt(req.params.assetId);

      if (isNaN(clientId) || isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const asset = await storage.getAsset(assetId);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      if (asset.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to update this asset" });
      }

      let parsed;
      if (asset.category === 'color') {
        parsed = insertColorAssetSchema.safeParse({
          ...req.body,
          clientId,
        });
      } else if (asset.category === 'typography') {
        parsed = insertFontAssetSchema.safeParse({
          ...req.body,
          clientId,
        });
      } else {
        return res.status(400).json({ message: "Invalid asset category" });
      }

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid data",
          errors: parsed.error.errors
        });
      }

      const updatedAsset = await storage.updateAsset(assetId, parsed.data);
      res.json(updatedAsset);
    } catch (error) {
      console.error("Error updating asset:", error);
      res.status(500).json({ message: "Error updating asset" });
    }
  });

  // Delete asset endpoint
  app.delete("/api/clients/:clientId/assets/:assetId", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const assetId = parseInt(req.params.assetId);

      if (isNaN(clientId) || isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const asset = await storage.getAsset(assetId);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      if (asset.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to delete this asset" });
      }

      await storage.deleteAsset(assetId);
      res.status(200).json({ message: "Asset deleted successfully" });
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ message: "Error deleting asset" });
    }
  });

  // Serve asset files
  app.get("/api/assets/:assetId/file", async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      if (isNaN(assetId)) {
        return res.status(400).json({ message: "Invalid asset ID format" });
      }

      const asset = await storage.getAsset(assetId);

      if (!asset || !asset.fileData) {
        return res.status(404).json({ message: "Asset not found" });
      }

      res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
      const buffer = Buffer.from(asset.fileData, 'base64');
      res.send(buffer);
    } catch (error) {
      console.error("Error serving asset file:", error);
      res.status(500).json({ message: "Error serving asset file" });
    }
  });
}