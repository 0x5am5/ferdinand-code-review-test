import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const AssetVisibility = {
  PRIVATE: "private",
  SHARED: "shared",
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
  AUGMENTED_FOURTH: Math.SQRT2,
  PERFECT_FIFTH: 1.5,
  GOLDEN_RATIO: 1.618,
  MAJOR_SIXTH: 1.667,
  MINOR_SEVENTH: 1.778,
  MAJOR_SEVENTH: 1.875,
  OCTAVE: 2,
} as const;

// Database Tables
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", {
    enum: ["super_admin", "admin", "editor", "standard", "guest"],
  }).notNull(),
  password: text("password"), // Legacy field, kept for backward compatibility
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
  featureToggles: jsonb("feature_toggles").default({
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
    figmaIntegration: false,
    slackIntegration: false,
    brandAssets: false,
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
  fileData: text("file_data"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  data: jsonb("data"),
  sortOrder: integer("sort_order").default(0),
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
  demographics: jsonb("demographics"),
  eventAttributes: jsonb("event_attributes"),
  motivations: text("motivations").array(),
  coreNeeds: text("core_needs").array(),
  painPoints: text("pain_points").array(),
  metrics: jsonb("metrics"),
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
  })
    .notNull()
    .default("px"),
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
    desktop: { baseSize: 16, scaleRatio: 1.25 },
  }),
  typeStyles: json("type_styles").default([
    {
      level: "h1",
      name: "Heading 1",
      size: 4,
      fontWeight: "700",
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h2",
      name: "Heading 2",
      size: 3,
      fontWeight: "600",
      lineHeight: 1.3,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h3",
      name: "Heading 3",
      size: 2,
      fontWeight: "600",
      lineHeight: 1.4,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h4",
      name: "Heading 4",
      size: 1,
      fontWeight: "500",
      lineHeight: 1.4,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h5",
      name: "Heading 5",
      size: 0,
      fontWeight: "500",
      lineHeight: 1.5,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "h6",
      name: "Heading 6",
      size: 0,
      fontWeight: "500",
      lineHeight: 1.5,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "body",
      name: "Body Text",
      size: 0,
      fontWeight: "400",
      lineHeight: 1.6,
      letterSpacing: 0,
      color: "#000000",
    },
    {
      level: "small",
      name: "Small Text",
      size: -1,
      fontWeight: "400",
      lineHeight: 1.5,
      letterSpacing: 0,
      color: "#666666",
    },
  ]),
  exports: json("exports").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  individual_header_styles: text("individual_header_styles").default("{}"),
  individual_body_styles: jsonb("individual_body_styles").default("{}"),
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
  elementsChanged: jsonb("elements_changed"), // Array of changed design tokens/styles
  conflictsDetected: jsonb("conflicts_detected"), // Array of conflicts found
  conflictsResolved: jsonb("conflicts_resolved"), // How conflicts were resolved
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
  ferdinandValue: jsonb("ferdinand_value").notNull(), // Value stored in Ferdinand
  figmaValue: jsonb("figma_value"), // Last known value from Figma
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

export const convertedAssetsRelations = relations(
  convertedAssets,
  ({ one }) => ({
    originalAsset: one(brandAssets, {
      fields: [convertedAssets.originalAssetId],
      references: [brandAssets.id],
    }),
  })
);

export const typeScalesRelations = relations(typeScales, ({ one }) => ({
  client: one(clients, {
    fields: [typeScales.clientId],
    references: [clients.id],
  }),
}));

export const figmaConnectionsRelations = relations(
  figmaConnections,
  ({ one, many }) => ({
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
  })
);

export const figmaSyncLogsRelations = relations(figmaSyncLogs, ({ one }) => ({
  connection: one(figmaConnections, {
    fields: [figmaSyncLogs.connectionId],
    references: [figmaConnections.id],
  }),
}));

