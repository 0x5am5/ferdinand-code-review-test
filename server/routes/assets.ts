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
          const { name, source, weights, styles } = req.body;
          const parsedWeights = JSON.parse(weights);
          const parsedStyles = JSON.parse(styles);
          const files = req.files as Express.Multer.File[];

          if (!files || files.length === 0) {
            return res.status(400).json({ message: "No font files uploaded" });
          }

          // Create the font asset data
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

        // Default to logo asset
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
        
        res.status(201).json(asset);
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
  app.get("/api/assets/:assetId/file", async (req, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const variant = req.query.variant as string;
      const format = req.query.format as string;
      const asset = await storage.getAsset(assetId);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      // Check if requesting a specific format conversion
      if (format && asset.category === 'logo') {
        const isDarkVariant = variant === 'dark';
        const convertedAsset = await storage.getConvertedAsset(assetId, format, isDarkVariant);
        
        if (convertedAsset) {
          console.log(`Serving converted asset format: ${format}, dark: ${isDarkVariant}`);
          res.setHeader("Content-Type", convertedAsset.mimeType);
          const buffer = Buffer.from(convertedAsset.fileData, "base64");
          return res.send(buffer);
        }
        
        // If the requested format is not found, fallback to the original
        console.log(`Requested format ${format} not found, falling back to original`);
      }

      // For logos with dark variants using the old method (backward compatibility)
      if (variant === 'dark' && asset.category === 'logo' && !format) {
        const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
        if (data.darkVariantFileData) {
          res.setHeader(
            "Content-Type",
            data.darkVariantMimeType || asset.mimeType || "application/octet-stream",
          );
          const buffer = Buffer.from(data.darkVariantFileData, "base64");
          return res.send(buffer);
        }
      }

      // Default case - serve the main file
      if (!asset.fileData) {
        return res.status(404).json({ message: "Asset file data not found" });
      }
      
      res.setHeader(
        "Content-Type",
        asset.mimeType || "application/octet-stream",
      );
      const buffer = Buffer.from(asset.fileData, "base64");
      res.send(buffer);
    } catch (error) {
      console.error("Error serving asset file:", error);
      res.status(500).json({ message: "Error serving asset file" });
    }
  });
  
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