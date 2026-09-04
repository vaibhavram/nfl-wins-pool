// Connection to the v2 (multi-tenant) database only -- completely separate from lib/db.ts's
// connection to the legacy single-pool database. Schema is applied explicitly via
// scripts/migrate.ts / the /api/internal/migrate route, never lazily on the request path.
import "server-only";
import { Pool } from "pg";

// Lazy: reading/validating the env var at module-load time would throw during `next build`'s
// route-collection pass (which imports every route handler module), before any env vars are
// available. Deferred to first actual use, same pattern as lib/session.ts's secret().
let pool2: Pool | null = null;

export function getPool(): Pool {
  if (pool2) return pool2;
  const connectionString = process.env.DATABASE_URL_V2;
  if (!connectionString) throw new Error("DATABASE_URL_V2 is not set");
  pool2 = new Pool({ connectionString });
  return pool2;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export type ScopedQuery = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

/** Runs `fn` inside a single BEGIN/COMMIT, rolling back on any thrown error. Nothing else in
 * this codebase transacts multi-statement writes (existing call sites are sequential
 * un-transacted queries) -- this exists for operations where a partial failure would leave
 * genuinely corrupt state: the legacy-pool migration (~60 rows across 5 tables) and the
 * onboarding claim-merge (foreign keys repointed across 3 tables). */
export async function withTransaction<T>(fn: (query: ScopedQuery) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const scopedQuery: ScopedQuery = async (text, params) => (await client.query(text, params)).rows;
    const result = await fn(scopedQuery);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