export const figmaDesignTokensRelations = relations(
  figmaDesignTokens,
  ({ one }) => ({
    connection: one(figmaConnections, {
      fields: [figmaDesignTokens.connectionId],
      references: [figmaConnections.id],
    }),
  })
);

// Slack Integration Tables
export const slackWorkspaces = pgTable("slack_workspaces", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  slackTeamId: text("slack_team_id").notNull().unique(),
  teamName: text("team_name").notNull(),
  botToken: text("bot_token").notNull(), // Encrypted
  botUserId: text("bot_user_id").notNull(),
  installedBy: integer("installed_by").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const slackUserMappings = pgTable(
  "slack_user_mappings",
  {
    id: serial("id").primaryKey(),
    slackUserId: text("slack_user_id").notNull(),
    slackTeamId: text("slack_team_id").notNull(),
    ferdinandUserId: integer("ferdinand_user_id").references(() => users.id),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    isActive: boolean("is_active").default(true),
  },
  (table) => ({
    // Index for finding active user mappings by Slack user/team (most common query)
    slackUserTeamIdx: index("idx_slack_user_mappings_user_team_active").on(
      table.slackUserId,
      table.slackTeamId,
      table.isActive
    ),
    // Index for queries by client ID
    clientIdIdx: index("idx_slack_user_mappings_client_id").on(table.clientId),
    // Index for queries by Ferdinand user ID
    ferdinandUserIdIdx: index("idx_slack_user_mappings_ferdinand_user").on(
      table.ferdinandUserId
    ),
  })
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    tokenHash: text("token_hash").notNull().unique(),
    tokenName: text("token_name").notNull(),
    scopes: text("scopes").array().default(["read:assets"]),
    createdBy: integer("created_by").references(() => users.id),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Index for finding active tokens by client (for listing tokens)
    clientActiveIdx: index("idx_api_tokens_client_active").on(
      table.clientId,
      table.isActive
    ),
    // Index for token validation queries
    tokenHashIdx: index("idx_api_tokens_hash_active").on(
      table.tokenHash,
      table.isActive
    ),
  })
);

export const slackConversations = pgTable("slack_conversations", {
  id: serial("id").primaryKey(),
  slackUserId: text("slack_user_id").notNull(),
  slackChannelId: text("slack_channel_id").notNull(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id),
  context: jsonb("context").default("{}"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  expiresAt: timestamp("expires_at").default(sql`(NOW() + INTERVAL '1 hour')`),
});

export const slackAuditLogs = pgTable(
  "slack_audit_logs",
  {
    id: serial("id").primaryKey(),
    slackUserId: text("slack_user_id").notNull(),
    slackWorkspaceId: text("slack_workspace_id").notNull(),
    ferdinandUserId: integer("ferdinand_user_id").references(() => users.id),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    command: text("command").notNull(),
    assetIds: integer("asset_ids").array(),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    responseTimeMs: integer("response_time_ms"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Index for audit queries by client and time (most common for reports)
    clientTimeIdx: index("idx_slack_audit_logs_client_time").on(
      table.clientId,
      table.createdAt
    ),
    // Index for finding logs by workspace
    workspaceTimeIdx: index("idx_slack_audit_logs_workspace_time").on(
      table.slackWorkspaceId,
      table.createdAt
    ),
    // Index for error analysis
    errorIdx: index("idx_slack_audit_logs_success_time").on(
      table.success,
      table.createdAt
    ),
  })
);

// Google Drive Integration Tables
export const googleDriveConnections = pgTable("google_drive_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes")
    .array()
    .default([
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ]),
  connectedAt: timestamp("connected_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Secure Drive Access Tokens (for temporary file access)
export const driveAccessTokens = pgTable(
  "drive_access_tokens",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull().unique(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    driveFileId: text("drive_file_id").notNull(),
    action: text("action", {
      enum: ["read", "download", "thumbnail"],
    }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"), // For manual revocation
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tokenIdx: index("idx_drive_access_tokens_token").on(table.token),
    expiresAtIdx: index("idx_drive_access_tokens_expires").on(table.expiresAt),
    assetIdIdx: index("idx_drive_access_tokens_asset").on(table.assetId),
    userIdIdx: index("idx_drive_access_tokens_user").on(table.userId),
  })
);

// Drive File Access Audit Logs (for security and compliance)
export const driveFileAccessLogs = pgTable(
  "drive_file_access_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    assetId: integer("asset_id").references(() => assets.id),
    driveFileId: text("drive_file_id"),
    action: text("action", {
      enum: ["read", "download", "thumbnail", "import", "list"],
    }).notNull(),
    success: boolean("success").notNull(),
    errorCode: text("error_code"), // e.g., "PERMISSION_DENIED", "FILE_NOT_FOUND"
    errorMessage: text("error_message"),
    userRole: text("user_role"),
    clientId: integer("client_id").references(() => clients.id),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").default("{}"), // Additional context
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Index for audit queries by user and time
    userTimeIdx: index("idx_drive_access_logs_user_time").on(
      table.userId,
      table.createdAt
    ),
    // Index for queries by asset
    assetTimeIdx: index("idx_drive_access_logs_asset_time").on(
      table.assetId,
      table.createdAt
    ),
    // Index for queries by client
    clientTimeIdx: index("idx_drive_access_logs_client_time").on(
      table.clientId,
      table.createdAt
    ),
    // Index for error analysis
    successIdx: index("idx_drive_access_logs_success").on(
      table.success,
      table.createdAt
    ),
    // Index for action-based queries
    actionIdx: index("idx_drive_access_logs_action").on(table.action),
  })
);

