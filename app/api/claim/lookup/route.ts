import { NextResponse } from "next/server";
import { query } from "@/lib/db2";
import { hashPhone } from "@/lib/phone-hmac";
import { getStandings } from "@/lib/espn";

const RATE_LIMIT_WINDOW = "15 minutes";
const RATE_LIMIT_MAX = 8; // looser than sign-in's 3 -- a mistyped digit is a normal retry here, and a failed lookup never sends an email

const NOT_FOUND_MESSAGE = "That number isn't on file. Ask your commissioner to check it, or try again.";

// ab/wins/losses/ties only -- the client resolves city/name/color/logo itself via lib/teams.ts's
// TEAM map, same as every other component that renders a team (e.g. components/TeamLogo.tsx).
type TeamPreview = { ab: string; wins: number; losses: number; ties: number };

/** Public, unauthenticated: given a phone number, previews the legacy pool it matches (if any)
 * without creating or linking anything yet -- that only happens in /api/claim/confirm once the
 * person picks an email and we've shown them what they're about to attach it to. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (!phone) return NextResponse.json({ ok: false, error: "Enter your phone number." }, { status: 400 });

  const phoneHash = hashPhone(phone);

  const recent = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM claim_lookup_attempts WHERE phone_hash = $1 AND created_at > now() - interval '${RATE_LIMIT_WINDOW}'`,
    [phoneHash],
  );
  await query("INSERT INTO claim_lookup_attempts (phone_hash) VALUES ($1)", [phoneHash]);
  if (Number(recent[0].count) >= RATE_LIMIT_MAX) {
    return NextResponse.json({ ok: false, error: NOT_FOUND_MESSAGE });
  }

  const placeholders = await query<{ id: string; display_name: string }>(
    "SELECT id, display_name FROM users WHERE legacy_phone_hmac = $1 AND claimed_at IS NULL",
    [phoneHash],
  );
  const placeholder = placeholders[0];
  if (!placeholder) return NextResponse.json({ ok: false, error: NOT_FOUND_MESSAGE });

  const memberships = await query<{ pool_name: string; season_id: string; draft_position: number; member_count: string }>(
    `SELECT p.name AS pool_name, ps.id AS season_id, sm.draft_position,
       (SELECT count(*)::text FROM pool_members WHERE pool_id = p.id) AS member_count
     FROM pool_members pm
     JOIN pools p ON p.id = pm.pool_id
     JOIN pool_seasons ps ON ps.pool_id = p.id
     JOIN season_managers sm ON sm.season_id = ps.id AND sm.user_id = pm.user_id
     WHERE pm.user_id = $1
     ORDER BY ps.season_year DESC
     LIMIT 1`,
    [placeholder.id],
  );
  const membership = memberships[0];
  if (!membership) return NextResponse.json({ ok: false, error: NOT_FOUND_MESSAGE });

  const picks = await query<{ team_ab: string }>("SELECT team_ab FROM season_picks WHERE season_id = $1 AND user_id = $2", [
    membership.season_id,
    placeholder.id,
  ]);

  const standings = await getStandings();
  const teams: TeamPreview[] = picks.map((p) => {
    const rec = standings[p.team_ab];
    return { ab: p.team_ab, wins: rec?.wins ?? 0, losses: rec?.losses ?? 0, ties: rec?.ties ?? 0 };
  });

  return NextResponse.json({
    ok: true,
    name: placeholder.display_name,
    poolName: membership.pool_name,
    draftPosition: membership.draft_position,
    memberCount: Number(membership.member_count),
    teams,
  });
}
