import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { withTransaction, type ScopedQuery } from "@/lib/db2";

// Handles the case /api/claim/confirm's email-collision check exists to catch: someone tries to
// claim their legacy placeholder with an email that already belongs to a *different*, unrelated
// account they made independently before the claim flow existed. Rather than forcing them onto
// a second, fresh account, this manually repoints the placeholder's pool_members/
// season_managers/season_picks onto their existing real account and tombstones the placeholder
// -- the exact same merge app/api/onboarding/route.ts already does automatically for the silent
// phone-match path, just triggered by hand for a one-off collision instead of at onboarding time.
export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATE_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorized = a.length === b.length && timingSafeEqual(a, b);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const placeholderId = typeof body?.placeholderId === "string" ? body.placeholderId : "";
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : "";
  if (!placeholderId || !targetUserId) {
    return NextResponse.json({ ok: false, error: "placeholderId and targetUserId are required" }, { status: 400 });
  }

  try {
    await withTransaction(async (query: ScopedQuery) => {
      const placeholders = await query<{ id: string }>(
        "SELECT id FROM users WHERE id = $1 AND legacy_manager_name IS NOT NULL AND claimed_at IS NULL",
        [placeholderId],
      );
      if (!placeholders[0]) throw new Error("Not an unclaimed legacy placeholder");

      const targets = await query<{ id: string }>("SELECT id FROM users WHERE id = $1", [targetUserId]);
      if (!targets[0]) throw new Error("Target user not found");

      await query("UPDATE pool_members SET user_id = $1 WHERE user_id = $2", [targetUserId, placeholderId]);
      await query("UPDATE season_managers SET user_id = $1 WHERE user_id = $2", [targetUserId, placeholderId]);
      await query("UPDATE season_picks SET user_id = $1 WHERE user_id = $2", [targetUserId, placeholderId]);
      await query("UPDATE users SET claimed_at = now(), claimed_by = $1 WHERE id = $2", [targetUserId, placeholderId]);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