// Asset Management Tables
export const assets = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    uploadedBy: integer("uploaded_by")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    originalFileName: text("original_file_name").notNull(),
    fileType: text("file_type").notNull(), // MIME type
    fileSize: integer("file_size").notNull(), // bytes
    storagePath: text("storage_path").notNull(), // S3 or local path
    visibility: text("visibility", {
      enum: ["private", "shared"],
    })
      .notNull()
      .default("shared"),
    isGoogleDrive: boolean("is_google_drive").default(false),
    driveFileId: text("drive_file_id"),
    driveWebLink: text("drive_web_link"),
    driveLastModified: timestamp("drive_last_modified"),
    driveOwner: text("drive_owner"), // Owner email or display name
    driveThumbnailUrl: text("drive_thumbnail_url"), // Drive thumbnail URL
    driveWebContentLink: text("drive_web_content_link"), // Direct download link
    driveSharingMetadata: jsonb("drive_sharing_metadata"), // Comprehensive Drive sharing metadata
    // Thumbnail cache fields
    cachedThumbnailPath: text("cached_thumbnail_path"), // Local storage path for cached thumbnail
    thumbnailCachedAt: timestamp("thumbnail_cached_at"), // When thumbnail was last cached
    thumbnailCacheVersion: text("thumbnail_cache_version"), // Version hash to track Drive thumbnail changes
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    deletedAt: timestamp("deleted_at"), // soft delete
    // Full-text search vector column for search functionality
    searchVector: text("search_vector"),
  },
  (table) => ({
    clientIdIdx: index("idx_assets_client_id").on(table.clientId),
    uploadedByIdx: index("idx_assets_uploaded_by").on(table.uploadedBy),
    visibilityIdx: index("idx_assets_visibility").on(table.visibility),
    deletedAtIdx: index("idx_assets_deleted_at").on(table.deletedAt),
    // GIN index for full-text search
    searchVectorIdx: index("idx_assets_search_vector").using(
      "gin",
      sql`to_tsvector('english', ${table.fileName} || ' ' || ${table.originalFileName})`
    ),
  })
);

export const assetCategories = pgTable(
  "asset_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isDefault: boolean("is_default").default(false),
    clientId: integer("client_id").references(() => clients.id), // null for system defaults
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    clientIdIdx: index("idx_asset_categories_client_id").on(table.clientId),
    slugIdx: index("idx_asset_categories_slug").on(table.slug),
  })
);

