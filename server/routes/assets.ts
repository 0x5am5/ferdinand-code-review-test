import type { Express, Response } from "express";
import { storage } from "../storage";
import { 
  insertColorAssetSchema, 
  insertFontAssetSchema, 
  insertConvertedAssetSchema, 
  brandAssets,
  convertedAssets 
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import multer from "multer";
import { validateClientId } from "server/middlewares/vaildateClientId";
import { RequestWithClientId } from "server/routes";
import { convertToAllFormats } from "../utils/file-converter";

const upload = multer({ preservePath: true });

export function registerAssetRoutes(app: Express) {
  // Google Fonts API endpoint
  app.get("/api/google-fonts", async (req, res: Response) => {
    try {
      console.log("Google Fonts API endpoint called");
      
      // Use Google Fonts API key if available, otherwise return empty response
      const apiKey = process.env.GOOGLE_FONTS_API_KEY;
      
      if (!apiKey) {
        console.log("No Google Fonts API key found, returning empty response");
        return res.json({ kind: "webfonts#webfontList", items: [] });
      }

      console.log("Fetching from Google Fonts API...");
      const response = await fetch(
        `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`
      );

      if (!response.ok) {
        console.error("Google Fonts API error:", response.status, response.statusText);
        return res.json({ kind: "webfonts#webfontList", items: [] });
      }

      const data = await response.json();
      console.log(`Successfully fetched ${data.items?.length || 0} fonts from Google Fonts API`);
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching Google Fonts:", error);
      res.json({ kind: "webfonts#webfontList", items: [] });
    }
  });
  // Get all assets
  app.get("/api/assets", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const allAssets = await db.select().from(brandAssets);
      res.json(allAssets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ message: "Error fetching assets" });
    }
  });

  // Get single asset
  app.get("/api/assets/:id", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const [asset] = await db.select()
        .from(brandAssets)
        .where(eq(brandAssets.id, parseInt(req.params.id)));

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      res.json(asset);
    } catch (error) {
      console.error("Error fetching asset:", error);
      res.status(500).json({ message: "Error fetching asset" });
    }
  });

  // Handle both file uploads and other assets
  app.post(
    "/api/clients/:clientId/assets",
    upload.any(),
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId!;
        const { category } = req.body;

        // Font asset creation
        if (category === "font") {
          const { name, subcategory, data } = req.body;
          
          // Validate required fields
          if (!name || !name.trim()) {
            return res.status(400).json({ message: "Font name is required" });
          }

          if (!clientId) {
            console.error("Client ID missing for font creation");
            return res.status(400).json({ message: "Client ID is required for font creation" });
          }
          
          // Handle Google Fonts (no file upload needed)
          if (subcategory === "google") {
            console.log("Creating Google Font asset:", name, "for client:", clientId);
            
            let fontData;
            try {
              fontData = typeof data === 'string' ? JSON.parse(data) : data;
            } catch (error) {
              console.error("Error parsing font data:", error);
              return res.status(400).json({ message: "Invalid font data format" });
            }

            // Validate font data structure
            if (!fontData || !fontData.source) {
              console.error("Invalid font data structure:", fontData);
              return res.status(400).json({ message: "Invalid font data structure" });
            }

            // Ensure weights is an array
            if (!fontData.weights || !Array.isArray(fontData.weights)) {
              fontData.weights = ["400"];
            }

            // Ensure styles is an array
            if (!fontData.styles || !Array.isArray(fontData.styles)) {
              fontData.styles = ["normal"];
            }
            
            const fontAsset = {
              clientId,
              name: name.trim(),
              category: "font" as const,
              data: fontData,
              fileData: null, // Google fonts don't need file storage
              mimeType: null,
            };

            console.log("Creating Google Font asset with data:", JSON.stringify(fontAsset, null, 2));
            
            try {
              const asset = await storage.createAsset(fontAsset);
              console.log("Google Font asset created successfully:", asset.id);
              return res.status(201).json(asset);
            } catch (dbError) {
              console.error("Database error creating Google Font:", dbError);
              return res.status(500).json({ 
                message: "Failed to create font asset", 
                error: dbError.message 
              });
            }
          }

          // Handle uploaded font files (Adobe fonts, custom uploads, etc.)
          const { source, weights, styles } = req.body;
          const parsedWeights = JSON.parse(weights || '["400"]');
          const parsedStyles = JSON.parse(styles || '["normal"]');
          const files = req.files as Express.Multer.File[];

          // Only require files for non-Google font uploads
          if (!files || files.length === 0) {
            return res.status(400).json({ message: "No font files uploaded for custom font" });
          }

          // Create the font asset data for uploaded fonts
          const fontAsset = {
            clientId,
            name,
            category: "font" as const,
            fileData: files[0].buffer.toString("base64"),
            mimeType: files[0].mimetype,
            data: {
              source,
              weights: parsedWeights,
              styles: parsedStyles,
              sourceData: {
                files: files.map((file) => ({
                  fileName: file.originalname,
                  fileData: file.buffer.toString("base64"),
                  format: file.originalname.split(".").pop()?.toLowerCase() as
                    | "woff"
                    | "woff2"
                    | "otf"
                    | "ttf"
                    | "eot",
                  weight: "400",
                  style: "normal",
                })),
              },
            },
          };

          const parsed = insertFontAssetSchema.safeParse(fontAsset);

          if (!parsed.success) {
            return res.status(400).json({
              message: "Invalid font data",
              errors: parsed.error.errors,
            });
          }

          const asset = await storage.createAsset(parsed.data);
          return res.status(201).json(asset);
        }

        if (category === "color") {
          // Handle color asset
          const colorAsset = {
            ...req.body,
            clientId,
            category: "color" as const,
          };

          const parsed = insertColorAssetSchema.safeParse(colorAsset);

          if (!parsed.success) {
            return res.status(400).json({
              message: "Invalid color data",
              errors: parsed.error.errors,
            });
          }

          const asset = await storage.createAsset(parsed.data);
          return res.status(201).json(asset);
        }

        // Default to logo asset (only for non-font assets)
        if (category !== "font") {
          const { name, type, isDarkVariant } = req.body;
          const files = req.files as Express.Multer.File[];

          if (!files || files.length === 0) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const file = files[0];
          const fileExtension = file.originalname.split(".").pop()?.toLowerCase();

          // Create proper data object instead of JSON string
          const logoData = {
            type,
            format: fileExtension || "png",
            fileName: file.originalname,
          };

          const logoAsset = {
            clientId,
            name,
            category: "logo" as const,
            data: logoData,
            fileData: file.buffer.toString("base64"),
            mimeType: file.mimetype,
          };

          // Create the main asset
          const asset = await storage.createAsset(logoAsset);

          try {
            // Convert the file to multiple formats
            const fileBuffer = file.buffer;
            const originalFormat = fileExtension || "png";
            const isDark = isDarkVariant === "true" || isDarkVariant === true;

            console.log(`Converting ${originalFormat} file to multiple formats. Dark variant: ${isDark}`);
            const convertedFiles = await convertToAllFormats(fileBuffer, originalFormat);

            // Store all converted versions in the database
            for (const convertedFile of convertedFiles) {
              // Skip the original format since we already stored it
              if (convertedFile.format === originalFormat) continue;

              const convertedAssetData = {
                originalAssetId: asset.id,
                format: convertedFile.format,
                fileData: convertedFile.data.toString("base64"),
                mimeType: convertedFile.mimeType,
                isDarkVariant: isDark
              };

              await storage.createConvertedAsset(convertedAssetData);
              console.log(`Created converted asset: ${convertedFile.format} (Dark: ${isDark})`);
            }
          } catch (conversionError) {
            console.error("Error converting asset to other formats:", conversionError);
            // We'll continue even if conversion fails since the original asset was saved
          }

          return res.status(201).json(asset);
        } else {
          // Font category but not Google - should not happen with current UI
          return res.status(400).json({ message: "Unsupported font type" });
        }
      } catch (error) {
        console.error("Error creating asset:", error);
        res.status(500).json({ message: "Error creating asset" });
      }
    },
  );

  // Update asset endpoint
  app.patch(
    "/api/clients/:clientId/assets/:assetId",
    upload.any(),
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId!;
        const assetId = parseInt(req.params.assetId);
        // Get variant from query params with debugging
        const variant = req.query.variant as string;
        console.log(`PATCH request received - assetId: ${assetId}, variant: ${variant}, isDarkVariant: ${req.body.isDarkVariant}`);

        // Force isDarkVariant to true if variant=dark is in the URL
        if (variant === 'dark') {
          req.body.isDarkVariant = "true";
          console.log("Setting isDarkVariant flag to true based on URL parameter");
        }

        const asset = await storage.getAsset(assetId);

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        if (asset.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Not authorized to update this asset" });
        }

        let parsed;
        if (req.body.category === "font") {
          parsed = insertFontAssetSchema.safeParse({
            ...req.body,
            clientId,
          });
        } else if (req.body.category === "color") {
          parsed = insertColorAssetSchema.safeParse({
            ...req.body,
            clientId,
          });
        } else if (req.body.category === "logo" || (req.body.data && JSON.parse(req.body.data).type)) {
          const files = req.files as Express.Multer.File[];
          const isDarkVariant = req.body.isDarkVariant === "true" || req.body.isDarkVariant === true;

          if (!files || files.length === 0) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const file = files[0];
          const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

          // For backward compatibility, we'll update both the old-style dark variant
          // and also create converted assets for the new system
          const existingData = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;

          if (isDarkVariant) {
            parsed = { success: true, data: {
              ...asset,
              category: "logo",
              // We update the existing data instead of replacing it entirely
              data: {
                ...existingData,
                hasDarkVariant: true,
                darkVariantFileData: file.buffer.toString('base64'),
                darkVariantMimeType: file.mimetype,
                darkVariantFormat: fileExtension || 'png'
              }
            }};

            // Also store in the new converted assets system
            try {
              const fileBuffer = file.buffer;
              const originalFormat = fileExtension || "png";

              console.log(`Converting ${originalFormat} file to multiple formats (dark variant)`);
              const convertedFiles = await convertToAllFormats(fileBuffer, originalFormat);

              // Delete any existing dark variant converted assets first
              try {
                // Use proper SQL to delete existing dark variant converted assets
                await db.execute(sql`
                  DELETE FROM "converted_assets"
                  WHERE "original_asset_id" = ${asset.id} AND "is_dark_variant" = true
                `);
                console.log(`Deleted existing dark variant converted assets for asset ID ${asset.id}`);
              } catch (deleteError) {
                console.error("Error deleting existing dark variant converted assets:", deleteError);
              }

              // Store all converted versions in the database
              for (const convertedFile of convertedFiles) {
                // First check if this format already exists
                const existingConverted = await storage.getConvertedAsset(
                  asset.id, 
                  convertedFile.format, 
                  true // isDarkVariant
                );

                if (existingConverted) {
                  // Delete the existing one using proper Drizzle ORM syntax
                  await db.delete(convertedAssets)
                    .where(eq(convertedAssets.id, existingConverted.id));
                }

                // Create the new converted asset
                const convertedAssetData = {
                  originalAssetId: asset.id,
                  format: convertedFile.format,
                  fileData: convertedFile.data.toString("base64"),
                  mimeType: convertedFile.mimeType,
                  isDarkVariant: true
                };

                await storage.createConvertedAsset(convertedAssetData);
                console.log(`Updated converted asset: ${convertedFile.format} (Dark)`);
              }
            } catch (conversionError) {
              console.error("Error converting dark variant to other formats:", conversionError);
              // We'll continue even if conversion fails since the original update will succeed
            }
          } else {
            // Regular logo update (light variant)
            parsed = { success: true, data: {
              ...asset,
              category: "logo",
              fileData: file.buffer.toString('base64'),
              mimeType: file.mimetype,
              data: {
                ...existingData,
                format: fileExtension || 'png',
                fileName: file.originalname
              }
            }};

            // Also update converted assets
            try {
              const fileBuffer = file.buffer;
              const originalFormat = fileExtension || "png";

              console.log(`Converting ${originalFormat} file to multiple formats (light variant update)`);
              const convertedFiles = await convertToAllFormats(fileBuffer, originalFormat);

              // Delete any existing light variant converted assets
              try {
                // Use proper Drizzle ORM query for deleting light variants
                // We need to use raw SQL because Drizzle doesn't support complex where clauses
                // Use SQL to delete light variant converted assets
                await db.execute(sql`
                  DELETE FROM "converted_assets"
                  WHERE "original_asset_id" = ${asset.id} AND "is_dark_variant" = false
                `);
                console.log(`Deleted light variant converted assets for asset ID ${asset.id}`);
              } catch (deleteError) {
                console.error("Error deleting existing light variant converted assets:", deleteError);
              }

              // Store all converted versions in the database
              for (const convertedFile of convertedFiles) {
                // Skip the original format since we already stored it
                if (convertedFile.format === originalFormat) continue;

                const convertedAssetData = {
                  originalAssetId: asset.id,
                  format: convertedFile.format,
                  fileData: convertedFile.data.toString("base64"),
                  mimeType: convertedFile.mimeType,
                  isDarkVariant: false
                };

                await storage.createConvertedAsset(convertedAssetData);
                console.log(`Updated converted asset: ${convertedFile.format} (Light)`);
              }
            } catch (conversionError) {
              console.error("Error converting light variant to other formats:", conversionError);
              // We'll continue even if conversion fails since the original update will succeed
            }
          }

        } else {
          return res.status(400).json({ message: "Invalid asset category" });
        }

        if (!parsed.success) {
          return res.status(400).json({
            message: `Invalid ${req.body.category} data`,
            errors: parsed.error.errors,
          });
        }

        const updatedAsset = await storage.updateAsset(assetId, parsed.data);
        res.json(updatedAsset);
      } catch (error) {
        console.error("Error updating asset:", error);
        res.status(500).json({ message: "Error updating asset" });
      }
    },
  );

  // Delete asset endpoint
  app.delete(
    "/api/clients/:clientId/assets/:assetId",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId!;
        const assetId = parseInt(req.params.assetId);
        const variant = req.query.variant as string;

        const asset = await storage.getAsset(assetId);

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        if (asset.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Not authorized to delete this asset" });
        }

        if (variant === 'dark' && asset.category === 'logo') {
          // Remove the dark variant from both the old system and new converted assets
          const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
          delete data.darkVariantFileData;
          delete data.darkVariantMimeType;
          delete data.darkVariantFormat;
          data.hasDarkVariant = false;

          // Update the asset with old system data removed
          await storage.updateAsset(assetId, {
            ...asset,
            data: typeof data === 'string' ? data : JSON.stringify(data)
          });

          // Delete converted assets for dark variant using direct SQL
          try {
            // Use parameterized query for safer SQL execution
            await db.execute(sql`
              DELETE FROM "converted_assets"
              WHERE "original_asset_id" = ${assetId} AND "is_dark_variant" = true
            `);
            console.log(`Deleted dark variant converted assets for asset ID ${assetId}`);
          } catch (error) {
            console.error("Error deleting converted assets for dark variant:", error);
            // We continue since we've already updated the main asset
          }

          return res.status(200).json({ message: "Dark variant deleted successfully" });
        }

        await storage.deleteAsset(assetId);
        res.status(200).json({ message: "Asset deleted successfully" });
      } catch (error) {
        console.error("Error deleting asset:", error);
        res.status(500).json({ message: "Error deleting asset" });
      }
    },
  );

  app.get(
    "/api/clients/:clientId/assets",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId!;
        const assets = await storage.getClientAssets(clientId);
        res.json(assets);
      } catch (error) {
        console.error("Error fetching client assets:", error);
        res.status(500).json({ message: "Error fetching client assets" });
      }
    },
  );

  // Serve asset endpoint
  app.get("/api/assets/:assetId/file", async (req: RequestWithClientId, res: Response) => {
    // This endpoint handles serving asset files with optional format conversion and resizing
    try {
      const assetId = parseInt(req.params.assetId);
      const variant = req.query.variant as string;
      const format = req.query.format as string;
      const sizeParam = req.query.size as string;
      const preserveRatio = req.query.preserveRatio === 'true';
      const preserveVector = req.query.preserveVector === 'true';
      const clientIdParam = req.query.clientId ? parseInt(req.query.clientId as string) : null;

      // Parse size as percentage or exact pixels
      let size: number | undefined;
      if (sizeParam) {
        size = parseFloat(sizeParam);
        if (isNaN(size)) {
          size = undefined;
        }
      }

      console.log(`=== SERVING ASSET REQUEST ===`);
      console.log(`Requested asset ID: ${assetId}, variant: ${variant}, format: ${format}, size: ${size}, preserveRatio: ${preserveRatio}, preserveVector: ${preserveVector}, clientId param: ${clientIdParam}`);

      // CRITICAL FIX: Add query timing for debugging with unique identifier
      const queryLabel = `asset-query-${assetId}-${Date.now()}`;
      console.time(queryLabel);
      const asset = await storage.getAsset(assetId);
      console.timeEnd(queryLabel);

      if (!asset) {
        console.error(`ERROR: Asset with ID ${assetId} not found in database`);
        return res.status(404).json({ message: "Asset not found" });
      }

      // Add detailed logging about the asset being served
      console.log(`Asset details - Name: ${asset.name}, ID: ${asset.id}, Client ID: ${asset.clientId}, Category: ${asset.category}, MimeType: ${asset.mimeType}`);
      console.log(`Request details - Requested ID: ${assetId}, Variant: ${variant}, Format: ${format}, Size: ${size}, Client ID param: ${clientIdParam}`);

      // CRITICAL FIX: Verify we're serving the correct asset
      if (asset.id !== assetId) {
        console.error(`ERROR: Requested asset ID ${assetId} but serving ${asset.id} (${asset.name})`);
        return res.status(500).json({ message: "Asset ID mismatch error" });
      }

      // CRITICAL FIX: Ensure client ID matches if provided in URL
      if (clientIdParam && asset.clientId !== clientIdParam) {
        console.error(`ERROR: Client ID mismatch - Asset belongs to client ${asset.clientId} but clientId=${clientIdParam} specified in URL`);
        return res.status(403).json({ message: "Client ID mismatch. You don't have permission to access this asset." });
      }

      // CRITICAL FIX: Get the client information for verification
      if (req.clientId) {
        // If client ID from session doesn't match the asset's client ID, log a warning
        // (We still serve the asset if user has access rights, but log for debugging)
        if (asset.clientId !== req.clientId) {
          console.warn(`WARNING: User with client ID ${req.clientId} accessing asset from client ${asset.clientId}`);
        }
      }

      let fileBuffer: Buffer;
      let mimeType: string;

      // Check if requesting a specific format conversion
      if (format && asset.category === 'logo') {
        const isDarkVariant = variant === 'dark';

        // CRITICAL FIX: Log the client ID we're checking for
        console.log(`Asset details - Name: ${asset.name}, ID: ${asset.id}, Client ID: ${asset.clientId}`);

        // Get the converted asset specifically for this asset ID
        // CRITICAL FIX: Get converted asset, ensuring it's the right one
        console.log(`Looking for converted asset - Original ID: ${assetId}, Format: ${format}, Dark: ${isDarkVariant}`);
        const convertedAsset = await storage.getConvertedAsset(assetId, format, isDarkVariant);
        
        if (convertedAsset) {
          console.log(`Found converted asset - ID: ${convertedAsset.id}, Original ID: ${convertedAsset.originalAssetId}, Format: ${convertedAsset.format}, Dark: ${convertedAsset.isDarkVariant}`);
          // CRITICAL: Verify this converted asset actually belongs to the requested asset
          if (convertedAsset.originalAssetId !== assetId) {
            console.error(`ERROR: Converted asset ${convertedAsset.id} belongs to original asset ${convertedAsset.originalAssetId}, but we requested ${assetId}`);
            // Don't use this converted asset, fall back to on-the-fly conversion
          } else {
            console.log(`✓ Converted asset correctly belongs to requested asset ${assetId}`);
          }
        } else {
          console.log(`No converted asset found for Original ID: ${assetId}, Format: ${format}, Dark: ${isDarkVariant}`);
        }

        if (convertedAsset && convertedAsset.originalAssetId === assetId) {
          console.log(`Serving converted asset - ID: ${convertedAsset.id}, Original ID: ${convertedAsset.originalAssetId}, Format: ${convertedAsset.format}, Dark: ${convertedAsset.isDarkVariant}`);
          mimeType = convertedAsset.mimeType;
          fileBuffer = Buffer.from(convertedAsset.fileData, "base64");
        } else {
          // If the requested format is not found, convert on-the-fly
          console.log(`Requested format ${format} not found, converting on-the-fly`);

          // Get the source buffer
          let sourceBuffer: Buffer | null = null;
          if (isDarkVariant && asset.category === 'logo') {
            sourceBuffer = getDarkVariantBuffer(asset);
          } else if (asset.fileData) {
            sourceBuffer = Buffer.from(asset.fileData, "base64");
          }

          if (!sourceBuffer) {
            return res.status(404).json({ message: "Source file data not found" });
          }

          // Get the source format
          const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
          const sourceFormat = isDarkVariant ? (data.darkVariantFormat || data.format) : data.format;

          console.log(`Converting asset ${assetId} to ${format}:`);
          console.log(`- Client ID: ${asset.clientId}`);
          console.log(`- Asset name: ${asset.name}`);
          console.log(`- Source format: ${sourceFormat}`);
          console.log(`- Source buffer size: ${sourceBuffer.length} bytes`);

          try {
            // Convert the file
            const result = await convertToFormat(sourceBuffer, sourceFormat, format, assetId);
            fileBuffer = result.data;
            mimeType = result.mimeType;

            // CRITICAL FIX: Store the converted asset for future use
            // This ensures we associate the converted asset with the correct original asset
            try {
              console.log(`Storing converted asset - Original ID: ${assetId}, Format: ${format}, Dark: ${isDarkVariant}, Client: ${asset.clientId}`);
              await storage.createConvertedAsset({
                originalAssetId: assetId,
                format,
                fileData: fileBuffer.toString('base64'),
                mimeType,
                isDarkVariant
              });
              console.log(`Successfully stored converted asset format ${format} for asset ID ${assetId} (Client: ${asset.clientId})`);
            } catch (storeError) {
              console.error("Failed to store converted asset:", storeError);
              // Continue serving the file even if storage fails
            }
          } catch (conversionError) {
            console.error("Format conversion failed:", conversionError);
            return res.status(400).json({ message: "Format conversion failed" });
          }
        }
      } 
      // For logos with dark variants using the old method (backward compatibility)
      else if (variant === 'dark' && asset.category === 'logo' && !format) {
        const darkBuffer = getDarkVariantBuffer(asset);
        if (darkBuffer) {
          const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
          mimeType = data.darkVariantMimeType || asset.mimeType || "application/octet-stream";
          fileBuffer = darkBuffer;
        } else {
          return res.status(404).json({ message: "Dark variant file data not found" });
        }
      }
      // Default case - serve the main file
      else {
        if (!asset.fileData) {
          return res.status(404).json({ message: "Asset file data not found" });
        }

        mimeType = asset.mimeType || "application/octet-stream";
        fileBuffer = Buffer.from(asset.fileData, "base64");
      }

      // Skip resizing for vector formats like SVG, AI, EPS, and PDF
      // preserveVector is already declared above
      const isVectorFormat = ['image/svg+xml', 'application/postscript', 'application/pdf'].some(
        type => mimeType.includes(type)
      ) || ['svg', 'ai', 'eps', 'pdf'].includes(format?.toLowerCase() || '');

      // Fix content type for specific vector formats to ensure proper download
      if (format === 'eps') {
        mimeType = 'application/postscript';
      } else if (format === 'ai') {
        mimeType = 'application/postscript';
      } else if (format === 'pdf') {
        mimeType = 'application/pdf';
      }

      // Log asset details to help diagnose the wrong logo issue
      console.log(`Asset details - Name: ${asset.name}, ID: ${asset.id}, Client ID: ${asset.clientId}`);

      // FIXED VECTOR HANDLING: Special handling for SVG assets that need resizing
      if (size && size > 0 && isVectorFormat && (format === 'png' || format === 'jpg' || format === 'jpeg')) {
        try {
          // For vector-to-raster conversion with resizing, we'll handle SVG specially
          if (mimeType === 'image/svg+xml' || (asset.fileData && !format)) {
            console.log(`Converting SVG to ${format} with proper sizing for ID: ${asset.id}, Client: ${asset.clientId}`);

            // Import sharp directly
            const sharp = (await import('sharp')).default;

            // Extract SVG dimensions for accurate aspect ratio
            const svgString = fileBuffer.toString('utf-8');
            let svgWidth = 500;
            let svgHeight = 500;

            // Try to extract dimensions from SVG viewBox
            const viewBoxMatch = svgString.match(/viewBox=["']([^"']*)["']/);
            if (viewBoxMatch && viewBoxMatch[1]) {
              const viewBoxParts = viewBoxMatch[1].split(/\s+/).map(parseFloat);
              if (viewBoxParts.length >= 4) {
                svgWidth = viewBoxParts[2];
                svgHeight = viewBoxParts[3];
              }
            }

            // Calculate target dimensions with proper aspect ratio
            const width = Math.round(size); // Target width in pixels
            const height = preserveRatio ? Math.round((width / svgWidth) * svgHeight) : width;

            console.log(`Converting SVG (${asset.id}) from ${svgWidth}x${svgHeight} to ${width}x${height}px ${format}`);

            // Use high-density rendering for SVG to prevent pixelation at larger sizes
            const sharpInstance = sharp(fileBuffer, { density: Math.min(1200, width * 2) });

            // Create high-quality raster output
            if (format === 'png') {
              fileBuffer = await sharpInstance.resize(width, height).png({ quality: 100 }).toBuffer();
              mimeType = 'image/png';
            } else {
              fileBuffer = await sharpInstance.resize(width, height).jpeg({ quality: 95 }).toBuffer();
              mimeType = 'image/jpeg';
            }

            console.log(`Successfully converted SVG to ${format} at ${width}x${height}px`);
            return res.set('Content-Type', mimeType).send(fileBuffer);
          }
        } catch (vectorError) {
          console.error("Error handling vector-to-raster conversion:", vectorError);
        }
      }

      // Standard resize for raster images
      if (size && size > 0 && isImageFormat(mimeType) && !isVectorFormat && !preserveVector) {
        try {
          // Import sharp directly to avoid require() issues
          const sharp = (await import('sharp')).default;

          // Create a sharp instance from the buffer
          const image = sharp(fileBuffer);
          const metadata = await image.metadata();

          // Get original dimensions
          const originalWidth = metadata.width || 500;
          const originalHeight = metadata.height || 500;

          // Calculate new dimensions - always interpret size parameter as exact pixel width
          const width = Math.round(size); // Ensure it's an integer
          const height = preserveRatio ? Math.round((width / originalWidth) * originalHeight) : width;

          console.log(`Resizing asset ${asset.id} (${asset.name}, Client: ${asset.clientId}) from ${originalWidth}x${originalHeight} to ${width}x${height}px`);

          // Perform the resize operation with high quality settings
          fileBuffer = await image.resize({
            width: width,
            height: height,
            fit: preserveRatio ? 'inside' : 'fill',
            kernel: 'lanczos3' // Use high-quality resize algorithm
          }).toBuffer();

          console.log(`Successfully resized image to ${width}x${height}px`);
        } catch (resizeError) {
          console.error("Image resize failed:", resizeError);
          // Continue with the original image if resize fails
        }
      } else if (isVectorFormat || preserveVector) {
        console.log(`Skipping resize for vector format: ${format || mimeType}. Preserving vector properties.`);
      }

      res.setHeader("Content-Type", mimeType);
      return res.send(fileBuffer);
    } catch (error) {
      console.error("Error serving asset file:", error);
      res.status(500).json({ message: "Error serving asset file" });
    }
  });

  // Helper function to get dark variant buffer
  function getDarkVariantBuffer(asset: any): Buffer | null {
    if (!asset) return null;

    try {
      const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
      if (data && data.darkVariantFileData) {
        return Buffer.from(data.darkVariantFileData, "base64");
      }
    } catch (error) {
      console.error("Error parsing dark variant data:", error);
    }
    return null;
  }

  // Helper function to check if a mimetype is an image format
  function isImageFormat(mimeType: string): boolean {
    return /^image\/(jpeg|png|gif|webp|svg\+xml)/.test(mimeType);
  }

  // Helper function to convert a file to another format using the file-converter utility
  async function convertToFormat(
    buffer: Buffer, 
    sourceFormat: string, 
    targetFormat: string,
    assetId?: number
  ): Promise<{ data: Buffer, mimeType: string }> {
    if (!buffer) {
      throw new Error("Invalid source buffer for conversion");
    }

    // CRITICAL FIX: Additional validation to ensure we have the right data
    if (buffer.length < 100) {
      console.error(`ERROR: Source buffer suspiciously small (${buffer.length} bytes) for asset ID ${assetId || 'unknown'}`);
    }

    console.log(`Converting from ${sourceFormat} to ${targetFormat} for asset ID ${assetId || 'unknown'}`);

    try {
      // Use the file converter utility
      const { convertToAllFormats } = await import('../utils/file-converter');
      const convertedFiles = await convertToAllFormats(buffer, sourceFormat);

      // Find the target format in the converted files
      const targetFile = convertedFiles.find(file => file.format.toLowerCase() === targetFormat.toLowerCase());

      if (!targetFile) {
        throw new Error(`Conversion to ${targetFormat} failed`);
      }

      return {
        data: targetFile.data,
        mimeType: targetFile.mimeType
      };
    } catch (error) {
      console.error("Error in format conversion:", error);
      throw new Error(`Failed to convert ${sourceFormat} to ${targetFormat}: ${error.message}`);
    }
  }

  // Get converted assets for a specific asset
  app.get("/api/assets/:assetId/converted", async (req, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const asset = await storage.getAsset(assetId);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      if (asset.category !== 'logo') {
        return res.status(400).json({ message: "Only logo assets have converted formats" });
      }

      const convertedAssets = await storage.getConvertedAssets(assetId);

      // Group by format and variant
      const result = {
        original: {
          format: typeof asset.data === 'string' 
            ? JSON.parse(asset.data).format 
            : asset.data.format,
          mimeType: asset.mimeType,
          isDark: false
        },
        converted: convertedAssets.map(ca => ({
          format: ca.format,
          mimeType: ca.mimeType,
          isDark: ca.isDarkVariant
        }))
      };

      res.json(result);
    } catch (error) {
      console.error("Error fetching converted assets:", error);
      res.status(500).json({ message: "Error fetching converted assets" });
    }
  });
}