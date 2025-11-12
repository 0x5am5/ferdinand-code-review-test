import sharp from "sharp";
import {
  deleteFile,
  downloadFile,
  fileExists,
  uploadFile,
} from "../storage/index";

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
  // Note: image/svg+xml is NOT included - SVGs are served directly without thumbnail conversion
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
 * Get the storage path for a thumbnail (works for both local and R2)
 * Note: SVGs are served directly and do not use thumbnails
 */
export function getThumbnailStoragePath(
  assetId: number,
  size: ThumbnailSize
): string {
  return `thumbnails/${size}/${assetId}.jpg`;
}

/**
 * Check if a thumbnail exists in storage
 */
export async function thumbnailExists(
  assetId: number,
  size: ThumbnailSize
): Promise<boolean> {
  const storagePath = getThumbnailStoragePath(assetId, size);
  return await fileExists(storagePath);
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
 * Generate a thumbnail for an image file and upload to storage
 * Note: SVGs are served directly and do not use this function
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

  const storagePath = getThumbnailStoragePath(assetId, size);
  const dimensions = THUMBNAIL_SIZES[size];

  try {
    let thumbnailBuffer: Buffer;

    // Handle PDF files differently
    if (SUPPORTED_PDF_TYPES.includes(mimeType.toLowerCase())) {
      thumbnailBuffer = await generatePdfThumbnail(sourcePath, dimensions);
    } else {
      // Handle raster image files with Sharp
      thumbnailBuffer = await sharp(sourcePath)
        .resize(dimensions.width, dimensions.height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    }

    // Upload thumbnail to storage (R2 or local)
    const uploadResult = await uploadFile(storagePath, thumbnailBuffer);

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || "Failed to upload thumbnail");
    }

    return storagePath;
  } catch (error) {
    console.error("Error generating thumbnail:", error);
    throw new Error("Failed to generate thumbnail");
  }
}

/**
 * Get or generate a thumbnail, returns the storage path
 * Note: SVGs are served directly and do not use this function
 */
export async function getOrGenerateThumbnail(
  sourcePath: string,
  assetId: number,
  size: ThumbnailSize,
  mimeType: string
): Promise<string> {
  const storagePath = getThumbnailStoragePath(assetId, size);

  // Check if thumbnail already exists in storage
  if (await fileExists(storagePath)) {
    return storagePath;
  }

  // Generate new thumbnail and upload to storage
  return await generateThumbnail(sourcePath, assetId, size, mimeType);
}

/**
 * Download a thumbnail from storage
 * Note: SVGs are served directly and do not use thumbnails
 */
export async function downloadThumbnail(
  assetId: number,
  size: ThumbnailSize
): Promise<Buffer> {
  const storagePath = getThumbnailStoragePath(assetId, size);
  const result = await downloadFile(storagePath);

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to download thumbnail");
  }

  return result.data;
}

/**
 * Delete all thumbnails for an asset from storage
 * Note: SVGs are served directly and do not have thumbnails to delete
 */
export async function deleteThumbnails(assetId: number): Promise<void> {
  const sizes: ThumbnailSize[] = ["small", "medium", "large"];

  await Promise.all(
    sizes.map(async (size) => {
      const storagePath = getThumbnailStoragePath(assetId, size);
      try {
        await deleteFile(storagePath);
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