export const assetTags = pgTable(
  "asset_tags",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    clientIdIdx: index("idx_asset_tags_client_id").on(table.clientId),
    slugIdx: index("idx_asset_tags_slug").on(table.slug),
    // Unique constraint on lowercase name per client
    uniqueNamePerClient: index("idx_asset_tags_unique_name_client").on(
      sql`LOWER(${table.name})`,
      table.clientId
    ),
  })
);

export const assetCategoryAssignments = pgTable(
  "asset_category_assignments",
  {
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => assetCategories.id),
  },
  (table) => ({
    pk: index("pk_asset_category_assignments").on(
      table.assetId,
      table.categoryId
    ),
    assetIdIdx: index("idx_asset_category_assignments_asset").on(table.assetId),
    categoryIdIdx: index("idx_asset_category_assignments_category").on(
      table.categoryId
    ),
  })
);

export const assetTagAssignments = pgTable(
  "asset_tag_assignments",
  {
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id),
    tagId: integer("tag_id")
      .notNull()
      .references(() => assetTags.id),
  },
  (table) => ({
    pk: index("pk_asset_tag_assignments").on(table.assetId, table.tagId),
    assetIdIdx: index("idx_asset_tag_assignments_asset").on(table.assetId),
    tagIdIdx: index("idx_asset_tag_assignments_tag").on(table.tagId),
  })
);

export const assetPublicLinks = pgTable(
  "asset_public_links",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id),
    token: text("token").notNull().unique(), // Random URL-safe token
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at"), // null = no expiry
    deletedAt: timestamp("deleted_at"), // soft delete
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    assetIdIdx: index("idx_asset_public_links_asset_id").on(table.assetId),
    tokenIdx: index("idx_asset_public_links_token").on(table.token),
    expiresAtIdx: index("idx_asset_public_links_expires_at").on(
      table.expiresAt
    ),
  })
);

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
          })
        )
        .min(1),
      gradient: z
        .object({
          type: z.enum(["linear", "radial"]),
          stops: z
            .array(
              z.object({
                color: z.string(),
                position: z.number().min(0).max(100),
              })
            )
            .min(2),
        })
        .optional(),
      tints: z
        .array(
          z.object({
            percentage: z.number(),
            hex: z.string(),
          })
        )
        .optional(),
      shades: z
        .array(
          z.object({
            percentage: z.number(),
            hex: z.string(),
          })
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
        z.enum(Object.values(FontWeight) as [string, ...string[]])
      ),
      styles: z.array(
        z.enum(Object.values(FontStyle) as [string, ...string[]])
      ),
      sourceData: z.object({
        projectId: z.string().optional(),
        url: z.string().url().optional(),
        files: z
          .array(
            z.object({
              weight: z.enum(
                Object.values(FontWeight) as [string, ...string[]]
              ),
              style: z.enum(Object.values(FontStyle) as [string, ...string[]]),
              format: z.enum(["woff", "woff2", "otf", "ttf", "eot"]),
              fileName: z.string(),
              fileData: z.string(),
            })
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
      z.enum(Object.values(PersonaEventAttribute) as [string, ...string[]])
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
  inspirationSections
).omit({ id: true, createdAt: true, updatedAt: true });

export const insertInspirationImageSchema = createInsertSchema(
  inspirationImages
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

export const insertHiddenSectionSchema = createInsertSchema(
  hiddenSections
).omit({ id: true, createdAt: true });

export const insertTypeScaleSchema = createInsertSchema(typeScales)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    unit: z.enum(["px", "rem", "em"]),
    baseSize: z.number().min(8).max(72),
    scaleRatio: z.number().min(1000).max(3000), // 1.0 to 3.0 stored as integers
    customRatio: z.number().min(1000).max(3000).optional(),
    bodyLetterSpacing: z.number().min(-1000).max(1000), // stored as integer (em * 1000)
    headerLetterSpacing: z.number().min(-1000).max(1000), // stored as integer (em * 1000)
    responsiveSizes: z
      .object({
        mobile: z.object({
          baseSize: z.number().min(8).max(72),
          scaleRatio: z.number().min(1.0).max(3.0),
        }),
        tablet: z.object({
          baseSize: z.number().min(8).max(72),
          scaleRatio: z.number().min(1.0).max(3.0),
        }),
        desktop: z.object({
          baseSize: z.number().min(8).max(72),
          scaleRatio: z.number().min(1.0).max(3.0),
        }),
      })
      .optional(),
    typeStyles: z
      .array(
        z.object({
          level: z.string(),
          name: z.string(),
          size: z.number(),
          fontWeight: z.string(),
          lineHeight: z.number(),
          letterSpacing: z.number(),
          color: z.string(),
          backgroundColor: z.string().optional(),
          textDecoration: z.string().optional(),
          fontStyle: z.string().optional(),
        })
      )
      .optional(),
    exports: z
      .array(
        z.object({
          format: z.enum(["css", "scss", "figma", "adobe"]),
          content: z.string(),
          fileName: z.string(),
          exportedAt: z.string(),
        })
      )
      .optional(),
  });

export const updateClientOrderSchema = z.object({
  clientOrders: z.array(
    z.object({
      id: z.number(),
      displayOrder: z.number(),
    })
  ),
});

// Base Types
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect & {
  featureToggles: FeatureToggles;
  lastEditedByUser?: User;
};
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
    elementsChanged: z
      .array(
        z.object({
          type: z.string(),
          name: z.string(),
          action: z.enum(["created", "updated", "deleted"]),
        })
      )
      .optional(),
    conflictsDetected: z
      .array(
        z.object({
          tokenType: z.string(),
          tokenName: z.string(),
          ferdinandValue: z.unknown(),
          figmaValue: z.unknown(),
        })
      )
      .optional(),
    conflictsResolved: z
      .array(
        z.object({
          tokenType: z.string(),
          tokenName: z.string(),
          resolution: z.enum(["ferdinand_wins", "figma_wins", "manual"]),
        })
      )
      .optional(),
  });

