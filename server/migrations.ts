import { db } from "./db.js";
import { sql, eq } from "drizzle-orm";
import { typeScales as typeScalesTable } from "@shared/schema";

export async function runMigrations() {
  console.log('Starting database migrations...');

  try {
    // Run all migrations in sequence
    await migrateFeatureToggles();
    await migrateLastEditedBy();
    await migrateFigmaTables();
    await migrateIndividualHeaderStyles();
    await migrateTypeScaleHierarchy();

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

async function migrateFeatureToggles() {
  // Check if feature_toggles column exists
  const checkFeatureToggles = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'feature_toggles'
  `);

  if (checkFeatureToggles.rows.length === 0) {
    console.log('Adding feature_toggles column to clients table...');
    // Add the feature_toggles column
    await db.execute(sql`
      ALTER TABLE clients 
      ADD COLUMN feature_toggles JSONB DEFAULT '{"logoSystem": true, "colorSystem": true, "typeSystem": true, "userPersonas": true, "inspiration": true}'
    `);
    console.log('feature_toggles migration completed successfully!');
  } else {
    console.log('feature_toggles column already exists.');
  }
}

async function migrateLastEditedBy() {
  // Check if last_edited_by column exists
  const checkLastEditedBy = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'last_edited_by'
  `);

  if (checkLastEditedBy.rows.length === 0) {
    console.log('Adding last_edited_by column to clients table...');
    // Add the last_edited_by column
    await db.execute(sql`
      ALTER TABLE clients 
      ADD COLUMN last_edited_by INTEGER REFERENCES users(id)
    `);
    console.log('last_edited_by migration completed successfully!');
  } else {
    console.log('last_edited_by column already exists.');
  }
}

async function migrateFigmaTables() {
  // Check if figma_connections table exists
  const checkFigmaConnections = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name = 'figma_connections'
  `);

  if (checkFigmaConnections.rows.length === 0) {
    console.log('Creating Figma integration tables...');

    // Create figma_connections table
    await db.execute(sql`
      CREATE TABLE figma_connections (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        figma_file_id TEXT NOT NULL,
        figma_file_key TEXT NOT NULL,
        figma_file_name TEXT NOT NULL,
        figma_team_id TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        is_active BOOLEAN DEFAULT true,
        last_sync_at TIMESTAMP,
        sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'success', 'error')),
        sync_error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create figma_sync_logs table
    await db.execute(sql`
      CREATE TABLE figma_sync_logs (
        id SERIAL PRIMARY KEY,
        connection_id INTEGER NOT NULL REFERENCES figma_connections(id),
        sync_type TEXT NOT NULL CHECK (sync_type IN ('pull_from_figma', 'push_to_figma', 'bidirectional')),
        sync_direction TEXT NOT NULL CHECK (sync_direction IN ('figma_to_ferdinand', 'ferdinand_to_figma')),
        elements_changed JSONB,
        conflicts_detected JSONB,
        conflicts_resolved JSONB,
        status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
        error_message TEXT,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create figma_design_tokens table
    await db.execute(sql`
      CREATE TABLE figma_design_tokens (
        id SERIAL PRIMARY KEY,
        connection_id INTEGER NOT NULL REFERENCES figma_connections(id),
        token_type TEXT NOT NULL CHECK (token_type IN ('color', 'typography', 'spacing', 'border_radius', 'shadow')),
        token_name TEXT NOT NULL,
        figma_id TEXT,
        ferdinand_value JSONB NOT NULL,
        figma_value JSONB,
        last_sync_at TIMESTAMP,
        sync_status TEXT DEFAULT 'in_sync' CHECK (sync_status IN ('in_sync', 'ferdinand_newer', 'figma_newer', 'conflict')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Figma tables migration completed successfully!');
  } else {
    console.log('Figma tables already exist.');
  }
}

async function migrateIndividualHeaderStyles() {
  // Ensure individual_header_styles column exists
  await db.execute(sql`
    ALTER TABLE type_scales 
    ADD COLUMN IF NOT EXISTS individual_header_styles JSONB DEFAULT '{}'::jsonb
  `);

  console.log("✓ individual_header_styles column ensured");

  // Ensure individual_body_styles column exists
  await db.execute(sql`
    ALTER TABLE type_scales 
    ADD COLUMN IF NOT EXISTS individual_body_styles JSONB DEFAULT '{}'::jsonb
  `);

  console.log("✓ individual_body_styles column ensured");
}

async function migrateTypeScaleHierarchy() {
  try {
    // Get all type scales
    const typeScales = await db.select().from(typeScalesTable);

    const newTypeStyles = [
      { level: "h1", name: "Heading 1", size: 3, fontWeight: "700", lineHeight: 1.2, letterSpacing: 0, color: "#000000" },
      { level: "h2", name: "Heading 2", size: 2, fontWeight: "600", lineHeight: 1.3, letterSpacing: 0, color: "#000000" },
      { level: "h3", name: "Heading 3", size: 1, fontWeight: "600", lineHeight: 1.4, letterSpacing: 0, color: "#000000" },
      { level: "h4", name: "Heading 4", size: 0, fontWeight: "500", lineHeight: 1.4, letterSpacing: 0, color: "#000000" },
      { level: "h5", name: "Heading 5", size: -1, fontWeight: "500", lineHeight: 1.5, letterSpacing: 0, color: "#000000" },
      { level: "h6", name: "Heading 6", size: -2, fontWeight: "500", lineHeight: 1.5, letterSpacing: 0, color: "#000000" },
      { level: "body-large", name: "Body Large", size: 0.5, fontWeight: "400", lineHeight: 1.6, letterSpacing: 0, color: "#000000" },
      { level: "body", name: "Body", size: 0, fontWeight: "400", lineHeight: 1.6, letterSpacing: 0, color: "#000000" },
      { level: "body-small", name: "Body Small", size: -0.5, fontWeight: "400", lineHeight: 1.5, letterSpacing: 0, color: "#000000" },
      { level: "caption", name: "Caption", size: -1, fontWeight: "400", lineHeight: 1.4, letterSpacing: 0, color: "#666666" },
      { level: "quote", name: "Quote", size: 1, fontWeight: "400", lineHeight: 1.6, letterSpacing: 0, color: "#000000" },
      { level: "code", name: "Code", size: -0.5, fontWeight: "400", lineHeight: 1.4, letterSpacing: 0, color: "#000000" },
    ];

    for (const typeScale of typeScales) {
      const currentTypeStyles = typeScale.typeStyles as any[] || [];
      const hasNewStructure = currentTypeStyles.some(style => 
        ['body-large', 'body-small', 'caption', 'quote', 'code'].includes(style.level)
      );

      if (!hasNewStructure) {
        console.log(`Migrating type scale ${typeScale.id} to new hierarchy`);
        await db
          .update(typeScalesTable)
          .set({ typeStyles: newTypeStyles })
          .where(eq(typeScalesTable.id, typeScale.id));
      }
    }

    console.log("✓ Type scale hierarchy migration completed");
  } catch (error) {
    console.error("Error migrating type scale hierarchy:", error);
    throw error;
  }
}