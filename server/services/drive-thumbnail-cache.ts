import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { assets } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { drive_v3 } from "googleapis";
import { db } from "../db";

/**
 * Directory for cached Drive thumbnails
 */
const THUMBNAIL_CACHE_DIR = "uploads/drive-thumbnails";

/**
 * Maximum age for cached thumbnails (7 days in milliseconds)
 */
const THUMBNAIL_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Thumbnail size options supported by Google Drive
 */
export type ThumbnailSize = "small" | "medium" | "large";

const THUMBNAIL_SIZES = {
  small: 200,
  medium: 400,
  large: 800,
} as const;

/**
 * Interface for thumbnail cache result
 */
export interface ThumbnailCacheResult {
  path: string;
  url: string;
  cached: boolean;
  expiresAt: Date;
}

/**
 * Ensures the thumbnail cache directory exists
 */
async function ensureCacheDirectory(): Promise<void> {
  try {
    await fs.access(THUMBNAIL_CACHE_DIR);
  } catch {
    await fs.mkdir(THUMBNAIL_CACHE_DIR, { recursive: true });
  }
}

/**
 * Generates a cache version hash from thumbnail URL and modification time
 */
function generateCacheVersion(
  thumbnailUrl: string,
  modifiedTime: Date
): string {
  const data = `${thumbnailUrl}-${modifiedTime.toISOString()}`;
  return crypto.createHash("md5").update(data).digest("hex");
}

/**
 * Generates a unique filename for the cached thumbnail
 */
function generateThumbnailFilename(
  driveFileId: string,
  size: ThumbnailSize
): string {
  return `${driveFileId}_${size}.jpg`;
}

/**
 * Checks if a cached thumbnail is still valid
 */
function isCacheValid(
  cachedAt: Date | null,
  cacheVersion: string | null,
  currentVersion: string
): boolean {
  if (!cachedAt || !cacheVersion) {
    return false;
  }

  // Check if cache version matches (file hasn't been updated in Drive)
  if (cacheVersion !== currentVersion) {
    return false;
  }

  // Check if cache is within max age
  const cacheAge = Date.now() - cachedAt.getTime();
  return cacheAge < THUMBNAIL_MAX_AGE;
}

/**
 * Downloads a thumbnail from Google Drive
 */
async function downloadThumbnail(
  driveClient: drive_v3.Drive,
  driveFileId: string,
  size: ThumbnailSize
): Promise<Buffer> {
  try {
    // Get file metadata with thumbnail link
    const fileResponse = await driveClient.files.get({
      fileId: driveFileId,
      fields: "thumbnailLink",
    });

    const thumbnailLink = fileResponse.data.thumbnailLink;
    if (!thumbnailLink) {
      throw new Error("No thumbnail available for this file");
    }

    // Modify thumbnail URL to request specific size
    // Google Drive thumbnail URLs have =s220 parameter for size
    const sizeParam = `=s${THUMBNAIL_SIZES[size]}`;
    const thumbnailUrl = thumbnailLink.replace(/=s\d+/, sizeParam);

    // Download the thumbnail using native fetch
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to download thumbnail: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Error downloading thumbnail:", error);
    throw new Error("Failed to download Drive thumbnail");
  }
}

/**
 * Saves thumbnail data to local storage
 */
async function saveThumbnailToCache(
  thumbnailData: Buffer,
  filename: string
): Promise<string> {
  await ensureCacheDirectory();
  const filePath = path.join(THUMBNAIL_CACHE_DIR, filename);
  await fs.writeFile(filePath, thumbnailData);
  return filePath;
}

/**
 * Fetches and caches a Drive file thumbnail
 */
