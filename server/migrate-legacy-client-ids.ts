import { userClients } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Migration script to move legacy client_id values from users table to userClients table
 * This ensures no data is lost when we remove the client_id column from users table
 *
 * NOTE: This script uses raw SQL to access the legacy client_id column since it's been
 * removed from the schema but may still exist in the database.
 */
async function migrateLegacyClientIds() {
  console.log("Starting migration of legacy client_id values...");

  try {
    // Check if client_id column still exists in the database
    const columnExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'client_id'
    `);

    if (columnExists.rows.length === 0) {
      console.log(
        "client_id column no longer exists in database. Migration already completed or not needed."
      );
      return;
    }

    // Get all users who have a client_id set (using raw SQL since column is not in schema)
    const usersWithClientId = await db.execute(sql`
      SELECT id, email, client_id 
      FROM users 
      WHERE client_id IS NOT NULL
    `);

    if (usersWithClientId.rows.length === 0) {
      console.log(
        "No users with legacy client_id found. Migration not needed."
      );
      return;
    }

    console.log(
      `Found ${usersWithClientId.rows.length} users with legacy client_id values`
    );

    let migratedCount = 0;
    let skippedCount = 0;

    for (const userRow of usersWithClientId.rows) {
      const userId = userRow.id as number;
      const userEmail = userRow.email as string;
      const clientId = userRow.client_id as number;

      console.log(
        `Processing user ${userEmail} (ID: ${userId}) with client_id: ${clientId}`
      );

      // Check if a userClient record already exists for this user-client pair
      const existingUserClient = await db
        .select()
        .from(userClients)
        .where(
          and(
            eq(userClients.userId, userId),
            eq(userClients.clientId, clientId)
          )
        )
        .limit(1);

      if (existingUserClient.length > 0) {
        console.log(`  - UserClient record already exists, skipping`);
        skippedCount++;
        continue;
      }

      // Create new userClient record
      await db.insert(userClients).values({
        userId,
        clientId,
      });

      console.log(
        `  - Created userClient record for user ${userId} -> client ${clientId}`
      );
      migratedCount++;
    }

    console.log(`Migration completed successfully!`);
    console.log(`- Migrated: ${migratedCount} users`);
    console.log(`- Skipped (already exists): ${skippedCount} users`);
    console.log(`- Total processed: ${usersWithClientId.rows.length} users`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateLegacyClientIds()
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateLegacyClientIds };
