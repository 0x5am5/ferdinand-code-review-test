import {
  pgTable,
  text,
  serial,
  integer,
  json,
  timestamp,
  boolean,
  jsonb,
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
  PDF: "pdf",
  AI: "ai",
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

export const TypeScaleUnit = {
  PX: "px",
  REM: "rem",
  EM: "em",
} as const;

export const TypeScaleRatio = {
  MAJOR_SECOND: 1.125,
  MINOR_THIRD: 1.2,
  MAJOR_THIRD: 1.25,
  PERFECT_FOURTH: 1.333,
  AUGMENTED_FOURTH: 1.414,
  PERFECT_FIFTH: 1.5,
  GOLDEN_RATIO: 1.618,
  MAJOR_SIXTH: 1.667,
  MINOR_SEVENTH: 1.778,
  MAJOR_SEVENTH: 1.875,
  OCTAVE: 2,
} as const;

// Database Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", {
    enum: ["super_admin", "admin", "editor", "standard", "guest"],
  }).notNull(),
  client_id: integer("client_id"),
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
  userId: integer("user_id"),
  // Feature toggles
  featureToggles: json("feature_toggles").default({
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
    figmaIntegration: false,
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

export const convertedAssets = pgTable("converted_assets", {
  id: serial("id").primaryKey(),
  originalAssetId: integer("original_asset_id")
    .notNull()
    .references(() => brandAssets.id),
  format: text("format", {
    enum: Object.values(FILE_FORMATS) as [string, ...string[]],
  }).notNull(),
  fileData: text("file_data").notNull(),
  mimeType: text("mime_type").notNull(),
  isDarkVariant: boolean("is_dark_variant").default(false),
  createdAt: timestamp("created_at").defaultNow(),
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
    enum: ["super_admin", "admin", "editor", "standard", "guest"],
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
// Table to store hidden sections for each client
export const hiddenSections = pgTable("hidden_sections", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  sectionType: text("section_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const typeScales = pgTable("type_scales", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  name: text("name").notNull(),
  unit: text("unit", {
    enum: ["px", "rem", "em"],
  }).notNull().default("px"),
  baseSize: integer("base_size").notNull().default(16),
  scaleRatio: integer("scale_ratio").notNull().default(1250), // stored as integer (1.25 * 1000)
  customRatio: integer("custom_ratio"), // for custom ratios
  bodyFontFamily: text("body_font_family").default(""),
  bodyFontWeight: text("body_font_weight").default("400"),
  bodyLetterSpacing: integer("body_letter_spacing").default(0), // stored as integer (em * 1000)
  bodyColor: text("body_color").default("#000000"),
  headerFontFamily: text("header_font_family").default(""),
  headerFontWeight: text("header_font_weight").default("700"),
  headerLetterSpacing: integer("header_letter_spacing").default(0), // stored as integer (em * 1000)
  headerColor: text("header_color").default("#000000"),
  responsiveSizes: json("responsive_sizes").default({
    mobile: { baseSize: 14, scaleRatio: 1.125 },
    tablet: { baseSize: 15, scaleRatio: 1.2 },
    desktop: { baseSize: 16, scaleRatio: 1.25 }
  }),
  typeStyles: json("type_styles").default([
    { level: "h1", name: "Heading 1", size: 4, fontWeight: "700", lineHeight: 1.2, letterSpacing: 0, color: "#000000" },
    { level: "h2", name: "Heading 2", size: 3, fontWeight: "600", lineHeight: 1.3, letterSpacing: 0, color: "#000000" },
    { level: "h3", name: "Heading 3", size: 2, fontWeight: "600", lineHeight: 1.4, letterSpacing: 0, color: "#000000" },
    { level: "h4", name: "Heading 4", size: 1, fontWeight: "500", lineHeight: 1.4, letterSpacing: 0, color: "#000000" },
    { level: "h5", name: "Heading 5", size: 0, fontWeight: "500", lineHeight: 1.5, letterSpacing: 0, color: "#000000" },
    { level: "h6", name: "Heading 6", size: 0, fontWeight: "500", lineHeight: 1.5, letterSpacing: 0, color: "#000000" },
    { level: "body", name: "Body Text", size: 0, fontWeight: "400", lineHeight: 1.6, letterSpacing: 0, color: "#000000" },
    { level: "small", name: "Small Text", size: -1, fontWeight: "400", lineHeight: 1.5, letterSpacing: 0, color: "#666666" }
  ]),
  exports: json("exports").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  individual_header_styles: jsonb("individual_header_styles").default('{}'),
  individual_body_styles: jsonb("individual_body_styles").default('{}'),
});

// Figma Integration Tables
export const figmaConnections = pgTable("figma_connections", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  figmaFileId: text("figma_file_id").notNull(),
  figmaFileKey: text("figma_file_key").notNull(),
  figmaFileName: text("figma_file_name").notNull(),
  figmaTeamId: text("figma_team_id"),
  accessToken: text("access_token").notNull(), // Encrypted Figma access token
  refreshToken: text("refresh_token"), // OAuth refresh token if using OAuth
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status", {
    enum: ["idle", "syncing", "success", "error"],
  }).default("idle"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const figmaSyncLogs = pgTable("figma_sync_logs", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id")
    .notNull()
    .references(() => figmaConnections.id),
  syncType: text("sync_type", {
    enum: ["pull_from_figma", "push_to_figma", "bidirectional"],
  }).notNull(),
  syncDirection: text("sync_direction", {
    enum: ["figma_to_ferdinand", "ferdinand_to_figma"],
  }).notNull(),
  elementsChanged: json("elements_changed"), // Array of changed design tokens/styles
  conflictsDetected: json("conflicts_detected"), // Array of conflicts found
  conflictsResolved: json("conflicts_resolved"), // How conflicts were resolved
  status: text("status", {
    enum: ["started", "completed", "failed"],
  }).notNull(),
  errorMessage: text("error_message"),
  duration: integer("duration"), // Sync duration in milliseconds
  createdAt: timestamp("created_at").defaultNow(),
});

export const figmaDesignTokens = pgTable("figma_design_tokens", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id")
    .notNull()
    .references(() => figmaConnections.id),
  tokenType: text("token_type", {
    enum: ["color", "typography", "spacing", "border_radius", "shadow"],
  }).notNull(),
  tokenName: text("token_name").notNull(),
  figmaId: text("figma_id"), // Figma style ID
  ferdinandValue: json("ferdinand_value").notNull(), // Value stored in Ferdinand
  figmaValue: json("figma_value"), // Last known value from Figma
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status", {
    enum: ["in_sync", "ferdinand_newer", "figma_newer", "conflict"],
  }).default("in_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  userClients: many(userClients),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  userClients: many(userClients),
  hiddenSections: many(hiddenSections),
  typeScales: many(typeScales),
  figmaConnections: many(figmaConnections),
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

export const brandAssetsRelations = relations(brandAssets, ({ many }) => ({
  convertedAssets: many(convertedAssets),
}));

export const convertedAssetsRelations = relations(convertedAssets, ({ one }) => ({
  originalAsset: one(brandAssets, {
    fields: [convertedAssets.originalAssetId],
    references: [brandAssets.id],
  }),
}));

export const typeScalesRelations = relations(typeScales, ({ one }) => ({
  client: one(clients, {
    fields: [typeScales.clientId],
    references: [clients.id],
  }),
}));

export const figmaConnectionsRelations = relations(figmaConnections, ({ one, many }) => ({
  client: one(clients, {
    fields: [figmaConnections.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [figmaConnections.userId],
    references: [users.id],
  }),
  syncLogs: many(figmaSyncLogs),
  designTokens: many(figmaDesignTokens),
}));

export const figmaSyncLogsRelations = relations(figmaSyncLogs, ({ one }) => ({
  connection: one(figmaConnections, {
    fields: [figmaSyncLogs.connectionId],
    references: [figmaConnections.id],
  }),
}));

export const figmaDesignTokensRelations = relations(figmaDesignTokens, ({ one }) => ({
  connection: one(figmaConnections, {
    fields: [figmaDesignTokens.connectionId],
    references: [figmaConnections.id],
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
      gradient: z
        .object({
          type: z.enum(["linear", "radial"]),
          stops: z.array(
            z.object({
              color: z.string(),
              position: z.number().min(0).max(100),
            })
          ).min(2),
        })
        .optional(),
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
    fileData: z.string().nullable().optional(),
    mimeType: z.string().nullable().optional(),
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

export const insertConvertedAssetSchema = createInsertSchema(convertedAssets)
  .omit({ id: true, createdAt: true })
  .extend({
    format: z.enum(Object.values(FILE_FORMATS) as [string, ...string[]]),
    fileData: z.string(),
    mimeType: z.string(),
  });

export const insertHiddenSectionSchema = createInsertSchema(hiddenSections)
  .omit({ id: true, createdAt: true });

export const insertTypeScaleSchema = createInsertSchema(typeScales)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    unit: z.enum(["px", "rem", "em"]),
    baseSize: z.number().min(8).max(72),
    scaleRatio: z.number().min(1000).max(3000), // 1.0 to 3.0 stored as integers
    customRatio: z.number().min(1000).max(3000).optional(),
    bodyLetterSpacing: z.number().min(-1000).max(1000), // stored as integer (em * 1000)
    headerLetterSpacing: z.number().min(-1000).max(1000), // stored as integer (em * 1000)
    responsiveSizes: z.object({
      mobile: z.object({
        baseSize: z.number().min(8).max(72),
        scaleRatio: z.number().min(1.0).max(3.0)
      }),
      tablet: z.object({
        baseSize: z.number().min(8).max(72),
        scaleRatio: z.number().min(1.0).max(3.0)
      }),
      desktop: z.object({
        baseSize: z.number().min(8).max(72),
        scaleRatio: z.number().min(1.0).max(3.0)
      })
    }).optional(),
    typeStyles: z.array(z.object({
      level: z.string(),
      name: z.string(),
      size: z.number(),
      fontWeight: z.string(),
      lineHeight: z.number(),
      letterSpacing: z.number(),
      color: z.string(),
      backgroundColor: z.string().optional(),
      textDecoration: z.string().optional(),
      fontStyle: z.string().optional()
    })).optional(),
    exports: z.array(z.object({
      format: z.enum(["css", "scss", "figma", "adobe"]),
      content: z.string(),
      fileName: z.string(),
      exportedAt: z.string()
    })).optional()
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
export type ConvertedAsset = typeof convertedAssets.$inferSelect;
export type UserPersona = typeof userPersonas.$inferSelect;
export type UserClient = typeof userClients.$inferSelect;
export type InspirationSection = typeof inspirationSections.$inferSelect;
export type InspirationImage = typeof inspirationImages.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type HiddenSection = typeof hiddenSections.$inferSelect;
export type TypeScaleDB = typeof typeScales.$inferSelect;

// Insert Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertBrandAsset = z.infer<typeof insertBrandAssetSchema>;
export type InsertFontAsset = z.infer<typeof insertFontAssetSchema>;
export type InsertColorAsset = z.infer<typeof insertColorAssetSchema>;
export type InsertConvertedAsset = z.infer<typeof insertConvertedAssetSchema>;
export type InsertUserPersona = z.infer<typeof insertUserPersonaSchema>;
export type InsertUserClient = z.infer<typeof insertUserClientSchema>;
export type InsertInspirationSection = z.infer<
  typeof insertInspirationSectionSchema
>;
export type InsertInspirationImage = z.infer<
  typeof insertInspirationImageSchema
>;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type InsertHiddenSection = z.infer<typeof insertHiddenSectionSchema>;
export type InsertTypeScale = z.infer<typeof insertTypeScaleSchema>;

// Figma Integration Insert Schemas
export const insertFigmaConnectionSchema = createInsertSchema(figmaConnections)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    figmaFileId: z.string().min(1),
    figmaFileKey: z.string().min(1),
    figmaFileName: z.string().min(1),
    figmaTeamId: z.string().optional(),
    accessToken: z.string().min(1),
    refreshToken: z.string().optional(),
  });

export const insertFigmaSyncLogSchema = createInsertSchema(figmaSyncLogs)
  .omit({ id: true, createdAt: true })
  .extend({
    syncType: z.enum(["pull_from_figma", "push_to_figma", "bidirectional"]),
    syncDirection: z.enum(["figma_to_ferdinand", "ferdinand_to_figma"]),
    status: z.enum(["started", "completed", "failed"]),
    elementsChanged: z.array(z.object({
      type: z.string(),
      name: z.string(),
      action: z.enum(["created", "updated", "deleted"])
    })).optional(),
    conflictsDetected: z.array(z.object({
      tokenType: z.string(),
      tokenName: z.string(),
      ferdinandValue: z.unknown(),
      figmaValue: z.unknown()
    })).optional(),
    conflictsResolved: z.array(z.object({
      tokenType: z.string(),
      tokenName: z.string(),
      resolution: z.enum(["ferdinand_wins", "figma_wins", "manual"])
    })).optional(),
  });

export const insertFigmaDesignTokenSchema = createInsertSchema(figmaDesignTokens)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    tokenType: z.enum(["color", "typography", "spacing", "border_radius", "shadow"]),
    tokenName: z.string().min(1),
    figmaId: z.string().optional(),
    ferdinandValue: z.unknown().optional(),
    figmaValue: z.unknown().optional(),
    syncStatus: z.enum(["in_sync", "ferdinand_newer", "figma_newer", "conflict"]).default("in_sync"),
  });

// Figma Integration Types
export type FigmaConnection = typeof figmaConnections.$inferSelect;
export type FigmaSyncLog = typeof figmaSyncLogs.$inferSelect;
export type FigmaDesignToken = typeof figmaDesignTokens.$inferSelect;
export type InsertFigmaConnection = z.infer<typeof insertFigmaConnectionSchema>;
export type InsertFigmaSyncLog = z.infer<typeof insertFigmaSyncLogSchema>;
export type InsertFigmaDesignToken = z.infer<typeof insertFigmaDesignTokenSchema>;

// Other Types
export type UpdateClientOrder = z.infer<typeof updateClientOrderSchema>;

// Feature Toggles Type
export interface FeatureToggles {
  logoSystem: boolean;
  colorSystem: boolean;
  typeSystem: boolean;
  userPersonas: boolean;
  inspiration: boolean;
  figmaIntegration: boolean;
}

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

export interface IndividualHeaderStyle {
  fontFamily?: string;
  fontWeight?: string;
  letterSpacing?: number;
  color?: string;
  fontSize?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through';
}

export interface IndividualBodyStyle {
  fontFamily?: string;
  fontWeight?: string;
  letterSpacing?: number;
  color?: string;
  fontSize?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through';
}

export interface TypeScale {
  id?: number;
  clientId: number;
  name: string;
  unit: "px" | "rem" | "em";
  baseSize: number;
  scaleRatio: number;
  customRatio?: number;
  bodyFontFamily: string;
  bodyFontWeight: string;
  bodyLetterSpacing: number;
  bodyColor: string;
  bodyTextTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  bodyFontStyle?: 'normal' | 'italic' | 'oblique';
  bodyTextDecoration?: 'none' | 'underline' | 'overline' | 'line-through';
  headerFontFamily: string;
  headerFontWeight: string;
  headerLetterSpacing: number;
  headerColor: string;
  headerTextTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  headerFontStyle?: 'normal' | 'italic' | 'oblique';
  headerTextDecoration?: 'none' | 'underline' | 'overline' | 'line-through';
  individualHeaderStyles?: {
    h1?: IndividualHeaderStyle;
    h2?: IndividualHeaderStyle;
    h3?: IndividualHeaderStyle;
    h4?: IndividualHeaderStyle;
    h5?: IndividualHeaderStyle;
    h6?: IndividualHeaderStyle;
  };
  individualBodyStyles?: {
    "body-large"?: IndividualBodyStyle;
    "body"?: IndividualBodyStyle;
    "body-small"?: IndividualBodyStyle;
    "caption"?: IndividualBodyStyle;
    "quote"?: IndividualBodyStyle;
    "code"?: IndividualBodyStyle;
    "small"?: IndividualBodyStyle;
  };
  responsiveSizes?: {
    mobile: { baseSize: number; scaleRatio: number };
    tablet: { baseSize: number; scaleRatio: number };
    desktop: { baseSize: number; scaleRatio: number };
  };
  typeStyles?: TypeStyle[];
  exports?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type TypographyLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | 
                              "body-large" | "body" | "body-small" | 
                              "caption" | "quote" | "code" | "small";

export interface TypeStyle {
  level: TypographyLevel | string;
  name: string;
  size: number;
  fontWeight: string;
  lineHeight: number;
  letterSpacing: number;
  color: string;
  backgroundColor?: string;
  textDecoration?: string;
  fontStyle?: string;
}
const individualHeaderStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontWeight: z.string().optional(),
  letterSpacing: z.number().optional(),
  color: z.string().optional(),
  fontSize: z.string().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(),
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(),
});

const individualBodyStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontWeight: z.string().optional(),
  letterSpacing: z.number().optional(),
  color: z.string().optional(),
  fontSize: z.string().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(),
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(),
});

export const insertTypeScaleSchemaExtended = insertTypeScaleSchema.extend({
  individualHeaderStyles: z.record(z.string(), individualHeaderStyleSchema).optional(),
  individualBodyStyles: z.record(z.string(), individualBodyStyleSchema).optional(),
  exports: z.array(z.string()).optional(),
});