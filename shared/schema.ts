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
  PDF: "pdf",
  AI: "ai",
  FIGMA: "figma",
} as const;

export const brandAssets = pgTable("brand_assets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  category: text("category", { 
    enum: ["logo", "color", "typography"] 
  }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  data: json("data").notNull(),
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

// Create Zod schemas for type validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertClientSchema = createInsertSchema(clients).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});

// Extended schema for brand assets with specific validation
export const insertBrandAssetSchema = createInsertSchema(brandAssets)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: z.literal("logo"),
    data: z.object({
      type: z.enum([
        LogoType.MAIN,
        LogoType.VERTICAL,
        LogoType.HORIZONTAL,
        LogoType.SQUARE,
        LogoType.APP_ICON,
        LogoType.FAVICON,
      ]),
      format: z.enum(Object.values(FILE_FORMATS) as [string, ...string[]]),
      fileName: z.string(),
    }),
  });

// Export types
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type BrandAsset = typeof brandAssets.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertBrandAsset = z.infer<typeof insertBrandAssetSchema>;

// Export constants
export const LOGO_TYPES = Object.values(LogoType);