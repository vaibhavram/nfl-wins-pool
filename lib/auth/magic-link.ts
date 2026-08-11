import "server-only";
import { randomBytes, createHash } from "crypto";
import { query } from "../db2";
import { sendEmail } from "../email";

const TOKEN_BYTES = 32;
const EXPIRY_MS = 20 * 60 * 1000; // 20 minutes
const RATE_LIMIT_WINDOW = "15 minutes";
const RATE_LIMIT_MAX = 3;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type MagicLinkPurpose = "sign_in" | "join_pool" | "claim";

export class RateLimitedError extends Error {}

/** Issues a single-use magic link and emails it. Callers should treat RateLimitedError the
 * same as success (never reveal whether an address is known or how many times it's been
 * tried) -- see app/api/auth/request-link/route.ts. */
export async function issueMagicLink(params: {
  email: string;
  purpose: MagicLinkPurpose;
  redirectTo?: string;
  userId?: string;
  appUrl: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();

  const recent = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM auth_links WHERE email = $1 AND created_at > now() - interval '${RATE_LIMIT_WINDOW}'`,
    [email],
  );
  if (Number(recent[0].count) >= RATE_LIMIT_MAX) {
    throw new RateLimitedError(`Too many sign-in requests for ${email}`);
  }

  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  await query(
    `INSERT INTO auth_links (token_hash, email, user_id, purpose, redirect_to, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [hashToken(raw), email, params.userId ?? null, params.purpose, params.redirectTo ?? null, expiresAt],
  );

  const link = `${params.appUrl}/auth/link?t=${raw}`;
  await sendEmail({
    to: email,
    subject: "Your sign-in link",
    text: `Sign in: ${link}\n\nThis link works for 20 minutes and only once.`,
    html: `<p><a href="${link}">Sign in</a></p><p>This link works for 20 minutes and only once.</p>`,
  });
}

export type ConsumeResult =
  | { ok: true; userId: string; tokenVersion: number; redirectTo: string | null }
  | { ok: false; error: string };

/** Atomically marks the link consumed (single UPDATE...RETURNING, no read-then-write race,
 * matching the concurrency pattern lib/draft-server.ts already uses for pick submission), then
 * resolves or creates the user. Claim-purpose links (Phase 4) pin a user_id up front; this
 * function will need a small extension then to also fill in that user's email. */
export async function consumeMagicLink(rawToken: string): Promise<ConsumeResult> {
  const rows = await query<{
    id: string;
    email: string;
    user_id: string | null;
    purpose: string;
    redirect_to: string | null;
  }>(
    `UPDATE auth_links SET consumed_at = now()
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
     RETURNING id, email, user_id, purpose, redirect_to`,
    [hashToken(rawToken)],
  );
  const link = rows[0];
  if (!link) return { ok: false, error: "This link is invalid or has expired." };

  let userId = link.user_id;
  if (!userId) {
    const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [link.email]);
    if (existing[0]) {
      userId = existing[0].id;
    } else {
      const displayName = link.email.split("@")[0];
      const created = await query<{ id: string }>("INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id", [
        link.email,
        displayName,
      ]);
      userId = created[0].id;
    }
  }

  const userRow = await query<{ token_version: number }>("SELECT token_version FROM users WHERE id = $1", [userId]);
  if (!userRow[0]) return { ok: false, error: "Account not found." };

  return { ok: true, userId, tokenVersion: userRow[0].token_version, redirectTo: link.redirect_to };
}
