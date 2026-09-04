import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getAllPools } from "@/lib/admin-server";

// Read-only twin of /api/internal/migrate: same MIGRATE_SECRET bearer gate, used for one-off
// production data checks from outside a browser session (e.g. confirming pool/creator counts)
// without needing to sign in as the admin user first.
export async function GET(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATE_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorized = a.length === b.length && timingSafeEqual(a, b);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const pools = await getAllPools();
    return NextResponse.json({ ok: true, pools });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
