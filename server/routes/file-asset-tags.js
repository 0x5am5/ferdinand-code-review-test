import { assetTagAssignments, assetTags, insertAssetTagSchema, UserRole, } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { validateClientId } from "../middlewares/vaildateClientId";
// Helper to check if user can delete tag
const checkTagDeletePermission = async (userId, tagId) => {
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
    const isAdmin = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;
    return { allowed: isAdmin, tag };
};
export function registerFileAssetTagRoutes(app) {
    // Get all tags (global endpoint for frontend queries - returns tags from all user's clients)
    app.get("/api/asset-tags", async (req, res) => {
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
            const clientIds = userClients.map((uc) => uc.clientId);
            const tags = await db
                .select()
                .from(assetTags)
                .where(inArray(assetTags.clientId, clientIds));
            res.json(tags);
        }
        catch (error) {
            console.error("Error fetching asset tags:", error instanceof Error ? error.message : "Unknown error");
            res.status(500).json({ message: "Error fetching asset tags" });
        }
    });
    // Create a new tag (global endpoint - infers clientId from user's first client)
    app.post("/api/asset-tags", async (req, res) => {
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
                return res
                    .status(400)
                    .json({ message: "No client associated with user" });
            }
            const clientId = userClients[0].clientId;
            const { name, slug } = req.body;
            // Normalize tag name to lowercase for consistency
            const normalizedName = name.trim().toLowerCase();
            const normalizedSlug = (slug || normalizedName.replace(/\s+/g, "-")).toLowerCase();
            // Check if tag already exists (case-insensitive)
            const { sql: rawSql } = await import("drizzle-orm");
            const existingTag = await db
                .select()
                .from(assetTags)
                .where(rawSql `LOWER(${assetTags.name}) = ${normalizedName} AND ${assetTags.clientId} = ${clientId}`)
                .limit(1);
            if (existingTag.length > 0) {
                // Return existing tag instead of creating duplicate
                return res.status(200).json(existingTag[0]);
            }
            const tagData = {
                name: normalizedName,
                slug: normalizedSlug,
                clientId,
            };
            const validated = insertAssetTagSchema.parse(tagData);
            const [tag] = await db.insert(assetTags).values(validated).returning();
            res.status(201).json(tag);
        }
        catch (error) {
            console.error("Error creating asset tag:", error instanceof Error ? error.message : "Unknown error");
            res.status(500).json({ message: "Error creating asset tag" });
        }
    });
    // Delete a tag (global endpoint)
    app.delete("/api/asset-tags/:id", async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: "Not authenticated" });
            }
            const tagId = parseInt(req.params.id, 10);
            const permission = await checkTagDeletePermission(req.session.userId, tagId);
            if (!permission.allowed || !permission.tag) {
                return res
                    .status(403)
                    .json({ message: "Not authorized to delete this tag" });
            }
            // Delete tag assignments first
            await db
                .delete(assetTagAssignments)
                .where(eq(assetTagAssignments.tagId, tagId));
            // Then delete the tag
            await db.delete(assetTags).where(eq(assetTags.id, tagId));
            res.json({ message: "Tag deleted successfully" });
        }
        catch (error) {
            console.error("Error deleting asset tag:", error instanceof Error ? error.message : "Unknown error");
            res.status(500).json({ message: "Error deleting asset tag" });
        }
    });
    // Get all tags for a client
    app.get("/api/clients/:clientId/file-asset-tags", validateClientId, async (req, res) => {
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
        }
        catch (error) {
            console.error("Error fetching asset tags:", error instanceof Error ? error.message : "Unknown error");
            res.status(500).json({ message: "Error fetching asset tags" });
        }
    });
    // Create a new tag
    app.post("/api/clients/:clientId/file-asset-tags", validateClientId, async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: "Not authenticated" });
            }
            const clientId = req.clientId;
            if (!clientId) {
                return res.status(400).json({ message: "Client ID is required" });
            }
            const { name, slug } = req.body;
            // Normalize tag name to lowercase for consistency
            const normalizedName = name.trim().toLowerCase();
            const normalizedSlug = (slug || normalizedName.replace(/\s+/g, "-")).toLowerCase();
            // Check if tag already exists (case-insensitive)
            const { sql: rawSql } = await import("drizzle-orm");
            const existingTag = await db
                .select()
                .from(assetTags)
                .where(rawSql `LOWER(${assetTags.name}) = ${normalizedName} AND ${assetTags.clientId} = ${clientId}`)
                .limit(1);
            if (existingTag.length > 0) {
                // Return existing tag instead of creating duplicate
                return res.status(200).json(existingTag[0]);
            }
            const tagData = {
                name: normalizedName,
                slug: normalizedSlug,
                clientId,
            };
            const validated = insertAssetTagSchema.parse(tagData);
            const [tag] = await db.insert(assetTags).values(validated).returning();
            res.status(201).json(tag);
        }
        catch (error) {
            console.error("Error creating asset tag:", error instanceof Error ? error.message : "Unknown error");
            res.status(500).json({ message: "Error creating asset tag" });
        }
    });
    // Delete a tag (creator or admin only)
    app.delete("/api/clients/:clientId/file-asset-tags/:tagId", validateClientId, async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ message: "Not authenticated" });
            }
            const clientId = req.clientId;
            if (!clientId) {
                return res.status(400).json({ message: "Client ID is required" });
            }
            const tagId = parseInt(req.params.tagId, 10);
            const permission = await checkTagDeletePermission(req.session.userId, tagId);
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
            // Delete tag assignments first
            await db
                .delete(assetTagAssignments)
                .where(eq(assetTagAssignments.tagId, tagId));
            // Then delete the tag
            await db.delete(assetTags).where(eq(assetTags.id, tagId));
            res.json({ message: "Tag deleted successfully" });
        }
        catch (error) {
            console.error("Error deleting asset tag:", error instanceof Error ? error.message : "Unknown error");
            res.status(500).json({ message: "Error deleting asset tag" });
        }
    });
}
