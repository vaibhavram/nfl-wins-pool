import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { captureWinProbabilitySnapshots } from "@/lib/win-probability-snapshot";

// Same MIGRATE_SECRET bearer gate as the other /api/internal routes. Meant to be called once a
// day (11pm PT) by the win-probability-snapshot-cron Railway service. `dryRun: true` computes and
// returns every row without writing anything to win_probability_snapshots.
export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATE_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorized = a.length === b.length && timingSafeEqual(a, b);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  try {
    const result = await captureWinProbabilitySnapshots({ dryRun });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