export const insertFigmaDesignTokenSchema = createInsertSchema(
  figmaDesignTokens
)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    tokenType: z.enum([
      "color",
      "typography",
      "spacing",
      "border_radius",
      "shadow",
    ]),
    tokenName: z.string().min(1),
    figmaId: z.string().optional(),
    ferdinandValue: z.unknown(),
    figmaValue: z.unknown().optional(),
    syncStatus: z
      .enum(["in_sync", "ferdinand_newer", "figma_newer", "conflict"])
      .default("in_sync"),
  });

// Figma Integration Types
export type FigmaConnection = typeof figmaConnections.$inferSelect;
export type FigmaSyncLog = typeof figmaSyncLogs.$inferSelect;
export type FigmaDesignToken = typeof figmaDesignTokens.$inferSelect;
export type InsertFigmaConnection = z.infer<typeof insertFigmaConnectionSchema>;
export type InsertFigmaSyncLog = z.infer<typeof insertFigmaSyncLogSchema>;
export type InsertFigmaDesignToken = z.infer<
  typeof insertFigmaDesignTokenSchema
>;

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
  slackIntegration: boolean;
  brandAssets: boolean;
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

// User Role Type
export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

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
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  fontStyle?: "normal" | "italic" | "oblique";
  textDecoration?: "none" | "underline" | "overline" | "line-through";
}

