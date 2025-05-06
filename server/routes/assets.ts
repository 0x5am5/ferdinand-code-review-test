import type { Express, Response } from "express";
import { storage } from "../storage";
import { insertColorAssetSchema, insertFontAssetSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import multer from "multer";
import { validateClientId } from "server/middlewares/vaildateClientId";
import { RequestWithClientId } from "server/routes";

const upload = multer({ preservePath: true });

export function registerAssetRoutes(app: Express) {
  // Get all assets
  app.get("/api/assets", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const allAssets = await db.query.assets.findMany();
      res.json(allAssets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ message: "Error fetching assets" });
    }
  });

  // Get single asset
  app.get("/api/assets/:id", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const asset = await db.query.assets.findFirst({
        where: eq(assets.id, parseInt(req.params.id)),
      });

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      res.json(asset);
    } catch (error) {
      console.error("Error fetching asset:", error);
      res.status(500).json({ message: "Error fetching asset" });
    }
  });

  // Handle both file uploads and other assets
  app.post(
    "/api/clients/:clientId/assets",
    upload.any(),
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId!;
        const { category } = req.body;

        // Font asset creation
        if (category === "font") {
          const { name, source, weights, styles } = req.body;
          const parsedWeights = JSON.parse(weights);
          const parsedStyles = JSON.parse(styles);
          const files = req.files as Express.Multer.File[];

          if (!files || files.length === 0) {
            return res.status(400).json({ message: "No font files uploaded" });
          }

          // Create the font asset data
          const fontAsset = {
            clientId,
            name,
            category: "font" as const,
            fileData: files[0].buffer.toString("base64"),
            mimeType: files[0].mimetype,
            data: {
              source,
              weights: parsedWeights,
              styles: parsedStyles,
              sourceData: {
                files: files.map((file) => ({
                  fileName: file.originalname,
                  fileData: file.buffer.toString("base64"),
                  format: file.originalname.split(".").pop()?.toLowerCase() as
                    | "woff"
                    | "woff2"
                    | "otf"
                    | "ttf"
                    | "eot",
                  weight: "400",
                  style: "normal",
                })),
              },
            },
          };

          const parsed = insertFontAssetSchema.safeParse(fontAsset);

          if (!parsed.success) {
            return res.status(400).json({
              message: "Invalid font data",
              errors: parsed.error.errors,
            });
          }

          const asset = await storage.createAsset(parsed.data);
          return res.status(201).json(asset);
        }

        if (category === "color") {
          // Handle color asset
          const colorAsset = {
            ...req.body,
            clientId,
            category: "color" as const,
          };

          const parsed = insertColorAssetSchema.safeParse(colorAsset);

          if (!parsed.success) {
            return res.status(400).json({
              message: "Invalid color data",
              errors: parsed.error.errors,
            });
          }

          const asset = await storage.createAsset(parsed.data);
          return res.status(201).json(asset);
        }

        // Default to logo asset
        const { name, type } = req.body;
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const file = files[0];
        const fileExtension = file.originalname.split(".").pop()?.toLowerCase();

        const logoAsset = {
          clientId,
          name,
          category: "logo" as const,
          data: JSON.stringify({
            type,
            format: fileExtension || "png",
            fileName: file.originalname,
          }),
          fileData: file.buffer.toString("base64"),
          mimeType: file.mimetype,
        };

        const asset = await storage.createAsset(logoAsset);
        res.status(201).json(asset);
      } catch (error) {
        console.error("Error creating asset:", error);
        res.status(500).json({ message: "Error creating asset" });
      }
    },
  );

  // Update asset endpoint
  app.patch(
    "/api/clients/:clientId/assets/:assetId",
    upload.any(),
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId!;
        const assetId = parseInt(req.params.assetId);

        const asset = await storage.getAsset(assetId);

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        if (asset.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Not authorized to update this asset" });
        }

        let parsed;
        if (req.body.category === "font") {
          parsed = insertFontAssetSchema.safeParse({
            ...req.body,
            clientId,
          });
        } else if (req.body.category === "color") {
          parsed = insertColorAssetSchema.safeParse({
            ...req.body,
            clientId,
          });
        } else if (req.body.category === "logo" || (req.body.data && JSON.parse(req.body.data).type)) {
          const files = req.files as Express.Multer.File[];
          if (!files || files.length === 0) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const existingData = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
          parsed = { success: true, data: {
            ...asset,
            category: "logo",
            data: JSON.stringify({
              ...existingData,
              hasDarkVariant: true,
              darkVariant: {
                fileData: files[0].buffer.toString('base64'),
                mimeType: files[0].mimetype,
                format: files[0].originalname.split('.').pop()?.toLowerCase() || 'png'
              }
            })
          }};
        } else {
          return res.status(400).json({ message: "Invalid asset category" });
        }

        if (!parsed.success) {
          return res.status(400).json({
            message: `Invalid ${req.body.category} data`,
            errors: parsed.error.errors,
          });
        }

        const updatedAsset = await storage.updateAsset(assetId, parsed.data);
        res.json(updatedAsset);
      } catch (error) {
        console.error("Error updating asset:", error);
        res.status(500).json({ message: "Error updating asset" });
      }
    },
  );

  // Delete asset endpoint
  app.delete(
    "/api/clients/:clientId/assets/:assetId",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId!;
        const assetId = parseInt(req.params.assetId);

        const asset = await storage.getAsset(assetId);

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        if (asset.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Not authorized to delete this asset" });
        }

        await storage.deleteAsset(assetId);
        res.status(200).json({ message: "Asset deleted successfully" });
      } catch (error) {
        console.error("Error deleting asset:", error);
        res.status(500).json({ message: "Error deleting asset" });
      }
    },
  );

  app.get(
    "/api/clients/:clientId/assets",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId!;
        const assets = await storage.getClientAssets(clientId);
        res.json(assets);
      } catch (error) {
        console.error("Error fetching client assets:", error);
        res.status(500).json({ message: "Error fetching client assets" });
      }
    },
  );

  // Serve asset endpoint
  app.get("/api/assets/:assetId/file", async (req, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const asset = await storage.getAsset(assetId);

      if (!asset || !asset.fileData) {
        return res.status(404).json({ message: "Asset not found" });
      }

      res.setHeader(
        "Content-Type",
        asset.mimeType || "application/octet-stream",
      );
      const buffer = Buffer.from(asset.fileData, "base64");
      res.send(buffer);
    } catch (error) {
      console.error("Error serving asset file:", error);
      res.status(500).json({ message: "Error serving asset file" });
    }
  });
}