import { NextRequest, NextResponse } from "next/server";
import { findManagerNameByPhone } from "@/lib/managers-server";
import { createSessionToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone : null;
  if (!phone) {
    return NextResponse.json({ ok: false, error: "Missing phone number." }, { status: 400 });
  }

  const name = findManagerNameByPhone(phone);
  if (!name) {
    return NextResponse.json({ ok: false, error: "That number isn't on the pool roster. Ask the commissioner to add you." });
  }
  return NextResponse.json({ ok: true, name, token: createSessionToken(name) });
}
