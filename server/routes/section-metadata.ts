import { sectionMetadata } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireMinimumRole } from "../middlewares/requireMinimumRole";
import { db } from "../db";

export function registerSectionMetadataRoutes(app: Express) {
  // List section metadata for a client
  app.get(
    "/api/clients/:clientId/section-metadata",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const clientId = parseInt(req.params.clientId, 10);

        if (isNaN(clientId)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        const metadata = await db
          .select()
          .from(sectionMetadata)
          .where(eq(sectionMetadata.clientId, clientId));

        return res.json(metadata);
      } catch (error) {
        console.error("Error fetching section metadata:", error);
        return res.status(500).json({ message: "Failed to fetch section metadata" });
      }
    }
  );

  // Update section metadata
  app.put(
    "/api/clients/:clientId/section-metadata/:sectionType",
    requireAuth,
    requireMinimumRole("editor"),
    async (req: Request, res: Response) => {
      try {
        const clientId = parseInt(req.params.clientId, 10);
        const { sectionType } = req.params;
        const { description } = req.body;

        if (isNaN(clientId)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        if (!sectionType) {
          return res.status(400).json({ message: "Section type is required" });
        }

        // Check if metadata already exists
        const existing = await db
          .select()
          .from(sectionMetadata)
          .where(
            and(
              eq(sectionMetadata.clientId, clientId),
              eq(sectionMetadata.sectionType, sectionType)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db
            .update(sectionMetadata)
            .set({ description })
            .where(
              and(
                eq(sectionMetadata.clientId, clientId),
                eq(sectionMetadata.sectionType, sectionType)
              )
            );
        } else {
          // Insert new
          await db.insert(sectionMetadata).values({
            clientId,
            sectionType,
            description,
          });
        }

        return res.json({ success: true });
      } catch (error) {
        console.error("Error updating section metadata:", error);
        return res.status(500).json({ message: "Failed to update section metadata" });
      }
    }
  );
}
