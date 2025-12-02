import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Determine if we're using a local PostgreSQL or Neon
const isLocalPostgres =
  process.env.DATABASE_URL.includes("localhost") ||
  process.env.DATABASE_URL.includes("127.0.0.1") ||
  process.env.DATABASE_URL.includes("@localhost");

let pool: NeonPool | PgPool;
let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzleNode>;

if (isLocalPostgres) {
  // Use standard node-postgres for local development
  console.log("🔧 Using local PostgreSQL database");
  pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20,
  });

  // Test the connection
  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });

  db = drizzleNode(pool, { schema });
} else {
  // Use Neon serverless for production/remote
  console.log("☁️  Using Neon serverless database");
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool, schema });
}

// Test database connection immediately (skip in tests)
if (process.env.NODE_ENV !== "test") {
  (async () => {
    try {
      console.log("Testing database connection...");
      await db.execute(sql`SELECT 1`);
      console.log("✓ Database connection successful");
    } catch (err) {
      console.error("✗ Database connection failed:", err);
      process.exit(1);
    }
  })();
}

export { pool, db };
