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

// Define font source types
export const FontSource = {
  FILE: "file",
  ADOBE: "adobe",
  GOOGLE: "google",
} as const;

// Define font weights
export const FontWeight = {
  THIN: "100",
  EXTRA_LIGHT: "200",
  LIGHT: "300",
  REGULAR: "400",
  MEDIUM: "500",
  SEMI_BOLD: "600",
  BOLD: "700",
  EXTRA_BOLD: "800",
  BLACK: "900",
} as const;

// Define font styles
export const FontStyle = {
  NORMAL: "normal",
  ITALIC: "italic",
  OBLIQUE: "oblique",
} as const;

// Define user persona related constants
export const PersonaEventAttribute = {
  FREQUENT: "frequent",
  EARLY_PLANNER: "early_planner",
  REGIONAL: "regional",
  NATIONAL: "national",
  TRENDING: "trending"
} as const;

export const brandAssets = pgTable("brand_assets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["logo", "color", "typography", "font"]
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
  displayOrder: integer("display_order"),
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

export const userPersonas = pgTable("user_personas", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  role: text("role"),
  imageUrl: text("image_url"),
  ageRange: text("age_range"),
  demographics: json("demographics"),
  eventAttributes: json("event_attributes"),
  motivations: text("motivations").array(),
  coreNeeds: text("core_needs").array(),
  painPoints: text("pain_points").array(),
  metrics: json("metrics"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Schema for fonts with required fields for validation
export const insertFontAssetSchema = createInsertSchema(brandAssets)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: z.literal("font"),
    data: z.object({
      source: z.enum(Object.values(FontSource) as [string, ...string[]]),
      weights: z.array(z.enum(Object.values(FontWeight) as [string, ...string[]])),
      styles: z.array(z.enum(Object.values(FontStyle) as [string, ...string[]]),),
      sourceData: z.object({
        projectId: z.string().optional(),
        url: z.string().url().optional(),
        files: z.array(z.object({
          weight: z.enum(Object.values(FontWeight) as [string, ...string[]]),
          style: z.enum(Object.values(FontStyle) as [string, ...string[]]),
          format: z.enum(["woff", "woff2", "otf", "ttf", "eot"]),
          fileName: z.string(),
          fileData: z.string(),
        })).optional(),
      }),
    }),
  });

// Schema for user personas with required fields for validation
export const insertUserPersonaSchema = createInsertSchema(userPersonas)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    demographics: z.object({
      location: z.string().optional(),
      occupation: z.string().optional(),
      interests: z.array(z.string()).optional(),
    }).optional(),
    eventAttributes: z.array(z.enum(Object.values(PersonaEventAttribute) as [string, ...string[]])),
    metrics: z.object({
      eventAttendance: z.number().optional(),
      engagementRate: z.number().optional(),
      averageSpend: z.string().optional(),
    }).optional(),
  });

export const inspirationSections = pgTable("inspiration_sections", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  label: text("label").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inspirationImages = pgTable("inspiration_images", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull().references(() => inspirationSections.id),
  url: text("url").notNull(),
  fileData: text("file_data").notNull(),
  mimeType: text("mime_type").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema for inspiration board
export const insertInspirationSectionSchema = createInsertSchema(inspirationSections)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const insertInspirationImageSchema = createInsertSchema(inspirationImages)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Export types
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type BrandAsset = typeof brandAssets.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertBrandAsset = z.infer<typeof insertBrandAssetSchema>;
export type InsertColorAsset = z.infer<typeof insertColorAssetSchema>;
export type InsertFontAsset = z.infer<typeof insertFontAssetSchema>;
export type UserPersona = typeof userPersonas.$inferSelect;
export type InsertUserPersona = z.infer<typeof insertUserPersonaSchema>;

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });

// Add new type exports
export type InspirationSection = typeof inspirationSections.$inferSelect;
export type InsertInspirationSection = z.infer<typeof insertInspirationSectionSchema>;
export type InspirationImage = typeof inspirationImages.$inferSelect;
export type InsertInspirationImage = z.infer<typeof insertInspirationImageSchema>;

// Export constants
export const LOGO_TYPES = Object.values(LogoType);
export const FILE_FORMAT_LIST = Object.values(FILE_FORMATS);
export const COLOR_CATEGORIES = Object.values(ColorCategory);
export const FONT_SOURCES = Object.values(FontSource);
export const FONT_WEIGHTS = Object.values(FontWeight);
export const FONT_STYLES = Object.values(FontStyle);
export const PERSONA_EVENT_ATTRIBUTES = Object.values(PersonaEventAttribute);

// Add a new schema for order updates
export const updateClientOrderSchema = z.object({
  clientOrders: z.array(z.object({
    id: z.number(),
    displayOrder: z.number()
  }))
});

export type UpdateClientOrder = z.infer<typeof updateClientOrderSchema>;