export async function fetchAndCacheThumbnail(
  driveClient: drive_v3.Drive,
  assetId: number,
  driveFileId: string,
  driveLastModified: Date,
  driveThumbnailUrl: string,
  size: ThumbnailSize = "medium"
): Promise<ThumbnailCacheResult> {
  // Get current asset from database
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));

  if (!asset) {
    throw new Error("Asset not found");
  }

  // Generate cache version based on thumbnail URL and modification time
  const currentVersion = generateCacheVersion(
    driveThumbnailUrl,
    driveLastModified
  );

  // Check if we have a valid cached thumbnail
  const isCached = isCacheValid(
    asset.thumbnailCachedAt,
    asset.thumbnailCacheVersion,
    currentVersion
  );

  if (isCached && asset.cachedThumbnailPath) {
    // Check if file still exists on disk
    try {
      await fs.access(asset.cachedThumbnailPath);
      const expiresAt = new Date(
        (asset.thumbnailCachedAt?.getTime() ?? 0) + THUMBNAIL_MAX_AGE
      );

      return {
        path: asset.cachedThumbnailPath,
        url: `/api/assets/${assetId}/thumbnail`,
        cached: true,
        expiresAt,
      };
    } catch {
      // File doesn't exist, need to re-cache
      console.log("Cached thumbnail file missing, re-caching...");
    }
  }

  // Download new thumbnail from Drive
  console.log(`Downloading thumbnail for Drive file ${driveFileId}...`);
  const thumbnailData = await downloadThumbnail(driveClient, driveFileId, size);

  // Save to local cache
  const filename = generateThumbnailFilename(driveFileId, size);
  const cachePath = await saveThumbnailToCache(thumbnailData, filename);

  // Update asset record with cache info
  await db
    .update(assets)
    .set({
      cachedThumbnailPath: cachePath,
      thumbnailCachedAt: new Date(),
      thumbnailCacheVersion: currentVersion,
    })
    .where(eq(assets.id, assetId));

  const expiresAt = new Date(Date.now() + THUMBNAIL_MAX_AGE);

  return {
    path: cachePath,
    url: `/api/assets/${assetId}/thumbnail`,
    cached: false,
    expiresAt,
  };
}

/**
 * Gets cached thumbnail path for an asset
 */
export async function getCachedThumbnailPath(
  assetId: number
): Promise<string | null> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));

  if (!asset || !asset.cachedThumbnailPath) {
    return null;
  }

  // Verify file exists
  try {
    await fs.access(asset.cachedThumbnailPath);
    return asset.cachedThumbnailPath;
  } catch {
    return null;
  }
}

/**
 * Invalidates cached thumbnail for an asset
 */
export async function invalidateThumbnailCache(assetId: number): Promise<void> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));

  if (!asset || !asset.cachedThumbnailPath) {
    return;
  }

  // Delete cached file
  try {
    await fs.unlink(asset.cachedThumbnailPath);
  } catch (error) {
    console.error("Error deleting cached thumbnail:", error);
  }

  // Clear cache fields in database
  await db
    .update(assets)
    .set({
      cachedThumbnailPath: null,
      thumbnailCachedAt: null,
      thumbnailCacheVersion: null,
    })
    .where(eq(assets.id, assetId));
}

/**
 * Clears expired thumbnails from cache
 */
export async function clearExpiredThumbnails(): Promise<number> {
  const cutoffDate = new Date(Date.now() - THUMBNAIL_MAX_AGE);

  // Find all assets with expired cached thumbnails
  const expiredAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.isGoogleDrive, true));

  let clearedCount = 0;

  for (const asset of expiredAssets) {
    if (
      asset.thumbnailCachedAt &&
      asset.thumbnailCachedAt < cutoffDate &&
      asset.cachedThumbnailPath
    ) {
      try {
        await fs.unlink(asset.cachedThumbnailPath);
        await db
          .update(assets)
          .set({
            cachedThumbnailPath: null,
            thumbnailCachedAt: null,
            thumbnailCacheVersion: null,
          })
          .where(eq(assets.id, asset.id));
        clearedCount++;
      } catch (error) {
        console.error(`Error clearing thumbnail for asset ${asset.id}:`, error);
      }
    }
  }

  return clearedCount;
}

/**
 * Gets cache statistics
 */
export async function getThumbnailCacheStats(): Promise<{
  totalCached: number;
  cacheSize: number;
  oldestCache: Date | null;
  newestCache: Date | null;
}> {
  const cachedAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.isGoogleDrive, true));

  const withCache = cachedAssets.filter(
    (a) => a.cachedThumbnailPath && a.thumbnailCachedAt
  );

  let totalSize = 0;
  for (const asset of withCache) {
    if (asset.cachedThumbnailPath) {
      try {
        const stats = await fs.stat(asset.cachedThumbnailPath);
        totalSize += stats.size;
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  const cacheDates = withCache
    .map((a) => a.thumbnailCachedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    totalCached: withCache.length,
    cacheSize: totalSize,
    oldestCache: cacheDates[0] || null,
    newestCache: cacheDates[cacheDates.length - 1] || null,
  };
}
