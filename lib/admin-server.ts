import "server-only";
import { query } from "./db2";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/** Whether this email may see /admin. Gated on email (not username -- usernames are
 * user-editable via /account now, so gating on one would break the moment the owner renames
 * themselves). No ADMIN_EMAIL set means nobody gets in, not everybody. */
export function isAdminEmail(email: string | null): boolean {
  return Boolean(ADMIN_EMAIL) && email === ADMIN_EMAIL;
}

/** SQL LIKE patterns that catch known test-account shapes:
 *  - Gmail plus-aliases of the admin's own address (vaibhav.ramamoorthy+anything@gmail.com) --
 *    every scripted test account created during development used one of these, since it's the
 *    standard trick for many distinct-but-real-inbox addresses without owning extra domains.
 *  - mailinator.com addresses -- a public disposable-inbox service used for manual testing.
 * Neither can collide with a real user's address by accident: one is anchored to the admin's own
 * local-part, the other to a domain nobody uses for a real account. */
function testEmailLikePatterns(): string[] {
  const patterns: string[] = ["%@mailinator.com"];
  if (ADMIN_EMAIL?.includes("@")) {
    const [localPart, domain] = ADMIN_EMAIL.split("@");
    patterns.push(`${localPart}+%@${domain}`);
  }
  return patterns;
}

/** Pool names that are unambiguously placeholders from manual testing ("Test", "Test 2", ...)
 * rather than someone's actual pool name. */
const TEST_POOL_NAME_REGEX = "^test( ?[0-9]+)?$";

/** Every user id and pool id that looks like a test artifact rather than real usage -- recomputed
 * on every call (deliberately not cached across requests, so a newly-created test pool is
 * excluded on the very next /admin load, not after a redeploy) and reused by every stat query
 * below so "what counts as a test" only lives in one place. /admin is loaded rarely enough by one
 * person that the handful of extra small queries this costs per page view doesn't matter. */
async function getTestExclusions(): Promise<{ userIds: string[]; poolIds: string[] }> {
  const patterns = testEmailLikePatterns();
  const userRows = await query<{ id: string }>(
    `SELECT id FROM users WHERE ${patterns.map((_, i) => `email LIKE $${i + 1}`).join(" OR ")}`,
    patterns,
  );
  const userIds = userRows.map((r) => r.id);

  const poolRows = await query<{ id: string }>(
    `SELECT id FROM pools WHERE created_by = ANY($1::uuid[]) OR name ~* $2`,
    [userIds, TEST_POOL_NAME_REGEX],
  );
  return { userIds, poolIds: poolRows.map((r) => r.id) };
}

export type AdminStats = {
  totalUsers: number;
  totalPools: number;
  poolsDrafting: number;
  poolsInSeason: number;
  seatsFilled: number;
  seatsTotal: number;
};

type CurrentSeasonRow = { pool_id: string; slug: string; name: string; status: string; member_count: string };

/** One row per pool -- its most recent season only, same "current season" convention used
 * throughout (lib/dashboard-server.ts), since a pool can only have more than one season once
 * rollover ships, which it hasn't yet. Excludes test pools (see getTestExclusions). */
async function getCurrentSeasonsAcrossAllPools(): Promise<CurrentSeasonRow[]> {
  const { poolIds } = await getTestExclusions();
  return query<CurrentSeasonRow>(
    `SELECT DISTINCT ON (ps.pool_id)
       ps.pool_id, p.slug, p.name, ps.status,
       (SELECT count(*)::text FROM pool_members WHERE pool_id = ps.pool_id) AS member_count
     FROM pool_seasons ps
     JOIN pools p ON p.id = ps.pool_id
     WHERE p.id <> ALL($1::uuid[])
     ORDER BY ps.pool_id, ps.season_year DESC`,
    [poolIds],
  );
}

export async function getAdminStats(): Promise<AdminStats> {
  const { userIds, poolIds } = await getTestExclusions();
  const [[{ count: totalUsers }], [{ count: totalPools }], currentSeasons] = await Promise.all([
    query<{ count: string }>("SELECT count(*)::text AS count FROM users WHERE id <> ALL($1::uuid[])", [userIds]),
    query<{ count: string }>("SELECT count(*)::text AS count FROM pools WHERE id <> ALL($1::uuid[])", [poolIds]),
    getCurrentSeasonsAcrossAllPools(),
  ]);

  return {
    totalUsers: Number(totalUsers),
    totalPools: Number(totalPools),
    poolsDrafting: currentSeasons.filter((s) => s.status === "drafting").length,
    poolsInSeason: currentSeasons.filter((s) => s.status === "in_season" || s.status === "final").length,
    seatsFilled: currentSeasons.reduce((sum, s) => sum + Number(s.member_count), 0),
    seatsTotal: currentSeasons.length * 10,
  };
}

export type StatusBreakdown = { status: string; count: number }[];

