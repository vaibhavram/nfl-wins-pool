import { NextResponse } from "next/server";
import { issueMagicLink, RateLimitedError } from "@/lib/auth/magic-link";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  try {
    await issueMagicLink({ email, purpose: "sign_in", redirectTo: body?.redirectTo, appUrl });
  } catch (err) {
    if (!(err instanceof RateLimitedError)) throw err;
    // fall through -- rate limiting is invisible to the client too
  }
  // Always the same response: never reveal whether the address is known or rate-limited.
  return NextResponse.json({ ok: true });
}
