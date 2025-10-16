import type { Express, Response } from "express";
import { validateClientId } from "../middlewares/vaildateClientId";
import type { RequestWithClientId } from "../routes";
import {
  type AssetVisibility,
  bulkUpdateAssetSharing,
  getAssetSharing,
  updateAssetSharing,
} from "../services/asset-sharing";

export function registerAssetSharingRoutes(app: Express) {
  // Update sharing settings for a single asset
  app.patch(
    "/api/clients/:clientId/assets/:assetId/visibility",
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
        const { visibility } = req.body as { visibility: AssetVisibility };

        if (!visibility || !["private", "shared"].includes(visibility)) {
          return res
            .status(400)
            .json({ message: "Invalid visibility setting" });
        }

        const updatedAsset = await updateAssetSharing({
          userId: req.session.userId as number,
          clientId: req.clientId,
          assetId,
          visibility,
        });

        res.json(updatedAsset);
      } catch (error) {
        console.error("Error updating asset visibility:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Error updating asset visibility";
        res.status(error instanceof Error ? 403 : 500).json({ message });
      }
    }
  );

  // Bulk update sharing settings
  app.patch(
    "/api/clients/:clientId/assets/bulk-visibility",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        if (!req.clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const { assetIds, visibility } = req.body as {
          assetIds: number[];
          visibility: AssetVisibility;
        };

        if (!Array.isArray(assetIds) || assetIds.length === 0) {
          return res.status(400).json({ message: "Invalid asset IDs" });
        }

        if (!visibility || !["private", "shared"].includes(visibility)) {
          return res
            .status(400)
            .json({ message: "Invalid visibility setting" });
        }

        const updatedAssets = await bulkUpdateAssetSharing({
          userId: req.session.userId as number,
          clientId: req.clientId,
          assetIds,
          visibility,
        });

        res.json({
          message: `Updated ${updatedAssets.length} assets`,
          assets: updatedAssets,
        });
      } catch (error) {
        console.error("Error bulk updating asset visibility:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Error updating assets visibility";
        res.status(error instanceof Error ? 403 : 500).json({ message });
      }
    }
  );

  // Get sharing settings for an asset
  app.get(
    "/api/clients/:clientId/assets/:assetId/visibility",
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
        const sharing = await getAssetSharing(
          req.session.userId as number,
          assetId,
          req.clientId
        );

        res.json(sharing);
      } catch (error) {
        console.error("Error getting asset visibility:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Error getting asset visibility";
        res.status(error instanceof Error ? 403 : 500).json({ message });
      }
    }
  );
}