export interface IndividualBodyStyle {
  fontFamily?: string;
  fontWeight?: string;
  letterSpacing?: number;
  color?: string;
  fontSize?: string;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  fontStyle?: "normal" | "italic" | "oblique";
  textDecoration?: "none" | "underline" | "overline" | "line-through";
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
  bodyTextTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  bodyFontStyle?: "normal" | "italic" | "oblique";
  bodyTextDecoration?: "none" | "underline" | "overline" | "line-through";
  headerFontFamily: string;
  headerFontWeight: string;
  headerLetterSpacing: number;
  headerColor: string;
  headerTextTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  headerFontStyle?: "normal" | "italic" | "oblique";
  headerTextDecoration?: "none" | "underline" | "overline" | "line-through";
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
    body?: IndividualBodyStyle;
    "body-small"?: IndividualBodyStyle;
    caption?: IndividualBodyStyle;
    quote?: IndividualBodyStyle;
    code?: IndividualBodyStyle;
    small?: IndividualBodyStyle;
  };
  responsiveSizes?: {
    mobile: { baseSize: number; scaleRatio: number };
    tablet: { baseSize: number; scaleRatio: number };
    desktop: { baseSize: number; scaleRatio: number };
  };
  typeStyles?: TypeStyle[];
  exports?: Array<{
    format: "css" | "scss" | "figma" | "adobe";
    content: string;
    fileName: string;
    exportedAt: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export type TypographyLevel =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body-large"
  | "body"
  | "body-small"
  | "caption"
  | "quote"
  | "code"
  | "small";

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
  textTransform: z
    .enum(["none", "uppercase", "lowercase", "capitalize"])
    .optional(),
  fontStyle: z.enum(["normal", "italic", "oblique"]).optional(),
  textDecoration: z
    .enum(["none", "underline", "overline", "line-through"])
    .optional(),
});

const individualBodyStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontWeight: z.string().optional(),
  letterSpacing: z.number().optional(),
  color: z.string().optional(),
  fontSize: z.string().optional(),
  textTransform: z
    .enum(["none", "uppercase", "lowercase", "capitalize"])
    .optional(),
  fontStyle: z.enum(["normal", "italic", "oblique"]).optional(),
  textDecoration: z
    .enum(["none", "underline", "overline", "line-through"])
    .optional(),
});

export const insertTypeScaleSchemaExtended = insertTypeScaleSchema.extend({
  individualHeaderStyles: z
    .record(z.string(), individualHeaderStyleSchema)
    .optional(),
  individualBodyStyles: z
    .record(z.string(), individualBodyStyleSchema)
    .optional(),
  exports: z
    .array(
      z.object({
        format: z.enum(["css", "scss", "figma", "adobe"]),
        content: z.string(),
        fileName: z.string(),
        exportedAt: z.string(),
      })
    )
    .optional(),
});

// Slack Integration Relations
export const slackWorkspacesRelations = relations(
  slackWorkspaces,
  ({ one }) => ({
    client: one(clients, {
      fields: [slackWorkspaces.clientId],
      references: [clients.id],
    }),
    installer: one(users, {
      fields: [slackWorkspaces.installedBy],
      references: [users.id],
    }),
  })
);

export const slackUserMappingsRelations = relations(
  slackUserMappings,
  ({ one }) => ({
    user: one(users, {
      fields: [slackUserMappings.ferdinandUserId],
      references: [users.id],
    }),
    client: one(clients, {
      fields: [slackUserMappings.clientId],
      references: [clients.id],
    }),
  })
);

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  client: one(clients, {
    fields: [apiTokens.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [apiTokens.createdBy],
    references: [users.id],
  }),
}));

// Asset Management Relations
export const assetsRelations = relations(assets, ({ one, many }) => ({
  client: one(clients, {
    fields: [assets.clientId],
    references: [clients.id],
  }),
  uploadedByUser: one(users, {
    fields: [assets.uploadedBy],
    references: [users.id],
  }),
  categoryAssignments: many(assetCategoryAssignments),
  tagAssignments: many(assetTagAssignments),
  publicLinks: many(assetPublicLinks),
}));

