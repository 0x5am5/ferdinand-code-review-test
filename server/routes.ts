import type { Express } from "express";
import { storage } from "./storage";
import { insertClientSchema, insertColorAssetSchema, insertFontAssetSchema, insertUserPersonaSchema } from "@shared/schema";
import multer from "multer";
import { 
  insertInspirationSectionSchema, 
  insertInspirationImageSchema 
} from "@shared/schema";

const upload = multer();

export function registerRoutes(app: Express) {
  // Middleware to validate client ID
  const validateClientId = (req: any, res: any, next: any) => {
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    req.clientId = clientId;
    next();
  };

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
        return res.status(400).json({ message: "Invalid client ID" });
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

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid client ID" });
      }

      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      await storage.deleteClient(id);
      res.status(200).json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Error deleting client" });
    }
  });

  // Asset routes
  app.get("/api/clients/:clientId/assets", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const assets = await storage.getClientAssets(clientId);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching client assets:", error);
      res.status(500).json({ message: "Error fetching client assets" });
    }
  });

  // Handle both file uploads and other assets
  app.post("/api/clients/:clientId/assets", upload.array('fontFiles'), validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const { category } = req.body;

      if (category === 'font') {
        // Handle font asset
        const { name, source, weights, styles } = req.body;
        const parsedWeights = JSON.parse(weights);
        const parsedStyles = JSON.parse(styles);
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No font files uploaded" });
        }

        // Create the font asset data
        const fontData = {
          clientId,
          name,
          category: 'font',
          data: {
            source,
            weights: parsedWeights,
            styles: parsedStyles,
            sourceData: {
              files: files.map(file => ({
                fileName: file.originalname,
                fileData: file.buffer.toString('base64'),
                format: file.originalname.split('.').pop()?.toLowerCase(),
                weight: '400', // Default weight
                style: 'normal' // Default style
              }))
            }
          }
        };

        const parsed = insertFontAssetSchema.safeParse(fontData);

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid font data",
            errors: parsed.error.errors
          });
        }

        const asset = await storage.createAsset(parsed.data);
        return res.status(201).json(asset);
      }

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

      // Handle logo asset
      const { name, type } = req.body;
      const file = req.file;

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
  app.patch("/api/clients/:clientId/assets/:assetId", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const assetId = parseInt(req.params.assetId);

      const asset = await storage.getAsset(assetId);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      if (asset.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to update this asset" });
      }

      let parsed;
      if (req.body.category === 'font') {
        parsed = insertFontAssetSchema.safeParse({
          ...req.body,
          clientId,
        });
      } else if (req.body.category === 'color') {
        parsed = insertColorAssetSchema.safeParse({
          ...req.body,
          clientId,
        });
      } else {
        return res.status(400).json({ message: "Invalid asset category" });
      }

      if (!parsed.success) {
        return res.status(400).json({
          message: `Invalid ${req.body.category} data`,
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
  app.delete("/api/clients/:clientId/assets/:assetId", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const assetId = parseInt(req.params.assetId);

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

  // User Persona routes
  app.get("/api/clients/:clientId/personas", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const personas = await storage.getClientPersonas(clientId);
      res.json(personas);
    } catch (error) {
      console.error("Error fetching client personas:", error);
      res.status(500).json({ message: "Error fetching client personas" });
    }
  });

  app.post("/api/clients/:clientId/personas", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const personaData = {
        ...req.body,
        clientId,
      };

      const parsed = insertUserPersonaSchema.safeParse(personaData);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid persona data",
          errors: parsed.error.errors
        });
      }

      const persona = await storage.createPersona(parsed.data);
      res.status(201).json(persona);
    } catch (error) {
      console.error("Error creating persona:", error);
      res.status(500).json({ message: "Error creating persona" });
    }
  });

  app.patch("/api/clients/:clientId/personas/:personaId", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const personaId = parseInt(req.params.personaId);

      const persona = await storage.getPersona(personaId);

      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }

      if (persona.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to update this persona" });
      }

      const parsed = insertUserPersonaSchema.safeParse({
        ...req.body,
        clientId,
      });

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid persona data",
          errors: parsed.error.errors
        });
      }

      const updatedPersona = await storage.updatePersona(personaId, parsed.data);
      res.json(updatedPersona);
    } catch (error) {
      console.error("Error updating persona:", error);
      res.status(500).json({ message: "Error updating persona" });
    }
  });

  app.delete("/api/clients/:clientId/personas/:personaId", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const personaId = parseInt(req.params.personaId);

      const persona = await storage.getPersona(personaId);

      if (!persona) {
        return res.status(404).json({ message: "Persona not found" });
      }

      if (persona.clientId !== clientId) {
        return res.status(403).json({ message: "Not authorized to delete this persona" });
      }

      await storage.deletePersona(personaId);
      res.status(200).json({ message: "Persona deleted successfully" });
    } catch (error) {
      console.error("Error deleting persona:", error);
      res.status(500).json({ message: "Error deleting persona" });
    }
  });

  // Serve asset files
  app.get("/api/assets/:assetId/file", async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
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

  // Inspiration board routes
  app.get("/api/clients/:clientId/inspiration/sections", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const sections = await storage.getClientInspirationSections(clientId);
      const sectionsWithImages = await Promise.all(
        sections.map(async (section) => ({
          ...section,
          images: await storage.getSectionImages(section.id),
        }))
      );
      res.json(sectionsWithImages);
    } catch (error) {
      console.error("Error fetching inspiration sections:", error);
      res.status(500).json({ message: "Error fetching inspiration sections" });
    }
  });

  app.post("/api/clients/:clientId/inspiration/sections", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const sectionData = {
        ...req.body,
        clientId,
      };

      const parsed = insertInspirationSectionSchema.safeParse(sectionData);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid section data",
          errors: parsed.error.errors,
        });
      }

      const section = await storage.createInspirationSection(parsed.data);
      res.status(201).json(section);
    } catch (error) {
      console.error("Error creating inspiration section:", error);
      res.status(500).json({ message: "Error creating inspiration section" });
    }
  });

  app.patch("/api/clients/:clientId/inspiration/sections/:sectionId", validateClientId, async (req, res) => {
    try {
      const clientId = req.clientId;
      const sectionId = parseInt(req.params.sectionId);
      const sectionData = {
        ...req.body,
        clientId,
      };

      const parsed = insertInspirationSectionSchema.safeParse(sectionData);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid section data",
          errors: parsed.error.errors,
        });
      }

      const section = await storage.updateInspirationSection(sectionId, parsed.data);
      res.json(section);
    } catch (error) {
      console.error("Error updating inspiration section:", error);
      res.status(500).json({ message: "Error updating inspiration section" });
    }
  });

  app.post("/api/clients/:clientId/inspiration/sections/:sectionId/images", upload.single('image'), validateClientId, async (req, res) => {
    try {
      const sectionId = parseInt(req.params.sectionId);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      const base64Data = file.buffer.toString('base64');
      const imageData = {
        sectionId,
        url: `data:${file.mimetype};base64,${base64Data}`,
        fileData: base64Data,
        mimeType: file.mimetype,
        order: parseInt(req.body.order) || 0,
      };

      const parsed = insertInspirationImageSchema.safeParse(imageData);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid image data",
          errors: parsed.error.errors,
        });
      }

      const image = await storage.createInspirationImage(parsed.data);
      res.status(201).json(image);
    } catch (error) {
      console.error("Error uploading inspiration image:", error);
      res.status(500).json({ message: "Error uploading inspiration image" });
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