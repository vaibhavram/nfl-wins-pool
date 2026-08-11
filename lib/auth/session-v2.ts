import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type SessionPayload = { u: string; v: number };

/** Session token for a signed-in user: v2.base64url(json).signature -- no expiry, no DB row,
 * same stateless-HMAC shape as the legacy lib/session.ts. The "v2." prefix and JSON payload
 * make this unforgeable as a legacy token and vice versa -- the two auth systems can never
 * collide, by construction, without needing to share any state. */
export function createSessionToken(userId: string, tokenVersion: number): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, v: tokenVersion } satisfies SessionPayload), "utf8").toString(
    "base64url",
  );
  return `v2.${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | null | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v2") return null;
  const [, payload, sig] = parts;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed.u !== "string" || typeof parsed.v !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}
