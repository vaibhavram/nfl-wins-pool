// Gmail (and most email clients) strip/refuse to render data: URI images in HTML email bodies --
// confirmed by the digest's own test send, where the base64-embedded leaderboard image simply
// didn't show up. Images in email need to be a real https URL the client fetches when the message
// is opened; this is a minimal self-hosted version of that (no object storage configured yet), an
// in-memory Map keyed by an unguessable random token, same "fine for this single-instance service"
// pattern as the other manual in-memory caches in this codebase (e.g. the simulate route's cache).
import "server-only";
import { randomBytes } from "crypto";

const TTL_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks -- generous for a weekly email that might be opened late

type Entry = { buffer: Buffer; contentType: string; expiresAt: number };
const store = new Map<string, Entry>();

export function storeEmailImage(buffer: Buffer, contentType = "image/png"): string {
  const token = randomBytes(16).toString("hex");
  store.set(token, { buffer, contentType, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function getEmailImage(token: string): { buffer: Buffer; contentType: string } | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(token);
    return null;
  }
  return entry;
}
