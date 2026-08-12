import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { query } from "@/lib/db2";

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

  try {
    await query(
      "UPDATE users SET display_name = $1, username = $2, phone = $3, onboarded_at = now() WHERE id = $4",
      [displayName, username, phone || null, user.id],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: false, error: "That username is taken." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