export async function getPoolsByStatus(): Promise<StatusBreakdown> {
  const seasons = await getCurrentSeasonsAcrossAllPools();
  const order = ["filling", "ready", "drafting", "in_season", "final"];
  const counts = new Map(order.map((s) => [s, 0]));
  for (const s of seasons) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  return order.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

/** Daily signup counts for the last 30 days, zero-filled so the bar row has no gaps. */
export async function getSignupsByDay(): Promise<{ day: string; count: number }[]> {
  const { userIds } = await getTestExclusions();
  const rows = await query<{ day: string; count: string }>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::text AS count
     FROM users
     WHERE created_at > now() - interval '30 days' AND id <> ALL($1::uuid[])
     GROUP BY 1
     ORDER BY 1`,
    [userIds],
  );
  const byDay = new Map(rows.map((r) => [r.day, Number(r.count)]));
  const days: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return days;
}

export type ActivityEvent = {
  type: "signup" | "pool_created" | "draft_started" | "draft_completed";
  at: string;
  label: string;
};

export async function getRecentActivity(limit = 20): Promise<ActivityEvent[]> {
  const { userIds, poolIds } = await getTestExclusions();
  const [signups, poolsCreated, draftsStarted, draftsCompleted] = await Promise.all([
    query<{ display_name: string; email: string | null; created_at: string }>(
      `SELECT display_name, email, created_at FROM users
       WHERE id <> ALL($2::uuid[])
       ORDER BY created_at DESC LIMIT $1`,
      [limit, userIds],
    ),
    query<{ name: string; creator_name: string; created_at: string }>(
      `SELECT p.name, u.display_name AS creator_name, p.created_at
       FROM pools p JOIN users u ON u.id = p.created_by
       WHERE p.id <> ALL($2::uuid[])
       ORDER BY p.created_at DESC LIMIT $1`,
      [limit, poolIds],
    ),
    query<{ name: string; draft_started_at: string }>(
      `SELECT p.name, ps.draft_started_at
       FROM pool_seasons ps JOIN pools p ON p.id = ps.pool_id
       WHERE ps.draft_started_at IS NOT NULL AND p.id <> ALL($2::uuid[])
       ORDER BY ps.draft_started_at DESC LIMIT $1`,
      [limit, poolIds],
    ),
    query<{ name: string; draft_completed_at: string }>(
      `SELECT p.name, ps.draft_completed_at
       FROM pool_seasons ps JOIN pools p ON p.id = ps.pool_id
       WHERE ps.draft_completed_at IS NOT NULL AND p.id <> ALL($2::uuid[])
       ORDER BY ps.draft_completed_at DESC LIMIT $1`,
      [limit, poolIds],
    ),
  ]);

  const events: ActivityEvent[] = [
    ...signups.map((u) => ({ type: "signup" as const, at: u.created_at, label: `${u.display_name} signed up${u.email ? ` (${u.email})` : ""}` })),
    ...poolsCreated.map((p) => ({ type: "pool_created" as const, at: p.created_at, label: `${p.creator_name} created "${p.name}"` })),
    ...draftsStarted.map((p) => ({ type: "draft_started" as const, at: p.draft_started_at, label: `Draft started in "${p.name}"` })),
    ...draftsCompleted.map((p) => ({ type: "draft_completed" as const, at: p.draft_completed_at, label: `Draft completed in "${p.name}"` })),
  ];

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events.slice(0, limit);
}

export type StalledPool = { slug: string; name: string; reason: string };

export async function getStalledPools(): Promise<StalledPool[]> {
  const { poolIds } = await getTestExclusions();
  const [stuckFilling, stuckDrafting] = await Promise.all([
    query<{ slug: string; name: string; last_joined: string; member_count: string }>(
      `SELECT p.slug, p.name, MAX(pm.joined_at) AS last_joined, count(pm.*)::text AS member_count
       FROM pools p
       JOIN pool_seasons ps ON ps.pool_id = p.id AND ps.status = 'filling'
       JOIN pool_members pm ON pm.pool_id = p.id
       WHERE p.id <> ALL($1::uuid[])
       GROUP BY p.id, p.slug, p.name
       HAVING MAX(pm.joined_at) < now() - interval '7 days'`,
      [poolIds],
    ),
    query<{ slug: string; name: string; draft_started_at: string; last_pick_at: string | null }>(
      `SELECT p.slug, p.name, ps.draft_started_at,
         (SELECT MAX(created_at) FROM season_picks WHERE season_id = ps.id) AS last_pick_at
       FROM pools p
       JOIN pool_seasons ps ON ps.pool_id = p.id AND ps.status = 'drafting'
       WHERE p.id <> ALL($1::uuid[])`,
      [poolIds],
    ),
  ]);

  const stalled: StalledPool[] = stuckFilling.map((p) => ({
    slug: p.slug,
    name: p.name,
    reason: `${p.member_count}/10 joined, no new member in 7+ days`,
  }));

  for (const p of stuckDrafting) {
    const lastActivity = p.last_pick_at ?? p.draft_started_at;
    const hoursSince = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);
    if (hoursSince >= 48) {
      stalled.push({ slug: p.slug, name: p.name, reason: `No pick in ${Math.floor(hoursSince / 24)}+ days` });
    }
  }

  return stalled;
}