export const assetCategoriesRelations = relations(
  assetCategories,
  ({ one, many }) => ({
    client: one(clients, {
      fields: [assetCategories.clientId],
      references: [clients.id],
    }),
    assetAssignments: many(assetCategoryAssignments),
  })
);

export const assetTagsRelations = relations(assetTags, ({ one, many }) => ({
  client: one(clients, {
    fields: [assetTags.clientId],
    references: [clients.id],
  }),
  assetAssignments: many(assetTagAssignments),
}));

export const assetCategoryAssignmentsRelations = relations(
  assetCategoryAssignments,
  ({ one }) => ({
    asset: one(assets, {
      fields: [assetCategoryAssignments.assetId],
      references: [assets.id],
    }),
    category: one(assetCategories, {
      fields: [assetCategoryAssignments.categoryId],
      references: [assetCategories.id],
    }),
  })
);

export const assetTagAssignmentsRelations = relations(
  assetTagAssignments,
  ({ one }) => ({
    asset: one(assets, {
      fields: [assetTagAssignments.assetId],
      references: [assets.id],
    }),
    tag: one(assetTags, {
      fields: [assetTagAssignments.tagId],
      references: [assetTags.id],
    }),
  })
);

export const assetPublicLinksRelations = relations(
  assetPublicLinks,
  ({ one }) => ({
    asset: one(assets, {
      fields: [assetPublicLinks.assetId],
      references: [assets.id],
    }),
    creator: one(users, {
      fields: [assetPublicLinks.createdBy],
      references: [users.id],
    }),
  })
);

// Slack Integration Insert Schemas
export const insertSlackWorkspaceSchema = createInsertSchema(slackWorkspaces)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    slackTeamId: z.string().min(1),
    teamName: z.string().min(1),
    botToken: z.string().min(1),
    botUserId: z.string().min(1),
  });

export const insertSlackUserMappingSchema = createInsertSchema(
  slackUserMappings
)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    slackUserId: z.string().min(1),
    slackTeamId: z.string().min(1),
  });

export const insertApiTokenSchema = createInsertSchema(apiTokens)
  .omit({ id: true, createdAt: true })
  .extend({
    tokenHash: z.string().min(1),
    tokenName: z.string().min(1),
    scopes: z.array(z.string()).optional(),
  });

export const insertSlackConversationSchema = createInsertSchema(
  slackConversations
)
  .omit({ id: true })
  .extend({
    slackUserId: z.string().min(1),
    slackChannelId: z.string().min(1),
  });

export const insertSlackAuditLogSchema = createInsertSchema(slackAuditLogs)
  .omit({ id: true, createdAt: true })
  .extend({
    slackUserId: z.string().min(1),
    slackWorkspaceId: z.string().min(1),
    command: z.string().min(1),
    success: z.boolean(),
    assetIds: z.array(z.number()).optional(),
    errorMessage: z.string().optional(),
    responseTimeMs: z.number().optional(),
  });

// Google Drive Integration Insert Schemas
export const insertGoogleDriveConnectionSchema = createInsertSchema(
  googleDriveConnections
)
  .omit({ id: true, connectedAt: true, lastUsedAt: true, updatedAt: true })
  .extend({
    userId: z.number(),
    encryptedAccessToken: z.string().min(1),
    encryptedRefreshToken: z.string().min(1),
    tokenExpiresAt: z.date().optional(),
    scopes: z.array(z.string()).optional(),
  });

export const insertDriveAccessTokenSchema = createInsertSchema(driveAccessTokens)
  .omit({ id: true, createdAt: true })
  .extend({
    token: z.string().min(1),
    assetId: z.number(),
    userId: z.number(),
    driveFileId: z.string().min(1),
    action: z.enum(["read", "download", "thumbnail"]),
    expiresAt: z.date(),
    revokedAt: z.date().nullable().optional(),
  });

