import "server-only";
import { randomBytes } from "crypto";
import { query } from "./db2";
import { getPoolMembers, joinPool, type JoinResult } from "./pools-server";

function generateToken(): string {
  return randomBytes(12).toString("base64url");
}

export type InviteRow = {
  id: string;
  pool_id: string;
  token: string;
  kind: "link" | "email";
  email: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  accepted_at: string | null;
};

/** The single durable share link for a pool (screen 07's primary invite path) -- gets-or-creates
 * so repeated calls return the same link rather than minting a new one every time. */
export async function getOrCreateShareLink(poolId: string, createdBy: string): Promise<InviteRow> {
  const existing = await query<InviteRow>(
    "SELECT * FROM pool_invites WHERE pool_id = $1 AND kind = 'link' AND revoked_at IS NULL",
    [poolId],
  );
  if (existing[0]) return existing[0];

  const [row] = await query<InviteRow>(
    "INSERT INTO pool_invites (pool_id, token, kind, created_by) VALUES ($1, $2, 'link', $3) RETURNING *",
    [poolId, generateToken(), createdBy],
  );
  return row;
}

export async function createEmailInvite(poolId: string, createdBy: string, email: string): Promise<InviteRow> {
  const [row] = await query<InviteRow>(
    "INSERT INTO pool_invites (pool_id, token, kind, email, created_by) VALUES ($1, $2, 'email', $3, $4) RETURNING *",
    [poolId, generateToken(), email.trim().toLowerCase(), createdBy],
  );
  return row;
}

export async function listInvites(poolId: string): Promise<InviteRow[]> {
  return query<InviteRow>(
    "SELECT * FROM pool_invites WHERE pool_id = $1 AND kind = 'email' ORDER BY created_at DESC",
    [poolId],
  );
}

export async function revokeInvite(inviteId: string, poolId: string): Promise<void> {
  await query("UPDATE pool_invites SET revoked_at = now() WHERE id = $1 AND pool_id = $2", [inviteId, poolId]);
}

export type InvitePreview = {
  invite: InviteRow;
  pool: { id: string; name: string; slug: string };
  seasonYear: number;
  memberCount: number;
  commissionerName: string;
};

export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const invites = await query<InviteRow>("SELECT * FROM pool_invites WHERE token = $1 AND revoked_at IS NULL", [token]);
  const invite = invites[0];
  if (!invite) return null;

  const pools = await query<{ id: string; name: string; slug: string }>("SELECT id, name, slug FROM pools WHERE id = $1", [
    invite.pool_id,
  ]);
  const pool = pools[0];
  if (!pool) return null;

  const seasons = await query<{ season_year: number }>(
    "SELECT season_year FROM pool_seasons WHERE pool_id = $1 ORDER BY season_year DESC LIMIT 1",
    [pool.id],
  );
  const members = await getPoolMembers(pool.id);
  const commissioner = members.find((m) => m.role === "commissioner");

  return {
    invite,
    pool,
    seasonYear: seasons[0]?.season_year ?? new Date().getFullYear(),
    memberCount: members.length,
    commissionerName: commissioner?.display_name ?? "Someone",
  };
}

export type AcceptResult = JoinResult;

/** Joins the pool the invite points to, and -- for a named email invite, not the reusable share
 * link -- records who accepted it so the pending list in settings can show "Joined". */
export async function acceptInvite(token: string, userId: string): Promise<AcceptResult> {
  const invites = await query<InviteRow>("SELECT * FROM pool_invites WHERE token = $1 AND revoked_at IS NULL", [token]);
  const invite = invites[0];
  if (!invite) return { ok: false, error: "This invite is invalid or has been revoked." };

  const result = await joinPool(invite.pool_id, userId);
  if (result.ok && invite.kind === "email" && !invite.accepted_at) {
    await query("UPDATE pool_invites SET accepted_at = now(), accepted_by = $1 WHERE id = $2", [userId, invite.id]);
  }
  return result;
}
