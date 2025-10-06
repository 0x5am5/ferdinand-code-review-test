import { apiTokens, insertApiTokenSchema } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import type { Express, Response } from "express";
import { db } from "../db";
import { validateClientId } from "../middlewares/vaildateClientId";
import type { RequestWithClientId } from "../routes";
import {
  generateApiToken,
  hashToken,
  maskSensitiveData,
} from "../utils/crypto";

/**
 * Register API token management routes
 */
export function registerApiTokenRoutes(app: Express) {
  // Generate a new API token
  app.post(
    "/api/clients/:clientId/tokens",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const { tokenName, scopes, expiresInDays } = req.body;

        if (!tokenName) {
          return res.status(400).json({
            message: "Token name is required",
          });
        }

        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        // Generate the actual token
        const plainTextToken = generateApiToken();
        const { hash, salt } = hashToken(plainTextToken);

        // Store hash with salt (format: "hash.salt")
        const tokenHash = `${hash}.${salt}`;

        // Calculate expiration if provided
        let expiresAt = null;
        if (expiresInDays && expiresInDays > 0) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        }

        // Default scopes if none provided
        const tokenScopes =
          scopes && Array.isArray(scopes) ? scopes : ["read:assets"];

        const tokenData = {
          clientId,
          tokenHash,
          tokenName,
          scopes: tokenScopes,
          createdBy: req.session.userId,
          expiresAt,
          isActive: true,
        };

        const parsed = insertApiTokenSchema.safeParse(tokenData);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid token data",
            errors: parsed.error.errors,
          });
        }

        const [created] = await db
          .insert(apiTokens)
          .values(parsed.data)
          .returning();

        // Return the plain text token only once
        res.status(201).json({
          ...created,
          token: plainTextToken, // This is the only time the plain text token is shown
          tokenHash: maskSensitiveData(created.tokenHash), // Mask the hash for security
        });
      } catch (error) {
        console.error("Error generating API token:", error);
        res.status(500).json({ message: "Error generating token" });
      }
    }
  );

  // List API tokens for a client
  app.get(
    "/api/clients/:clientId/tokens",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        const tokens = await db
          .select({
            id: apiTokens.id,
            tokenName: apiTokens.tokenName,
            scopes: apiTokens.scopes,
            createdBy: apiTokens.createdBy,
            expiresAt: apiTokens.expiresAt,
            lastUsedAt: apiTokens.lastUsedAt,
            isActive: apiTokens.isActive,
            createdAt: apiTokens.createdAt,
            // Mask the token hash for security
            tokenHash: apiTokens.tokenHash,
          })
          .from(apiTokens)
          .where(eq(apiTokens.clientId, clientId))
          .orderBy(desc(apiTokens.createdAt));

        // Mask token hashes in response
        const maskedTokens = tokens.map((token) => ({
          ...token,
          tokenHash: maskSensitiveData(token.tokenHash),
        }));

        res.json(maskedTokens);
      } catch (error) {
        console.error("Error fetching API tokens:", error);
        res.status(500).json({ message: "Error fetching tokens" });
      }
    }
  );

  // Update API token (rename, change scopes, activate/deactivate)
  app.patch(
    "/api/clients/:clientId/tokens/:tokenId",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const clientId = req.clientId;
        const tokenId = parseInt(req.params.tokenId, 10);

        if (!clientId || !tokenId) {
          return res
            .status(400)
            .json({ message: "Client ID and token ID are required" });
        }

        const { tokenName, scopes, isActive } = req.body;

        // Verify token belongs to this client
        const [existingToken] = await db
          .select()
          .from(apiTokens)
          .where(
            and(eq(apiTokens.id, tokenId), eq(apiTokens.clientId, clientId))
          );

        if (!existingToken) {
          return res.status(404).json({ message: "Token not found" });
        }

        // Build update data
        const updateData: Partial<typeof apiTokens.$inferInsert> = {};

        if (tokenName !== undefined) {
          updateData.tokenName = tokenName;
        }

        if (scopes !== undefined && Array.isArray(scopes)) {
          updateData.scopes = scopes;
        }

        if (isActive !== undefined) {
          updateData.isActive = isActive;
        }

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ message: "No valid fields to update" });
        }

        const [updated] = await db
          .update(apiTokens)
          .set(updateData)
          .where(eq(apiTokens.id, tokenId))
          .returning();

        res.json({
          ...updated,
          tokenHash: maskSensitiveData(updated.tokenHash),
        });
      } catch (error) {
        console.error("Error updating API token:", error);
        res.status(500).json({ message: "Error updating token" });
      }
    }
  );

  // Delete (deactivate) API token
  app.delete(
    "/api/clients/:clientId/tokens/:tokenId",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        const tokenId = parseInt(req.params.tokenId, 10);

        if (!clientId || !tokenId) {
          return res
            .status(400)
            .json({ message: "Client ID and token ID are required" });
        }

        // Verify token belongs to this client
        const [existingToken] = await db
          .select()
          .from(apiTokens)
          .where(
            and(eq(apiTokens.id, tokenId), eq(apiTokens.clientId, clientId))
          );

        if (!existingToken) {
          return res.status(404).json({ message: "Token not found" });
        }

        // Soft delete by deactivating
        const [deactivated] = await db
          .update(apiTokens)
          .set({ isActive: false })
          .where(eq(apiTokens.id, tokenId))
          .returning();

        res.json({
          message: "Token deactivated successfully",
          token: {
            ...deactivated,
            tokenHash: maskSensitiveData(deactivated.tokenHash),
          },
        });
      } catch (error) {
        console.error("Error deactivating API token:", error);
        res.status(500).json({ message: "Error deactivating token" });
      }
    }
  );

  // Get token usage statistics
  app.get(
    "/api/clients/:clientId/tokens/:tokenId/stats",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        const tokenId = parseInt(req.params.tokenId, 10);

        if (!clientId || !tokenId) {
          return res
            .status(400)
            .json({ message: "Client ID and token ID are required" });
        }

        // Get token info
        const [token] = await db
          .select({
            id: apiTokens.id,
            tokenName: apiTokens.tokenName,
            createdAt: apiTokens.createdAt,
            lastUsedAt: apiTokens.lastUsedAt,
            isActive: apiTokens.isActive,
          })
          .from(apiTokens)
          .where(
            and(eq(apiTokens.id, tokenId), eq(apiTokens.clientId, clientId))
          );

        if (!token) {
          return res.status(404).json({ message: "Token not found" });
        }

        // Calculate usage statistics
        const daysSinceCreated = token.createdAt
          ? Math.floor(
              (Date.now() - token.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;

        const daysSinceLastUsed = token.lastUsedAt
          ? Math.floor(
              (Date.now() - token.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24)
            )
          : null;

        res.json({
          tokenId: token.id,
          tokenName: token.tokenName,
          isActive: token.isActive,
          createdAt: token.createdAt,
          lastUsedAt: token.lastUsedAt,
          stats: {
            daysSinceCreated,
            daysSinceLastUsed,
            hasBeenUsed: !!token.lastUsedAt,
          },
        });
      } catch (error) {
        console.error("Error fetching token stats:", error);
        res.status(500).json({ message: "Error fetching token statistics" });
      }
    }
  );
}
