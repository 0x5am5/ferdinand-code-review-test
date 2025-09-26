import { pgTable, foreignKey, serial, integer, text, timestamp, jsonb, index, varchar, json, unique, boolean, check, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const brandAssets = pgTable("brand_assets", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	name: text().notNull(),
	category: text().notNull(),
	logoType: text("logo_type"),
	format: text(),
	fileData: text("file_data"),
	mimeType: text("mime_type"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	data: jsonb(),
	sortOrder: integer("sort_order").default(0),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "brand_assets_client_id_clients_id_fk"
		}),
]);

export const clients = pgTable("clients", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	website: text(),
	address: text(),
	phone: text(),
	logoUrl: text("logo_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	displayOrder: integer("display_order"),
	userId: integer("user_id"),
	featureToggles: jsonb("feature_toggles").default({"logoSystem":true,"typeSystem":true,"colorSystem":true,"inspiration":true,"userPersonas":true}),
	lastEditedBy: integer("last_edited_by"),
	primaryColor: text("primary_color"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "clients_user_id_fkey"
		}),
	foreignKey({
			columns: [table.lastEditedBy],
			foreignColumns: [users.id],
			name: "clients_last_edited_by_fkey"
		}),
]);

export const userPersonas = pgTable("user_personas", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id"),
	name: text().notNull(),
	role: text(),
	imageUrl: text("image_url"),
	ageRange: text("age_range"),
	demographics: jsonb(),
	eventAttributes: jsonb("event_attributes"),
	motivations: text().array(),
	coreNeeds: text("core_needs").array(),
	painPoints: text("pain_points").array(),
	metrics: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "user_personas_client_id_fkey"
		}),
]);

export const inspirationSections = pgTable("inspiration_sections", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	label: text().notNull(),
	order: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "inspiration_sections_client_id_fkey"
		}),
]);

export const inspirationImages = pgTable("inspiration_images", {
	id: serial().primaryKey().notNull(),
	sectionId: integer("section_id").notNull(),
	url: text().notNull(),
	fileData: text("file_data").notNull(),
	mimeType: text("mime_type").notNull(),
	order: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.sectionId],
			foreignColumns: [inspirationSections.id],
			name: "inspiration_images_section_id_fkey"
		}),
]);

export const userClients = pgTable("user_clients", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	clientId: integer("client_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_clients_user_id_fkey"
		}),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "user_clients_client_id_fkey"
		}),
]);

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
	name: text().notNull(),
	role: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	password: text(),
	lastLogin: timestamp("last_login", { mode: 'string' }),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const invitations = pgTable("invitations", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
	name: text().notNull(),
	role: text().notNull(),
	token: text().notNull(),
	createdById: integer("created_by_id"),
	clientIds: integer("client_ids").array(),
	used: boolean().default(false),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "invitations_created_by_id_fkey"
		}),
	unique("invitations_token_key").on(table.token),
]);

export const figmaConnections = pgTable("figma_connections", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	userId: integer("user_id").notNull(),
	figmaFileId: text("figma_file_id").notNull(),
	figmaFileKey: text("figma_file_key").notNull(),
	figmaFileName: text("figma_file_name").notNull(),
	figmaTeamId: text("figma_team_id"),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token"),
	isActive: boolean("is_active").default(true),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	syncStatus: text("sync_status").default('idle'),
	syncError: text("sync_error"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "figma_connections_client_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "figma_connections_user_id_fkey"
		}),
	check("figma_connections_sync_status_check", sql`sync_status = ANY (ARRAY['idle'::text, 'syncing'::text, 'success'::text, 'error'::text])`),
]);

export const convertedAssets = pgTable("converted_assets", {
	id: serial().primaryKey().notNull(),
	originalAssetId: integer("original_asset_id").notNull(),
	format: text().notNull(),
	fileData: text("file_data").notNull(),
	mimeType: text("mime_type").notNull(),
	isDarkVariant: boolean("is_dark_variant").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.originalAssetId],
			foreignColumns: [brandAssets.id],
			name: "converted_assets_original_asset_id_fkey"
		}),
]);

export const hiddenSections = pgTable("hidden_sections", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	sectionType: text("section_type").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "hidden_sections_client_id_fkey"
		}),
]);

export const figmaDesignTokens = pgTable("figma_design_tokens", {
	id: serial().primaryKey().notNull(),
	connectionId: integer("connection_id").notNull(),
	tokenType: text("token_type").notNull(),
	tokenName: text("token_name").notNull(),
	figmaId: text("figma_id"),
	ferdinandValue: jsonb("ferdinand_value").notNull(),
	figmaValue: jsonb("figma_value"),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }),
	syncStatus: text("sync_status").default('in_sync'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.connectionId],
			foreignColumns: [figmaConnections.id],
			name: "figma_design_tokens_connection_id_fkey"
		}),
	check("figma_design_tokens_token_type_check", sql`token_type = ANY (ARRAY['color'::text, 'typography'::text, 'spacing'::text, 'border_radius'::text, 'shadow'::text])`),
	check("figma_design_tokens_sync_status_check", sql`sync_status = ANY (ARRAY['in_sync'::text, 'ferdinand_newer'::text, 'figma_newer'::text, 'conflict'::text])`),
]);