export const insertDriveFileAccessLogSchema = createInsertSchema(
  driveFileAccessLogs
)
  .omit({ id: true, createdAt: true })
  .extend({
    userId: z.number().optional(),
    assetId: z.number().optional(),
    driveFileId: z.string().optional(),
    action: z.enum(["read", "download", "thumbnail", "import", "list"]),
    success: z.boolean(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    userRole: z.string().optional(),
    clientId: z.number().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  });

// Asset Management Insert Schemas
export const insertAssetSchema = createInsertSchema(assets)
  .omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true })
  .extend({
    fileName: z.string().min(1),
    originalFileName: z.string().min(1),
    fileType: z.string().min(1),
    fileSize: z.number().min(1),
    storagePath: z.string().min(1),
    visibility: z.enum(["private", "shared"]).default("shared"),
  });

export const insertAssetCategorySchema = createInsertSchema(assetCategories)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1),
    slug: z.string().min(1),
    isDefault: z.boolean().default(false),
    clientId: z.number().optional(),
  });

export const insertAssetTagSchema = createInsertSchema(assetTags)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1),
    slug: z.string().min(1),
    clientId: z.number(),
  });

export const insertAssetCategoryAssignmentSchema = createInsertSchema(
  assetCategoryAssignments
).extend({
  assetId: z.number(),
  categoryId: z.number(),
});

export const insertAssetTagAssignmentSchema = createInsertSchema(
  assetTagAssignments
).extend({
  assetId: z.number(),
  tagId: z.number(),
});

export const insertAssetPublicLinkSchema = createInsertSchema(assetPublicLinks)
  .omit({ id: true, createdAt: true })
  .extend({
    assetId: z.number(),
    token: z.string().min(1),
    createdBy: z.number(),
    expiresAt: z.date().nullable().optional(),
  });

// Slack Integration Types
export type SlackWorkspace = typeof slackWorkspaces.$inferSelect;
export type SlackUserMapping = typeof slackUserMappings.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type SlackConversation = typeof slackConversations.$inferSelect;
export type SlackAuditLog = typeof slackAuditLogs.$inferSelect;
export type InsertSlackWorkspace = z.infer<typeof insertSlackWorkspaceSchema>;
export type InsertSlackUserMapping = z.infer<
  typeof insertSlackUserMappingSchema
>;
export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type InsertSlackConversation = z.infer<
  typeof insertSlackConversationSchema
>;
export type InsertSlackAuditLog = z.infer<typeof insertSlackAuditLogSchema>;

// Google Drive Integration Types
export type GoogleDriveConnection = typeof googleDriveConnections.$inferSelect;
export type InsertGoogleDriveConnection = z.infer<
  typeof insertGoogleDriveConnectionSchema
>;
export type DriveAccessToken = typeof driveAccessTokens.$inferSelect;
export type InsertDriveAccessToken = z.infer<typeof insertDriveAccessTokenSchema>;
export type DriveFileAccessLog = typeof driveFileAccessLogs.$inferSelect;
export type InsertDriveFileAccessLog = z.infer<
  typeof insertDriveFileAccessLogSchema
>;

// Asset Management Types
export type Asset = typeof assets.$inferSelect;
export type AssetCategory = typeof assetCategories.$inferSelect;
export type AssetTag = typeof assetTags.$inferSelect;
export type AssetCategoryAssignment =
  typeof assetCategoryAssignments.$inferSelect;
export type AssetTagAssignment = typeof assetTagAssignments.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertAssetCategory = z.infer<typeof insertAssetCategorySchema>;
export type InsertAssetTag = z.infer<typeof insertAssetTagSchema>;
export type InsertAssetCategoryAssignment = z.infer<
  typeof insertAssetCategoryAssignmentSchema
>;
export type InsertAssetTagAssignment = z.infer<
  typeof insertAssetTagAssignmentSchema
>;
export type AssetPublicLink = typeof assetPublicLinks.$inferSelect;
export type InsertAssetPublicLink = z.infer<typeof insertAssetPublicLinkSchema>;
