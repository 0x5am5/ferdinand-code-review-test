import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { db } from "../server/db";
import { assets } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  fetchAndCacheThumbnail,
  getCachedThumbnailPath,
  invalidateThumbnailCache,
  clearExpiredThumbnails,
  getThumbnailCacheStats,
  type ThumbnailSize,
} from "../server/services/drive-thumbnail-cache";

// Mock Drive client for testing
const mockDriveClient = {
  files: {
    get: async ({ fileId, fields }: { fileId: string; fields: string }) => {
      return {
        data: {
          thumbnailLink: `https://example.com/thumbnail/${fileId}=s220`,
        },
      };
    },
  },
} as any;

// Mock fetch for testing
const originalFetch = global.fetch;

describe("Drive Thumbnail Cache", () => {
  const testAssetId = 999999;
  const testDriveFileId = "test-drive-file-123";
  const testThumbnailUrl = "https://example.com/thumbnail/test=s220";
  const testModifiedDate = new Date("2025-01-01T00:00:00Z");

  // Helper function to access URL field
  const getUrl = (url: string | URL | Request): string => {
    if (typeof url === 'string') return url;
    return url instanceof URL ? url.toString() : new URL(url.url || '').toString();
  };

  beforeAll(async () => {
    // Mock global fetch
    global.fetch = async (url: string | URL | Request) => {
      // Return mock image data
      const mockImageBuffer = Buffer.from("fake-image-data");
      return {
        ok: true,
        statusText: "OK",
        arrayBuffer: async () => mockImageBuffer.buffer,
      } as Response;
    };

    // Create test asset
    await db.insert(assets).values({
      id: testAssetId,
      clientId: 1,
      uploadedBy: 1,
      fileName: "test-file.jpg",
      originalFileName: "test-file.jpg",
      fileType: "image/jpeg",
      fileSize: 1024,
      storagePath: "/test/path",
      visibility: "shared",
      isGoogleDrive: true,
      driveFileId: testDriveFileId,
      driveWebLink: "https://drive.google.com/file/123",
      driveLastModified: testModifiedDate,
      driveThumbnailUrl: testThumbnailUrl,
    });
  });

  afterAll(async () => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Clean up test asset
    await db.delete(assets).where(eq(assets.id, testAssetId));

    // Clean up any test thumbnail files
    try {
      const testDir = "uploads/drive-thumbnails";
      const files = await fs.readdir(testDir);
      for (const file of files) {
        if (file.includes("test-drive-file-123")) {
          await fs.unlink(path.join(testDir, file));
        }
      }
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  it("should fetch and cache a thumbnail", async () => {
    const result = await fetchAndCacheThumbnail(
      mockDriveClient,
      testAssetId,
      testDriveFileId,
      testModifiedDate,
      testThumbnailUrl,
      "medium" as ThumbnailSize
    );

    expect(result).toBeDefined();
    expect(result.path).toBeTruthy();
    expect(result.url).toBe(`/api/assets/${testAssetId}/thumbnail`);
    expect(result.cached).toBe(false); // First fetch, not from cache

    // Verify file was created
    const fileExists = await fs
      .access(result.path)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    // Verify database was updated
    const [asset] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, testAssetId));

    expect(asset.cachedThumbnailPath).toBeTruthy();
    expect(asset.thumbnailCachedAt).toBeTruthy();
    expect(asset.thumbnailCacheVersion).toBeTruthy();
  });

  it("should return cached thumbnail on second fetch", async () => {
    // First fetch
    await fetchAndCacheThumbnail(
      mockDriveClient,
      testAssetId,
      testDriveFileId,
      testModifiedDate,
      testThumbnailUrl,
      "medium" as ThumbnailSize
    );

    // Second fetch should use cache
    const result = await fetchAndCacheThumbnail(
      mockDriveClient,
      testAssetId,
      testDriveFileId,
      testModifiedDate,
      testThumbnailUrl,
      "medium" as ThumbnailSize
    );

    expect(result.cached).toBe(true);
  });

  it("should get cached thumbnail path", async () => {
    const path = await getCachedThumbnailPath(testAssetId);
    expect(path).toBeTruthy();
    expect(path).toContain("drive-thumbnails");
  });

  it("should invalidate cached thumbnail", async () => {
    // First, ensure there's a cached thumbnail
    await fetchAndCacheThumbnail(
      mockDriveClient,
      testAssetId,
      testDriveFileId,
      testModifiedDate,
      testThumbnailUrl,
      "medium" as ThumbnailSize
    );

    // Invalidate the cache
    await invalidateThumbnailCache(testAssetId);

    // Verify database fields are cleared
    const [asset] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, testAssetId));

    expect(asset.cachedThumbnailPath).toBeNull();
    expect(asset.thumbnailCachedAt).toBeNull();
    expect(asset.thumbnailCacheVersion).toBeNull();

    // Verify cached thumbnail path returns null
    const path = await getCachedThumbnailPath(testAssetId);
    expect(path).toBeNull();
  });

  it("should re-fetch when cache version changes", async () => {
    // First fetch with original date
    await fetchAndCacheThumbnail(
      mockDriveClient,
      testAssetId,
      testDriveFileId,
      testModifiedDate,
      testThumbnailUrl,
      "medium" as ThumbnailSize
    );

    // Update with new modified date (simulating file update in Drive)
    const newModifiedDate = new Date("2025-01-15T00:00:00Z");
    const result = await fetchAndCacheThumbnail(
      mockDriveClient,
      testAssetId,
      testDriveFileId,
      newModifiedDate,
      testThumbnailUrl,
      "medium" as ThumbnailSize
    );

    // Should re-fetch because cache version changed
    expect(result.cached).toBe(false);
  });

  it("should get cache statistics", async () => {
    const stats = await getThumbnailCacheStats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalCached).toBe("number");
    expect(typeof stats.cacheSize).toBe("number");
    expect(stats.totalCached).toBeGreaterThanOrEqual(0);
  });

  it("should clear expired thumbnails", async () => {
    // This test would require manipulating the cache date
    // For now, just verify the function runs without error
    const cleared = await clearExpiredThumbnails();
    expect(typeof cleared).toBe("number");
    expect(cleared).toBeGreaterThanOrEqual(0);
  });

  it("should handle different thumbnail sizes", async () => {
    const sizes: ThumbnailSize[] = ["small", "medium", "large"];

    for (const size of sizes) {
      const result = await fetchAndCacheThumbnail(
        mockDriveClient,
        testAssetId,
        testDriveFileId,
        testModifiedDate,
        testThumbnailUrl,
        size
      );

      expect(result).toBeDefined();
      expect(result.path).toContain(size);
    }
  });

  it("should handle missing thumbnail gracefully", async () => {
    const nonExistentAssetId = 888888;

    await expect(
      fetchAndCacheThumbnail(
        mockDriveClient,
        nonExistentAssetId,
        "non-existent-file",
        testModifiedDate,
        testThumbnailUrl,
        "medium" as ThumbnailSize
      )
    ).rejects.toThrow("Asset not found");
  });
});
