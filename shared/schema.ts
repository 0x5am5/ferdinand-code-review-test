import {
  pgTable,
  text,
  serial,
  integer,
  json,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Constants
export const LogoType = {
  MAIN: "main",
  VERTICAL: "vertical",
  HORIZONTAL: "horizontal",
  SQUARE: "square",
  APP_ICON: "app_icon",
  FAVICON: "favicon",
} as const;

export const FILE_FORMATS = {
  PNG: "png",
  SVG: "svg",
  JPG: "jpg",
  JPEG: "jpeg",
} as const;

export const ColorCategory = {
  BRAND: "brand",
  NEUTRAL: "neutral",
  INTERACTIVE: "interactive",
} as const;

export const FontSource = {
  FILE: "file",
  ADOBE: "adobe",
  GOOGLE: "google",
} as const;

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

export const FontStyle = {
  NORMAL: "normal",
  ITALIC: "italic",
  OBLIQUE: "oblique",
} as const;

export const PersonaEventAttribute = {
  FREQUENT: "frequent",
  EARLY_PLANNER: "early_planner",
  REGIONAL: "regional",
  NATIONAL: "national",
  TRENDING: "trending",
} as const;

export const UserRole = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EDITOR: "editor",
  STANDARD: "standard",
  GUEST: "guest",
} as const;

// Database Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", {
    enum: ["super_admin", "admin", "editor", "standard", "guest"],
  }).notNull(),
  client_id: integer("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  website: text("website"),
  address: text("address"),
  phone: text("phone"),
  logo: text("logo_url"),
  primaryColor: text("primary_color"),
  displayOrder: integer("display_order"),
  userId: integer("user_id").references(() => users.id),
  // Feature toggles
  featureToggles: json("feature_toggles").default({
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
  }),
  lastEditedBy: integer("last_edited_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userClients = pgTable("user_clients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const brandAssets = pgTable("brand_assets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["logo", "color", "typography", "font"],
  }).notNull(),
  data: json("data"),
  fileData: text("file_data"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userPersonas = pgTable("user_personas", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
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

export const inspirationSections = pgTable("inspiration_sections", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  label: text("label").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inspirationImages = pgTable("inspiration_images", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => inspirationSections.id),
  url: text("url").notNull(),
  fileData: text("file_data").notNull(),
  mimeType: text("mime_type").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", {
    enum: ["super_admin", "admin", "standard", "guest"],
  }).notNull(),
  token: text("token").notNull().unique(),
  createdById: integer("created_by_id").references(() => users.id),
  clientIds: integer("client_ids").array(),
  used: boolean("used").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InviteUserForm = z.infer<typeof inviteUserSchema>;
export type UpdateUserRoleForm = z.infer<typeof updateUserRoleSchema>;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userClients: many(userClients),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  userClients: many(userClients),
}));

