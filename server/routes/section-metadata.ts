import { sectionMetadata, UserRole, userClients, users } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { db } from "../db";
import { requireAuth } from "../middlewares/auth";
import { requireMinimumRole } from "../middlewares/requireMinimumRole";

export function registerSectionMetadataRoutes(app: Express) {
  // List section metadata for a client
  app.get(
    "/api/clients/:clientId/section-metadata",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const clientId = parseInt(req.params.clientId, 10);

        if (Number.isNaN(clientId)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        // Authorization check: verify user has access to this client
        if (!req.session?.userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.session.userId));

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Super admins have access to all clients
        if (user.role !== UserRole.SUPER_ADMIN) {
          // Check if user has access to this client
          const [userClient] = await db
            .select()
            .from(userClients)
            .where(
              and(
                eq(userClients.userId, req.session.userId),
                eq(userClients.clientId, clientId)
              )
            );

          if (!userClient) {
            return res.status(403).json({
              message: "You do not have access to this client",
            });
          }
        }

        const metadata = await db
          .select()
          .from(sectionMetadata)
          .where(eq(sectionMetadata.clientId, clientId));

        return res.json(metadata);
      } catch (error) {
        console.error("Error fetching section metadata:", error);
        return res
          .status(500)
          .json({ message: "Failed to fetch section metadata" });
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

        if (Number.isNaN(clientId)) {
          return res.status(400).json({ message: "Invalid client ID" });
        }

        if (!sectionType) {
          return res.status(400).json({ message: "Section type is required" });
        }

        // Authorization check: verify user has access to this client
        if (!req.session?.userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.session.userId));

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Super admins have access to all clients
        if (user.role !== UserRole.SUPER_ADMIN) {
          // Check if user has access to this client
          const [userClient] = await db
            .select()
            .from(userClients)
            .where(
              and(
                eq(userClients.userId, req.session.userId),
                eq(userClients.clientId, clientId)
              )
            );

          if (!userClient) {
            return res.status(403).json({
              message: "You do not have access to this client",
            });
          }
        }

        // Validate description
        if (description === undefined || description === null) {
          return res.status(400).json({ message: "Description is required" });
        }

        if (typeof description !== "string") {
          return res
            .status(400)
            .json({ message: "Description must be a string" });
        }

        const trimmedDescription = description.trim();

        // Enforce length limits (e.g., 2000 characters)
        const MAX_DESCRIPTION_LENGTH = 2000;
        if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
          return res.status(400).json({
            message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
          });
        }

        // Atomic upsert using onConflictDoUpdate to avoid race conditions
        const [result] = await db
          .insert(sectionMetadata)
          .values({
            clientId,
            sectionType,
            description: trimmedDescription,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [sectionMetadata.clientId, sectionMetadata.sectionType],
            set: {
              description: trimmedDescription,
              updatedAt: new Date(),
            },
          })
          .returning();

        return res.json({ success: true, data: result });
      } catch (error) {
        console.error("Error updating section metadata:", error);
        return res
          .status(500)
          .json({ message: "Failed to update section metadata" });
      }
    }
  );
}
