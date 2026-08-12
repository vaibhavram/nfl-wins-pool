import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { createSessionToken } from "@/lib/auth/session-v2";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/current-user";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ ok: false, error: "Missing token." }, { status: 400 });

  const result = await consumeMagicLink(token);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  const sessionToken = createSessionToken(result.userId, result.tokenVersion);
  const res = NextResponse.json({
    ok: true,
    redirectTo: result.redirectTo ?? "/pools",
    needsOnboarding: result.needsOnboarding,
  });
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