export const figmaSyncLogs = pgTable("figma_sync_logs", {
	id: serial().primaryKey().notNull(),
	connectionId: integer("connection_id").notNull(),
	syncType: text("sync_type").notNull(),
	syncDirection: text("sync_direction").notNull(),
	elementsChanged: jsonb("elements_changed"),
	conflictsDetected: jsonb("conflicts_detected"),
	conflictsResolved: jsonb("conflicts_resolved"),
	status: text().notNull(),
	errorMessage: text("error_message"),
	duration: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.connectionId],
			foreignColumns: [figmaConnections.id],
			name: "figma_sync_logs_connection_id_fkey"
		}),
	check("figma_sync_logs_sync_type_check", sql`sync_type = ANY (ARRAY['pull_from_figma'::text, 'push_to_figma'::text, 'bidirectional'::text])`),
	check("figma_sync_logs_sync_direction_check", sql`sync_direction = ANY (ARRAY['figma_to_ferdinand'::text, 'ferdinand_to_figma'::text])`),
	check("figma_sync_logs_status_check", sql`status = ANY (ARRAY['started'::text, 'completed'::text, 'failed'::text])`),
]);

export const typeScales = pgTable("type_scales", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	name: text().notNull(),
	unit: text().default('rem').notNull(),
	baseSize: integer("base_size").default(16).notNull(),
	scaleRatio: integer("scale_ratio").default(1250).notNull(),
	customRatio: integer("custom_ratio"),
	responsiveSizes: json("responsive_sizes").default({"mobile":{"baseSize":14,"scaleRatio":1.125},"tablet":{"baseSize":15,"scaleRatio":1.2},"desktop":{"baseSize":16,"scaleRatio":1.25}}),
	typeStyles: json("type_styles").default([{"level":"h1","name":"Heading 1","size":0,"fontWeight":"700","lineHeight":1.2,"letterSpacing":0,"color":"#000000"},{"level":"h2","name":"Heading 2","size":-1,"fontWeight":"600","lineHeight":1.3,"letterSpacing":0,"color":"#000000"},{"level":"h3","name":"Heading 3","size":-2,"fontWeight":"600","lineHeight":1.4,"letterSpacing":0,"color":"#000000"},{"level":"h4","name":"Heading 4","size":-3,"fontWeight":"500","lineHeight":1.4,"letterSpacing":0,"color":"#000000"},{"level":"h5","name":"Heading 5","size":-4,"fontWeight":"500","lineHeight":1.5,"letterSpacing":0,"color":"#000000"},{"level":"h6","name":"Heading 6","size":-5,"fontWeight":"500","lineHeight":1.5,"letterSpacing":0,"color":"#000000"},{"level":"body","name":"Body Text","size":-6,"fontWeight":"400","lineHeight":1.6,"letterSpacing":0,"color":"#000000"},{"level":"small","name":"Small Text","size":-7,"fontWeight":"400","lineHeight":1.5,"letterSpacing":0,"color":"#666666"}]),
	exports: json().default([]),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	bodyFontFamily: text("body_font_family").default(''),
	bodyFontWeight: text("body_font_weight").default('400'),
	bodyLetterSpacing: integer("body_letter_spacing").default(0),
	bodyColor: text("body_color").default('#000000'),
	headerFontFamily: text("header_font_family").default(''),
	headerFontWeight: text("header_font_weight").default('700'),
	headerLetterSpacing: integer("header_letter_spacing").default(0),
	headerColor: text("header_color").default('#000000'),
	individualHeaderStyles: text("individual_header_styles"),
	individualBodyStyles: jsonb("individual_body_styles").default({}),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "type_scales_client_id_fkey"
		}),
	check("type_scales_unit_check", sql`unit = ANY (ARRAY['px'::text, 'rem'::text, 'em'::text])`),
]);

export const slackWorkspaces = pgTable("slack_workspaces", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	slackTeamId: text("slack_team_id").notNull(),
	teamName: text("team_name").notNull(),
	botToken: text("bot_token").notNull(),
	botUserId: text("bot_user_id").notNull(),
	installedBy: integer("installed_by"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_slack_workspaces_team_id").using("btree", table.slackTeamId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "slack_workspaces_client_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.installedBy],
			foreignColumns: [users.id],
			name: "slack_workspaces_installed_by_fkey"
		}).onDelete("set null"),
	unique("slack_workspaces_slack_team_id_key").on(table.slackTeamId),
]);

export const slackUserMappings = pgTable("slack_user_mappings", {
	id: serial().primaryKey().notNull(),
	slackUserId: text("slack_user_id").notNull(),
	slackTeamId: text("slack_team_id").notNull(),
	ferdinandUserId: integer("ferdinand_user_id"),
	clientId: integer("client_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	isActive: boolean("is_active").default(true),
}, (table) => [
	index("idx_slack_user_mappings_team").using("btree", table.slackTeamId.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_slack_user_mappings_unique_active").using("btree", table.slackUserId.asc().nullsLast().op("text_ops"), table.slackTeamId.asc().nullsLast().op("text_ops")).where(sql`(is_active = true)`),
	foreignKey({
			columns: [table.ferdinandUserId],
			foreignColumns: [users.id],
			name: "slack_user_mappings_ferdinand_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "slack_user_mappings_client_id_fkey"
		}).onDelete("cascade"),
]);

export const apiTokens = pgTable("api_tokens", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	tokenName: text("token_name").notNull(),
	scopes: text().array().default(["RAY['read:assets'::tex"]),
	createdBy: integer("created_by"),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_api_tokens_hash").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "api_tokens_client_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "api_tokens_created_by_fkey"
		}).onDelete("set null"),
	unique("api_tokens_token_hash_key").on(table.tokenHash),
]);

export const slackConversations = pgTable("slack_conversations", {
	id: serial().primaryKey().notNull(),
	slackUserId: text("slack_user_id").notNull(),
	slackChannelId: text("slack_channel_id").notNull(),
	clientId: integer("client_id").notNull(),
	context: jsonb().default({}),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).default(sql`(now() + '01:00:00'::interval)`),
}, (table) => [
	index("idx_slack_conversations_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "slack_conversations_client_id_fkey"
		}).onDelete("cascade"),
]);
