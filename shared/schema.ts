import { pgTable, text, serial, integer, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Define valid logo types
export const LogoType = {
  MAIN: "main",
  VERTICAL: "vertical",
  HORIZONTAL: "horizontal",
  SQUARE: "square",
  APP_ICON: "app_icon",
  FAVICON: "favicon",
} as const;

// Define valid font sources
export const FontSource = {
  GOOGLE: "google",
  ADOBE: "adobe",
  CUSTOM: "custom",
} as const;

export const brandAssets = pgTable("brand_assets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  category: text("category", { 
    enum: ["logo", "color", "typography", "pattern", "icon", "illustration"] 
  }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  // For colors: { hex: string, labels: { rgb?: string, cmyk?: string, hsl?: string, pantone?: string } }
  // For logos: { type: LogoType, url: string }
  // For fonts: { source: FontSource, family: string, url?: string }
  data: json("data").notNull(),
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
    data: z.union([
      // Color asset
      z.object({
        hex: z.string(),
        labels: z.object({
          rgb: z.string().optional(),
          cmyk: z.string().optional(),
          hsl: z.string().optional(),
          pantone: z.string().optional(),
        }),
      }),
      // Logo asset
      z.object({
        type: z.enum([
          LogoType.MAIN,
          LogoType.VERTICAL,
          LogoType.HORIZONTAL,
          LogoType.SQUARE,
          LogoType.APP_ICON,
          LogoType.FAVICON,
        ]),
        url: z.string().url(),
      }),
      // Font asset
      z.object({
        source: z.enum([
          FontSource.GOOGLE,
          FontSource.ADOBE,
          FontSource.CUSTOM,
        ]),
        family: z.string(),
        url: z.string().url().optional(),
      }),
    ]),
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
export const FONT_SOURCES = Object.values(FontSource);