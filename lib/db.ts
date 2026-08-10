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
      -- Append-only audit log: application code only ever INSERTs here, never UPDATEs or
      -- DELETEs, so it survives a draft reset even though draft_picks itself gets wiped.
      CREATE TABLE IF NOT EXISTS draft_events (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        pick_no INTEGER,
        manager TEXT,
        team_ab TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      -- One-time, idempotent backfill of picks that were already made before this log existed.
      INSERT INTO draft_events (event_type, pick_no, manager, team_ab, created_at)
      SELECT 'pick', dp.pick_no, dp.manager, dp.team_ab, dp.created_at
      FROM draft_picks dp
      WHERE NOT EXISTS (
        SELECT 1 FROM draft_events de WHERE de.event_type = 'pick' AND de.pick_no = dp.pick_no
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
