import {
  assetCategories,
  assetCategoryAssignments,
  assetPublicLinks,
  assets,
  assetTagAssignments,
  assetTags,
  insertAssetSchema,
  insertAssetTagSchema,
  UserRole,
  userClients,
  users,
} from "@shared/schema";

type Asset = typeof assets.$inferSelect;

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import type { Express, Response } from "express";
import { db } from "../db";
import { uploadRateLimit } from "../middlewares/rate-limit";
import { csrfProtection } from "../middlewares/security-headers";
import { upload, virusScan } from "../middlewares/upload";
import { validateClientId } from "../middlewares/vaildateClientId";
import type { RequestWithClientId } from "../routes";
import { checkAssetPermission } from "../services/asset-permissions";
import {
  ensureDefaultCategories,
  getCategoriesForClient,
} from "../services/default-categories";
import {
  canGenerateThumbnail,
  deleteThumbnails,
  downloadThumbnail,
  getFileTypeIcon,
  getOrGenerateThumbnail,
} from "../services/thumbnail";
import {
  deleteFile,
  downloadFile,
  generateStoragePath,
  generateUniqueFileName,
  uploadFile,
  validateFileSize,
  validateMimeType,
} from "../storage/index";
import {
  autoSelectCategory,
  determineAssetCategory,
} from "../utils/asset-categorization";

