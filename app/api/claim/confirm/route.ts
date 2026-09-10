import { NextResponse } from "next/server";
import { query } from "@/lib/db2";
import { hashPhone } from "@/lib/phone-hmac";
import { issueMagicLink, RateLimitedError } from "@/lib/auth/magic-link";

const NOT_FOUND_MESSAGE = "That number isn't on file. Ask your commissioner to check it, or try again.";

/** Public: re-verifies the phone still matches an unclaimed placeholder (never trust the
 * client's earlier /api/claim/lookup round-trip), records the phone on that placeholder, and
 * issues a claim-purpose magic link to the chosen email. The actual profile completion
 * (email/username/onboarded_at) happens when that link is clicked -- see
 * lib/auth/magic-link.ts#completeClaim -- clicking from their own inbox is what proves they
 * own the email, same as every other magic-link purpose in this app. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!phone) return NextResponse.json({ ok: false, error: "Enter your phone number." }, { status: 400 });
  if (!email.includes("@")) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });

  const phoneHash = hashPhone(phone);
  const placeholders = await query<{ id: string }>("SELECT id FROM users WHERE legacy_phone_hmac = $1 AND claimed_at IS NULL", [
    phoneHash,
  ]);
  const placeholder = placeholders[0];
  if (!placeholder) return NextResponse.json({ ok: false, error: NOT_FOUND_MESSAGE });

  const conflicting = await query<{ id: string }>("SELECT id FROM users WHERE email = $1 AND id <> $2", [email, placeholder.id]);
  if (conflicting[0]) {
    return NextResponse.json({ ok: false, error: "That email is already in use by a different Wins Pool account." }, { status: 409 });
  }

  await query("UPDATE users SET phone = $1 WHERE id = $2", [phone, placeholder.id]);

  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  try {
    await issueMagicLink({ email, purpose: "claim", userId: placeholder.id, appUrl });
  } catch (err) {
    if (!(err instanceof RateLimitedError)) throw err;
    // Same as sign-in: rate limiting is invisible to the client.
  }

  return NextResponse.json({ ok: true });
}
