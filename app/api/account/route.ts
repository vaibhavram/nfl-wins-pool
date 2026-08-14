import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { query } from "@/lib/db2";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Lets a signed-in user change their own display name and username -- nothing else. Doesn't
 * touch phone or onboarded_at (see app/api/onboarding/route.ts for the first-time-signup version
 * that does), and doesn't rewrite season_managers' snapshotted display names, which are meant to
 * stay frozen at whatever they were when a draft was seeded. */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";

  if (!displayName) return NextResponse.json({ ok: false, error: "Enter your name." }, { status: 400 });
  if (displayName.length > 60) return NextResponse.json({ ok: false, error: "Name is too long." }, { status: 400 });
  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { ok: false, error: "Username must be 3-20 characters: letters, numbers, underscores." },
      { status: 400 },
    );
  }

  try {
    await query("UPDATE users SET display_name = $1, username = $2 WHERE id = $3", [displayName, username, user.id]);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: false, error: "That username is taken." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
