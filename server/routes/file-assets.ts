import {
  assetCategoryAssignments,
  assetTags,
  assets,
  assetTagAssignments,
  insertAssetSchema,
  insertAssetTagSchema,
  UserRole,
} from "@shared/schema";

type Asset = typeof assets.$inferSelect;

import { and, eq, inArray, isNull, or, ilike, SQL } from "drizzle-orm";
import type { Express, Response } from "express";
import { db } from "../db";
import { upload, virusScan } from "../middlewares/upload";
import { validateClientId } from "../middlewares/vaildateClientId";
import type { RequestWithClientId } from "../routes";
import {
  downloadFile,
  generateStoragePath,
  generateUniqueFileName,
  uploadFile,
  validateFileSize,
  validateMimeType,
} from "../storage/index";

// Helper to check user permissions
const checkAssetPermission = async (
  userId: number,
  assetId: number,
  clientId: number,
  requiredPermission: "read" | "write" | "delete"
): Promise<{ allowed: boolean; asset?: Asset }> => {
  // Get the asset
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), isNull(assets.deletedAt)));

  if (!asset) {
    return { allowed: false };
  }

  // Verify asset belongs to the client
  if (asset.clientId !== clientId) {
    return { allowed: false };
  }

  // Get user to check role
  const [user] = await db
    .select()
    .from((await import("@shared/schema")).users)
    .where(eq((await import("@shared/schema")).users.id, userId));

  if (!user) {
    return { allowed: false };
  }

  // Permission logic based on role and asset visibility
  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isAdmin = user.role === UserRole.ADMIN;
  const isEditor = user.role === UserRole.EDITOR;
  const isOwner = asset.uploadedBy === userId;

  switch (requiredPermission) {
    case "read":
      // Guest can view shared assets only
      if (user.role === UserRole.GUEST) {
        return { allowed: asset.visibility === "shared", asset };
      }
      // All other roles can view if asset is shared or they own it
      return {
        allowed:
          asset.visibility === "shared" || isOwner || isAdmin || isSuperAdmin,
        asset,
      };

    case "write":
      // Guest cannot edit
      if (user.role === UserRole.GUEST) {
        return { allowed: false };
      }
      // Owner, editor, admin, and super admin can edit
      return {
        allowed: isOwner || isEditor || isAdmin || isSuperAdmin,
        asset,
      };

    case "delete":
      // Only owner, admin, or super admin can delete
      return { allowed: isOwner || isAdmin || isSuperAdmin, asset };

    default:
      return { allowed: false };
  }
};

