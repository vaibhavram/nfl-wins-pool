// Numbered-migration runner for the v2 (multi-tenant) database only. Deliberately not the
// lazy `CREATE TABLE IF NOT EXISTS` pattern lib/db.ts uses for the legacy database -- that
// pattern runs on every cold boot and a DDL typo would fail every request. This runs only
// when explicitly invoked (`npm run migrate`), against DATABASE_URL_V2 only.
//
// Needs direct network access to the database. From environments without that (see
// lib/migrate-runner.ts's doc comment), use the protected /api/internal/migrate route instead,
// which runs the identical logic from inside the deployed container.
import { Pool } from "pg";
import { runPendingMigrations } from "../lib/migrate-runner";

const DATABASE_URL_V2 = process.env.DATABASE_URL_V2;
if (!DATABASE_URL_V2) throw new Error("DATABASE_URL_V2 is not set");

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL_V2 });
  try {
    const { applied, skipped } = await runPendingMigrations(pool);
    for (const f of skipped) console.log(`skip  ${f} (already applied)`);
    for (const f of applied) console.log(`apply ${f}`);
    console.log(applied.length > 0 ? "Done." : "Already up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
