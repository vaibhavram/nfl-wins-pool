import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { withTransaction, type ScopedQuery } from "@/lib/db2";
import { hashPhone } from "@/lib/phone-hmac";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!displayName) return NextResponse.json({ ok: false, error: "Enter your name." }, { status: 400 });
  if (displayName.length > 60) return NextResponse.json({ ok: false, error: "Name is too long." }, { status: 400 });
  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { ok: false, error: "Username must be 3-20 characters: letters, numbers, underscores." },
      { status: 400 },
    );
  }
  if (!phone) return NextResponse.json({ ok: false, error: "Enter your phone number." }, { status: 400 });

  try {
    await withTransaction(async (q: ScopedQuery) => {
      await q(
        "UPDATE users SET display_name = $1, username = $2, phone = $3, onboarded_at = now() WHERE id = $4",
        [displayName, username, phone, user.id],
      );

      // Silent legacy-pool claim: if this phone number matches an unclaimed placeholder created
      // by the legacy-pool migration, repoint that placeholder's pool membership, draft slot,
      // and picks onto this real account, then retire the placeholder as a tombstone. No
      // separate "claim" UI or email -- signing up with the same phone number you gave the
      // commissioner before is the whole flow. See lib/phone-hmac.ts and
      // app/api/internal/migrate-legacy-pool/route.ts for how placeholders are seeded.
      const hash = hashPhone(phone);
      const [placeholder] = await q<{ id: string }>(
        "SELECT id FROM users WHERE legacy_phone_hmac = $1 AND claimed_at IS NULL",
        [hash],
      );
      if (placeholder) {
        await q("UPDATE pool_members SET user_id = $1 WHERE user_id = $2", [user.id, placeholder.id]);
        await q("UPDATE season_managers SET user_id = $1 WHERE user_id = $2", [user.id, placeholder.id]);
        await q("UPDATE season_picks SET user_id = $1 WHERE user_id = $2", [user.id, placeholder.id]);
        await q("UPDATE users SET claimed_at = now(), claimed_by = $1 WHERE id = $2", [user.id, placeholder.id]);
      }
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: false, error: "That username is taken." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
