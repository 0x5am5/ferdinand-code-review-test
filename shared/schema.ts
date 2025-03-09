import { pgTable, text, serial, integer, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define valid logo types
export const LogoType = {
  MAIN: "main",
  VERTICAL: "vertical",
  HORIZONTAL: "horizontal",
  SQUARE: "square",
  APP_ICON: "app_icon",
  FAVICON: "favicon",
} as const;

// Define valid file formats
export const FILE_FORMATS = {
  PNG: "png",
  SVG: "svg",
  JPG: "jpg",
  JPEG: "jpeg"
} as const;

// Define color categories
export const ColorCategory = {
  BRAND: "brand",
  NEUTRAL: "neutral",
  INTERACTIVE: "interactive"
} as const;

// Add font-specific constants
export const FontSource = {
  ADOBE: "adobe",
  GOOGLE: "google",
  CUSTOM: "custom",
} as const;

export const FontFormat = {
  WOFF: "woff",
  WOFF2: "woff2",
  OTF: "otf",
  TTF: "ttf",
  EOT: "eot",
} as const;

export const brandAssets = pgTable("brand_assets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["logo", "color", "typography"]
  }).notNull(),
  data: json("data"),
  fileData: text("file_data"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  website: text("website"),
  address: text("address"),
  phone: text("phone"),
  logo: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "client", "guest"] }).notNull(),
  clientId: integer("client_id").references(() => clients.id),
});

// Schema for colors with required fields for validation
export const insertColorAssetSchema = createInsertSchema(brandAssets)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: z.literal("color"),
    data: z.object({
      type: z.enum(["solid", "gradient"]),
      category: z.enum(Object.values(ColorCategory) as [string, ...string[]]),
      colors: z.array(z.object({
        hex: z.string(),
        rgb: z.string().optional(),
        hsl: z.string().optional(),
        cmyk: z.string().optional(),
        pantone: z.string().optional(),
      })).min(1),
      tints: z.array(z.object({
        percentage: z.number(),
        hex: z.string(),
      })).optional(),
      shades: z.array(z.object({
        percentage: z.number(),
        hex: z.string(),
      })).optional(),
    }),
  });

// Schema for logos with required fields for validation
export const insertBrandAssetSchema = createInsertSchema(brandAssets)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: z.literal("logo"),
    data: z.object({
      type: z.enum(Object.values(LogoType) as [string, ...string[]]),
      format: z.enum(Object.values(FILE_FORMATS) as [string, ...string[]]),
      fileName: z.string(),
    }),
    fileData: z.string(),
    mimeType: z.string(),
  });

// Update font-specific schema to handle all font sources correctly
export const insertFontAssetSchema = createInsertSchema(brandAssets)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: z.literal("typography"),
    data: z.object({
      source: z.enum(Object.values(FontSource) as [string, ...string[]]),
      family: z.string(),
      weights: z.array(z.number()).min(1),
      styles: z.array(z.string()).min(1),
      formats: z.array(z.enum(Object.values(FontFormat) as [string, ...string[]])).min(1),
      files: z.array(z.object({
        format: z.enum(Object.values(FontFormat) as [string, ...string[]]),
        weight: z.number(),
        style: z.string(),
        url: z.string().optional(), // For Google Fonts
        fileData: z.string().optional(), // For custom uploads (base64)
      })).optional(),
      projectId: z.string().optional(), // For Adobe Fonts
      projectUrl: z.string().optional(), // For Adobe/Google Fonts
      previewText: z.string().optional(),
      characters: z.string().optional(),
    }).refine((data) => {
      // Adobe Fonts requires projectId
      if (data.source === FontSource.ADOBE) {
        return !!data.projectId;
      }
      // Google Fonts requires projectUrl
      if (data.source === FontSource.GOOGLE) {
        return !!data.projectUrl;
      }
      // Custom fonts require files array
      if (data.source === FontSource.CUSTOM) {
        return Array.isArray(data.files) && data.files.length > 0;
      }
      return true;
    }, {
      message: "Missing required fields for the selected font source",
    }),
  });

// Export types
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type BrandAsset = typeof brandAssets.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertBrandAsset = z.infer<typeof insertBrandAssetSchema>;
export type InsertColorAsset = z.infer<typeof insertColorAssetSchema>;
export type InsertFontAsset = z.infer<typeof insertFontAssetSchema>;

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });

// Export constants
export const LOGO_TYPES = Object.values(LogoType);
export const FILE_FORMAT_LIST = Object.values(FILE_FORMATS);
export const COLOR_CATEGORIES = Object.values(ColorCategory);
export const FONT_SOURCES = Object.values(FontSource);
export const FONT_FORMATS = Object.values(FontFormat);