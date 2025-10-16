import { assetPublicLinks, assets } from "@shared/schema";
import crypto from "crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db";

const EXPIRY_OPTIONS = {
  "1_day": 1,
  "7_days": 7,
  "30_days": 30,
  never: null,
} as const;

type ExpiryOption = keyof typeof EXPIRY_OPTIONS;

interface ShareableLinkOptions {
  assetId: number;
  createdBy: number;
  expiresIn?: ExpiryOption;
}

/**
 * Generate a secure token for shareable links
 */
const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString("base64url");
};

/**
 * Calculate expiry date based on option
 */
const calculateExpiryDate = (expiresIn?: ExpiryOption): Date | null => {
  if (!expiresIn || expiresIn === "never") {
    return null;
  }

  const days = EXPIRY_OPTIONS[expiresIn];
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate;
};

/**
 * Create a new shareable link for an asset
 */
export const createShareableLink = async (options: ShareableLinkOptions) => {
  try {
    const { assetId, createdBy, expiresIn } = options;

    // Generate a unique token
    const token = generateSecureToken();
    const expiryDate = calculateExpiryDate(expiresIn);

    // Create the link record
    const [link] = await db
      .insert(assetPublicLinks)
      .values({
        assetId,
        token,
        createdBy,
        expiresAt: expiryDate,
      })
      .returning();

    return {
      ...link,
      url: `/api/public/assets/${token}`,
    };
  } catch (error) {
    console.error("Error creating shareable link:", error);
    throw new Error("Failed to create shareable link");
  }
};

/**
 * Get all active shareable links for an asset
 */
export const getAssetShareableLinks = async (assetId: number) => {
  try {
    const now = new Date();

    // Get all active links that are not deleted and not expired
    const links = await db
      .select()
      .from(assetPublicLinks)
      .where(
        and(
          eq(assetPublicLinks.assetId, assetId),
          isNull(assetPublicLinks.deletedAt),
          or(
            isNull(assetPublicLinks.expiresAt),
            gt(assetPublicLinks.expiresAt, now)
          )
        )
      );

    return links.map((link) => ({
      ...link,
      url: `/api/public/assets/${link.token}`,
    }));
  } catch (error) {
    console.error("Error getting shareable links:", error);
    return [];
  }
};

/**
 * Deactivate a shareable link
 */
export const deactivateShareableLink = async (linkId: number) => {
  try {
    await db
      .update(assetPublicLinks)
      .set({ deletedAt: new Date() })
      .where(eq(assetPublicLinks.id, linkId));

    return true;
  } catch (error) {
    console.error("Error deactivating shareable link:", error);
    return false;
  }
};

/**
 * Get asset by shareable link token
 */
export const getAssetByShareableLink = async (token: string) => {
  try {
    const now = new Date();

    // Get the link and check if it's valid
    const [link] = await db
      .select()
      .from(assetPublicLinks)
      .where(
        and(
          eq(assetPublicLinks.token, token),
          isNull(assetPublicLinks.deletedAt),
          or(
            isNull(assetPublicLinks.expiresAt),
            gt(assetPublicLinks.expiresAt, now)
          )
        )
      );

    if (!link) {
      return null;
    }

    // Get the asset
    const [asset] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, link.assetId));

    return asset || null;
  } catch (error) {
    console.error("Error getting asset by shareable link:", error);
    return null;
  }
};