export function registerFileAssetRoutes(app: Express) {
  // Global list endpoint for file assets
  app.get("/api/assets", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Get user's clients to determine which assets they can see
      const userClientRecords = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, req.session.userId));

      if (userClientRecords.length === 0) {
        return res.json([]);
      }

      const clientIds = userClientRecords.map((uc) => uc.clientId);

      // Get user role for visibility filtering
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId));

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Parse query parameters
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string, 10)
        : undefined;
      const tagIds = req.query.tagIds
        ? (req.query.tagIds as string).split(",").map((id) => parseInt(id, 10))
        : undefined;
      const visibility = req.query.visibility as
        | "private"
        | "shared"
        | undefined;

      // Build base conditions
      const conditions: SQL[] = [
        isNull(assets.deletedAt),
        inArray(assets.clientId, clientIds),
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
          .filter((_row: { assetId: number }) => {
            // Count how many of the specified tags this asset has
            return true; // We'll refine this in the next query
          })
          .map((row: { assetId: number }) => row.assetId);

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

            const assetTagIdSet = new Set(assetTagIds.map((t) => t.tagId));
            const hasAllTags = tagIds.every((tagId) =>
              assetTagIdSet.has(tagId)
            );

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

      // Fetch categories and tags for each asset
      const assetsWithDetails = await Promise.all(
        assetList.map(async (asset) => {
          // Get categories
          const categoryRows = await db
            .select({
              id: assetCategories.id,
              name: assetCategories.name,
              slug: assetCategories.slug,
              isDefault: assetCategories.isDefault,
              clientId: assetCategories.clientId,
            })
            .from(assetCategoryAssignments)
            .innerJoin(
              assetCategories,
              eq(assetCategoryAssignments.categoryId, assetCategories.id)
            )
            .where(eq(assetCategoryAssignments.assetId, asset.id));

          // Get tags
          const tagRows = await db
            .select({
              id: assetTags.id,
              name: assetTags.name,
              slug: assetTags.slug,
              clientId: assetTags.clientId,
            })
            .from(assetTagAssignments)
            .innerJoin(assetTags, eq(assetTagAssignments.tagId, assetTags.id))
            .where(eq(assetTagAssignments.assetId, asset.id));

          return {
            ...asset,
            categories: categoryRows,
            tags: tagRows,
          };
        })
      );

      // Apply search filter across all asset fields if search is provided
      let filteredAssets = assetsWithDetails;
      if (search) {
        const searchLower = search.toLowerCase().trim();
        filteredAssets = assetsWithDetails.filter((asset) => {
          // Create searchable text from all asset fields
          const searchableFields = [
            asset.fileName,
            asset.originalFileName,
            asset.fileType,
            // Format dates for natural language searching
            asset.createdAt
              ? new Date(asset.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "",
            asset.updatedAt
              ? new Date(asset.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "",
            // Add category names
            ...(asset.categories?.map((c) => c.name) || []),
            // Add tag names
            ...(asset.tags?.map((t) => t.name) || []),
          ];

          const searchableText = searchableFields.join(" ").toLowerCase();
          return searchableText.includes(searchLower);
        });
      }

      // Sort by creation date (newest first)
      const sortedAssets = filteredAssets.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      res.json(sortedAssets);
    } catch (error: unknown) {
      console.error(
        "Error fetching assets:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching assets" });
    }
  });

  // Dedicated search endpoint with ranking and grouped results
  app.get("/api/assets/search", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const search = req.query.q as string | undefined;
      if (!search || search.trim().length === 0) {
        return res.json({ results: [], total: 0 });
      }

      // Get user's clients to determine which assets they can see
      const userClientRecords = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, req.session.userId));

      if (userClientRecords.length === 0) {
        return res.json({ results: [], total: 0 });
      }

      const clientIds = userClientRecords.map((uc) => uc.clientId);

      // Get user role for visibility filtering
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId));

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Prepare search query for PostgreSQL full-text search
      const searchQuery = search.trim().replace(/\s+/g, " & ");

      // Build base conditions
      const conditions: SQL[] = [
        isNull(assets.deletedAt),
        inArray(assets.clientId, clientIds),
        sql`to_tsvector('english', ${assets.fileName} || ' ' || ${assets.originalFileName}) @@ to_tsquery('english', ${searchQuery})`,
      ];

      // Guest users can only see shared assets
      if (user.role === UserRole.GUEST) {
        conditions.push(eq(assets.visibility, "shared"));
      }

      // Query with relevance ranking
      const searchResults = await db
        .select({
          asset: assets,
          rank: sql<number>`ts_rank(to_tsvector('english', ${assets.fileName} || ' ' || ${assets.originalFileName}), to_tsquery('english', ${searchQuery}))`,
        })
        .from(assets)
        .where(and(...conditions))
        .orderBy(
          sql`ts_rank(to_tsvector('english', ${assets.fileName} || ' ' || ${assets.originalFileName}), to_tsquery('english', ${searchQuery})) DESC`
        );

      // Get category information for each asset
      const assetIds = searchResults.map((r) => r.asset.id);
      const categoryAssignments =
        assetIds.length > 0
          ? await db
              .select({
                assetId: assetCategoryAssignments.assetId,
                category: assetCategories,
              })
              .from(assetCategoryAssignments)
              .innerJoin(
                assetCategories,
                eq(assetCategoryAssignments.categoryId, assetCategories.id)
              )
              .where(inArray(assetCategoryAssignments.assetId, assetIds))
          : [];

      // Group results by category
      const categoryMap = new Map<string, typeof searchResults>();
      const uncategorized: typeof searchResults = [];

      for (const result of searchResults) {
        const assetCategories = categoryAssignments
          .filter((ca) => ca.assetId === result.asset.id)
          .map((ca) => ca.category);

        if (assetCategories.length === 0) {
          uncategorized.push(result);
        } else {
          for (const category of assetCategories) {
            const key = category.name;
            if (!categoryMap.has(key)) {
              categoryMap.set(key, []);
            }
            categoryMap.get(key)?.push(result);
          }
        }
      }

      // Format response
      const groupedResults = Array.from(categoryMap.entries()).map(
        ([categoryName, results]) => ({
          category: categoryName,
          assets: results.map((r) => ({ ...r.asset, relevance: r.rank })),
        })
      );

      if (uncategorized.length > 0) {
        groupedResults.push({
          category: "Uncategorized",
          assets: uncategorized.map((r) => ({ ...r.asset, relevance: r.rank })),
        });
      }

      res.json({
        results: groupedResults,
        total: searchResults.length,
        query: search,
      });
    } catch (error: unknown) {
      console.error(
        "Error searching assets:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error searching assets" });
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
      const userClientRecords = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, req.session.userId));

      if (userClientRecords.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClientRecords.map((uc) => uc.clientId);

      // Get the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.id, assetId),
            isNull(assets.deletedAt),
            inArray(assets.clientId, clientIds)
          )
        );

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
        return res
          .status(403)
          .json({ message: "Not authorized to view this asset" });
      }

      // Get categories
      const categoryRows = await db
        .select({
          id: assetCategories.id,
          name: assetCategories.name,
          slug: assetCategories.slug,
          isDefault: assetCategories.isDefault,
          clientId: assetCategories.clientId,
        })
        .from(assetCategoryAssignments)
        .innerJoin(
          assetCategories,
          eq(assetCategoryAssignments.categoryId, assetCategories.id)
        )
        .where(eq(assetCategoryAssignments.assetId, asset.id));

      // Get tags
      const tagRows = await db
        .select({
          id: assetTags.id,
          name: assetTags.name,
          slug: assetTags.slug,
          clientId: assetTags.clientId,
        })
        .from(assetTagAssignments)
        .innerJoin(assetTags, eq(assetTagAssignments.tagId, assetTags.id))
        .where(eq(assetTagAssignments.assetId, asset.id));

      res.json({
        ...asset,
        categories: categoryRows,
        tags: tagRows,
      });
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
      const userClientRecords = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, req.session.userId));

      if (userClientRecords.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClientRecords.map((uc) => uc.clientId);

      // Get the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.id, assetId),
            isNull(assets.deletedAt),
            inArray(assets.clientId, clientIds)
          )
        );

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
        return res
          .status(403)
          .json({ message: "Not authorized to download this asset" });
      }

      const downloadAsset = permission.asset;

      // Check if this is a reference-only asset (Google Workspace file)
      // CRITICAL: Do this check BEFORE attempting to download from storage
      if (downloadAsset.referenceOnly) {
        if (!downloadAsset.driveWebLink) {
          if (downloadAsset.driveFileId) {
            const webLink = `https://drive.google.com/file/d/${downloadAsset.driveFileId}/view`;
            try {
              await db
                .update(assets)
                .set({ driveWebLink: webLink, updatedAt: new Date() })
                .where(eq(assets.id, assetId));
              console.log(
                `Backfilled driveWebLink for asset ${assetId}: ${webLink}`
              );
            } catch (e) {
              console.warn(
                `Failed to backfill driveWebLink for asset ${assetId}:`,
                e
              );
            }
            return res.redirect(302, webLink);
          }
          return res.status(400).json({
            message: "Reference-only asset without valid Google Drive link",
          });
        }
        console.log(
          `Redirecting to Google Drive file: ${downloadAsset.driveWebLink}`
        );
        return res.redirect(302, downloadAsset.driveWebLink);
      }

      // Validate storagePath exists for regular assets
      if (!downloadAsset.storagePath) {
        console.error(
          `ERROR: Asset ${assetId} has empty storagePath and is not a reference asset`
        );
        return res.status(400).json({
          message: "Asset storage path not found",
        });
      }

      // Download file from storage for regular assets
      const downloadResult = await downloadFile(downloadAsset.storagePath);

      if (!downloadResult.success || !downloadResult.data) {
        return res
          .status(404)
          .json({ message: downloadResult.error || "File not found" });
      }

      const fileBuffer = downloadResult.data;

      // Set headers for file download
      res.setHeader("Content-Type", downloadAsset.fileType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${downloadAsset.originalFileName}"`
      );
      res.setHeader("Content-Length", fileBuffer.length);

      res.send(fileBuffer);
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
      const userClientRecords = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, req.session.userId));

      if (userClientRecords.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClientRecords.map((uc) => uc.clientId);

      // Get the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.id, assetId),
            isNull(assets.deletedAt),
            inArray(assets.clientId, clientIds)
          )
        );

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
        return res
          .status(403)
          .json({ message: "Not authorized to update this asset" });
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
      const userClientRecords = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, req.session.userId));

      if (userClientRecords.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClientRecords.map((uc) => uc.clientId);

      // Get the asset
      const [assetRecord] = await db
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.id, assetId),
            isNull(assets.deletedAt),
            inArray(assets.clientId, clientIds)
          )
        );

      if (!assetRecord) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Check if user has delete permission
      const permission = await checkAssetPermission(
        req.session.userId,
        assetId,
        assetRecord.clientId,
        "delete"
      );

      if (!permission.allowed || !permission.asset) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this asset" });
      }

      const asset = permission.asset ?? assetRecord;

      // Delete public links first
      await db
        .delete(assetPublicLinks)
        .where(eq(assetPublicLinks.assetId, assetId));

      // Soft delete the asset
      await db
        .update(assets)
        .set({ deletedAt: new Date() })
        .where(eq(assets.id, assetId));

      // Delete the actual file from storage
      if (asset.storagePath) {
        const deleteResult = await deleteFile(asset.storagePath);
        if (!deleteResult.success) {
          console.error(
            `Failed to delete file from storage: ${deleteResult.error}`
          );
        }
      }

      // Delete any thumbnails for this asset
      try {
        await deleteThumbnails(assetId);
      } catch (error) {
        console.error(
          `Failed to delete thumbnails for asset ${assetId}:`,
          error
        );
      }

      res.json({ message: "Asset deleted successfully" });
    } catch (error: unknown) {
      console.error(
        "Error deleting asset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error deleting asset" });
    }
  });

  // Bulk delete endpoint
  app.post("/api/assets/bulk-delete", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { assetIds } = req.body;

      if (!Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({ message: "Invalid asset IDs" });
      }

      // Get user's clients to determine access
      const userClientRecords = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, req.session.userId));

      if (userClientRecords.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClientRecords.map((uc) => uc.clientId);

      // Get all assets to be deleted
      const assetsToDelete = await db
        .select()
        .from(assets)
        .where(
          and(
            inArray(assets.id, assetIds),
            isNull(assets.deletedAt),
            inArray(assets.clientId, clientIds)
          )
        );

      if (assetsToDelete.length === 0) {
        return res.status(404).json({ message: "No assets found" });
      }

      // Check permissions for each asset
      const userId = req.session.userId;
      const permissionChecks = await Promise.all(
        assetsToDelete.map((asset) =>
          checkAssetPermission(userId, asset.id, asset.clientId, "delete")
        )
      );

      const unauthorizedAssets = permissionChecks.filter((p) => !p.allowed);
      if (unauthorizedAssets.length > 0) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete some assets" });
      }

      // Delete public links for all assets first
      await db
        .delete(assetPublicLinks)
        .where(inArray(assetPublicLinks.assetId, assetIds));

      // Soft delete all assets
      await db
        .update(assets)
        .set({ deletedAt: new Date() })
        .where(inArray(assets.id, assetIds));

      // Delete files and thumbnails
      await Promise.all(
        assetsToDelete.map(async (asset) => {
          // Delete the actual file from storage
          if (asset.storagePath) {
            const deleteResult = await deleteFile(asset.storagePath);
            if (!deleteResult.success) {
              console.error(
                `Failed to delete file from storage: ${deleteResult.error}`
              );
            }
          }

          // Delete thumbnails
          try {
            await deleteThumbnails(asset.id);
          } catch (error) {
            console.error(
              `Failed to delete thumbnails for asset ${asset.id}:`,
              error
            );
          }
        })
      );

      res.json({
        message: `${assetsToDelete.length} asset${assetsToDelete.length === 1 ? "" : "s"} deleted successfully`,
        deletedCount: assetsToDelete.length,
      });
    } catch (error: unknown) {
      console.error(
        "Error bulk deleting assets:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error bulk deleting assets" });
    }
  });

  // Bulk update endpoint (for categories and tags)
  app.post("/api/assets/bulk-update", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { assetIds, categoryId, tagIds, addTags, removeTags } = req.body;

      // Validate assetIds
      if (!Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({ message: "Invalid asset IDs" });
      }

      // At least one update operation must be specified
      if (
        categoryId === undefined &&
        tagIds === undefined &&
        addTags === undefined &&
        removeTags === undefined
      ) {
        return res.status(400).json({ message: "No updates specified" });
      }

      // Get user's clients to determine access
      const userClientRecords = await db
        .select()
        .from(userClients)
        .where(eq(userClients.userId, req.session.userId));

      if (userClientRecords.length === 0) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const clientIds = userClientRecords.map((uc) => uc.clientId);

      // Get all assets to be updated
      const assetsToUpdate = await db
        .select()
        .from(assets)
        .where(
          and(
            inArray(assets.id, assetIds),
            isNull(assets.deletedAt),
            inArray(assets.clientId, clientIds)
          )
        );

      if (assetsToUpdate.length === 0) {
        return res.status(404).json({ message: "No assets found" });
      }

      // Check permissions for each asset (need write permission)
      const userId = req.session.userId;
      const permissionChecks = await Promise.all(
        assetsToUpdate.map((asset) =>
          checkAssetPermission(userId, asset.id, asset.clientId, "write")
        )
      );

      const unauthorizedAssets = permissionChecks.filter((p) => !p.allowed);
      if (unauthorizedAssets.length > 0) {
        return res
          .status(403)
          .json({ message: "Not authorized to update some assets" });
      }

      // Update category if specified
      if (categoryId !== undefined && categoryId !== null) {
        // Remove all existing category assignments for these assets
        await db
          .delete(assetCategoryAssignments)
          .where(inArray(assetCategoryAssignments.assetId, assetIds));

        // Add new category assignment
        if (categoryId > 0) {
          const categoryAssignments = assetIds.map((assetId) => ({
            assetId,
            categoryId,
          }));
          await db.insert(assetCategoryAssignments).values(categoryAssignments);
        }
      }

      // Handle tag updates
      if (
        addTags !== undefined &&
        Array.isArray(addTags) &&
        addTags.length > 0
      ) {
        // Add tags to existing tags (don't remove existing)
        const tagAssignments: { assetId: number; tagId: number }[] = [];

        for (const assetId of assetIds) {
          // Get existing tags for this asset
          const existingTags = await db
            .select()
            .from(assetTagAssignments)
            .where(eq(assetTagAssignments.assetId, assetId));

          const existingTagIds = new Set(existingTags.map((t) => t.tagId));

          // Add only tags that don't already exist
          for (const tagId of addTags) {
            if (!existingTagIds.has(tagId)) {
              tagAssignments.push({ assetId, tagId });
            }
          }
        }

        if (tagAssignments.length > 0) {
          await db.insert(assetTagAssignments).values(tagAssignments);
        }
      }

      // Handle tag removal
      if (
        removeTags !== undefined &&
        Array.isArray(removeTags) &&
        removeTags.length > 0
      ) {
        // Remove specified tags from the assets
        await db
          .delete(assetTagAssignments)
          .where(
            and(
              inArray(assetTagAssignments.assetId, assetIds),
              inArray(assetTagAssignments.tagId, removeTags)
            )
          );
      }

      if (tagIds !== undefined && Array.isArray(tagIds)) {
        // Replace all tags with the specified ones
        // Remove all existing tag assignments for these assets
        await db
          .delete(assetTagAssignments)
          .where(inArray(assetTagAssignments.assetId, assetIds));

        // Add new tag assignments if any
        if (tagIds.length > 0) {
          const tagAssignments: { assetId: number; tagId: number }[] = [];
          for (const assetId of assetIds) {
            for (const tagId of tagIds) {
              tagAssignments.push({ assetId, tagId });
            }
          }
          await db.insert(assetTagAssignments).values(tagAssignments);
        }
      }

      res.json({
        message: `${assetsToUpdate.length} asset${assetsToUpdate.length === 1 ? "" : "s"} updated successfully`,
        updatedCount: assetsToUpdate.length,
      });
    } catch (error: unknown) {
      console.error(
        "Error bulk updating assets:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error bulk updating assets" });
    }
  });

  // Global upload endpoint (infers clientId from session/user context)
  app.post(
    "/api/assets/upload",
    csrfProtection,
    uploadRateLimit,
    upload.single("file"),
    virusScan,
    async (req, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        // Check user role - guests cannot upload
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.session.userId));

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        if (user.role === UserRole.GUEST) {
          return res
            .status(403)
            .json({ message: "Guests cannot upload files" });
        }

        // Get user's first client (for now - could be enhanced to require clientId in body)
        const userClientRecords = await db
          .select()
          .from(userClients)
          .where(eq(userClients.userId, req.session.userId));

        if (userClientRecords.length === 0) {
          return res
            .status(400)
            .json({ message: "No client associated with user" });
        }

        const clientId = userClientRecords[0].clientId;

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

        // Auto-categorize if no manual categories provided
        let finalCategoryIds = categoryIds;
        if (finalCategoryIds.length === 0) {
          try {
            // Ensure default categories exist
            await ensureDefaultCategories();

            // Get available categories for this client (defaults + client-specific)
            const categories = await getCategoriesForClient(clientId);

            // Auto-select category based on file type
            const autoCategoryId = autoSelectCategory(
              file.originalname,
              file.mimetype,
              categories
            );

            if (autoCategoryId) {
              finalCategoryIds = [autoCategoryId];
              const categoryName = determineAssetCategory(
                file.originalname,
                file.mimetype
              );
              console.log(
                `Auto-categorized uploaded file "${file.originalname}" as "${categoryName}" (ID: ${autoCategoryId})`
              );
            }
          } catch (categoryError) {
            console.warn(
              "Failed to auto-categorize uploaded file:",
              categoryError
            );
            // Continue without categorization if it fails
          }
        }

        const validated = insertAssetSchema.parse(assetData);
        const [asset] = await db.insert(assets).values(validated).returning();

        // Assign categories
        if (finalCategoryIds.length > 0) {
          await db.insert(assetCategoryAssignments).values(
            finalCategoryIds.map((categoryId) => ({
              assetId: asset.id,
              categoryId,
            }))
          );
        }

        // Process tags - create new ones if needed
        if (tagNames.length > 0) {
          const tagIds: number[] = [];

          for (const tagName of tagNames) {
            const slug = tagName.toLowerCase().replace(/\s+/g, "-");

            // Check if tag already exists for this client
            const [existingTag] = await db
              .select()
              .from(assetTags)
              .where(
                and(eq(assetTags.clientId, clientId), eq(assetTags.slug, slug))
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
    csrfProtection,
    uploadRateLimit,
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

        // Check user role - guests cannot upload
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.session.userId));

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        if (user.role === UserRole.GUEST) {
          return res
            .status(403)
            .json({ message: "Guests cannot upload files" });
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

        // Auto-categorize if no manual categories provided
        let finalCategoryIds = categoryIds;
        if (finalCategoryIds.length === 0) {
          try {
            // Ensure default categories exist
            await ensureDefaultCategories();

            // Get available categories for this client (defaults + client-specific)
            const categories = await getCategoriesForClient(clientId);

            // Auto-select category based on file type
            const autoCategoryId = autoSelectCategory(
              file.originalname,
              file.mimetype,
              categories
            );

            if (autoCategoryId) {
              finalCategoryIds = [autoCategoryId];
              const categoryName = determineAssetCategory(
                file.originalname,
                file.mimetype
              );
              console.log(
                `Auto-categorized uploaded file "${file.originalname}" as "${categoryName}" (ID: ${autoCategoryId})`
              );
            }
          } catch (categoryError) {
            console.warn(
              "Failed to auto-categorize uploaded file:",
              categoryError
            );
            // Continue without categorization if it fails
          }
        }

        const validated = insertAssetSchema.parse(assetData);
        const [asset] = await db.insert(assets).values(validated).returning();

        // Assign categories
        if (finalCategoryIds.length > 0) {
          await db.insert(assetCategoryAssignments).values(
            finalCategoryIds.map((categoryId) => ({
              assetId: asset.id,
              categoryId,
            }))
          );
        }

        // Process tags - create new ones if needed
        if (tagNames.length > 0) {
          const tagIds: number[] = [];

          for (const tagName of tagNames) {
            const slug = tagName.toLowerCase().replace(/\s+/g, "-");

            // Check if tag already exists for this client
            const [existingTag] = await db
              .select()
              .from(assetTags)
              .where(
                and(eq(assetTags.clientId, clientId), eq(assetTags.slug, slug))
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
          .from(users)
          .where(eq(users.id, req.session.userId));

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
          (a: Asset, b: Asset) =>
            new Date(b.createdAt ?? new Date()).getTime() -
            new Date(a.createdAt ?? new Date()).getTime()
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

        // Get categories
        const categoryRows = await db
          .select({
            id: assetCategories.id,
            name: assetCategories.name,
            slug: assetCategories.slug,
            isDefault: assetCategories.isDefault,
            clientId: assetCategories.clientId,
          })
          .from(assetCategoryAssignments)
          .innerJoin(
            assetCategories,
            eq(assetCategoryAssignments.categoryId, assetCategories.id)
          )
          .where(eq(assetCategoryAssignments.assetId, assetId));

        // Get tags
        const tagRows = await db
          .select({
            id: assetTags.id,
            name: assetTags.name,
            slug: assetTags.slug,
            clientId: assetTags.clientId,
          })
          .from(assetTagAssignments)
          .innerJoin(assetTags, eq(assetTagAssignments.tagId, assetTags.id))
          .where(eq(assetTagAssignments.assetId, assetId));

        res.json({
          ...permission.asset,
          categories: categoryRows,
          tags: tagRows,
        });
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

        // Check if this is a reference-only asset (Google Workspace file)
        // CRITICAL: Do this check BEFORE attempting to download from storage
        if (asset.referenceOnly) {
          if (!asset.driveWebLink) {
            if (asset.driveFileId) {
              const webLink = `https://drive.google.com/file/d/${asset.driveFileId}/view`;
              try {
                await db
                  .update(assets)
                  .set({ driveWebLink: webLink, updatedAt: new Date() })
                  .where(eq(assets.id, assetId));
                console.log(
                  `Backfilled driveWebLink for asset ${assetId}: ${webLink}`
                );
              } catch (e) {
                console.warn(
                  `Failed to backfill driveWebLink for asset ${assetId}:`,
                  e
                );
              }
              return res.redirect(302, webLink);
            }
            return res.status(400).json({
              message: "Reference-only asset without valid Google Drive link",
            });
          }
          console.log(
            `Redirecting to Google Drive file: ${asset.driveWebLink}`
          );
          return res.redirect(302, asset.driveWebLink);
        }

        // Validate storagePath exists for regular assets
        if (!asset.storagePath) {
          console.error(
            `ERROR: Asset ${assetId} has empty storagePath and is not a reference asset`
          );
          return res.status(400).json({
            message: "Asset storage path not found",
          });
        }

        // Download file from storage for regular assets
        const downloadResult = await downloadFile(asset.storagePath);

        if (!downloadResult.success || !downloadResult.data) {
          return res
            .status(404)
            .json({ message: downloadResult.error || "File not found" });
        }

        const fileBuffer = downloadResult.data;

        // Set headers for file download
        res.setHeader("Content-Type", asset.fileType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${asset.originalFileName}"`
        );
        res.setHeader("Content-Length", fileBuffer.length);

        res.send(fileBuffer);
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

  // Get thumbnail for a file asset
  app.get(
    "/api/clients/:clientId/file-assets/:assetId/thumbnail/:size",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const assetId = parseInt(req.params.assetId, 10);
        const size = req.params.size as "small" | "medium" | "large";
        const clientId = req.clientId;

        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        // Validate size parameter
        if (!["small", "medium", "large"].includes(size)) {
          return res.status(400).json({ message: "Invalid thumbnail size" });
        }

        // Check if user has read permission
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

        const asset = permission.asset;

        // Check if we can generate a thumbnail for this file type
        if (!canGenerateThumbnail(asset.fileType || "")) {
          // Return file type icon name instead
          const iconName = getFileTypeIcon(asset.fileType || "");
          return res.json({ iconName });
        }

        // Download file from storage
        const downloadResult = await downloadFile(asset.storagePath);

        if (!downloadResult.success || !downloadResult.data) {
          return res
            .status(404)
            .json({ message: downloadResult.error || "File not found" });
        }

        const fileBuffer = downloadResult.data;

        // Create a temporary file path for processing
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(
          tempDir,
          `asset-${assetId}-${Date.now()}`
        );

        // Write the buffer to temp file
        await fs.writeFile(tempFilePath, fileBuffer);

        try {
          // Generate or get cached thumbnail (returns storage path)
          const _thumbnailStoragePath = await getOrGenerateThumbnail(
            tempFilePath,
            assetId,
            size,
            asset.fileType || ""
          );

          // Download thumbnail from storage
          const thumbnailBuffer = await downloadThumbnail(assetId, size);

          res.setHeader("Content-Type", "image/jpeg");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.send(thumbnailBuffer);
        } finally {
          // Clean up temp file
          try {
            await fs.unlink(tempFilePath);
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (error: unknown) {
        console.error(
          "Error generating thumbnail:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error generating thumbnail" });
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

        // Delete the actual file from storage
        if (permission.asset.storagePath) {
          const deleteResult = await deleteFile(permission.asset.storagePath);
          if (!deleteResult.success) {
            console.error(
              `Failed to delete file from storage: ${deleteResult.error}`
            );
          }
        }

        // Delete any thumbnails for this asset
        try {
          await deleteThumbnails(assetId);
        } catch (error) {
          console.error(
            `Failed to delete thumbnails for asset ${assetId}:`,
            error
          );
        }

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

  // ============ PUBLIC LINK ROUTES ============

  // Create a public link for an asset
  app.post(
    "/api/clients/:clientId/assets/:assetId/public-links",
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
        const { expiresInDays } = req.body; // 1, 3, 7, null (no expiry)

        // Check if user has share permission for this asset
        const permission = await checkAssetPermission(
          req.session.userId,
          assetId,
          clientId,
          "share"
        );

        if (!permission.allowed || !permission.asset) {
          return res
            .status(403)
            .json({ message: "Not authorized to create link for this asset" });
        }

        // Generate a secure random token
        const token = crypto.randomBytes(32).toString("base64url");

        // Calculate expiry date if specified
        let expiresAt: Date | null = null;
        if (expiresInDays && expiresInDays > 0) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        }

        // Insert the public link
        const [publicLink] = await db
          .insert(assetPublicLinks)
          .values({
            assetId,
            token,
            createdBy: req.session.userId,
            expiresAt,
          })
          .returning();

        res.status(201).json(publicLink);
      } catch (error: unknown) {
        console.error(
          "Error creating public link:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error creating public link" });
      }
    }
  );

  // List public links for an asset
  app.get(
    "/api/clients/:clientId/assets/:assetId/public-links",
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

        // Check if user has read permission for this asset
        const permission = await checkAssetPermission(
          req.session.userId,
          assetId,
          clientId,
          "read"
        );

        if (!permission.allowed) {
          return res
            .status(403)
            .json({ message: "Not authorized to view links for this asset" });
        }

        // Get all public links for this asset
        const links = await db
          .select()
          .from(assetPublicLinks)
          .where(eq(assetPublicLinks.assetId, assetId));

        res.json(links);
      } catch (error: unknown) {
        console.error(
          "Error fetching public links:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching public links" });
      }
    }
  );

  // Delete a public link
  app.delete(
    "/api/clients/:clientId/assets/:assetId/public-links/:linkId",
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
        const linkId = parseInt(req.params.linkId, 10);

        // Check if user has share permission for this asset
        const permission = await checkAssetPermission(
          req.session.userId,
          assetId,
          clientId,
          "share"
        );

        if (!permission.allowed) {
          return res
            .status(403)
            .json({ message: "Not authorized to delete this link" });
        }

        // Delete the link
        await db
          .delete(assetPublicLinks)
          .where(
            and(
              eq(assetPublicLinks.id, linkId),
              eq(assetPublicLinks.assetId, assetId)
            )
          );

        res.json({ message: "Public link deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting public link:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting public link" });
      }
    }
  );

  // Public download endpoint (no auth required)
  app.get("/api/public/assets/:token", async (req, res: Response) => {
    try {
      const { token } = req.params;

      // Find the public link
      const [publicLink] = await db
        .select()
        .from(assetPublicLinks)
        .where(eq(assetPublicLinks.token, token));

      if (!publicLink) {
        return res.status(404).json({ message: "Link not found" });
      }

      // Check if link has expired
      if (publicLink.expiresAt && publicLink.expiresAt < new Date()) {
        return res.status(410).json({ message: "Link has expired" });
      }

      // Get the asset
      const [asset] = await db
        .select()
        .from(assets)
        .where(
          and(eq(assets.id, publicLink.assetId), isNull(assets.deletedAt))
        );

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Check if this is a reference-only asset (Google Workspace file)
      // CRITICAL: Do this check BEFORE attempting to download from storage
      if (asset.referenceOnly) {
        if (!asset.driveWebLink) {
          if (asset.driveFileId) {
            const webLink = `https://drive.google.com/file/d/${asset.driveFileId}/view`;
            try {
              await db
                .update(assets)
                .set({ driveWebLink: webLink, updatedAt: new Date() })
                .where(eq(assets.id, asset.id));
              console.log(
                `Backfilled driveWebLink for asset ${asset.id}: ${webLink}`
              );
            } catch (e) {
              console.warn(
                `Failed to backfill driveWebLink for asset ${asset.id}:`,
                e
              );
            }
            return res.redirect(302, webLink);
          }
          return res.status(400).json({
            message: "Reference-only asset without valid Google Drive link",
          });
        }
        console.log(`Redirecting to Google Drive file: ${asset.driveWebLink}`);
        return res.redirect(302, asset.driveWebLink);
      }

      // Validate storagePath exists for regular assets
      if (!asset.storagePath) {
        console.error(
          `ERROR: Asset has empty storagePath and is not a reference asset`
        );
        return res.status(400).json({
          message: "Asset storage path not found",
        });
      }

      // Download file from storage for regular assets
      const downloadResult = await downloadFile(asset.storagePath);

      if (!downloadResult.success || !downloadResult.data) {
        return res
          .status(404)
          .json({ message: downloadResult.error || "File not found" });
      }

      // Set headers for download
      res.setHeader("Content-Type", asset.fileType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asset.originalFileName}"`
      );
      res.send(downloadResult.data);
    } catch (error: unknown) {
      console.error(
        "Error serving public asset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error serving asset" });
    }
  });
}
