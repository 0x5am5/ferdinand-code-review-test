import {
  assetCategories,
  insertAssetCategorySchema,
  UserRole,
} from "@shared/schema";
import { eq, isNull, or } from "drizzle-orm";
import type { Express, Response } from "express";
import { db } from "../db";
import { validateClientId } from "../middlewares/vaildateClientId";
import type { RequestWithClientId } from "../routes";

// Helper to check if user is admin
const checkAdminPermission = async (userId: number): Promise<boolean> => {
  const [user] = await db
    .select()
    .from((await import("@shared/schema")).users)
    .where(eq((await import("@shared/schema")).users.id, userId));

  if (!user) {
    return false;
  }

  return user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;
};

export function registerFileAssetCategoryRoutes(app: Express) {
  // Get all categories (global endpoint for frontend queries)
  app.get("/api/asset-categories", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get all system default categories (clientId is null)
      const categories = await db
        .select()
        .from(assetCategories)
        .where(isNull(assetCategories.clientId));

      res.json(categories);
    } catch (error: unknown) {
      console.error(
        "Error fetching asset categories:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching asset categories" });
    }
  });

  // Get all categories (system defaults + client-specific)
  app.get(
    "/api/clients/:clientId/file-asset-categories",
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

        // Get system defaults (clientId is null) and client-specific categories
        const categories = await db
          .select()
          .from(assetCategories)
          .where(
            or(
              isNull(assetCategories.clientId),
              eq(assetCategories.clientId, clientId)
            )
          );

        res.json(categories);
      } catch (error: unknown) {
        console.error(
          "Error fetching asset categories:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching asset categories" });
      }
    }
  );

  // Create a new category (admin only)
  app.post(
    "/api/clients/:clientId/file-asset-categories",
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

        // Check if user is admin
        const isAdmin = await checkAdminPermission(req.session.userId);
        if (!isAdmin) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { name, slug, isDefault } = req.body;

        const categoryData = {
          name,
          slug,
          isDefault: isDefault || false,
          clientId: isDefault ? undefined : clientId, // System defaults have no clientId
        };

        const validated = insertAssetCategorySchema.parse(categoryData);
        const [category] = await db
          .insert(assetCategories)
          .values(validated)
          .returning();

        res.status(201).json(category);
      } catch (error: unknown) {
        console.error(
          "Error creating asset category:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error creating asset category" });
      }
    }
  );

  // Update a category (admin only)
  app.patch(
    "/api/clients/:clientId/file-asset-categories/:categoryId",
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

        // Check if user is admin
        const isAdmin = await checkAdminPermission(req.session.userId);
        if (!isAdmin) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const categoryId = parseInt(req.params.categoryId, 10);
        const { name, slug } = req.body;

        // Get existing category
        const [existingCategory] = await db
          .select()
          .from(assetCategories)
          .where(eq(assetCategories.id, categoryId));

        if (!existingCategory) {
          return res.status(404).json({ message: "Category not found" });
        }

        // Don't allow editing system defaults
        if (existingCategory.isDefault) {
          return res
            .status(403)
            .json({ message: "Cannot edit system default categories" });
        }

        // Verify category belongs to client
        if (existingCategory.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Category does not belong to this client" });
        }

        const updates: Partial<typeof existingCategory> = {};
        if (name) updates.name = name;
        if (slug) updates.slug = slug;

        await db
          .update(assetCategories)
          .set(updates)
          .where(eq(assetCategories.id, categoryId));

        const [updatedCategory] = await db
          .select()
          .from(assetCategories)
          .where(eq(assetCategories.id, categoryId));

        res.json(updatedCategory);
      } catch (error: unknown) {
        console.error(
          "Error updating asset category:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error updating asset category" });
      }
    }
  );

  // Delete a category (admin only)
  app.delete(
    "/api/clients/:clientId/file-asset-categories/:categoryId",
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

        // Check if user is admin
        const isAdmin = await checkAdminPermission(req.session.userId);
        if (!isAdmin) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const categoryId = parseInt(req.params.categoryId, 10);

        // Get existing category
        const [existingCategory] = await db
          .select()
          .from(assetCategories)
          .where(eq(assetCategories.id, categoryId));

        if (!existingCategory) {
          return res.status(404).json({ message: "Category not found" });
        }

        // Don't allow deleting system defaults
        if (existingCategory.isDefault) {
          return res
            .status(403)
            .json({ message: "Cannot delete system default categories" });
        }

        // Verify category belongs to client
        if (existingCategory.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Category does not belong to this client" });
        }

        // Delete the category (this will cascade delete category assignments)
        await db
          .delete(assetCategories)
          .where(eq(assetCategories.id, categoryId));

        res.json({ message: "Category deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting asset category:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting asset category" });
      }
    }
  );
}
