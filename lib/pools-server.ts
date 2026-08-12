import "server-only";
import { randomBytes, randomInt } from "crypto";
import { query } from "./db2";

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l, avoids ambiguous slugs
const SLUG_LENGTH = 10;
const MAX_SEATS = 10;

function generateSlug(): string {
  const bytes = randomBytes(SLUG_LENGTH);
  let out = "";
  for (let i = 0; i < SLUG_LENGTH; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

/** Fisher-Yates via crypto.randomInt -- same approach the legacy app used for its draft-position shuffle. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type PoolRow = {
  id: string;
  slug: string;
  name: string;
  created_by: string;
  is_legacy: boolean;
  created_at: string;
};

export type SeasonRow = {
  id: string;
  pool_id: string;
  season_year: number;
  status: "filling" | "ready" | "drafting" | "in_season" | "final";
  pick_clock_seconds: number;
  scheduled_draft_at: string | null;
  draft_started_at: string | null;
  draft_completed_at: string | null;
};

export type MemberRow = {
  user_id: string;
  seat_no: number;
  role: "commissioner" | "manager";
  display_name: string;
  email: string | null;
  joined_at: string;
};

function currentSeasonYear(): number {
  return new Date().getFullYear();
}

export async function createPool(params: {
  creatorUserId: string;
  name: string;
  pickClockSeconds: number;
}): Promise<{ id: string; slug: string }> {
  const slug = generateSlug();
  const [pool] = await query<{ id: string }>(
    "INSERT INTO pools (slug, name, created_by) VALUES ($1, $2, $3) RETURNING id",
    [slug, params.name, params.creatorUserId],
  );
  await query("INSERT INTO pool_members (pool_id, user_id, seat_no, role) VALUES ($1, $2, 1, 'commissioner')", [
    pool.id,
    params.creatorUserId,
  ]);
  await query("INSERT INTO pool_seasons (pool_id, season_year, pick_clock_seconds) VALUES ($1, $2, $3)", [
    pool.id,
    currentSeasonYear(),
    params.pickClockSeconds,
  ]);
  return { id: pool.id, slug };
}

export async function getPoolBySlug(slug: string): Promise<PoolRow | null> {
  const rows = await query<PoolRow>("SELECT * FROM pools WHERE slug = $1", [slug]);
  return rows[0] ?? null;
}

/** For Phase 2 there's only ever one season per pool (multi-season isn't built yet) -- just the
 * single row that exists. */
export async function getCurrentSeason(poolId: string): Promise<SeasonRow | null> {
  const rows = await query<SeasonRow>("SELECT * FROM pool_seasons WHERE pool_id = $1 ORDER BY season_year DESC LIMIT 1", [
    poolId,
  ]);
  return rows[0] ?? null;
}

export async function getPoolMembers(poolId: string): Promise<MemberRow[]> {
  return query<MemberRow>(
    `SELECT pm.user_id, pm.seat_no, pm.role, pm.joined_at, u.display_name, u.email
     FROM pool_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.pool_id = $1 ORDER BY pm.seat_no ASC`,
    [poolId],
  );
}

export async function getMembership(poolId: string, userId: string): Promise<MemberRow | null> {
  const rows = await query<MemberRow>(
    `SELECT pm.user_id, pm.seat_no, pm.role, pm.joined_at, u.display_name, u.email
     FROM pool_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.pool_id = $1 AND pm.user_id = $2`,
    [poolId, userId],
  );
  return rows[0] ?? null;
}

/** Randomly assigns draft positions 1-10 to every current member, once, when a pool fills up.
 * Snapshots each member's display name into season_managers so a later rename doesn't rewrite
 * draft-day history. */
async function seedSeasonManagers(seasonId: string, poolId: string): Promise<void> {
  const members = await getPoolMembers(poolId);
  const positions = shuffle(members.map((_, i) => i + 1));
  for (let i = 0; i < members.length; i++) {
    await query("INSERT INTO season_managers (season_id, user_id, display_name, draft_position) VALUES ($1, $2, $3, $4)", [
      seasonId,
      members[i].user_id,
      members[i].display_name,
      positions[i],
    ]);
  }
}

export type JoinResult =
  | { ok: true; seatNo: number; alreadyMember: boolean; poolReady: boolean }
  | { ok: false; error: string };

/** Adds a user to a pool, allocating the lowest free seat (not just count+1 -- a member removed
 * from the middle would otherwise leave a gap that later collides). Transitions the season to
 * "ready" and seeds the random draft order exactly once, the moment the 10th seat fills. */
export async function joinPool(poolId: string, userId: string): Promise<JoinResult> {
  const existing = await query<{ seat_no: number }>("SELECT seat_no FROM pool_members WHERE pool_id = $1 AND user_id = $2", [
    poolId,
    userId,
  ]);
  if (existing[0]) return { ok: true, seatNo: existing[0].seat_no, alreadyMember: true, poolReady: false };

  const season = await getCurrentSeason(poolId);
  if (!season || season.status !== "filling") {
    return { ok: false, error: "This pool isn't accepting new members right now." };
  }

  for (let attempt = 0; attempt < MAX_SEATS; attempt++) {
    const [{ seat }] = await query<{ seat: number | null }>(
      `SELECT MIN(t.seat)::int AS seat FROM generate_series(1, $2) AS t(seat)
       WHERE t.seat NOT IN (SELECT seat_no FROM pool_members WHERE pool_id = $1)`,
      [poolId, MAX_SEATS],
    );
    if (seat === null) return { ok: false, error: "This pool is already full." };

    try {
      await query("INSERT INTO pool_members (pool_id, user_id, seat_no, role) VALUES ($1, $2, $3, 'manager')", [
        poolId,
        userId,
        seat,
      ]);

      const count = await query<{ count: string }>("SELECT count(*)::text AS count FROM pool_members WHERE pool_id = $1", [
        poolId,
      ]);
      let poolReady = false;
      if (Number(count[0].count) >= MAX_SEATS) {
        const readied = await query<{ id: string }>(
          "UPDATE pool_seasons SET status = 'ready' WHERE id = $1 AND status = 'filling' RETURNING id",
          [season.id],
        );
        if (readied[0]) {
          await seedSeasonManagers(season.id, poolId);
          poolReady = true;
        }
      }
      return { ok: true, seatNo: seat, alreadyMember: false, poolReady };
    } catch (err) {
      if ((err as { code?: string }).code === "23505") continue; // seat race -- recompute and retry
      throw err;
    }
  }
  return { ok: false, error: "Couldn't join right now -- please try again." };
}

export type RemoveResult = { ok: true } | { ok: false; error: string };

/** Removes a not-yet-drafting member. If the pool had already filled to "ready", this reopens
 * it (back to "filling") and clears the randomized draft order, since it was assigned for a
 * specific 10-person roster that no longer exists -- it'll be reseeded once the pool refills. */
export async function removeMember(poolId: string, userId: string): Promise<RemoveResult> {
  const member = await getMembership(poolId, userId);
  if (!member) return { ok: false, error: "That person isn't in this pool." };
  if (member.role === "commissioner") return { ok: false, error: "The commissioner can't be removed." };

  const season = await getCurrentSeason(poolId);
  if (!season || (season.status !== "filling" && season.status !== "ready")) {
    return { ok: false, error: "Members can't be removed once the draft has started." };
  }

  await query("DELETE FROM pool_members WHERE pool_id = $1 AND user_id = $2", [poolId, userId]);
  if (season.status === "ready") {
    await query("UPDATE pool_seasons SET status = 'filling' WHERE id = $1", [season.id]);
    await query("DELETE FROM season_managers WHERE season_id = $1", [season.id]);
  }
  return { ok: true };
}

export async function renamePool(poolId: string, name: string): Promise<void> {
  await query("UPDATE pools SET name = $1 WHERE id = $2", [name, poolId]);
}

export type UpdateDraftSettingsResult = { ok: true } | { ok: false; error: string };

/** Commissioner-only, and only while the draft hasn't started -- once picks exist, the clock and
 * schedule are no longer meaningful to change. */
export async function updateDraftSettings(
  seasonId: string,
  updates: { pickClockSeconds?: number; scheduledDraftAt?: string | null },
): Promise<UpdateDraftSettingsResult> {
  const season = await query<SeasonRow>("SELECT * FROM pool_seasons WHERE id = $1", [seasonId]);
  if (!season[0]) return { ok: false, error: "Season not found." };
  if (season[0].status !== "filling" && season[0].status !== "ready") {
    return { ok: false, error: "Draft settings can't be changed once the draft has started." };
  }

  if (updates.pickClockSeconds !== undefined) {
    await query("UPDATE pool_seasons SET pick_clock_seconds = $1 WHERE id = $2", [updates.pickClockSeconds, seasonId]);
  }
  if (updates.scheduledDraftAt !== undefined) {
    await query("UPDATE pool_seasons SET scheduled_draft_at = $1 WHERE id = $2", [updates.scheduledDraftAt, seasonId]);
  }
  return { ok: true };
}
