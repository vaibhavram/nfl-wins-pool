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