export const userClientsRelations = relations(userClients, ({ one }) => ({
  user: one(users, {
    fields: [userClients.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [userClients.clientId],
    references: [clients.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users)
  .extend({
    clientIds: z.array(z.number()).optional(),
  })
  .omit({ id: true });

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserClientSchema = createInsertSchema(userClients).omit({
  id: true,
  createdAt: true,
});

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

export const insertColorAssetSchema = createInsertSchema(brandAssets)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: z.literal("color"),
    data: z.object({
      type: z.enum(["solid", "gradient"]),
      category: z.enum(Object.values(ColorCategory) as [string, ...string[]]),
      colors: z
        .array(
          z.object({
            hex: z.string(),
            rgb: z.string().optional(),
            hsl: z.string().optional(),
            cmyk: z.string().optional(),
            pantone: z.string().optional(),
          }),
        )
        .min(1),
      tints: z
        .array(
          z.object({
            percentage: z.number(),
            hex: z.string(),
          }),
        )
        .optional(),
      shades: z
        .array(
          z.object({
            percentage: z.number(),
            hex: z.string(),
          }),
        )
        .optional(),
    }),
  });

export const insertFontAssetSchema = createInsertSchema(brandAssets)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: z.literal("font"),
    data: z.object({
      source: z.enum(Object.values(FontSource) as [string, ...string[]]),
      weights: z.array(
        z.enum(Object.values(FontWeight) as [string, ...string[]]),
      ),
      styles: z.array(
        z.enum(Object.values(FontStyle) as [string, ...string[]]),
      ),
      sourceData: z.object({
        projectId: z.string().optional(),
        url: z.string().url().optional(),
        files: z
          .array(
            z.object({
              weight: z.enum(
                Object.values(FontWeight) as [string, ...string[]],
              ),
              style: z.enum(Object.values(FontStyle) as [string, ...string[]]),
              format: z.enum(["woff", "woff2", "otf", "ttf", "eot"]),
              fileName: z.string(),
              fileData: z.string(),
            }),
          )
          .optional(),
      }),
    }),
  });

export const insertUserPersonaSchema = createInsertSchema(userPersonas)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    demographics: z
      .object({
        location: z.string().optional(),
        occupation: z.string().optional(),
        interests: z.array(z.string()).optional(),
      })
      .optional(),
    eventAttributes: z.array(
      z.enum(Object.values(PersonaEventAttribute) as [string, ...string[]]),
    ),
    metrics: z
      .object({
        eventAttendance: z.number().optional(),
        engagementRate: z.number().optional(),
        averageSpend: z.string().optional(),
      })
      .optional(),
  });

export const insertInspirationSectionSchema = createInsertSchema(
  inspirationSections,
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertInspirationImageSchema = createInsertSchema(
  inspirationImages,
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertInvitationSchema = createInsertSchema(invitations)
  .omit({ id: true, createdAt: true, token: true, expiresAt: true })
  .extend({
    clientIds: z.array(z.number()).optional(),
  });

export const updateClientOrderSchema = z.object({
  clientOrders: z.array(
    z.object({
      id: z.number(),
      displayOrder: z.number(),
    }),
  ),
});

// Base Types
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type BrandAsset = typeof brandAssets.$inferSelect;
export type UserPersona = typeof userPersonas.$inferSelect;
export type UserClient = typeof userClients.$inferSelect;
export type InspirationSection = typeof inspirationSections.$inferSelect;
export type InspirationImage = typeof inspirationImages.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;

// Insert Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertBrandAsset = z.infer<typeof insertBrandAssetSchema>;
export type InsertFontAsset = z.infer<typeof insertFontAssetSchema>;
export type InsertColorAsset = z.infer<typeof insertColorAssetSchema>;
export type InsertUserPersona = z.infer<typeof insertUserPersonaSchema>;
export type InsertUserClient = z.infer<typeof insertUserClientSchema>;
export type InsertInspirationSection = z.infer<
  typeof insertInspirationSectionSchema
>;
export type InsertInspirationImage = z.infer<
  typeof insertInspirationImageSchema
>;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;

// Other Types
export type UpdateClientOrder = z.infer<typeof updateClientOrderSchema>;

// Constants from enums
export const LOGO_TYPES = Object.values(LogoType);
export const FILE_FORMAT_LIST = Object.values(FILE_FORMATS);
export const COLOR_CATEGORIES = Object.values(ColorCategory);
export const FONT_SOURCES = Object.values(FontSource);
export const FONT_WEIGHTS = Object.values(FontWeight);
export const FONT_STYLES = Object.values(FontStyle);
export const PERSONA_EVENT_ATTRIBUTES = Object.values(PersonaEventAttribute);
export const USER_ROLES = Object.values(UserRole);

// Create form schemas
export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(USER_ROLES as [string, ...string[]]),
  clientIds: z.array(z.number()).optional(),
});

export const updateUserRoleSchema = z.object({
  id: z.number(),
  role: z.enum(USER_ROLES as [string, ...string[]]),
});
