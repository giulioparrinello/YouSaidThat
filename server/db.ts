import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("[db] DATABASE_URL is not set — all DB queries will fail");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