export function registerFileAssetRoutes(app: Express) {
  // Global list endpoint for file assets
  app.get("/api/assets", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user's clients to determine which assets they can see
      const userClients = await db
        .select()
        .from((await import("@shared/schema")).userClients)
        .where(eq((await import("@shared/schema")).userClients.userId, req.session.userId));

      if (userClients.length === 0) {
        return res.json([]);
      }

      const clientIds = userClients.map(uc => uc.clientId);

      // Get user role for visibility filtering
      const [user] = await db
        .select()
        .from((await import("@shared/schema")).users)
        .where(eq((await import("@shared/schema")).users.id, req.session.userId));

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Parse query parameters
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string, 10)
        : undefined;
      const tagIds = req.query.tagIds
        ? (req.query.tagIds as string).split(',').map(id => parseInt(id, 10))
        : undefined;
      const visibility = req.query.visibility as "private" | "shared" | undefined;

      // Build base conditions
      const conditions: SQL[] = [
        isNull(assets.deletedAt),
        inArray(assets.clientId, clientIds)
      ];

      // Guest users can only see shared assets
      if (user.role === UserRole.GUEST) {
        conditions.push(eq(assets.visibility, "shared"));
      } else if (visibility) {
        conditions.push(eq(assets.visibility, visibility));
      }

      // Add search filter (searches in fileName and originalFileName)
      if (search) {
        conditions.push(
          or(
            ilike(assets.fileName, `%${search}%`),
            ilike(assets.originalFileName, `%${search}%`)
          )!
        );
      }

      let assetList: Asset[];

      // Filter by category if specified
      if (categoryId) {
        const rows = await db
          .select({ asset: assets })
          .from(assets)
          .innerJoin(
            assetCategoryAssignments,
            eq(assets.id, assetCategoryAssignments.assetId)
          )
          .where(
            and(
              ...conditions,
              eq(assetCategoryAssignments.categoryId, categoryId)
            )
          );
        assetList = rows.map((r) => r.asset);
      }
      // Filter by tags if specified (assets must have ALL specified tags)
      else if (tagIds && tagIds.length > 0) {
        // Get assets that have all the specified tags
        const assetIdCounts = await db
          .select({
            assetId: assetTagAssignments.assetId,
          })
          .from(assetTagAssignments)
          .where(inArray(assetTagAssignments.tagId, tagIds))
          .groupBy(assetTagAssignments.assetId);

        // Filter to only assets with all tags
        const matchingAssetIds = assetIdCounts
          .filter((row: any) => {
            // Count how many of the specified tags this asset has
            return true; // We'll refine this in the next query
          })
          .map((row: any) => row.assetId);

        if (matchingAssetIds.length === 0) {
          return res.json([]);
        }

        // Now get the full asset records
        conditions.push(inArray(assets.id, matchingAssetIds));
        assetList = await db
          .select()
          .from(assets)
          .where(and(...conditions));

        // Filter to only assets that have ALL specified tags
        const assetsWithAllTags = await Promise.all(
          assetList.map(async (asset) => {
            const assetTagIds = await db
              .select({ tagId: assetTagAssignments.tagId })
              .from(assetTagAssignments)
              .where(eq(assetTagAssignments.assetId, asset.id));

            const assetTagIdSet = new Set(assetTagIds.map(t => t.tagId));
            const hasAllTags = tagIds.every(tagId => assetTagIdSet.has(tagId));

            return hasAllTags ? asset : null;
          })
        );

        assetList = assetsWithAllTags.filter((a): a is Asset => a !== null);
      } else {
        // No special filtering, just base conditions
        assetList = await db
          .select()
          .from(assets)
          .where(and(...conditions));
      }

      // Sort by creation date (newest first)
      const sortedAssets = assetList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json(sortedAssets);
    } catch (error: unknown) {
      console.error(
        "Error fetching assets:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching assets" });
    }
  });

  // Global get single asset endpoint
  app.get("/api/assets/:assetId", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const assetId = parseInt(req.params.assetId, 10);

      // Get user's clients to determine access
      const userClients = await db
        .select()
        .from((await import("@shared/schema")).userClients)
        .where(eq((await import("@shared/schema")).userClients.userId, req.session.userId));

      if (userClients.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClients.map(uc => uc.clientId);

      // Get the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(and(
          eq(assets.id, assetId),
          isNull(assets.deletedAt),
          inArray(assets.clientId, clientIds)
        ));

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Check if user has read permission
      const permission = await checkAssetPermission(
        req.session.userId,
        assetId,
        asset.clientId,
        "read"
      );

      if (!permission.allowed) {
        return res.status(403).json({ message: "Not authorized to view this asset" });
      }

      res.json(asset);
    } catch (error: unknown) {
      console.error(
        "Error fetching asset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching asset" });
    }
  });

  // Global download endpoint
  app.get("/api/assets/:assetId/download", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const assetId = parseInt(req.params.assetId, 10);

      // Get user's clients to determine access
      const userClients = await db
        .select()
        .from((await import("@shared/schema")).userClients)
        .where(eq((await import("@shared/schema")).userClients.userId, req.session.userId));

      if (userClients.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClients.map(uc => uc.clientId);

      // Get the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(and(
          eq(assets.id, assetId),
          isNull(assets.deletedAt),
          inArray(assets.clientId, clientIds)
        ));

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Check if user has read permission
      const permission = await checkAssetPermission(
        req.session.userId,
        assetId,
        asset.clientId,
        "read"
      );

      if (!permission.allowed || !permission.asset) {
        return res.status(403).json({ message: "Not authorized to download this asset" });
      }

      // Download file from storage
      const downloadResult = await downloadFile(permission.asset.storagePath);

      if (!downloadResult.success || !downloadResult.data) {
        return res
          .status(404)
          .json({ message: downloadResult.error || "File not found" });
      }

      // Set headers for file download
      res.setHeader("Content-Type", permission.asset.fileType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${permission.asset.originalFileName}"`
      );
      res.setHeader("Content-Length", downloadResult.data.length);

      res.send(downloadResult.data);
    } catch (error: unknown) {
      console.error(
        "Error downloading asset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error downloading asset" });
    }
  });

  // Global update endpoint
  app.patch("/api/assets/:assetId", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const assetId = parseInt(req.params.assetId, 10);

      // Get user's clients to determine access
      const userClients = await db
        .select()
        .from((await import("@shared/schema")).userClients)
        .where(eq((await import("@shared/schema")).userClients.userId, req.session.userId));

      if (userClients.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClients.map(uc => uc.clientId);

      // Get the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(and(
          eq(assets.id, assetId),
          isNull(assets.deletedAt),
          inArray(assets.clientId, clientIds)
        ));

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Check if user has write permission
      const permission = await checkAssetPermission(
        req.session.userId,
        assetId,
        asset.clientId,
        "write"
      );

      if (!permission.allowed) {
        return res.status(403).json({ message: "Not authorized to update this asset" });
      }

      const { visibility, categories, tags } = req.body;

      // Update asset metadata
      const updates: Partial<Asset> = {};
      if (visibility) {
        updates.visibility = visibility;
      }
      updates.updatedAt = new Date();

      if (Object.keys(updates).length > 0) {
        await db.update(assets).set(updates).where(eq(assets.id, assetId));
      }

      // Update category assignments if provided
      if (categories !== undefined) {
        const categoryIds = categories.map((c: { id: number }) => c.id);

        // Remove existing categories
        await db
          .delete(assetCategoryAssignments)
          .where(eq(assetCategoryAssignments.assetId, assetId));

        // Add new categories
        if (categoryIds.length > 0) {
          await db.insert(assetCategoryAssignments).values(
            categoryIds.map((categoryId: number) => ({
              assetId,
              categoryId,
            }))
          );
        }
      }

      // Update tag assignments if provided
      if (tags !== undefined) {
        const tagIds = tags.map((t: { id: number }) => t.id);

        // Remove existing tags
        await db
          .delete(assetTagAssignments)
          .where(eq(assetTagAssignments.assetId, assetId));

        // Add new tags
        if (tagIds.length > 0) {
          await db.insert(assetTagAssignments).values(
            tagIds.map((tagId: number) => ({
              assetId,
              tagId,
            }))
          );
        }
      }

      // Fetch updated asset
      const [updatedAsset] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, assetId));

      res.json(updatedAsset);
    } catch (error: unknown) {
      console.error(
        "Error updating asset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error updating asset" });
    }
  });

  // Global delete endpoint
  app.delete("/api/assets/:assetId", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const assetId = parseInt(req.params.assetId, 10);

      // Get user's clients to determine access
      const userClients = await db
        .select()
        .from((await import("@shared/schema")).userClients)
        .where(eq((await import("@shared/schema")).userClients.userId, req.session.userId));

      if (userClients.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClients.map(uc => uc.clientId);

      // Get the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(and(
          eq(assets.id, assetId),
          isNull(assets.deletedAt),
          inArray(assets.clientId, clientIds)
        ));

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Check if user has delete permission
      const permission = await checkAssetPermission(
        req.session.userId,
        assetId,
        asset.clientId,
        "delete"
      );

      if (!permission.allowed) {
        return res.status(403).json({ message: "Not authorized to delete this asset" });
      }

      // Soft delete the asset
      await db
        .update(assets)
        .set({ deletedAt: new Date() })
        .where(eq(assets.id, assetId));

      res.json({ message: "Asset deleted successfully" });
    } catch (error: unknown) {
      console.error(
        "Error deleting asset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error deleting asset" });
    }
  });

  // Global upload endpoint (infers clientId from session/user context)
  app.post(
    "/api/assets/upload",
    upload.single("file"),
    virusScan,
    async (req, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        // Get user's first client (for now - could be enhanced to require clientId in body)
        const userClients = await db
          .select()
          .from((await import("@shared/schema")).userClients)
          .where(eq((await import("@shared/schema")).userClients.userId, req.session.userId));

        if (userClients.length === 0) {
          return res.status(400).json({ message: "No client associated with user" });
        }

        const clientId = userClients[0].clientId;

        const file = req.file;
        if (!file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Validate file size
        if (!validateFileSize(file.size)) {
          return res.status(400).json({
            message: "File size exceeds maximum allowed (500MB)",
          });
        }

        // Validate MIME type
        if (!validateMimeType(file.mimetype)) {
          return res.status(400).json({
            message: "File type not allowed",
          });
        }

        // Generate unique filename and storage path
        const uniqueFileName = generateUniqueFileName(file.originalname);
        const storagePath = generateStoragePath(clientId, uniqueFileName);

        // Upload file to storage
        const uploadResult = await uploadFile(storagePath, file.buffer);

        if (!uploadResult.success) {
          return res
            .status(500)
            .json({ message: uploadResult.error || "File upload failed" });
        }

        // Get visibility and category/tag data from request
        const visibility =
          (req.body.visibility as "private" | "shared") || "shared";
        const categoryIds: number[] = req.body.categoryIds
          ? JSON.parse(req.body.categoryIds)
          : [];
        const tagNames: string[] = req.body.tags
          ? JSON.parse(req.body.tags)
          : [];

        // Create asset record
        const assetData = {
          clientId,
          uploadedBy: req.session.userId,
          fileName: uniqueFileName,
          originalFileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          storagePath,
          visibility,
        };

        const validated = insertAssetSchema.parse(assetData);
        const [asset] = await db.insert(assets).values(validated).returning();

        // Assign categories
        if (categoryIds.length > 0) {
          await db.insert(assetCategoryAssignments).values(
            categoryIds.map((categoryId) => ({
              assetId: asset.id,
              categoryId,
            }))
          );
        }

        // Process tags - create new ones if needed
        if (tagNames.length > 0) {
          const tagIds: number[] = [];

          for (const tagName of tagNames) {
            const slug = tagName.toLowerCase().replace(/\s+/g, '-');

            // Check if tag already exists for this client
            const [existingTag] = await db
              .select()
              .from(assetTags)
              .where(
                and(
                  eq(assetTags.clientId, clientId),
                  eq(assetTags.slug, slug)
                )
              );

            if (existingTag) {
              tagIds.push(existingTag.id);
            } else {
              // Create new tag
              const tagData = insertAssetTagSchema.parse({
                name: tagName,
                slug,
                clientId,
              });
              const [newTag] = await db
                .insert(assetTags)
                .values(tagData)
                .returning();
              tagIds.push(newTag.id);
            }
          }

          // Assign tags to asset
          if (tagIds.length > 0) {
            await db.insert(assetTagAssignments).values(
              tagIds.map((tagId) => ({
                assetId: asset.id,
                tagId,
              }))
            );
          }
        }

        res.status(201).json(asset);
      } catch (error: unknown) {
        console.error(
          "Error uploading asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error uploading asset" });
      }
    }
  );

  // Upload asset (client-scoped)
  app.post(
    "/api/clients/:clientId/file-assets/upload",
    validateClientId,
    upload.single("file"),
    virusScan,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const file = req.file;
        if (!file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Validate file size
        if (!validateFileSize(file.size)) {
          return res.status(400).json({
            message: "File size exceeds maximum allowed (500MB)",
          });
        }

        // Validate MIME type
        if (!validateMimeType(file.mimetype)) {
          return res.status(400).json({
            message: "File type not allowed",
          });
        }

        // Generate unique filename and storage path
        const uniqueFileName = generateUniqueFileName(file.originalname);
        const storagePath = generateStoragePath(clientId, uniqueFileName);

        // Upload file to storage
        const uploadResult = await uploadFile(storagePath, file.buffer);

        if (!uploadResult.success) {
          return res
            .status(500)
            .json({ message: uploadResult.error || "File upload failed" });
        }

        // Get visibility and category/tag data from request
        const visibility =
          (req.body.visibility as "private" | "shared") || "shared";
        const categoryIds: number[] = req.body.categoryIds
          ? JSON.parse(req.body.categoryIds)
          : [];
        const tagNames: string[] = req.body.tags
          ? JSON.parse(req.body.tags)
          : [];

        // Create asset record
        const assetData = {
          clientId,
          uploadedBy: req.session.userId,
          fileName: uniqueFileName,
          originalFileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          storagePath,
          visibility,
        };

        const validated = insertAssetSchema.parse(assetData);
        const [asset] = await db.insert(assets).values(validated).returning();

        // Assign categories
        if (categoryIds.length > 0) {
          await db.insert(assetCategoryAssignments).values(
            categoryIds.map((categoryId) => ({
              assetId: asset.id,
              categoryId,
            }))
          );
        }

        // Process tags - create new ones if needed
        if (tagNames.length > 0) {
          const tagIds: number[] = [];

          for (const tagName of tagNames) {
            const slug = tagName.toLowerCase().replace(/\s+/g, '-');

            // Check if tag already exists for this client
            const [existingTag] = await db
              .select()
              .from(assetTags)
              .where(
                and(
                  eq(assetTags.clientId, clientId),
                  eq(assetTags.slug, slug)
                )
              );

            if (existingTag) {
              tagIds.push(existingTag.id);
            } else {
              // Create new tag
              const tagData = insertAssetTagSchema.parse({
                name: tagName,
                slug,
                clientId,
              });
              const [newTag] = await db
                .insert(assetTags)
                .values(tagData)
                .returning();
              tagIds.push(newTag.id);
            }
          }

          // Assign tags to asset
          if (tagIds.length > 0) {
            await db.insert(assetTagAssignments).values(
              tagIds.map((tagId) => ({
                assetId: asset.id,
                tagId,
              }))
            );
          }
        }

        res.status(201).json(asset);
      } catch (error: unknown) {
        console.error(
          "Error uploading asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error uploading asset" });
      }
    }
  );

  // List assets for a client
  app.get(
    "/api/clients/:clientId/file-assets",
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

        // Parse query parameters
        const limit = parseInt(req.query.limit as string, 10) || 50;
        const offset = parseInt(req.query.offset as string, 10) || 0;
        const categoryId = req.query.categoryId
          ? parseInt(req.query.categoryId as string, 10)
          : undefined;
        const tagId = req.query.tagId
          ? parseInt(req.query.tagId as string, 10)
          : undefined;
        const visibility = req.query.visibility as
          | "private"
          | "shared"
          | undefined;

        // Get user role to determine what they can see
        const [user] = await db
          .select()
          .from((await import("@shared/schema")).users)
          .where(
            eq((await import("@shared/schema")).users.id, req.session.userId)
          );

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Build query conditions
        const conditions = [
          eq(assets.clientId, clientId),
          isNull(assets.deletedAt),
        ];

        // Guest users can only see shared assets
        if (user.role === UserRole.GUEST) {
          conditions.push(eq(assets.visibility, "shared"));
        } else if (visibility) {
          conditions.push(eq(assets.visibility, visibility));
        }

        let assetList: Asset[];

        // Filter by category if specified
        if (categoryId) {
          const rows = await db
            .select({ asset: assets })
            .from(assets)
            .innerJoin(
              assetCategoryAssignments,
              eq(assets.id, assetCategoryAssignments.assetId)
            )
            .where(
              and(
                ...conditions,
                eq(assetCategoryAssignments.categoryId, categoryId)
              )
            );
          assetList = rows.map((r) => r.asset);
        }
        // Filter by tag if specified
        else if (tagId) {
          const rows = await db
            .select({ asset: assets })
            .from(assets)
            .innerJoin(
              assetTagAssignments,
              eq(assets.id, assetTagAssignments.assetId)
            )
            .where(and(...conditions, eq(assetTagAssignments.tagId, tagId)));
          assetList = rows.map((r) => r.asset);
        } else {
          assetList = await db
            .select()
            .from(assets)
            .where(and(...conditions));
        }

        // Apply pagination and sorting
        const sortedAssets = assetList.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const paginatedAssets = sortedAssets.slice(offset, offset + limit);

        res.json({
          assets: paginatedAssets,
          total: assetList.length,
          limit,
          offset,
        });
      } catch (error: unknown) {
        console.error(
          "Error fetching assets:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching assets" });
      }
    }
  );

  // Get single asset
  app.get(
    "/api/clients/:clientId/file-assets/:assetId",
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

        const assetId = parseInt(req.params.assetId, 10);
        const permission = await checkAssetPermission(
          req.session.userId,
          assetId,
          clientId,
          "read"
        );

        if (!permission.allowed || !permission.asset) {
          return res
            .status(403)
            .json({ message: "Not authorized to view this asset" });
        }

        res.json(permission.asset);
      } catch (error: unknown) {
        console.error(
          "Error fetching asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching asset" });
      }
    }
  );

  // Download asset
  app.get(
    "/api/clients/:clientId/file-assets/:assetId/download",
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

        const assetId = parseInt(req.params.assetId, 10);
        const permission = await checkAssetPermission(
          req.session.userId,
          assetId,
          clientId,
          "read"
        );

        if (!permission.allowed || !permission.asset) {
          return res
            .status(403)
            .json({ message: "Not authorized to download this asset" });
        }

        const asset = permission.asset;

        // Download file from storage
        const downloadResult = await downloadFile(asset.storagePath);

        if (!downloadResult.success || !downloadResult.data) {
          return res
            .status(404)
            .json({ message: downloadResult.error || "File not found" });
        }

        // Set headers for file download
        res.setHeader("Content-Type", asset.fileType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${asset.originalFileName}"`
        );
        res.setHeader("Content-Length", downloadResult.data.length);

        res.send(downloadResult.data);
      } catch (error: unknown) {
        console.error(
          "Error downloading asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error downloading asset" });
      }
    }
  );

  // Update asset metadata
  app.patch(
    "/api/clients/:clientId/file-assets/:assetId",
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

        const assetId = parseInt(req.params.assetId, 10);
        const permission = await checkAssetPermission(
          req.session.userId,
          assetId,
          clientId,
          "write"
        );

        if (!permission.allowed || !permission.asset) {
          return res
            .status(403)
            .json({ message: "Not authorized to update this asset" });
        }

        const { visibility, categoryIds, tagIds } = req.body;

        // Update asset metadata
        const updates: Partial<Asset> = {};
        if (visibility) {
          updates.visibility = visibility;
        }
        updates.updatedAt = new Date();

        if (Object.keys(updates).length > 0) {
          await db.update(assets).set(updates).where(eq(assets.id, assetId));
        }

        // Update category assignments if provided
        if (categoryIds !== undefined) {
          // Remove existing categories
          await db
            .delete(assetCategoryAssignments)
            .where(eq(assetCategoryAssignments.assetId, assetId));

          // Add new categories
          if (categoryIds.length > 0) {
            await db.insert(assetCategoryAssignments).values(
              categoryIds.map((categoryId: number) => ({
                assetId,
                categoryId,
              }))
            );
          }
        }

        // Update tag assignments if provided
        if (tagIds !== undefined) {
          // Remove existing tags
          await db
            .delete(assetTagAssignments)
            .where(eq(assetTagAssignments.assetId, assetId));

          // Add new tags
          if (tagIds.length > 0) {
            await db.insert(assetTagAssignments).values(
              tagIds.map((tagId: number) => ({
                assetId,
                tagId,
              }))
            );
          }
        }

        // Fetch updated asset
        const [updatedAsset] = await db
          .select()
          .from(assets)
          .where(eq(assets.id, assetId));

        res.json(updatedAsset);
      } catch (error: unknown) {
        console.error(
          "Error updating asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error updating asset" });
      }
    }
  );

  // Delete asset (soft delete)
  app.delete(
    "/api/clients/:clientId/file-assets/:assetId",
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

        const assetId = parseInt(req.params.assetId, 10);
        const permission = await checkAssetPermission(
          req.session.userId,
          assetId,
          clientId,
          "delete"
        );

        if (!permission.allowed || !permission.asset) {
          return res
            .status(403)
            .json({ message: "Not authorized to delete this asset" });
        }

        // Soft delete the asset
        await db
          .update(assets)
          .set({ deletedAt: new Date() })
          .where(eq(assets.id, assetId));

        // Note: We don't delete the physical file immediately
        // This allows for potential recovery. A cleanup job can be implemented later.

        res.json({ message: "Asset deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting asset" });
      }
    }
  );
}
