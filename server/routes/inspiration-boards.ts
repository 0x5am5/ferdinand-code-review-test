import {
  insertInspirationImageSchema,
  insertInspirationSectionSchema,
} from "@shared/schema";
import type { Express } from "express";
import multer from "multer";
import { requireAdminRole } from "server/middlewares/requireAdminRole";
import { validateClientId } from "server/middlewares/vaildateClientId";
import type { RequestWithClientId } from "server/routes";
import { storage } from "server/storage";

const upload = multer();

export function registerInspirationBoardsRoutes(app: Express) {
  app.get(
    "/api/clients/:clientId/inspiration/sections",
    validateClientId,
    async (req: RequestWithClientId, res) => {
      try {
        const clientId = req.clientId!;
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
        res
          .status(500)
          .json({ message: "Error fetching inspiration sections" });
      }
    }
  );

  app.post(
    "/api/clients/:clientId/inspiration/sections",
    validateClientId,
    requireAdminRole,
    async (req: RequestWithClientId, res) => {
      try {
        const clientId = req.clientId!;
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
    }
  );

  app.patch(
    "/api/clients/:clientId/inspiration/sections/:sectionId",
    validateClientId,
    requireAdminRole,
    async (req: RequestWithClientId, res) => {
      try {
        const clientId = req.clientId!;
        const sectionId = parseInt(req.params.sectionId, 10);
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

        const section = await storage.updateInspirationSection(
          sectionId,
          parsed.data
        );
        res.json(section);
      } catch (error) {
        console.error("Error updating inspiration section:", error);
        res.status(500).json({ message: "Error updating inspiration section" });
      }
    }
  );

  app.delete(
    "/api/clients/:clientId/inspiration/sections/:sectionId",
    validateClientId,
    requireAdminRole,
    async (req: RequestWithClientId, res) => {
      try {
        const sectionId = parseInt(req.params.sectionId, 10);
        if (Number.isNaN(sectionId)) {
          return res.status(400).json({ message: "Invalid section ID" });
        }

        await storage.deleteInspirationSection(sectionId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting inspiration section:", error);
        res.status(500).json({ message: "Error deleting inspiration section" });
      }
    }
  );

  app.post(
    "/api/clients/:clientId/inspiration/sections/:sectionId/images",
    upload.single("image"),
    validateClientId,
    async (req: RequestWithClientId, res) => {
      try {
        const sectionId = parseInt(req.params.sectionId, 10);
        const file = req.file;

        if (!file) {
          return res.status(400).json({ message: "No image file uploaded" });
        }

        const base64Data = file.buffer.toString("base64");
        const imageData = {
          sectionId,
          url: `data:${file.mimetype};base64,${base64Data}`,
          fileData: base64Data,
          mimeType: file.mimetype,
          order: parseInt(req.body.order, 10) || 0,
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
    }
  );
}
