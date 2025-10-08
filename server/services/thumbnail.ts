import fs, { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export type ThumbnailSize = "small" | "medium" | "large";

export interface ThumbnailDimensions {
  width: number;
  height: number;
}

const THUMBNAIL_SIZES: Record<ThumbnailSize, ThumbnailDimensions> = {
  small: { width: 150, height: 150 },
  medium: { width: 400, height: 400 },
  large: { width: 800, height: 800 },
};

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

const SUPPORTED_PDF_TYPES = ["application/pdf"];

/**
 * Check if a file type can have a thumbnail generated
 */
export function canGenerateThumbnail(mimeType: string): boolean {
  return (
    SUPPORTED_IMAGE_TYPES.includes(mimeType.toLowerCase()) ||
    SUPPORTED_PDF_TYPES.includes(mimeType.toLowerCase())
  );
}

/**
 * Get the cache path for a thumbnail
 */
export function getThumbnailCachePath(
  assetId: number,
  size: ThumbnailSize
): string {
  const cacheDir = process.env.THUMBNAIL_CACHE_DIR || "uploads/thumbnails";
  return path.join(cacheDir, size, `${assetId}.jpg`);
}

/**
 * Ensure the thumbnail cache directory exists
 */
async function ensureCacheDirectory(cachePath: string): Promise<void> {
  const dir = path.dirname(cachePath);
  await mkdir(dir, { recursive: true });
}

/**
 * Check if a thumbnail exists in cache
 */
export async function thumbnailExists(
  assetId: number,
  size: ThumbnailSize
): Promise<boolean> {
  const cachePath = getThumbnailCachePath(assetId, size);
  try {
    await fs.access(cachePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a thumbnail for a PDF file (first page)
 */
async function generatePdfThumbnail(
  sourcePath: string,
  dimensions: ThumbnailDimensions
): Promise<Buffer> {
  try {
    const { pdf } = await import("pdf-to-img");

    // Convert first page of PDF to image
    const document = await pdf(sourcePath, { scale: 3.0 });

    // Get the first page
    let firstPageBuffer: Buffer | null = null;
    for await (const page of document) {
      firstPageBuffer = page;
      break; // Only get the first page
    }

    if (!firstPageBuffer) {
      throw new Error("Failed to extract first page from PDF");
    }

    // Use Sharp to convert to JPEG and resize to exact dimensions
    return await sharp(firstPageBuffer)
      .resize(dimensions.width, dimensions.height, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
  } catch (error) {
    console.error("Error generating PDF thumbnail:", error);
    throw new Error("Failed to generate PDF thumbnail");
  }
}

/**
 * Generate a thumbnail for an image file
 */
export async function generateThumbnail(
  sourcePath: string,
  assetId: number,
  size: ThumbnailSize,
  mimeType: string
): Promise<string> {
  if (!canGenerateThumbnail(mimeType)) {
    throw new Error(`Cannot generate thumbnail for type: ${mimeType}`);
  }

  const cachePath = getThumbnailCachePath(assetId, size);
  await ensureCacheDirectory(cachePath);

  const dimensions = THUMBNAIL_SIZES[size];

  try {
    // Handle PDF files differently
    if (SUPPORTED_PDF_TYPES.includes(mimeType.toLowerCase())) {
      const thumbnailBuffer = await generatePdfThumbnail(
        sourcePath,
        dimensions
      );
      await fs.writeFile(cachePath, thumbnailBuffer);
      return cachePath;
    }

    // Handle image files with Sharp
    await sharp(sourcePath)
      .resize(dimensions.width, dimensions.height, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, progressive: true })
      .toFile(cachePath);

    return cachePath;
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    throw new Error("Failed to generate thumbnail");
  }
}

/**
 * Get or generate a thumbnail
 */
export async function getOrGenerateThumbnail(
  sourcePath: string,
  assetId: number,
  size: ThumbnailSize,
  mimeType: string
): Promise<string> {
  const cachePath = getThumbnailCachePath(assetId, size);

  // Check if thumbnail already exists
  if (await thumbnailExists(assetId, size)) {
    return cachePath;
  }

  // Generate new thumbnail
  return await generateThumbnail(sourcePath, assetId, size, mimeType);
}

/**
 * Delete all thumbnails for an asset
 */
export async function deleteThumbnails(assetId: number): Promise<void> {
  const sizes: ThumbnailSize[] = ["small", "medium", "large"];

  await Promise.all(
    sizes.map(async (size) => {
      const cachePath = getThumbnailCachePath(assetId, size);
      try {
        await fs.unlink(cachePath);
      } catch {
        // Ignore if file doesn't exist
      }
    })
  );
}

/**
 * Get file type icon name based on MIME type
 */
export function getFileTypeIcon(mimeType: string): string {
  const type = mimeType.toLowerCase();

  // Images
  if (type.startsWith("image/")) return "image";

  // Documents
  if (type.includes("pdf")) return "file-text";
  if (
    type.includes("document") ||
    type.includes("word") ||
    type.includes("text")
  )
    return "file-text";

  // Spreadsheets
  if (type.includes("spreadsheet") || type.includes("excel")) return "table";

  // Presentations
  if (type.includes("presentation") || type.includes("powerpoint"))
    return "presentation";

  // Videos
  if (type.startsWith("video/")) return "video";

  // Audio
  if (type.startsWith("audio/")) return "music";

  // Archives
  if (type.includes("zip") || type.includes("rar") || type.includes("tar"))
    return "archive";

  // Default
  return "file";
}
