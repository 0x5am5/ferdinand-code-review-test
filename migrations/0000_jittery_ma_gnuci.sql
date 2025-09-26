-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "brand_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"logo_type" text,
	"format" text,
	"file_data" text,
	"mime_type" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"data" jsonb,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"website" text,
	"address" text,
	"phone" text,
	"logo_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"display_order" integer,
	"user_id" integer,
	"feature_toggles" jsonb DEFAULT '{"logoSystem":true,"typeSystem":true,"colorSystem":true,"inspiration":true,"userPersonas":true}'::jsonb,
	"last_edited_by" integer,
	"primary_color" text
);
--> statement-breakpoint
CREATE TABLE "user_personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"name" text NOT NULL,
	"role" text,
	"image_url" text,
	"age_range" text,
	"demographics" jsonb,
	"event_attributes" jsonb,
	"motivations" text[],
	"core_needs" text[],
	"pain_points" text[],
	"metrics" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "inspiration_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"label" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "inspiration_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"url" text NOT NULL,
	"file_data" text NOT NULL,
	"mime_type" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "user_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"password" text,
	"last_login" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"created_by_id" integer,
	"client_ids" integer[],
	"used" boolean DEFAULT false,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "invitations_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "figma_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"figma_file_id" text NOT NULL,
	"figma_file_key" text NOT NULL,
	"figma_file_name" text NOT NULL,
	"figma_team_id" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"sync_status" text DEFAULT 'idle',
	"sync_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "figma_connections_sync_status_check" CHECK (sync_status = ANY (ARRAY['idle'::text, 'syncing'::text, 'success'::text, 'error'::text]))
);
--> statement-breakpoint
CREATE TABLE "converted_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_asset_id" integer NOT NULL,
	"format" text NOT NULL,
	"file_data" text NOT NULL,
	"mime_type" text NOT NULL,
	"is_dark_variant" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hidden_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"section_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "figma_design_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"token_type" text NOT NULL,
	"token_name" text NOT NULL,
	"figma_id" text,
	"ferdinand_value" jsonb NOT NULL,
	"figma_value" jsonb,
	"last_sync_at" timestamp,
	"sync_status" text DEFAULT 'in_sync',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "figma_design_tokens_token_type_check" CHECK (token_type = ANY (ARRAY['color'::text, 'typography'::text, 'spacing'::text, 'border_radius'::text, 'shadow'::text])),
	CONSTRAINT "figma_design_tokens_sync_status_check" CHECK (sync_status = ANY (ARRAY['in_sync'::text, 'ferdinand_newer'::text, 'figma_newer'::text, 'conflict'::text]))
);
--> statement-breakpoint
CREATE TABLE "figma_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"sync_type" text NOT NULL,
	"sync_direction" text NOT NULL,
	"elements_changed" jsonb,
	"conflicts_detected" jsonb,
	"conflicts_resolved" jsonb,
	"status" text NOT NULL,
	"error_message" text,
	"duration" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "figma_sync_logs_sync_type_check" CHECK (sync_type = ANY (ARRAY['pull_from_figma'::text, 'push_to_figma'::text, 'bidirectional'::text])),
	CONSTRAINT "figma_sync_logs_sync_direction_check" CHECK (sync_direction = ANY (ARRAY['figma_to_ferdinand'::text, 'ferdinand_to_figma'::text])),
	CONSTRAINT "figma_sync_logs_status_check" CHECK (status = ANY (ARRAY['started'::text, 'completed'::text, 'failed'::text]))
);
--> statement-breakpoint
CREATE TABLE "type_scales" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'rem' NOT NULL,
	"base_size" integer DEFAULT 16 NOT NULL,
	"scale_ratio" integer DEFAULT 1250 NOT NULL,
	"custom_ratio" integer,
	"responsive_sizes" json DEFAULT '{"mobile":{"baseSize":14,"scaleRatio":1.125},"tablet":{"baseSize":15,"scaleRatio":1.2},"desktop":{"baseSize":16,"scaleRatio":1.25}}'::json,
	"type_styles" json DEFAULT '[{"level":"h1","name":"Heading 1","size":0,"fontWeight":"700","lineHeight":1.2,"letterSpacing":0,"color":"#000000"},{"level":"h2","name":"Heading 2","size":-1,"fontWeight":"600","lineHeight":1.3,"letterSpacing":0,"color":"#000000"},{"level":"h3","name":"Heading 3","size":-2,"fontWeight":"600","lineHeight":1.4,"letterSpacing":0,"color":"#000000"},{"level":"h4","name":"Heading 4","size":-3,"fontWeight":"500","lineHeight":1.4,"letterSpacing":0,"color":"#000000"},{"level":"h5","name":"Heading 5","size":-4,"fontWeight":"500","lineHeight":1.5,"letterSpacing":0,"color":"#000000"},{"level":"h6","name":"Heading 6","size":-5,"fontWeight":"500","lineHeight":1.5,"letterSpacing":0,"color":"#000000"},{"level":"body","name":"Body Text","size":-6,"fontWeight":"400","lineHeight":1.6,"letterSpacing":0,"color":"#000000"},{"level":"small","name":"Small Text","size":-7,"fontWeight":"400","lineHeight":1.5,"letterSpacing":0,"color":"#666666"}]'::json,
	"exports" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"body_font_family" text DEFAULT '',
	"body_font_weight" text DEFAULT '400',
	"body_letter_spacing" integer DEFAULT 0,
	"body_color" text DEFAULT '#000000',
	"header_font_family" text DEFAULT '',
	"header_font_weight" text DEFAULT '700',
	"header_letter_spacing" integer DEFAULT 0,
	"header_color" text DEFAULT '#000000',
	"individual_header_styles" text,
	"individual_body_styles" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "type_scales_unit_check" CHECK (unit = ANY (ARRAY['px'::text, 'rem'::text, 'em'::text]))
);
--> statement-breakpoint
CREATE TABLE "slack_workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"slack_team_id" text NOT NULL,
	"team_name" text NOT NULL,
	"bot_token" text NOT NULL,
	"bot_user_id" text NOT NULL,
	"installed_by" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "slack_workspaces_slack_team_id_key" UNIQUE("slack_team_id")
);
--> statement-breakpoint
CREATE TABLE "slack_user_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"slack_user_id" text NOT NULL,
	"slack_team_id" text NOT NULL,
	"ferdinand_user_id" integer,
	"client_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"token_name" text NOT NULL,
	"scopes" text[] DEFAULT '{"RAY['read:assets'::tex"}',
	"created_by" integer,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "api_tokens_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "slack_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slack_user_id" text NOT NULL,
	"slack_channel_id" text NOT NULL,
	"client_id" integer NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"last_message_at" timestamp DEFAULT now(),
	"expires_at" timestamp DEFAULT (now() + '01:00:00'::interval)
);
--> statement-breakpoint
ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_personas" ADD CONSTRAINT "user_personas_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspiration_sections" ADD CONSTRAINT "inspiration_sections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspiration_images" ADD CONSTRAINT "inspiration_images_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."inspiration_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_clients" ADD CONSTRAINT "user_clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_clients" ADD CONSTRAINT "user_clients_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figma_connections" ADD CONSTRAINT "figma_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figma_connections" ADD CONSTRAINT "figma_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "converted_assets" ADD CONSTRAINT "converted_assets_original_asset_id_fkey" FOREIGN KEY ("original_asset_id") REFERENCES "public"."brand_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hidden_sections" ADD CONSTRAINT "hidden_sections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figma_design_tokens" ADD CONSTRAINT "figma_design_tokens_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."figma_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figma_sync_logs" ADD CONSTRAINT "figma_sync_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."figma_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_scales" ADD CONSTRAINT "type_scales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_workspaces" ADD CONSTRAINT "slack_workspaces_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_workspaces" ADD CONSTRAINT "slack_workspaces_installed_by_fkey" FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_user_mappings" ADD CONSTRAINT "slack_user_mappings_ferdinand_user_id_fkey" FOREIGN KEY ("ferdinand_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_user_mappings" ADD CONSTRAINT "slack_user_mappings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_conversations" ADD CONSTRAINT "slack_conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_slack_workspaces_team_id" ON "slack_workspaces" USING btree ("slack_team_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_slack_user_mappings_team" ON "slack_user_mappings" USING btree ("slack_team_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_slack_user_mappings_unique_active" ON "slack_user_mappings" USING btree ("slack_user_id" text_ops,"slack_team_id" text_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_api_tokens_hash" ON "api_tokens" USING btree ("token_hash" text_ops);--> statement-breakpoint
CREATE INDEX "idx_slack_conversations_expires" ON "slack_conversations" USING btree ("expires_at" timestamp_ops);
*/