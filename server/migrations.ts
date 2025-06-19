import { db } from './db';
import { sql } from 'drizzle-orm';

export async function runMigrations() {
  console.log('Starting database migrations...');

  try {
    // Run all migrations in sequence
    await migrateFeatureToggles();
    await migrateLastEditedBy();
    await migrateFigmaTables();

    // Add sortOrder column to brand_assets table
    try {
      await db.execute(sql`ALTER TABLE brand_assets ADD COLUMN sort_order INTEGER DEFAULT 0`);
      console.log("✓ Added sort_order column to brand_assets table");
    } catch (error: any) {
      if (error.message?.includes("duplicate column name")) {
        console.log("sort_order column already exists.");
      } else {
        throw error;
      }
    }

    console.log("All migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
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