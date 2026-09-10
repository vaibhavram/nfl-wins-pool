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
  if (purpose === "claim") {
    const intro = "You requested to link this email to your Wins Pool account. Click below to confirm.";
    return {
      subject: "Confirm your Wins Pool account",
      text: `${intro}\n\n${link}\n\nThis link remains active for 20 minutes.`,
      html: `<p>${intro}</p><p><a href="${link}">Confirm and sign in</a></p><p>This link remains active for 20 minutes.</p>`,
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

/** Same sanitization app/onboarding/page.tsx#suggestUsername applies to an email local-part,
 * applied here to a legacy manager's display name instead (e.g. "Jong Ha" -> "jong_ha"). */
function sanitizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
}

/** Finishes a claim-purpose link: fills in the placeholder's email/username and marks it
 * onboarded/claimed, in one step, skipping the normal onboarding form entirely -- we already
 * know the person's name (from the legacy roster) and phone (they typed it into /claim just
 * before this link was issued). Guarded by `onboarded_at IS NULL` so a stale second link from
 * the same claim attempt is a harmless no-op rather than clobbering anything. */
async function completeClaim(userId: string, email: string): Promise<void> {
  const rows = await query<{ display_name: string }>("SELECT display_name FROM users WHERE id = $1 AND onboarded_at IS NULL", [
    userId,
  ]);
  if (!rows[0]) return; // already completed (or was never a claim placeholder to begin with)

  const base = sanitizeUsername(rows[0].display_name) || "manager";
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const candidate = suffix ? `${base.slice(0, 20 - suffix.length)}${suffix}` : base;
    try {
      await query(
        "UPDATE users SET email = $1, username = $2, onboarded_at = now(), claimed_at = now() WHERE id = $3 AND onboarded_at IS NULL",
        [email, candidate, userId],
      );
      return;
    } catch (err) {
      if ((err as { code?: string }).code === "23505") continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique username for claimed account");
}

/** Atomically marks the link consumed (single UPDATE...RETURNING, no read-then-write race,
 * matching the concurrency pattern lib/draft-server.ts already uses for pick submission), then
 * resolves or creates the user. An email-invite link's purpose='join_pool' link also serves as
 * that person's identity verification -- clicking it (from their own inbox) is itself proof of
 * email ownership, so no separate sign-in round-trip is needed on top of it. Claim-purpose links
 * pin a user_id up front (see app/api/claim/confirm/route.ts) -- consumeMagicLink then also
 * finishes that placeholder's profile via completeClaim, skipping onboarding entirely. */
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

  if (link.purpose === "claim") {
    await completeClaim(userId, link.email);
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
    needsOnboarding: link.purpose === "claim" ? false : userRow[0].onboarded_at === null,
  };
}
