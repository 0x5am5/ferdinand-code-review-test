import {
  type BrandAsset,
  brandAssets,
  convertedAssets,
  assets as fileAssets,
  userClients as fileUserClients,
  type InsertBrandAsset,
  type InsertColorAsset,
  type InsertFontAsset,
  insertColorAssetSchema,
  insertFontAssetSchema,
  userClients,
} from "@shared/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "server/middlewares/auth";
import { validateClientId } from "server/middlewares/vaildateClientId";
import type { RequestWithClientId } from "server/routes";
import { db } from "../db";
import { mutationRateLimit } from "../middlewares/rate-limit";
import { checkAssetPermission } from "../services/asset-permissions";
import { storage } from "../storage";
import { convertToAllFormats } from "../utils/file-converter";

const upload = multer({ preservePath: true });

interface AdobeFontsFamily {
  name: string;
  slug: string;
  variations: string[];
  foundry: {
    name: string;
  };
  css_names: string[];
}

// Helper function to fix logo data for assets that might have malformed type data
async function fixLogoTypeData() {
  try {
    console.log("Starting logo type data fix...");
    const clients = await storage.getClients();

    for (const client of clients) {
      const clientAssets = await storage.getClientAssets(client.id);
      const logoAssets = clientAssets.filter(
        (asset) => asset.category === "logo"
      );

      for (const asset of logoAssets) {
        let needsUpdate = false;
        let assetData: Record<string, unknown>;

        try {
          assetData =
            typeof asset.data === "string"
              ? JSON.parse(asset.data)
              : asset.data;
        } catch (error) {
          console.error(
            `Asset ${asset.id} has invalid JSON data, skipping:`,
            error
          );
          continue;
        }

        // If the asset has no type or an undefined type, infer it from the name
        if (!assetData?.type) {
          console.log(
            `Asset ${asset.id} (${asset.name}) missing type, inferring from name...`
          );

          // Infer type from asset name
          const name = asset.name.toLowerCase();
          if (name.includes("main")) {
            assetData.type = "main";
            needsUpdate = true;
          } else if (name.includes("square")) {
            assetData.type = "square";
            needsUpdate = true;
          } else if (name.includes("favicon")) {
            assetData.type = "favicon";
            needsUpdate = true;
          } else if (name.includes("vertical")) {
            assetData.type = "vertical";
            needsUpdate = true;
          } else if (name.includes("horizontal")) {
            assetData.type = "horizontal";
            needsUpdate = true;
          } else if (name.includes("app")) {
            assetData.type = "app_icon";
            needsUpdate = true;
          } else {
            // Default to main if we can't determine
            assetData.type = "main";
            needsUpdate = true;
          }

          console.log(
            `Inferred type "${assetData.type}" for asset ${asset.id}`
          );
        }

        if (needsUpdate) {
          await storage.updateAsset(asset.id, {
            name: asset.name,
            clientId: asset.clientId,
            category: asset.category as "logo",
            data: assetData as unknown as InsertBrandAsset["data"],
            fileData: asset.fileData || "",
            mimeType: asset.mimeType || "",
          });
          console.log(`Updated asset ${asset.id} with type: ${assetData.type}`);
        }
      }
    }
    console.log("Completed logo type data fix");
  } catch (error) {
    console.error("Error in logo type data fix:", error);
  }
}

// Helper function to update client logos based on existing square/favicon logos
async function updateClientLogosFromAssets() {
  try {
    console.log("Starting retroactive client logo update...");
    const clients = await storage.getClients();

    for (const client of clients) {
      // Skip clients who already have favicon or square logo assets
      const clientAssets = await storage.getClientAssets(client.id);
      const logoAssets = clientAssets.filter(
        (asset) => asset.category === "logo"
      );
      const hasFaviconOrSquare = logoAssets.some((asset) => {
        try {
          const data =
            typeof asset.data === "string"
              ? JSON.parse(asset.data)
              : asset.data;
          return data?.type === "favicon" || data?.type === "square";
        } catch (error) {
          console.error(
            `Failed to parse asset data for asset ${asset.id}:`,
            error
          );
          return false;
        }
      });

      if (hasFaviconOrSquare) {
        continue; // Skip clients who already have favicon or square logos
      }

      // Prioritize square logos first, then favicon logos
      let selectedAsset = logoAssets.find((asset) => {
        const assetData =
          typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;
        return assetData?.type === "square";
      });

      if (!selectedAsset) {
        selectedAsset = logoAssets.find((asset) => {
          const assetData =
            typeof asset.data === "string"
              ? JSON.parse(asset.data)
              : asset.data;
          return assetData?.type === "favicon";
        });
      }

      if (selectedAsset) {
        const logoUrl = `/api/clients/${client.id}/brand-assets/${selectedAsset.id}/download`;
        await storage.updateClient(client.id, { logo: logoUrl });
        console.log(
          `Updated client ${client.id} (${client.name}) logo to: ${logoUrl}`
        );
      }
    }
    console.log("Completed retroactive client logo update");
  } catch (error) {
    console.error("Error in retroactive client logo update:", error);
  }
}

/**
 * Brand Assets Routes
 *
 * This module handles design system assets: logos, fonts, colors, and typography.
 * These are stored directly in the database (base64 encoded) and support format conversion.
 *
 * This is distinct from the File Assets system (/server/routes/file-assets.ts) which handles
 * general file storage with external storage backends.
 */
