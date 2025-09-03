import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { promisify } from "util";

const unlinkAsync = promisify(fs.unlink);
const mkdtempAsync = promisify(fs.mkdtemp);

export interface ConvertedFile {
  format: string;
  data: Buffer;
  mimeType: string;
}

/**
 * Converts an image file to multiple formats
 * @param fileBuffer - The original file buffer
 * @param originalFormat - The original file format (e.g., 'png', 'jpg', 'svg')
 * @returns Promise with an array of converted files in different formats
 */
export async function convertToAllFormats(
  fileBuffer: Buffer,
  originalFormat: string,
  assetId?: number
): Promise<ConvertedFile[]> {
  const convertedFiles: ConvertedFile[] = [];
  const tempDir = await mkdtempAsync(
    path.join(os.tmpdir(), "logo-conversion-")
  );

  console.log(`Starting conversion process for asset ID ${assetId}:`);
  console.log(`- Original format: ${originalFormat}`);
  console.log(`- Buffer size: ${fileBuffer.length} bytes`);
  console.log(`- First 50 bytes: ${fileBuffer.slice(0, 50).toString("hex")}`);

  try {
    const isVector = ["svg", "ai", "eps", "pdf"].includes(
      originalFormat.toLowerCase()
    );

    if (isVector) {
      // Vector file conversions - can generate all formats
      console.log(`Handling vector file conversion from: ${originalFormat}`);
      await handleVectorFile(
        fileBuffer,
        originalFormat,
        convertedFiles,
        tempDir
      );
    } else {
      // Raster file conversions - can only generate raster formats
      console.log(`Handling raster file conversion from: ${originalFormat}`);
      await handleRasterFile(fileBuffer, originalFormat, convertedFiles);
    }

    // CRITICAL FIX: Add original file to the list if it's not empty
    if (fileBuffer && fileBuffer.length > 0) {
      // Make sure we're adding the real file data - check it's not empty
      if (fileBuffer.length < 100) {
        console.error(
          `WARNING: Original file buffer suspiciously small (${fileBuffer.length} bytes)`
        );
      } else {
        console.log(
          `Adding original file format: ${originalFormat} (size: ${fileBuffer.length} bytes)`
        );
        convertedFiles.push({
          format: originalFormat,
          data: fileBuffer,
          mimeType: getMimeType(originalFormat),
        });
      }
    } else {
      console.error(
        `ERROR: Empty or invalid original file buffer for format ${originalFormat}`
      );
    }

    console.log(
      `Conversion complete. Generated ${convertedFiles.length} formats.`
    );

    return convertedFiles;
  } finally {
    // Clean up temp directory
    try {
      for (const file of fs.readdirSync(tempDir)) {
        await unlinkAsync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    } catch (err: unknown) {
      console.error("Error cleaning up temp directory:", err);
    }
  }
}

/**
 * Handles conversion of raster image files (PNG/JPG)
 */
async function handleRasterFile(
  fileBuffer: Buffer,
  originalFormat: string,
  convertedFiles: ConvertedFile[]
) {
  const sharpImage = sharp(fileBuffer);

  // Convert to PNG if original is not PNG
  if (originalFormat.toLowerCase() !== "png") {
    const pngBuffer = await sharpImage.png().toBuffer();
    convertedFiles.push({
      format: "png",
      data: pngBuffer,
      mimeType: "image/png",
    });
  }

  // Convert to JPG if original is not JPG
  if (
    originalFormat.toLowerCase() !== "jpg" &&
    originalFormat.toLowerCase() !== "jpeg"
  ) {
    // For JPG conversion, use white background for transparent PNGs
    const jpgBuffer = await sharpImage
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // Add white background
      .jpeg()
      .toBuffer();

    convertedFiles.push({
      format: "jpg",
      data: jpgBuffer,
      mimeType: "image/jpeg",
    });
  }

  // For PDF conversion from raster, we create a PDF with the image embedded
  if (originalFormat.toLowerCase() !== "pdf") {
    try {
      // First convert to PNG if it's not already
      const pngBuffer =
        originalFormat.toLowerCase() === "png"
          ? fileBuffer
          : await sharpImage.png().toBuffer();

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Embed the PNG image
      const pngImage = await pdfDoc.embedPng(pngBuffer);

      // Get dimensions to maintain aspect ratio
      const { width, height } = pngImage;
      const aspectRatio = width / height;

      // Add a page with appropriate dimensions
      const pageWidth = 500;
      const pageHeight = pageWidth / aspectRatio;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw the image on the page, fitting to the page dimensions
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Set metadata
      pdfDoc.setTitle("Converted Image");
      pdfDoc.setAuthor("Ferdinand Brand Manager");

      // Save the PDF
      const pdfBytes = await pdfDoc.save();

      convertedFiles.push({
        format: "pdf",
        data: Buffer.from(pdfBytes),
        mimeType: "application/pdf",
      });
    } catch (error: unknown) {
      console.error("Error creating PDF:", error);
      // Create a simple placeholder PDF if embedding fails
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([500, 500]);
      const pdfBytes = await pdfDoc.save();

      convertedFiles.push({
        format: "pdf",
        data: Buffer.from(pdfBytes),
        mimeType: "application/pdf",
      });
    }
  }
}

/**
 * Handles conversion of vector files (SVG/AI/PDF)
 */
async function handleVectorFile(
  fileBuffer: Buffer,
  originalFormat: string,
  convertedFiles: ConvertedFile[],
  tempDir: string
) {
  // For SVG conversions
  if (originalFormat.toLowerCase() === "svg") {
    // Convert SVG to PNG and JPG using sharp
    const sharpImage = sharp(fileBuffer);

    // To PNG
    const pngBuffer = await sharpImage.png().toBuffer();
    convertedFiles.push({
      format: "png",
      data: pngBuffer,
      mimeType: "image/png",
    });

    // To JPG - use white background for transparent areas
    const jpgBuffer = await sharpImage
      .flatten({ background: { r: 255, g: 255, b: 255 } }) // Add white background
      .jpeg()
      .toBuffer();

    convertedFiles.push({
      format: "jpg",
      data: jpgBuffer,
      mimeType: "image/jpeg",
    });

    // To PDF with embedded image
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Embed the PNG image (we already converted above)
      const pngImage = await pdfDoc.embedPng(pngBuffer);

      // Get dimensions to maintain aspect ratio
      const { width, height } = pngImage;
      const aspectRatio = width / height;

      // Add a page with appropriate dimensions
      const pageWidth = 500;
      const pageHeight = pageWidth / aspectRatio;
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw the image on the page, fitting to the page dimensions
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Set metadata
      pdfDoc.setTitle("Converted SVG Image");
      pdfDoc.setAuthor("Ferdinand Brand Manager");

      // Save the PDF
      const pdfBytes = await pdfDoc.save();

      convertedFiles.push({
        format: "pdf",
        data: Buffer.from(pdfBytes),
        mimeType: "application/pdf",
      });
    } catch (error: unknown) {
      console.error("Error creating PDF from SVG:", error);
      // Create a simple PDF if embedding fails
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([500, 500]);
      const pdfBytes = await pdfDoc.save();

      convertedFiles.push({
        format: "pdf",
        data: Buffer.from(pdfBytes),
        mimeType: "application/pdf",
      });
    }

    // AI format generation removed - no longer included in logo packages
  }

  // For PDF conversions
  if (originalFormat.toLowerCase() === "pdf") {
    // Convert PDF to images using sharp (this is simplified, real PDF conversion needs more handling)
    const tempPngPath = path.join(tempDir, "temp.png");

    try {
      // Extract the first page as PNG
      await sharp(fileBuffer, { pages: 1 }).png().toFile(tempPngPath);

      // Read the PNG file and convert to other formats
      const pngBuffer = fs.readFileSync(tempPngPath);

      // Add PNG
      convertedFiles.push({
        format: "png",
        data: pngBuffer,
        mimeType: "image/png",
      });

      // Convert to JPG with white background
      const jpgBuffer = await sharp(pngBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // Add white background
        .jpeg()
        .toBuffer();

      convertedFiles.push({
        format: "jpg",
        data: jpgBuffer,
        mimeType: "image/jpeg",
      });

      // For SVG, we'd need to trace the bitmap (simplified here)
      const svgPlaceholder = Buffer.from(
        `<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg"></svg>`
      );
      convertedFiles.push({
        format: "svg",
        data: svgPlaceholder,
        mimeType: "image/svg+xml",
      });
    } catch (error: unknown) {
      console.error("Error converting PDF:", error);
      // Fallback to placeholder files
      const placeholderBuffer = Buffer.from("Placeholder");
      ["png", "jpg", "svg"].forEach((format) => {
        if (format !== originalFormat.toLowerCase()) {
          convertedFiles.push({
            format,
            data: placeholderBuffer,
            mimeType: getMimeType(format),
          });
        }
      });
    }
  }

  // For AI conversions (simplified as we can't really handle AI files directly)
  if (originalFormat.toLowerCase() === "ai") {
    // For AI files, we'll just create placeholder files
    const placeholderBuffer = Buffer.from("Placeholder");
    ["png", "jpg", "svg", "pdf"].forEach((format) => {
      if (format !== originalFormat.toLowerCase()) {
        convertedFiles.push({
          format,
          data: placeholderBuffer,
          mimeType: getMimeType(format),
        });
      }
    });
  }
}

/**
 * Helper to get MIME type from file extension
 */
function getMimeType(format: string): string {
  switch (format.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "ai":
      return "application/postscript";
    default:
      return "application/octet-stream";
  }
}
