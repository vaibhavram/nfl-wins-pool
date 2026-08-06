import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { MANAGER_NAMES } from "./managers";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Opaque session token for a signed-in manager: base64url(name).signature — no expiry, no DB row. */
export function createSessionToken(name: string): string {
  const payload = Buffer.from(name, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const name = Buffer.from(payload, "base64url").toString("utf8");
  return MANAGER_NAMES.includes(name) ? name : null;
}

/** Pull the manager name out of a request's Authorization: Bearer <token> header. */
export function managerFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifySessionToken(authHeader.slice("Bearer ".length));
}
