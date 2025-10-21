import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Express, Response } from "express";
import { validateClientId } from "../middlewares/vaildateClientId";
import type { RequestWithClientId } from "../routes";
import { checkAssetPermission } from "../services/asset-permissions";
import {
  createShareableLink,
  deactivateShareableLink,
  getAssetByShareableLink,
  getAssetShareableLinks,
} from "../services/shareable-links";

export function registerShareableLinksRoutes(app: Express) {
  // Create shareable link
  app.post(
    "/api/clients/:clientId/assets/:assetId/share",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const assetId = parseInt(req.params.assetId, 10);
        const clientId = req.clientId;

        // Check if user can share this asset
        const permission = await checkAssetPermission(
          req.session.userId as number,
          assetId,
          clientId,
          "share"
        );

        if (!permission.allowed) {
          return res.status(403).json({
            message: permission.reason || "Not authorized to share this asset",
          });
        }

        const { expiresIn } = req.body;

        const shareableLink = await createShareableLink({
          assetId,
          createdBy: req.session.userId as number,
          expiresIn,
        });

        res.json(shareableLink);
      } catch (error) {
        console.error("Error creating shareable link:", error);
        res.status(500).json({ message: "Error creating shareable link" });
      }
    }
  );

  // List shareable links for an asset
  app.get(
    "/api/clients/:clientId/assets/:assetId/share",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const assetId = parseInt(req.params.assetId, 10);
        const clientId = req.clientId;

        // Check if user can view this asset
        const permission = await checkAssetPermission(
          req.session.userId as number,
          assetId,
          clientId,
          "read"
        );

        if (!permission.allowed) {
          return res.status(403).json({
            message: permission.reason || "Not authorized to view this asset",
          });
        }

        const links = await getAssetShareableLinks(assetId);
        res.json(links);
      } catch (error) {
        console.error("Error listing shareable links:", error);
        res.status(500).json({ message: "Error listing shareable links" });
      }
    }
  );

  // Delete shareable link
  app.delete(
    "/api/clients/:clientId/assets/:assetId/share/:linkId",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const assetId = parseInt(req.params.assetId, 10);
        const linkId = parseInt(req.params.linkId, 10);
        const clientId = req.clientId;

        // Check if user can modify this asset
        const permission = await checkAssetPermission(
          req.session.userId as number,
          assetId,
          clientId,
          "write"
        );

        if (!permission.allowed) {
          return res.status(403).json({
            message: permission.reason || "Not authorized to modify this asset",
          });
        }

        await deactivateShareableLink(linkId);
        res.json({ message: "Link deactivated successfully" });
      } catch (error) {
        console.error("Error deleting shareable link:", error);
        res.status(500).json({ message: "Error deleting shareable link" });
      }
    }
  );

  // Public download route (no auth required)
  app.get("/api/public/assets/:token", async (req, res: Response) => {
    try {
      const { token } = req.params;

      const asset = await getAssetByShareableLink(token);
      if (!asset) {
        return res
          .status(404)
          .json({ message: "Asset not found or link expired" });
      }

      // Read file from storage
      try {
        const filePath = resolve(asset.storagePath);
        const fileBuffer = await readFile(filePath);

        // Set headers for file download
        res.setHeader("Content-Type", asset.fileType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${asset.originalFileName}"`
        );
        res.setHeader("Content-Length", fileBuffer.length);

        res.send(fileBuffer);
      } catch (fileError) {
        console.error("Error reading file:", fileError);
        return res.status(404).json({ message: "File not found" });
      }
    } catch (error) {
      console.error("Error serving public asset:", error);
      res.status(500).json({ message: "Error serving asset" });
    }
  });
}