export function registerBrandAssetRoutes(app: Express) {
  // Utility endpoint to fix logo type data
  app.post("/api/utils/fix-logo-types", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "super_admin") {
        return res.status(403).json({ message: "Super admin access required" });
      }

      await fixLogoTypeData();
      res.json({ message: "Logo type data fixed successfully" });
    } catch (error) {
      console.error("Error in logo type data fix:", error);
      res.status(500).json({ message: "Error fixing logo type data" });
    }
  });

  // Utility endpoint to update client logos from existing assets
  app.post("/api/utils/update-client-logos", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "super_admin") {
        return res.status(403).json({ message: "Super admin access required" });
      }

      await updateClientLogosFromAssets();
      res.json({ message: "Client logos updated successfully" });
    } catch (error) {
      console.error("Error in manual client logo update:", error);
      res.status(500).json({ message: "Error updating client logos" });
    }
  });

  // Adobe Fonts API endpoint
  app.get("/api/adobe-fonts/:projectId", async (req, res: Response) => {
    try {
      const { projectId } = req.params;

      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      console.log(`Adobe Fonts API endpoint called for project: ${projectId}`);

      // Validate project ID format (Adobe project IDs are typically alphanumeric)
      if (!/^[a-zA-Z0-9]+$/.test(projectId)) {
        return res.status(400).json({
          message:
            "Invalid project ID format. Project ID should contain only letters and numbers.",
        });
      }

      // Use Adobe Fonts API with authentication
      const apiKey = process.env.ADOBE_FONTS_API_KEY;

      if (!apiKey) {
        console.error("Adobe Fonts API key not found");
        return res.status(500).json({
          message:
            "Adobe Fonts API key not configured. Please contact support.",
        });
      }

      // Adobe Fonts API endpoint for getting kit information
      const apiUrl = `https://typekit.com/api/v1/json/kits/${projectId}`;

      console.log(`Fetching from Adobe Fonts API: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: {
          "X-Typekit-Token": apiKey,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        console.error(
          "Adobe Fonts API error:",
          response.status,
          response.statusText
        );
        if (response.status === 401) {
          return res.status(401).json({
            message:
              "Invalid Adobe Fonts API key. Please check your API credentials.",
          });
        }
        if (response.status === 404) {
          return res.status(404).json({
            message:
              "Adobe Fonts project not found. Please check your Project ID.",
          });
        }
        return res.status(response.status).json({
          message: "Failed to fetch fonts from Adobe Fonts API",
        });
      }

      const data = await response.json();
      console.log(
        `Successfully fetched Adobe Fonts data for project ${projectId}`
      );
      console.log("Adobe Fonts API Response:", JSON.stringify(data, null, 2));

      // Transform the Adobe Fonts API response to our expected format
      const transformedData = {
        projectId,
        fonts:
          data.kit?.families
            ?.map((family: AdobeFontsFamily) => {
              console.log(
                `Processing family: ${family.name}`,
                JSON.stringify(family.variations, null, 2)
              );
              // Convert Adobe font variations (fvd format) to weights and styles
              const weights: string[] = [];
              const styles: string[] = [];

              if (family.variations && Array.isArray(family.variations)) {
                family.variations.forEach((variation: string) => {
                  // Variations are strings like "n3", "n4", "i6", "n7"
                  // Format: [n|i][weight_class]
                  // Examples: n4 = normal 400, i7 = italic 700, n3 = normal 300
                  const isItalic = variation.startsWith("i");

                  // Extract weight - the number after the style indicator
                  const weightMatch = variation.match(/[ni](\d)/);
                  if (weightMatch) {
                    const weightClass = parseInt(weightMatch[1], 10);
                    // Convert weight class to actual weight
                    const weightMap: { [key: number]: string } = {
                      1: "100", // Thin
                      2: "200", // Extra Light
                      3: "300", // Light
                      4: "400", // Normal/Regular
                      5: "500", // Medium
                      6: "600", // Semi Bold
                      7: "700", // Bold
                      8: "800", // Extra Bold
                      9: "900", // Black
                    };

                    const weight = weightMap[weightClass] || "400";
                    if (!weights.includes(weight)) {
                      weights.push(weight);
                    }
                  }

                  const style = isItalic ? "italic" : "normal";
                  if (!styles.includes(style)) {
                    styles.push(style);
                  }
                });
              }

              // Fallback to defaults if no variations found
              if (weights.length === 0) weights.push("400");
              if (styles.length === 0) styles.push("normal");

              return {
                family:
                  family.slug ||
                  family.name?.toLowerCase().replace(/\s+/g, "-"),
                displayName: family.name,
                weights: weights.sort(
                  (a, b) => parseInt(a, 10) - parseInt(b, 10)
                ),
                styles: styles,
                cssUrl: `https://use.typekit.net/${projectId}.css`,
                category: family.css_names?.[0]?.includes("serif")
                  ? "serif"
                  : "sans-serif",
                foundry: family.foundry?.name || "Adobe",
              };
            })
            .filter(Boolean) || [],
      };

      res.json(transformedData);
    } catch (error: unknown) {
      console.error(
        "Error fetching Adobe Fonts:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({
        message: "Error connecting to Adobe Fonts API. Please try again later.",
      });
    }
  });

  // Google Fonts API endpoint
  app.get("/api/google-fonts", async (_req, res: Response) => {
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
        console.error(
          "Google Fonts API error:",
          response.status,
          response.statusText
        );
        return res.json({ kind: "webfonts#webfontList", items: [] });
      }

      const data = await response.json();
      console.log(
        `Successfully fetched ${data.items?.length || 0} fonts from Google Fonts API`
      );

      res.json(data);
    } catch (error: unknown) {
      console.error(
        "Error fetching Google Fonts:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.json({ kind: "webfonts#webfontList", items: [] });
    }
  });
  // Get all brand assets (logos, colors, fonts)
  app.get("/api/brand-assets", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const allAssets = await db.select().from(brandAssets);
      res.json(allAssets);
    } catch (error: unknown) {
      console.error(
        "Error fetching brand assets:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching brand assets" });
    }
  });

  // Get single brand asset
  app.get("/api/brand-assets/:id", async (req, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const [asset] = await db
        .select()
        .from(brandAssets)
        .where(eq(brandAssets.id, parseInt(req.params.id, 10)));

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      res.json(asset);
    } catch (error: unknown) {
      console.error(
        "Error fetching asset:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching asset" });
    }
  });

  // Handle both file uploads and other brand assets
  app.post(
    "/api/clients/:clientId/brand-assets",
    upload.any(),
    validateClientId,
    requireAuth,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        const userId = req.session?.userId;

        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        // Check if user has write permission for this client
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Guest users cannot create assets
        if (user.role === "guest") {
          return res
            .status(403)
            .json({ message: "Guests cannot create assets" });
        }

        // Verify user has access to this client (unless super admin)
        if (user.role !== "super_admin") {
          const userClient = await db
            .select()
            .from(userClients)
            .where(
              and(
                eq(userClients.clientId, clientId),
                eq(userClients.userId, userId)
              )
            );

          if (userClient.length === 0) {
            return res
              .status(403)
              .json({ message: "Not authorized for this client" });
          }
        }

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
            return res
              .status(400)
              .json({ message: "Client ID is required for font creation" });
          }

          // Handle Google Fonts (no file upload needed)
          if (subcategory === "google") {
            console.log(
              "Creating Google Font asset:",
              name,
              "for client:",
              clientId
            );

            let fontData: Record<string, unknown>;
            try {
              fontData = typeof data === "string" ? JSON.parse(data) : data;
            } catch (error: unknown) {
              console.error(
                "Error parsing font data:",
                error instanceof Error ? error.message : "Unknown error"
              );
              return res
                .status(400)
                .json({ message: "Invalid font data format" });
            }

            // Validate font data structure
            if (!fontData || !fontData.source) {
              console.error("Invalid font data structure:", fontData);
              return res
                .status(400)
                .json({ message: "Invalid font data structure" });
            }

            // Ensure weights is an array
            if (!fontData.weights || !Array.isArray(fontData.weights)) {
              fontData.weights = ["400"];
            }

            // Ensure styles is an array
            if (!fontData.styles || !Array.isArray(fontData.styles)) {
              fontData.styles = ["normal"];
            }

            // Ensure sourceData exists with proper structure
            if (!fontData.sourceData) {
              fontData.sourceData = {};
            }

            const fontAsset = {
              clientId,
              name: name.trim(),
              category: "font" as const,
              data: {
                source: fontData.source as string,
                weights: fontData.weights as string[],
                styles: fontData.styles as string[],
                sourceData: fontData.sourceData as Record<string, unknown>,
              },
              fileData: null, // Google fonts don't need file storage
              mimeType: null,
            };

            console.log(
              "Creating Google Font asset with data:",
              JSON.stringify(fontAsset, null, 2)
            );

            try {
              const asset = await storage.createAsset(fontAsset);
              await storage.touchClient(clientId);
              console.log("Google Font asset created successfully:", asset.id);
              return res.status(201).json(asset);
            } catch (dbError: unknown) {
              console.error("Database error creating Google Font:", dbError);
              return res.status(500).json({
                message: "Failed to create font asset",
                error: (dbError as Error).message,
              });
            }
          }

          // Handle Adobe Fonts (no file upload needed)
          if (subcategory === "adobe") {
            console.log(
              "Creating Adobe Font asset:",
              name,
              "for client:",
              clientId
            );

            let fontData: Record<string, unknown>;
            try {
              fontData = typeof data === "string" ? JSON.parse(data) : data;
            } catch (error: unknown) {
              console.error(
                "Error parsing Adobe font data:",
                error instanceof Error ? error.message : "Unknown error"
              );
              return res
                .status(400)
                .json({ message: "Invalid font data format" });
            }

            // Validate font data structure
            if (!fontData || !fontData.source) {
              console.error("Invalid Adobe font data structure:", fontData);
              return res
                .status(400)
                .json({ message: "Invalid font data structure" });
            }

            // Ensure weights is an array
            if (!fontData.weights || !Array.isArray(fontData.weights)) {
              fontData.weights = ["400"];
            }

            // Ensure styles is an array
            if (!fontData.styles || !Array.isArray(fontData.styles)) {
              fontData.styles = ["normal"];
            }

            // Ensure sourceData exists with proper structure
            if (!fontData.sourceData) {
              fontData.sourceData = {};
            }

            const fontAsset = {
              clientId,
              name: name.trim(),
              category: "font" as const,
              data: {
                source: fontData.source as string,
                weights: fontData.weights as string[],
                styles: fontData.styles as string[],
                sourceData: fontData.sourceData as Record<string, unknown>,
              },
              fileData: null, // Adobe fonts don't need file storage
              mimeType: null,
            };

            console.log(
              "Creating Adobe Font asset with data:",
              JSON.stringify(fontAsset, null, 2)
            );

            try {
              const asset = await storage.createAsset(fontAsset);
              await storage.touchClient(clientId);
              console.log("Adobe Font asset created successfully:", asset.id);
              return res.status(201).json(asset);
            } catch (dbError: unknown) {
              console.error("Database error creating Adobe Font:", dbError);
              return res.status(500).json({
                message: "Failed to create font asset",
                error: (dbError as Error).message,
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
            return res
              .status(400)
              .json({ message: "No font files uploaded for custom font" });
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
          await storage.touchClient(clientId);
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
          await storage.touchClient(clientId);
          return res.status(201).json(asset);
        }

        // Default to logo asset (only for non-font assets)
        if (category !== "font") {
          const { name, type, currentType, isDarkVariant } = req.body;
          // Use currentType if available (from updates), otherwise fall back to type
          const logoType = currentType || type;
          const files = req.files as Express.Multer.File[];

          if (!files || files.length === 0) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const file = files[0];
          const fileExtension = file.originalname
            .split(".")
            .pop()
            ?.toLowerCase();

          // Check if this is supposed to be a dark variant
          const isDark = isDarkVariant === "true" || isDarkVariant === true;

          // Create proper data object instead of JSON string
          const logoData = {
            type: logoType,
            format: fileExtension || "png",
            fileName: file.originalname,
            // Mark this asset as a dark variant if applicable
            // This is used when uploading a dark variant as a separate asset
            // (though usually dark variants are added via PATCH to existing assets)
            ...(isDark && { isStandaloneDarkVariant: true }),
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
          await storage.touchClient(clientId);

          try {
            // Convert the file to multiple formats
            const fileBuffer = file.buffer;
            const originalFormat = fileExtension || "png";

            console.log(
              `Converting ${originalFormat} file to multiple formats. Dark variant: ${isDark}`
            );
            const convertedFiles = await convertToAllFormats(
              fileBuffer,
              originalFormat
            );

            // Store all converted versions in the database
            for (const convertedFile of convertedFiles) {
              // Skip the original format since we already stored it
              if (convertedFile.format === originalFormat) continue;

              const convertedAssetData = {
                originalAssetId: asset.id,
                format: convertedFile.format,
                fileData: convertedFile.data.toString("base64"),
                mimeType: convertedFile.mimeType,
                isDarkVariant: isDark,
              };

              await storage.createConvertedAsset(convertedAssetData);
              console.log(
                `Created converted asset: ${convertedFile.format} (Dark: ${isDark})`
              );
            }
          } catch (conversionError: unknown) {
            console.error(
              "Error converting asset to other formats:",
              conversionError instanceof Error
                ? conversionError.message
                : "Unknown error"
            );
            // We'll continue even if conversion fails since the original asset was saved
          }

          return res.status(201).json(asset);
        } else {
          // Font category but not Google - should not happen with current UI
          return res.status(400).json({ message: "Unsupported font type" });
        }
      } catch (error: unknown) {
        console.error(
          "Error creating asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error creating asset" });
      }
    }
  );

  // Update brand asset endpoint
  app.patch(
    "/api/clients/:clientId/brand-assets/:assetId",
    upload.any(),
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }
        const assetId = parseInt(req.params.assetId, 10);
        // Get variant from query params with debugging
        const variant = req.query.variant as string;
        console.log(
          `PATCH request received - assetId: ${assetId}, variant: ${variant}, isDarkVariant: ${req.body.isDarkVariant}`
        );

        // Force isDarkVariant to true if variant=dark is in the URL
        if (variant === "dark") {
          req.body.isDarkVariant = "true";
          console.log(
            "Setting isDarkVariant flag to true based on URL parameter"
          );
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

        let parsed: { success: boolean; data?: unknown; error?: unknown };
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
        } else if (
          req.body.category === "logo" ||
          (req.body.data && JSON.parse(req.body.data).type)
        ) {
          const files = req.files as Express.Multer.File[];
          const isDarkVariant =
            req.body.isDarkVariant === "true" ||
            req.body.isDarkVariant === true;

          if (!files || files.length === 0) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const file = files[0];
          const fileExtension = file.originalname
            .split(".")
            .pop()
            ?.toLowerCase();

          // For backward compatibility, we'll update both the old-style dark variant
          // and also create converted assets for the new system
          const existingData =
            typeof asset.data === "string"
              ? JSON.parse(asset.data)
              : asset.data;

          if (isDarkVariant) {
            console.log(
              `[DARK VARIANT UPLOAD] Uploading dark variant for asset ${assetId}`
            );
            console.log(
              `[DARK VARIANT UPLOAD] File size: ${file.buffer.length} bytes, format: ${fileExtension}`
            );

            parsed = {
              success: true,
              data: {
                ...asset,
                category: "logo",
                // We update the existing data instead of replacing it entirely
                data: {
                  ...existingData,
                  hasDarkVariant: true,
                  darkVariantFileData: file.buffer.toString("base64"),
                  darkVariantMimeType: file.mimetype,
                  darkVariantFormat: fileExtension || "png",
                },
              },
            };

            // Also store in the new converted assets system
            try {
              const fileBuffer = file.buffer;
              const originalFormat = fileExtension || "png";

              console.log(
                `Converting ${originalFormat} file to multiple formats (dark variant)`
              );
              const convertedFiles = await convertToAllFormats(
                fileBuffer,
                originalFormat
              );

              // Delete any existing dark variant converted assets first
              try {
                // Use proper SQL to delete existing dark variant converted assets
                await db.execute(sql`
                  DELETE FROM "converted_assets"
                  WHERE "original_asset_id" = ${asset.id} AND "is_dark_variant" = true
                `);
                console.log(
                  `Deleted existing dark variant converted assets for asset ID ${asset.id}`
                );
              } catch (deleteError: unknown) {
                console.error(
                  "Error deleting existing dark variant converted assets:",
                  deleteError instanceof Error
                    ? deleteError.message
                    : "Unknown error"
                );
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
                  await db
                    .delete(convertedAssets)
                    .where(eq(convertedAssets.id, existingConverted.id));
                }

                // Create the new converted asset
                const convertedAssetData = {
                  originalAssetId: asset.id,
                  format: convertedFile.format,
                  fileData: convertedFile.data.toString("base64"),
                  mimeType: convertedFile.mimeType,
                  isDarkVariant: true,
                };

                await storage.createConvertedAsset(convertedAssetData);
                console.log(
                  `Updated converted asset: ${convertedFile.format} (Dark)`
                );
              }
            } catch (conversionError: unknown) {
              console.error(
                "Error converting dark variant to other formats:",
                conversionError instanceof Error
                  ? conversionError.message
                  : "Unknown error"
              );
              // We'll continue even if conversion fails since the original update will succeed
            }
          } else {
            // Regular logo update (light variant)
            parsed = {
              success: true,
              data: {
                ...asset,
                category: "logo",
                fileData: file.buffer.toString("base64"),
                mimeType: file.mimetype,
                data: {
                  ...existingData,
                  format: fileExtension || "png",
                  fileName: file.originalname,
                },
              },
            };

            // Also update converted assets
            try {
              const fileBuffer = file.buffer;
              const originalFormat = fileExtension || "png";

              console.log(
                `Converting ${originalFormat} file to multiple formats (light variant update)`
              );
              const convertedFiles = await convertToAllFormats(
                fileBuffer,
                originalFormat
              );

              // Delete any existing light variant converted assets
              try {
                // Use proper Drizzle ORM query for deleting light variants
                // We need to use raw SQL because Drizzle doesn't support complex where clauses
                // Use SQL to delete light variant converted assets
                await db.execute(sql`
                  DELETE FROM "converted_assets"
                  WHERE "original_asset_id" = ${asset.id} AND "is_dark_variant" = false
                `);
                console.log(
                  `Deleted light variant converted assets for asset ID ${asset.id}`
                );
              } catch (deleteError: unknown) {
                console.error(
                  "Error deleting existing light variant converted assets:",
                  deleteError instanceof Error
                    ? deleteError.message
                    : "Unknown error"
                );
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
                  isDarkVariant: false,
                };

                await storage.createConvertedAsset(convertedAssetData);
                console.log(
                  `Updated converted asset: ${convertedFile.format} (Light)`
                );
              }
            } catch (conversionError: unknown) {
              console.error(
                "Error converting light variant to other formats:",
                conversionError instanceof Error
                  ? conversionError.message
                  : "Unknown error"
              );
              // We'll continue even if conversion fails since the original update will succeed
            }
          }
        } else {
          return res.status(400).json({ message: "Invalid asset category" });
        }

        if (!parsed.success) {
          return res.status(400).json({
            message: `Invalid ${req.body.category} data`,
            errors: parsed.error,
          });
        }

        const updatedAsset = await storage.updateAsset(
          assetId,
          parsed.data as InsertBrandAsset | InsertFontAsset | InsertColorAsset
        );
        await storage.touchClient(clientId);

        // Update client logo if this is a square or favicon logo update
        try {
          if (asset.category === "logo" && parsed.data) {
            const data = parsed.data as InsertBrandAsset;
            const assetData =
              typeof asset.data === "string"
                ? JSON.parse(asset.data)
                : asset.data;
            const logoType =
              (data.data as Record<string, unknown>)?.type ||
              (assetData as Record<string, unknown>)?.type;

            if (logoType === "square" || logoType === "favicon") {
              const logoUrl = `/api/clients/${clientId}/brand-assets/${asset.id}/download`;
              await storage.updateClient(clientId, { logo: logoUrl });
              console.log(
                `Updated client ${clientId} logo to: ${logoUrl} (via update)`
              );
            }
          }
        } catch (logoUpdateError: unknown) {
          console.error(
            "Error updating client logo during asset update:",
            logoUpdateError instanceof Error
              ? logoUpdateError.message
              : "Unknown error"
          );
          // Don't fail the request if logo update fails
        }

        res.json(updatedAsset);
      } catch (error: unknown) {
        console.error(
          "Error updating asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error updating asset" });
      }
    }
  );

  // Delete brand asset endpoint
  app.delete(
    "/api/clients/:clientId/brand-assets/:assetId",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }
        const assetId = parseInt(req.params.assetId, 10);
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

        if (variant === "dark" && asset.category === "logo") {
          // Remove the dark variant from both the old system and new converted assets
          const data =
            typeof asset.data === "string"
              ? JSON.parse(asset.data)
              : asset.data;
          delete data.darkVariantFileData;
          delete data.darkVariantMimeType;
          delete data.darkVariantFormat;
          data.hasDarkVariant = false;

          // Update the asset with old system data removed
          await storage.updateAsset(assetId, {
            name: asset.name,
            clientId: asset.clientId,
            category: asset.category as "logo",
            data,
            fileData: asset.fileData || "",
            mimeType: asset.mimeType || "",
          });

          // Delete converted assets for dark variant using direct SQL
          try {
            // Use parameterized query for safer SQL execution
            await db.execute(sql`
              DELETE FROM "converted_assets"
              WHERE "original_asset_id" = ${assetId} AND "is_dark_variant" = true
            `);
            console.log(
              `Deleted dark variant converted assets for asset ID ${assetId}`
            );
          } catch (error: unknown) {
            console.error(
              "Error deleting converted assets for dark variant:",
              error instanceof Error ? error.message : "Unknown error"
            );
            // We continue since we've already updated the main asset
          }

          return res
            .status(200)
            .json({ message: "Dark variant deleted successfully" });
        }

        await storage.deleteAsset(assetId);
        await storage.touchClient(clientId);
        res.status(200).json({ message: "Asset deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting asset" });
      }
    }
  );

  // Delete asset endpoint (simplified path without clientId)
  app.delete(
    "/api/assets/:id",
    requireAuth,
    mutationRateLimit,
    async (req: Request, res: Response) => {
      console.log("DELETE /api/assets/:id");
      try {
        const assetId = parseInt(req.params.id, 10);
        const userId = req.session?.userId;

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        if (Number.isNaN(assetId)) {
          return res.status(400).json({ message: "Invalid asset ID" });
        }

        // First try to get from brandAssets, then from fileAssets
        type AssetUnion = BrandAsset | typeof fileAssets.$inferSelect;
        let asset: AssetUnion | null =
          (await storage.getAsset(assetId)) ?? null;

        if (!asset) {
          // Try to get from file assets table
          const [fileAsset] = await db
            .select()
            .from(fileAssets)
            .where(
              and(eq(fileAssets.id, assetId), isNull(fileAssets.deletedAt))
            );

          if (fileAsset) {
            asset = fileAsset;
          }
        }

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        // Check if user has permission to delete this asset
        const permission = await checkAssetPermission(
          userId,
          assetId,
          asset.clientId,
          "delete"
        );

        if (!permission.allowed) {
          return res.status(403).json({
            message: permission.reason || "Not authorized to delete this asset",
          });
        }

        // Delete the asset
        await storage.deleteAsset(assetId);
        await storage.touchClient(asset.clientId);

        res.status(200).json({ message: "Asset deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting asset" });
      }
    }
  );

  app.get(
    "/api/clients/:clientId/brand-assets",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      try {
        const clientId = req.clientId;
        if (!clientId) {
          return res.status(400).json({ message: "Client ID is required" });
        }
        const assets = await storage.getClientAssets(clientId);
        res.json(assets);
      } catch (error: unknown) {
        console.error(
          "Error fetching client brand assets:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching client brand assets" });
      }
    }
  );

  // New optimized asset serving endpoints for better caching
  app.get(
    "/api/assets/:assetId/light",
    async (req: RequestWithClientId, res: Response) => {
      // Call the file handler directly with the same logic but without variant
      const assetId = parseInt(req.params.assetId, 10);

      try {
        const asset = await storage.getAsset(assetId);

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        if (!asset.fileData) {
          return res.status(404).json({ message: "Asset file data not found" });
        }

        const mimeType = asset.mimeType || "application/octet-stream";
        const fileBuffer = Buffer.from(asset.fileData, "base64");

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(fileBuffer);
      } catch (error: unknown) {
        console.error(
          "Error serving light asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error serving asset file" });
      }
    }
  );

  app.get(
    "/api/assets/:assetId/dark",
    async (req: RequestWithClientId, res: Response) => {
      // Call the file handler directly with dark variant logic
      const assetId = parseInt(req.params.assetId, 10);

      try {
        const asset = await storage.getAsset(assetId);

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        // Get dark variant buffer
        let fileBuffer: Buffer;
        let mimeType: string;

        if (asset.category === "logo") {
          const darkBuffer = getDarkVariantBuffer(asset);
          if (darkBuffer) {
            const data =
              typeof asset.data === "string"
                ? JSON.parse(asset.data)
                : asset.data;
            mimeType =
              data.darkVariantMimeType ||
              asset.mimeType ||
              "application/octet-stream";
            fileBuffer = darkBuffer;
          } else {
            return res
              .status(404)
              .json({ message: "Dark variant file data not found" });
          }
        } else {
          return res
            .status(400)
            .json({ message: "Dark variant only available for logo assets" });
        }

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(fileBuffer);
      } catch (error: unknown) {
        console.error(
          "Error serving dark asset:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error serving asset file" });
      }
    }
  );

  // Serve asset endpoint
  app.get(
    "/api/assets/:assetId/file",
    async (req: RequestWithClientId, res: Response) => {
      // This endpoint handles serving asset files with optional format conversion and resizing
      try {
        const assetId = parseInt(req.params.assetId, 10);
        const variant = req.query.variant as string;
        const format = req.query.format as string;
        const sizeParam = req.query.size as string;
        const preserveRatio = req.query.preserveRatio === "true";
        const preserveVector = req.query.preserveVector === "true";
        const clientIdParam = req.query.clientId
          ? parseInt(req.query.clientId as string, 10)
          : null;

        // Parse size as percentage or exact pixels
        let size: number | undefined;
        if (sizeParam) {
          size = parseFloat(sizeParam);
          if (Number.isNaN(size)) {
            size = undefined;
          }
        }

        console.log(`=== SERVING ASSET REQUEST ===`);
        console.log(
          `Requested asset ID: ${assetId}, variant: ${variant}, format: ${format}, size: ${size}, preserveRatio: ${preserveRatio}, preserveVector: ${preserveVector}, clientId param: ${clientIdParam}`
        );

        // CRITICAL FIX: Add query timing for debugging with unique identifier
        const queryLabel = `asset-query-${assetId}-${Date.now()}`;
        console.time(queryLabel);
        const asset = await storage.getAsset(assetId);
        console.timeEnd(queryLabel);

        if (!asset) {
          console.error(
            `ERROR: Asset with ID ${assetId} not found in database`
          );
          return res.status(404).json({ message: "Asset not found" });
        }

        // Add detailed logging about the asset being served
        console.log(
          `Asset details - Name: ${asset.name}, ID: ${asset.id}, Client ID: ${asset.clientId}, Category: ${asset.category}, MimeType: ${asset.mimeType}`
        );
        console.log(
          `Request details - Requested ID: ${assetId}, Variant: ${variant}, Format: ${format}, Size: ${size}, Client ID param: ${clientIdParam}`
        );

        // CRITICAL FIX: Verify we're serving the correct asset
        if (asset.id !== assetId) {
          console.error(
            `ERROR: Requested asset ID ${assetId} but serving ${asset.id} (${asset.name})`
          );
          return res.status(500).json({ message: "Asset ID mismatch error" });
        }

        // CRITICAL FIX: Ensure client ID matches if provided in URL
        if (clientIdParam && asset.clientId !== clientIdParam) {
          console.error(
            `ERROR: Client ID mismatch - Asset belongs to client ${asset.clientId} but clientId=${clientIdParam} specified in URL`
          );
          return res.status(403).json({
            message:
              "Client ID mismatch. You don't have permission to access this asset.",
          });
        }

        // CRITICAL FIX: Get the client information for verification
        if (req.clientId) {
          // If client ID from session doesn't match the asset's client ID, log a warning
          // (We still serve the asset if user has access rights, but log for debugging)
          if (asset.clientId !== req.clientId) {
            console.warn(
              `WARNING: User with client ID ${req.clientId} accessing asset from client ${asset.clientId}`
            );
          }
        }

        let fileBuffer: Buffer | undefined;
        let mimeType: string | undefined;

        // Check if requesting a specific format conversion
        if (format && asset.category === "logo") {
          const isDarkVariant = variant === "dark";

          // Log the asset and variant details
          console.log(
            `Asset details - Name: ${asset.name}, ID: ${asset.id}, Client ID: ${asset.clientId}, Variant: ${variant}, Dark: ${isDarkVariant}`
          );

          // For dark variants, check if the asset actually has a dark variant
          if (isDarkVariant) {
            const data =
              typeof asset.data === "string"
                ? JSON.parse(asset.data)
                : asset.data;
            const hasDarkVariant = data?.hasDarkVariant === true;
            const hasDarkVariantFileData = !!data?.darkVariantFileData;

            if (!hasDarkVariant && !hasDarkVariantFileData) {
              // Fall back to light variant
              const convertedAsset = await storage.getConvertedAsset(
                assetId,
                format,
                false
              );

              if (
                convertedAsset &&
                convertedAsset.originalAssetId === assetId
              ) {
                mimeType = convertedAsset.mimeType;
                fileBuffer = Buffer.from(convertedAsset.fileData, "base64");
              } else {
                // Convert on-the-fly from light variant
                if (!asset.fileData) {
                  console.error("Asset fileData is null");
                  return res
                    .status(400)
                    .json({ message: "Asset file data not found" });
                }
                const sourceBuffer = Buffer.from(asset.fileData, "base64");
                const sourceFormat = data.format;

                try {
                  const result = await convertToFormat(
                    sourceBuffer,
                    sourceFormat,
                    format,
                    assetId
                  );
                  fileBuffer = result.data;
                  mimeType = result.mimeType;
                } catch (conversionError) {
                  console.error("Format conversion failed:", conversionError);
                  return res
                    .status(400)
                    .json({ message: "Format conversion failed" });
                }
              }
            } else {
              // Get the converted asset specifically for this asset ID
              const convertedAsset = await storage.getConvertedAsset(
                assetId,
                format,
                isDarkVariant
              );

              if (convertedAsset) {
                console.log(
                  `Found converted asset - ID: ${convertedAsset.id}, Original ID: ${convertedAsset.originalAssetId}, Format: ${convertedAsset.format}, Dark: ${convertedAsset.isDarkVariant}`
                );
                // Verify this converted asset actually belongs to the requested asset
                if (convertedAsset.originalAssetId !== assetId) {
                  console.error(
                    `ERROR: Converted asset ${convertedAsset.id} belongs to original asset ${convertedAsset.originalAssetId}, but we requested ${assetId}`
                  );
                } else {
                  console.log(
                    `✓ Converted asset correctly belongs to requested asset ${assetId}`
                  );
                  mimeType = convertedAsset.mimeType;
                  fileBuffer = Buffer.from(convertedAsset.fileData, "base64");
                }
              }

              if (!fileBuffer) {
                // Convert on-the-fly from dark variant
                const darkBuffer = getDarkVariantBuffer(asset);
                if (!darkBuffer) {
                  return res
                    .status(404)
                    .json({ message: "Dark variant file data not found" });
                }

                const data =
                  typeof asset.data === "string"
                    ? JSON.parse(asset.data)
                    : asset.data;
                const sourceFormat = data.darkVariantFormat || data.format;

                try {
                  const result = await convertToFormat(
                    darkBuffer,
                    sourceFormat,
                    format,
                    assetId
                  );
                  fileBuffer = result.data;
                  mimeType = result.mimeType;

                  // Store the converted dark variant for future use
                  try {
                    await storage.createConvertedAsset({
                      originalAssetId: assetId,
                      format,
                      fileData: fileBuffer.toString("base64"),
                      mimeType,
                      isDarkVariant: true,
                    });
                    console.log(
                      `Successfully stored dark variant converted asset format ${format} for asset ID ${assetId}`
                    );
                  } catch (storeError) {
                    console.error(
                      "Failed to store dark variant converted asset:",
                      storeError
                    );
                  }
                } catch (conversionError) {
                  console.error(
                    "Dark variant format conversion failed:",
                    conversionError
                  );
                  return res
                    .status(400)
                    .json({ message: "Dark variant format conversion failed" });
                }
              }
            }
          } else {
            // Light variant or regular format conversion
            console.log(
              `Looking for converted asset - Original ID: ${assetId}, Format: ${format}, Dark: ${isDarkVariant}`
            );
            const convertedAsset = await storage.getConvertedAsset(
              assetId,
              format,
              isDarkVariant
            );

            if (convertedAsset && convertedAsset.originalAssetId === assetId) {
              console.log(
                `Serving converted asset - ID: ${convertedAsset.id}, Original ID: ${convertedAsset.originalAssetId}, Format: ${convertedAsset.format}, Dark: ${convertedAsset.isDarkVariant}`
              );
              mimeType = convertedAsset.mimeType;
              fileBuffer = Buffer.from(convertedAsset.fileData, "base64");
            } else {
              // Convert on-the-fly
              console.log(
                `Requested format ${format} not found, converting on-the-fly`
              );

              if (!asset.fileData) {
                console.error("Asset fileData is null");
                return res
                  .status(400)
                  .json({ message: "Asset file data not found" });
              }
              const sourceBuffer = Buffer.from(asset.fileData, "base64");
              const assetData =
                typeof asset.data === "string"
                  ? JSON.parse(asset.data)
                  : asset.data;
              const sourceFormat = assetData?.format || "png";

              try {
                const result = await convertToFormat(
                  sourceBuffer,
                  sourceFormat,
                  format,
                  assetId
                );
                fileBuffer = result.data;
                mimeType = result.mimeType;

                // Store the converted asset for future use
                try {
                  await storage.createConvertedAsset({
                    originalAssetId: assetId,
                    format,
                    fileData: fileBuffer.toString("base64"),
                    mimeType,
                    isDarkVariant: false,
                  });
                  console.log(
                    `Successfully stored converted asset format ${format} for asset ID ${assetId}`
                  );
                } catch (storeError) {
                  console.error("Failed to store converted asset:", storeError);
                }
              } catch (conversionError) {
                console.error("Format conversion failed:", conversionError);
                return res
                  .status(400)
                  .json({ message: "Format conversion failed" });
              }
            }
          }
        }
        // For logos with dark variants using the old method (backward compatibility)
        else if (variant === "dark" && asset.category === "logo" && !format) {
          const darkBuffer = getDarkVariantBuffer(asset);

          if (darkBuffer) {
            const data =
              typeof asset.data === "string"
                ? JSON.parse(asset.data)
                : asset.data;
            mimeType =
              data.darkVariantMimeType ||
              asset.mimeType ||
              "application/octet-stream";
            fileBuffer = darkBuffer;
          } else {
            return res
              .status(404)
              .json({ message: "Dark variant file data not found" });
          }
        }
        // Default case - serve the main file
        else {
          if (!asset.fileData) {
            return res
              .status(404)
              .json({ message: "Asset file data not found" });
          }

          mimeType = asset.mimeType || "application/octet-stream";
          fileBuffer = Buffer.from(asset.fileData, "base64");
        }

        // Skip resizing for vector formats like SVG, AI, EPS, and PDF
        // preserveVector is already declared above
        const isVectorFormat =
          (mimeType &&
            ["image/svg+xml", "application/postscript", "application/pdf"].some(
              (type) => mimeType?.includes(type)
            )) ||
          ["svg", "ai", "eps", "pdf"].includes(format?.toLowerCase() || "");

        // Fix content type for specific vector formats to ensure proper download
        if (format === "ai") {
          mimeType = "application/postscript";
        } else if (format === "pdf") {
          mimeType = "application/pdf";
        }

        // Log asset details to help diagnose the wrong logo issue
        console.log(
          `Asset details - Name: ${asset.name}, ID: ${asset.id}, Client ID: ${asset.clientId}`
        );

        // FIXED VECTOR HANDLING: Special handling for SVG assets that need resizing
        if (
          size &&
          size > 0 &&
          isVectorFormat &&
          (format === "png" || format === "jpg" || format === "jpeg")
        ) {
          try {
            // For vector-to-raster conversion with resizing, we'll handle SVG specially
            if (mimeType === "image/svg+xml" || (asset.fileData && !format)) {
              console.log(
                `Converting SVG to ${format} with proper sizing for ID: ${asset.id}, Client: ${asset.clientId}`
              );

              // Import sharp directly
              const sharp = (await import("sharp")).default;

              // Extract SVG dimensions for accurate aspect ratio
              const svgString = fileBuffer.toString("utf-8");
              let svgWidth = 500;
              let svgHeight = 500;

              // Try to extract dimensions from SVG viewBox
              const viewBoxMatch = svgString.match(/viewBox=["']([^"']*)["']/);
              if (viewBoxMatch?.[1]) {
                const viewBoxParts = viewBoxMatch[1]
                  .split(/\s+/)
                  .map(parseFloat);
                if (viewBoxParts.length >= 4) {
                  svgWidth = viewBoxParts[2];
                  svgHeight = viewBoxParts[3];
                }
              }

              // Calculate target dimensions with proper aspect ratio
              const width = Math.round(size); // Target width in pixels
              const height = preserveRatio
                ? Math.round((width / svgWidth) * svgHeight)
                : width;

              console.log(
                `Converting SVG (${asset.id}) from ${svgWidth}x${svgHeight} to ${width}x${height}px ${format}`
              );

              // Use high-density rendering for SVG to prevent pixelation at larger sizes
              const sharpInstance = sharp(fileBuffer, {
                density: Math.min(1200, width * 2),
              });

              // Create high-quality raster output
              if (format === "png") {
                fileBuffer = await sharpInstance
                  .resize(width, height)
                  .png({ quality: 100 })
                  .toBuffer();
                mimeType = "image/png";
              } else {
                fileBuffer = await sharpInstance
                  .resize(width, height)
                  .jpeg({ quality: 95 })
                  .toBuffer();
                mimeType = "image/jpeg";
              }

              console.log(
                `Successfully converted SVG to ${format} at ${width}x${height}px`
              );
              return res.set("Content-Type", mimeType).send(fileBuffer);
            }
          } catch (vectorError: unknown) {
            console.error(
              "Error handling vector-to-raster conversion:",
              vectorError instanceof Error
                ? vectorError.message
                : "Unknown error"
            );
          }
        }

        // Standard resize for raster images
        if (
          size &&
          size > 0 &&
          mimeType &&
          isImageFormat(mimeType) &&
          !isVectorFormat &&
          !preserveVector
        ) {
          try {
            // Import sharp directly to avoid require() issues
            const sharp = (await import("sharp")).default;

            // Create a sharp instance from the buffer
            const image = sharp(fileBuffer);
            const metadata = await image.metadata();

            // Get original dimensions
            const originalWidth = metadata.width || 500;
            const originalHeight = metadata.height || 500;

            // Calculate new dimensions - always interpret size parameter as exact pixel width
            const width = Math.round(size); // Ensure it's an integer
            const height = preserveRatio
              ? Math.round((width / originalWidth) * originalHeight)
              : width;

            console.log(
              `Resizing asset ${asset.id} (${asset.name}, Client: ${asset.clientId}) from ${originalWidth}x${originalHeight} to ${width}x${height}px`
            );

            // Perform the resize operation with high quality settings
            fileBuffer = await image
              .resize({
                width: width,
                height: height,
                fit: preserveRatio ? "inside" : "fill",
                kernel: "lanczos3", // Use high-quality resize algorithm
              })
              .toBuffer();

            console.log(`Successfully resized image to ${width}x${height}px`);
          } catch (resizeError: unknown) {
            console.error(
              "Image resize failed:",
              resizeError instanceof Error
                ? resizeError.message
                : "Unknown error"
            );
            // Continue with the original image if resize fails
          }
        } else if (isVectorFormat || preserveVector) {
          console.log(
            `Skipping resize for vector format: ${format || mimeType}. Preserving vector properties.`
          );
        }

        if (!fileBuffer || !mimeType) {
          console.error("Failed to prepare file buffer or mime type");
          return res
            .status(500)
            .json({ message: "Failed to serve asset file" });
        }

        res.setHeader("Content-Type", mimeType);
        return res.send(fileBuffer);
      } catch (error: unknown) {
        console.error(
          "Error serving asset file:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error serving asset file" });
      }
    }
  );

  // Helper function to get dark variant buffer
  function getDarkVariantBuffer(asset: BrandAsset): Buffer | null {
    if (!asset) {
      return null;
    }

    try {
      const data =
        typeof asset.data === "string" ? JSON.parse(asset.data) : asset.data;

      if (data?.darkVariantFileData) {
        const buffer = Buffer.from(data.darkVariantFileData, "base64");
        return buffer;
      }
    } catch (error: unknown) {
      console.error(
        "Error parsing dark variant data:",
        error instanceof Error ? error.message : "Unknown error"
      );
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
  ): Promise<{ data: Buffer; mimeType: string }> {
    if (!buffer) {
      throw new Error("Invalid source buffer for conversion");
    }

    // CRITICAL FIX: Additional validation to ensure we have the right data
    if (buffer.length < 100) {
      console.error(
        `ERROR: Source buffer suspiciously small (${buffer.length} bytes) for asset ID ${assetId || "unknown"}`
      );
    }

    console.log(
      `Converting from ${sourceFormat} to ${targetFormat} for asset ID ${assetId || "unknown"}`
    );

    try {
      // Use the file converter utility
      const { convertToAllFormats } = await import("../utils/file-converter");
      const convertedFiles = await convertToAllFormats(buffer, sourceFormat);

      // Find the target format in the converted files
      const targetFile = convertedFiles.find(
        (file) => file.format.toLowerCase() === targetFormat.toLowerCase()
      );

      if (!targetFile) {
        throw new Error(`Conversion to ${targetFormat} failed`);
      }

      return {
        data: targetFile.data,
        mimeType: targetFile.mimeType,
      };
    } catch (error: unknown) {
      console.error(
        "Error in format conversion:",
        error instanceof Error ? error.message : "Unknown error"
      );
      throw new Error(
        `Failed to convert ${sourceFormat} to ${targetFormat}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Direct download endpoint without client ID (for public/direct access)
  app.get("/api/assets/:assetId/download", async (req, res: Response) => {
    // Redirect to the existing /file endpoint with the same parameters
    const assetId = req.params.assetId;
    const query = new URLSearchParams(req.query as Record<string, string>);
    const queryString = query.toString();
    const redirectUrl = `/api/assets/${assetId}/file${queryString ? `?${queryString}` : ""}`;

    console.log(`Redirecting direct /download request to: ${redirectUrl}`);
    return res.redirect(302, redirectUrl);
  });

  // Add the missing /download endpoint that matches the URLs being generated
  app.get(
    "/api/clients/:clientId/assets/:assetId/download",
    validateClientId,
    async (req: RequestWithClientId, res: Response) => {
      // Redirect to the existing /file endpoint with the same parameters
      const assetId = req.params.assetId;
      const query = new URLSearchParams(req.query as Record<string, string>);
      const queryString = query.toString();
      const redirectUrl = `/api/assets/${assetId}/file${queryString ? `?${queryString}` : ""}`;

      console.log(`Redirecting /download request to: ${redirectUrl}`);
      return res.redirect(302, redirectUrl);
    }
  );

  // Get converted assets for a specific asset
  app.get("/api/assets/:assetId/converted", async (req, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId, 10);
      const asset = await storage.getAsset(assetId);

      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }

      if (asset.category !== "logo") {
        return res
          .status(400)
          .json({ message: "Only logo assets have converted formats" });
      }

      const convertedAssets = await storage.getConvertedAssets(assetId);

      // Group by format and variant
      const parsedData =
        typeof asset.data === "string"
          ? JSON.parse(asset.data as string)
          : asset.data;

      const result = {
        original: {
          format:
            parsedData &&
            typeof parsedData === "object" &&
            "format" in parsedData
              ? parsedData.format
              : "unknown",
          mimeType: asset.mimeType,
          isDark: false,
        },
        converted: convertedAssets.map((ca) => ({
          format: ca.format,
          mimeType: ca.mimeType,
          isDark: ca.isDarkVariant,
        })),
      };

      res.json(result);
    } catch (error: unknown) {
      console.error(
        "Error fetching converted assets:",
        error instanceof Error ? error.message : "Unknown error"
      );
      res.status(500).json({ message: "Error fetching converted assets" });
    }
  });

  // Get thumbnail for an asset
  app.get(
    "/api/assets/:assetId/thumbnail/:size",
    async (req, res: Response) => {
      try {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const assetId = parseInt(req.params.assetId, 10);
        const size = req.params.size as "small" | "medium" | "large";

        // Validate size parameter
        if (!["small", "medium", "large"].includes(size)) {
          return res.status(400).json({ message: "Invalid thumbnail size" });
        }

        // Get user's role to determine client access
        const { users } = await import("@shared/schema");
        const { UserRole } = await import("@shared/schema");
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, req.session.userId));

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        // Get client IDs based on user role
        let clientIds: number[];
        if (user.role === UserRole.SUPER_ADMIN) {
          // Super admins see all assets from all clients
          const { clients } = await import("@shared/schema");
          const allClients = await db.select({ id: clients.id }).from(clients);
          clientIds = allClients.map((c) => c.id);
        } else {
          // Regular users see only assets from their assigned clients
          const userClients = await db
            .select()
            .from(fileUserClients)
            .where(eq(fileUserClients.userId, req.session.userId));

          if (userClients.length === 0) {
            return res.status(403).json({ message: "Not authorized" });
          }

          clientIds = userClients.map((uc) => uc.clientId);
        }

        // Get asset from database (file asset) - check user has access to this client
        const [asset] = await db
          .select()
          .from(fileAssets)
          .where(
            and(
              eq(fileAssets.id, assetId),
              isNull(fileAssets.deletedAt),
              inArray(fileAssets.clientId, clientIds)
            )
          );

        if (!asset) {
          return res.status(404).json({ message: "Asset not found" });
        }

        // Check if user has read permission
        const { checkAssetPermission } = await import(
          "../services/asset-permissions"
        );
        const permission = await checkAssetPermission(
          req.session.userId,
          assetId,
          asset.clientId,
          "read"
        );

        if (!permission.allowed || !permission.asset) {
          return res
            .status(403)
            .json({ message: "Not authorized to view this asset" });
        }

        // Import thumbnail service
        const {
          canGenerateThumbnail,
          getOrGenerateThumbnail,
          getFileTypeIcon,
        } = await import("../services/thumbnail");

        // Check if we can generate a thumbnail for this file type
        if (!canGenerateThumbnail(asset.fileType || "")) {
          // Return file type icon name instead
          const iconName = getFileTypeIcon(asset.fileType || "");
          return res.json({ icon: iconName });
        }

        // Download file from storage
        const { downloadFile } = await import("../storage/index");
        const downloadResult = await downloadFile(asset.storagePath);

        if (!downloadResult.success || !downloadResult.data) {
          return res
            .status(404)
            .json({ message: downloadResult.error || "File not found" });
        }

        const fileBuffer = downloadResult.data;

        // Create a temporary file path for processing
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const os = await import("node:os");

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(
          tempDir,
          `asset-${assetId}-${Date.now()}`
        );

        // Write the buffer to temp file
        await fs.writeFile(tempFilePath, fileBuffer);

        try {
          // Generate or get cached thumbnail (returns storage path)
          const _thumbnailStoragePath = await getOrGenerateThumbnail(
            tempFilePath,
            assetId,
            size,
            asset.fileType || ""
          );

          // Download thumbnail from storage
          const { downloadThumbnail } = await import("../services/thumbnail");
          const thumbnailBuffer = await downloadThumbnail(assetId, size);

          res.setHeader("Content-Type", "image/jpeg");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.send(thumbnailBuffer);
        } finally {
          // Clean up temp file
          try {
            await fs.unlink(tempFilePath);
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (error: unknown) {
        console.error(
          "Error generating thumbnail:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error generating thumbnail" });
      }
    }
  );
}
