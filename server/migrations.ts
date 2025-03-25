import { db } from './db';
import { sql } from 'drizzle-orm';

export async function runMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // Run all migrations in sequence
    await migrateFeatureToggles();
    await migrateLastEditedBy();
    
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