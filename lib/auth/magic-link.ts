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

function emailContent(
  purpose: MagicLinkPurpose,
  link: string,
  inviteContext?: { inviterName: string; poolName: string },
): { subject: string; text: string; html: string } {
  if (purpose === "join_pool" && inviteContext) {
    const { inviterName, poolName } = inviteContext;
    const intro = `${inviterName} invited you to join ${poolName} on The Wins Pool. Please click the link below to accept the invite.`;
    return {
      subject: `${inviterName} invited you to ${poolName}`,
      text: `${intro}\n\n${link}\n\nThis link remains active for 20 minutes.`,
      html: `<p>${intro}</p><p><a href="${link}">Accept the invite</a></p><p>This link remains active for 20 minutes.</p>`,
    };
  }
  const intro = "You requested a sign-in link from The Wins Pool. Please click the link below to verify your email.";
  return {
    subject: "Your sign-in link",
    text: `Hi,\n\n${intro} The link remains active for 20 minutes.\n\n${link}`,
    html: `<p>Hi,</p><p>${intro} The link remains active for 20 minutes.</p><p><a href="${link}">Verify your email</a></p>`,
  };
}

/** Issues a single-use magic link and emails it. Callers should treat RateLimitedError the
 * same as success (never reveal whether an address is known or how many times it's been
 * tried) -- see app/api/auth/request-link/route.ts. */
export async function issueMagicLink(params: {
  email: string;
  purpose: MagicLinkPurpose;
  redirectTo?: string;
  userId?: string;
  appUrl: string;
  inviteContext?: { inviterName: string; poolName: string };
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
  const { subject, text, html } = emailContent(params.purpose, link, params.inviteContext);
  await sendEmail({ to: email, subject, text, html });
}

export type ConsumeResult =
  | { ok: true; userId: string; tokenVersion: number; redirectTo: string | null; needsOnboarding: boolean }
  | { ok: false; error: string };

/** Atomically marks the link consumed (single UPDATE...RETURNING, no read-then-write race,
 * matching the concurrency pattern lib/draft-server.ts already uses for pick submission), then
 * resolves or creates the user. An email-invite link's purpose='join_pool' link also serves as
 * that person's identity verification -- clicking it (from their own inbox) is itself proof of
 * email ownership, so no separate sign-in round-trip is needed on top of it. Claim-purpose links
 * (Phase 4) pin a user_id up front; this function will need a small extension then to also fill
 * in that user's email. */
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

  const userRow = await query<{ token_version: number; onboarded_at: string | null }>(
    "SELECT token_version, onboarded_at FROM users WHERE id = $1",
    [userId],
  );
  if (!userRow[0]) return { ok: false, error: "Account not found." };

  return {
    ok: true,
    userId,
    tokenVersion: userRow[0].token_version,
    redirectTo: link.redirect_to,
    needsOnboarding: userRow[0].onboarded_at === null,
  };
}
