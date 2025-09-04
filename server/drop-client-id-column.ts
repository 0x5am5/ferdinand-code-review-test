import { db } from "./db";
import { sql } from "drizzle-orm";
import { migrateLegacyClientIds } from "./migrate-legacy-client-ids";

/**
 * Script to safely drop the client_id column from users table
 * This runs after ensuring all data has been migrated to userClients table
 */
async function dropClientIdColumn() {
  console.log("Starting safe removal of client_id column from users table...");
  
  try {
    // First, run the migration to ensure any data is moved
    console.log("Step 1: Running data migration to ensure no data loss...");
    await migrateLegacyClientIds();
    
    // Check if the column still exists
    console.log("Step 2: Checking if client_id column exists...");
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'client_id'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log("✅ client_id column has already been removed from users table.");
      return;
    }
    
    // Drop the column
    console.log("Step 3: Dropping client_id column from users table...");
    await db.execute(sql`ALTER TABLE users DROP COLUMN client_id`);
    
    console.log("✅ Successfully dropped client_id column from users table!");
    
    // Verify the column is gone
    const verifyDrop = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'client_id'
    `);
    
    if (verifyDrop.rows.length === 0) {
      console.log("✅ Verified: client_id column has been completely removed.");
    } else {
      console.error("❌ Warning: Column may still exist in the database.");
    }
    
  } catch (error) {
    console.error("❌ Error dropping client_id column:", error);
    throw error;
  }
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  dropClientIdColumn()
    .then(() => {
      console.log("✅ Column removal completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Column removal failed:", error);
      process.exit(1);
    });
}

export { dropClientIdColumn };