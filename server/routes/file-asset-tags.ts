import { assetTags, insertAssetTagSchema, UserRole } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import type { Express, Response } from "express";
import { db } from "../db";
import { validateClientId } from "../middlewares/vaildateClientId";
import type { RequestWithClientId } from "../routes";

// Helper to check if user can delete tag
const checkTagDeletePermission = async (
  userId: number,
  tagId: number
): Promise<{ allowed: boolean; tag?: typeof assetTags.$inferSelect }> => {
  const [tag] = await db
    .select()
    .from(assetTags)
    .where(eq(assetTags.id, tagId));

  if (!tag) {
    return { allowed: false };
  }

  const [user] = await db
    .select()
    .from((await import("@shared/schema")).users)
    .where(eq((await import("@shared/schema")).users.id, userId));

  if (!user) {
    return { allowed: false };
  }

  // Admin and super admin can delete any tag
  // Creator can delete their own tag
  const isAdmin =
    user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;

  return { allowed: isAdmin, tag };
};

export function registerFileAssetTagRoutes(app: Express) {
  // Get all tags (global endpoint for frontend queries - returns tags from all user's clients)
  app.get("/api/asset-tags", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user's clients to determine which tags they can see
      const userClients = await db
        .select()
        .from((await import("@shared/schema")).userClients)
        .where(eq((await import("@shared/schema")).userClients.userId, req.session.userId));

      if (userClients.length === 0) {
        return res.json([]);
      }

      // Get tags for all user's clients
      const clientIds = userClients.map(uc => uc.clientId);
      const tags = await db
        .select()
        .from(assetTags)
        .where(inArray(assetTags.clientId, clientIds));

      res.json(tags);
    } catch (error: unknown) {
      console.error(
        "Error fetching asset tags:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching asset tags" });
    }
  });

  // Create a new tag (global endpoint - infers clientId from user's first client)
  app.post("/api/asset-tags", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user's first client (could be enhanced to require clientId in body)
      const userClients = await db
        .select()
        .from((await import("@shared/schema")).userClients)
        .where(eq((await import("@shared/schema")).userClients.userId, req.session.userId));

      if (userClients.length === 0) {
        return res.status(400).json({ message: "No client associated with user" });
      }

      const clientId = userClients[0].clientId;
      const { name, slug } = req.body;

      const tagData = {
        name,
        slug,
        clientId,
      };

      const validated = insertAssetTagSchema.parse(tagData);
      const [tag] = await db.insert(assetTags).values(validated).returning();

      res.status(201).json(tag);
    } catch (error: unknown) {
      console.error(
        "Error creating asset tag:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error creating asset tag" });
    }
  });

  // Get all tags for a client
  app.get(
    "/api/clients/:clientId/file-asset-tags",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const tags = await db
          .select()
          .from(assetTags)
          .where(eq(assetTags.clientId, clientId));

        res.json(tags);
      } catch (error: unknown) {
        console.error(
          "Error fetching asset tags:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching asset tags" });
      }
    }
  );

  // Create a new tag
  app.post(
    "/api/clients/:clientId/file-asset-tags",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const { name, slug } = req.body;

        const tagData = {
          name,
          slug,
          clientId,
        };

        const validated = insertAssetTagSchema.parse(tagData);
        const [tag] = await db.insert(assetTags).values(validated).returning();

        res.status(201).json(tag);
      } catch (error: unknown) {
        console.error(
          "Error creating asset tag:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error creating asset tag" });
      }
    }
  );

  // Delete a tag (creator or admin only)
  app.delete(
    "/api/clients/:clientId/file-asset-tags/:tagId",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const tagId = parseInt(req.params.tagId, 10);

        const permission = await checkTagDeletePermission(
          req.session.userId,
          tagId
        );

        if (!permission.allowed || !permission.tag) {
          return res
            .status(403)
            .json({ message: "Not authorized to delete this tag" });
        }

        // Verify tag belongs to client
        if (permission.tag.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Tag does not belong to this client" });
        }

        // Delete the tag (this will cascade delete tag assignments)
        await db.delete(assetTags).where(eq(assetTags.id, tagId));

        res.json({ message: "Tag deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting asset tag:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting asset tag" });
      }
    }
  );
}
