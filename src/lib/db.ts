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
  await db.query("SELECT pg_advisory_lock(hashtext('ad_app_auth_schema'))");

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'");

    await db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        session_token_hash TEXT NOT NULL UNIQUE,
        device_id TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        logged_out_at TIMESTAMPTZ NULL
      )
    `);

    await db.query("CREATE INDEX IF NOT EXISTS user_sessions_active_idx ON user_sessions (user_id, expires_at) WHERE logged_out_at IS NULL");
  } finally {
    await db.query("SELECT pg_advisory_unlock(hashtext('ad_app_auth_schema'))");
  }
}
