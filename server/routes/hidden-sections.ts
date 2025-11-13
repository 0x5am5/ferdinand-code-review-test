import { insertHiddenSectionSchema, UserRole } from "@shared/schema";
import type { Express, Request, Response } from "express";
import { requireMinimumRole } from "../middlewares/requireMinimumRole";
import { storage } from "../storage";

export function registerHiddenSectionsRoutes(app: Express) {
  // Get all hidden sections for a client
  app.get(
    "/api/clients/:clientId/hidden-sections",
    requireMinimumRole(UserRole.EDITOR),
    async (req: Request, res: Response) => {
      try {
        const clientId = parseInt(req.params.clientId, 10);
        if (Number.isNaN(clientId)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        const hiddenSections = await storage.getClientHiddenSections(clientId);
        return res.status(200).json(hiddenSections);
      } catch (error: unknown) {
        console.error(
          "Error getting hidden sections:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Add a section to the hidden list
  app.post(
    "/api/clients/:clientId/hidden-sections",
    requireMinimumRole(UserRole.EDITOR),
    async (req: Request, res: Response) => {
      try {
        const clientId = parseInt(req.params.clientId, 10);
        if (Number.isNaN(clientId)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        // Validate the request body
        const validationResult = insertHiddenSectionSchema.safeParse({
          ...req.body,
          clientId,
        });

        if (!validationResult.success) {
          return res.status(400).json({
            message: "Invalid request data",
            errors: validationResult.error.errors,
          });
        }

        const hiddenSection = await storage.createHiddenSection(
          validationResult.data
        );
        return res.status(201).json(hiddenSection);
      } catch (error: unknown) {
        console.error(
          "Error creating hidden section:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Remove a section from the hidden list
  app.delete(
    "/api/clients/:clientId/hidden-sections/:sectionType",
    requireMinimumRole(UserRole.EDITOR),
    async (req: Request, res: Response) => {
      try {
        const clientId = parseInt(req.params.clientId, 10);
        if (Number.isNaN(clientId)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        const { sectionType } = req.params;
        if (!sectionType) {
          return res.status(400).json({ message: "Section type is required" });
        }

        await storage.deleteHiddenSection(clientId, sectionType);
        return res
          .status(200)
          .json({ message: "Section removed from hidden list" });
      } catch (error: unknown) {
        console.error(
          "Error removing hidden section:",
          error instanceof Error ? error.message : "Unknown error"
        );
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );
}
