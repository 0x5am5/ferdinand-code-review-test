import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
dotenv.config();

async function migrate() {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });

	try {
		// Check if feature_toggles column exists
		const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'feature_toggles'
    `);

		if (checkResult.rows.length === 0) {
			console.log("Adding feature_toggles column to clients table...");
			// Add the feature_toggles column
			await pool.query(`
        ALTER TABLE clients 
        ADD COLUMN feature_toggles JSONB DEFAULT '{"logoSystem": true, "colorSystem": true, "typeSystem": true, "userPersonas": true, "inspiration": true}'
      `);
			console.log("Migration completed successfully!");
		} else {
			console.log(
				"feature_toggles column already exists. No migration needed.",
			);
		}
	} catch (error) {
		console.error("Migration failed:", error);
	} finally {
		await pool.end();
	}
}

migrate();
