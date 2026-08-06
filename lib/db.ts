import "server-only";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS draft_picks (
        pick_no INTEGER PRIMARY KEY,
        manager TEXT NOT NULL,
        team_ab TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS presence (
        manager TEXT PRIMARY KEY,
        last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS draft_meta (
        id INTEGER PRIMARY KEY DEFAULT 1,
        started_at TIMESTAMPTZ,
        CHECK (id = 1)
      );
      CREATE TABLE IF NOT EXISTS draft_positions (
        position INTEGER PRIMARY KEY,
        manager TEXT NOT NULL
      );
    `).then(() => undefined);
  }
  return schemaReady;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  await ensureSchema();
  const res = await pool.query(text, params);
  return res.rows as T[];
}
