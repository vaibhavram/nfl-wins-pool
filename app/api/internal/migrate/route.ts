import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db2";
import { runPendingMigrations } from "@/lib/migrate-runner";

// One-time-use-per-deploy internal endpoint: applies pending migrations from inside the
// deployed container, which has network access to its own database even when the environment
// running `npm run migrate` doesn't (see lib/migrate-runner.ts). Protected by a dedicated
// secret, not SESSION_SECRET, so a leaked session-signing key can't also run schema changes.
export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATE_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorized = a.length === b.length && timingSafeEqual(a, b);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runPendingMigrations(getPool());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
