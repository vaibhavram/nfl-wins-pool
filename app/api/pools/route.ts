import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createPool } from "@/lib/pools-server";

const PICK_CLOCK_OPTIONS_SECONDS = new Set([60, 120, 300, 600, 3600, 14400, 28800, 43200, 86400]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const pickClockSeconds = PICK_CLOCK_OPTIONS_SECONDS.has(body?.pickClockSeconds) ? body.pickClockSeconds : 43200;

  if (!name) return NextResponse.json({ ok: false, error: "Give your pool a name." }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ ok: false, error: "Pool name is too long." }, { status: 400 });

  const pool = await createPool({ creatorUserId: user.id, name, pickClockSeconds });
  return NextResponse.json({ ok: true, slug: pool.slug });
}
