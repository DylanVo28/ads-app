import "server-only";

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for authentication.");
}

declare global {
  var postgresPool: Pool | undefined;
}

export const db = globalThis.postgresPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresPool = db;
}

export async function ensureUsersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
