
import type { Express } from "express";
import { storage } from "../storage";
import * as fs from "fs";
import path from "path";

export function registerDesignSystemRoutes(app: Express) {
  // Get design system
  app.get("/api/design-system", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const designSystem = await storage.getDesignSystem();
      res.json(designSystem);
    } catch (error) {
      console.error("Error fetching design system:", error);
      res.status(500).json({ message: "Error fetching design system" });
    }
  });

  // Update design system
  app.patch("/api/design-system", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const updatedSystem = await storage.updateDesignSystem(req.body);
      res.json(updatedSystem);
    } catch (error) {
      console.error("Error updating design system:", error);
      res.status(500).json({ message: "Error updating design system" });
    }
  });

  // Export design system tokens
  app.get("/api/design-system/export", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const designSystem = await storage.getDesignSystem();
      const tokens = storage.generateDesignTokens(designSystem);
      res.json(tokens);
    } catch (error) {
      console.error("Error exporting design system:", error);
      res.status(500).json({ message: "Error exporting design system" });
    }
  });
}
