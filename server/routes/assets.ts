
import type { Express } from "express";
import { storage } from "../storage";
import { assets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import multer from "multer";

const upload = multer();

export function registerAssetRoutes(app: Express) {
  // Get all assets
  app.get("/api/assets", async (req, res) => {
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
  app.get("/api/assets/:id", async (req, res) => {
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

  // Upload asset
  app.post("/api/assets", upload.single("file"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Handle file upload logic here
      const result = await storage.uploadAsset(req.file);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error uploading asset:", error);
      res.status(500).json({ message: "Error uploading asset" });
    }
  });

  // Delete asset
  app.delete("/api/assets/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      await db.delete(assets).where(eq(assets.id, parseInt(req.params.id)));
      res.json({ message: "Asset deleted successfully" });
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ message: "Error deleting asset" });
    }
  });
}
