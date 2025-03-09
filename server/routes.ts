import type { Express } from "express";
import { storage } from "./storage";
import { insertClientSchema, insertColorAssetSchema, insertFontAssetSchema, FontSource, FontFormat } from "@shared/schema";
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

      const { category, source } = req.body;

      if (category === 'typography') {
        // Initialize font data with common fields
        const fontData = {
          clientId,
          name: req.body.name,
          category: 'typography' as const,
          data: {
            source,
            family: req.body.name,
            weights: [400],
            styles: ['normal'],
            formats: [FontFormat.WOFF2],
            projectId: req.body.projectId,
            projectUrl: req.body.projectUrl,
            previewText: req.body.previewText,
          },
        };

        // Handle different font sources
        if (source === FontSource.ADOBE) {
          if (!req.body.projectId?.trim()) {
            return res.status(400).json({ 
              message: "Adobe Fonts Error",
              details: "Project ID is required for Adobe Fonts integration"
            });
          }
          fontData.data.projectUrl = `https://fonts.adobe.com/fonts/${req.body.projectId}`;
        } 
        else if (source === FontSource.GOOGLE) {
          if (!req.body.projectUrl?.trim()) {
            return res.status(400).json({ 
              message: "Google Fonts Error",
              details: "Please provide a valid Google Fonts URL"
            });
          }
          try {
            const url = new URL(req.body.projectUrl);
            if (!url.hostname.includes('fonts.google.com')) {
              throw new Error('Invalid Google Fonts URL');
            }
          } catch (error) {
            return res.status(400).json({ 
              message: "Google Fonts Error",
              details: "The provided URL is not a valid Google Fonts URL"
            });
          }
        }
        else if (source === FontSource.CUSTOM) {
          if (!req.files?.length) {
            return res.status(400).json({ 
              message: "Font Upload Error",
              details: "Please select at least one font file to upload (supported formats: TTF, OTF, WOFF, or WOFF2)"
            });
          }

          const fontFiles = req.files as Express.Multer.File[];
          fontData.data.files = [];

          try {
            for (const file of fontFiles) {
              const fileExt = file.originalname.split('.').pop()?.toLowerCase();

              if (!['ttf', 'otf', 'woff', 'woff2'].includes(fileExt || '')) {
                return res.status(400).json({ 
                  message: "Invalid Font Format",
                  details: `File "${file.originalname}" is not supported. Please upload only TTF, OTF, WOFF, or WOFF2 files.`
                });
              }

              // Extract metadata and convert font
              const metadata = await extractFontMetadata(file.buffer, fileExt || '');
              const convertedFormats = await convertFont(file.buffer, fileExt || '');

              // Update font data with metadata
              fontData.data.family = metadata.family;
              if (!fontData.data.weights.includes(metadata.weight)) {
                fontData.data.weights.push(metadata.weight);
              }
              if (!fontData.data.styles.includes(metadata.style)) {
                fontData.data.styles.push(metadata.style);
              }
              fontData.data.characters = metadata.characters;

              // Add converted files
              Object.entries(convertedFormats).forEach(([format, fileData]) => {
                const formatKey = format as keyof typeof FontFormat;
                if (!fontData.data.formats.includes(FontFormat[formatKey])) {
                  fontData.data.formats.push(FontFormat[formatKey]);
                }
                fontData.data.files?.push({
                  format: FontFormat[formatKey],
                  weight: metadata.weight,
                  style: metadata.style,
                  fileData,
                });
              });
            }
          } catch (error) {
            console.error('Font processing error:', error);
            return res.status(400).json({ 
              message: "Font Processing Error",
              details: error instanceof Error ? error.message : "Failed to process font file"
            });
          }
        }

        // Validate the complete font data
        const parsed = insertFontAssetSchema.safeParse(fontData);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid Font Data",
            details: parsed.error.errors.map(err => err.message).join(', ')
          });
        }

        try {
          const asset = await storage.createAsset(parsed.data);
          return res.status(201).json(asset);
        } catch (error) {
          console.error('Database error:', error);
          return res.status(500).json({
            message: "Database Error",
            details: "Failed to save the font"
          });
        }
      }

      // Handle other asset types (color, logo, etc.)
      else if (category === 'color') {
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
      // Handle other asset types (logo, etc.)
      return res.status(400).json({ message: "Invalid asset category" });
    } catch (error) {
      console.error("Error creating asset:", error);
      return res.status(500).json({ 
        message: "Server Error",
        details: error instanceof Error ? error.message : "An unexpected error occurred"
      });
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