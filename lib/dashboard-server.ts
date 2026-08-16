import "server-only";
import { query } from "./db2";
import { getOnClockManager, getSeasonPicks, getSeasonManagers } from "./season-server";
import { rostersFromPicks, totalWins } from "./draft";
import { getStandings } from "./espn";

export type PoolCard = {
  id: string;
  slug: string;
  name: string;
  role: "commissioner" | "manager";
  seasonId: string;
  seasonYear: number;
  status: "filling" | "ready" | "drafting" | "in_season" | "final";
  memberCount: number;
  /** Set only for in_season/final pools -- the viewer's 1-based standing. */
  rank: number | null;
  /** Set only for drafting pools. */
  isMyTurn: boolean;
  onClockName: string | null;
};

type PoolCardRow = Omit<PoolCard, "rank" | "isMyTurn" | "onClockName">;

/** Every pool this user belongs to, newest season first, one row per (pool, season). A pool with
 * multiple seasons (once season rollover exists) shows up as multiple rows -- callers split the
 * newest per pool from the rest to build a "current" list plus a past-seasons archive. */
async function getUserPoolRows(userId: string): Promise<PoolCardRow[]> {
  return query<PoolCardRow>(
    `SELECT
       p.id, p.slug, p.name, pm.role,
       ps.id AS "seasonId", ps.season_year AS "seasonYear", ps.status,
       (SELECT count(*)::int FROM pool_members WHERE pool_id = p.id) AS "memberCount"
     FROM pool_members pm
     JOIN pools p ON p.id = pm.pool_id
     JOIN pool_seasons ps ON ps.pool_id = p.id
     WHERE pm.user_id = $1
     ORDER BY ps.season_year DESC, p.created_at DESC`,
    [userId],
  );
}

/** Viewer's 1-based standing in a season, by total wins -- same ranking StandingsContent uses,
 * minus its live-simulation tiebreaker (too expensive to compute for every pool on every
 * dashboard/switcher load; ties just keep their original manager order). */
async function computeRank(
  seasonId: string,
  userId: string,
  standings: Awaited<ReturnType<typeof getStandings>>,
): Promise<number | null> {
  const [picks, managers] = await Promise.all([getSeasonPicks(seasonId), getSeasonManagers(seasonId)]);
  const roster = managers.map((m) => m.userId);
  const rosters = rostersFromPicks(picks, roster);
  const totals = managers
    .map((m) => ({ userId: m.userId, wins: totalWins(rosters[m.userId] ?? [], standings) }))
    .sort((a, b) => b.wins - a.wins);
  const idx = totals.findIndex((t) => t.userId === userId);
  return idx === -1 ? null : idx + 1;
}

async function enrichRow(row: PoolCardRow, userId: string, standings: Awaited<ReturnType<typeof getStandings>> | null): Promise<PoolCard> {
  if ((row.status === "in_season" || row.status === "final") && standings) {
    const rank = await computeRank(row.seasonId, userId, standings);
    return { ...row, rank, isMyTurn: false, onClockName: null };
  }
  if (row.status === "drafting") {
    const onClock = await getOnClockManager(row.seasonId);
    return { ...row, rank: null, isMyTurn: onClock?.userId === userId, onClockName: onClock?.displayName ?? null };
  }
  return { ...row, rank: null, isMyTurn: false, onClockName: null };
}

/** Current (most recent season per pool) cards only -- what the dashboard and switcher's "active
 * pools" list show. */
export async function getUserPools(userId: string): Promise<PoolCard[]> {
  const rows = await getUserPoolRows(userId);
  const seenPools = new Set<string>();
  const current = rows.filter((r) => {
    if (seenPools.has(r.id)) return false;
    seenPools.add(r.id);
    return true;
  });

  const needsStandings = current.some((r) => r.status === "in_season" || r.status === "final");
  const standings = needsStandings ? await getStandings() : null;
  return Promise.all(current.map((r) => enrichRow(r, userId, standings)));
}

/** Non-current seasons for pools the user belongs to -- the collapsed "Past seasons" archive.
 * Always empty today (nothing creates a second season for a pool yet), included for when season
 * rollover ships. */
export async function getUserArchivedSeasons(userId: string): Promise<PoolCard[]> {
  const rows = await getUserPoolRows(userId);
  const seenPools = new Set<string>();
  const archived: PoolCardRow[] = [];
  for (const r of rows) {
    if (!seenPools.has(r.id)) {
      seenPools.add(r.id); // first occurrence per pool is "current", skip it
      continue;
    }
    archived.push(r);
  }
  if (archived.length === 0) return [];

  const needsStandings = archived.some((r) => r.status === "in_season" || r.status === "final");
  const standings = needsStandings ? await getStandings() : null;
  return Promise.all(archived.map((r) => enrichRow(r, userId, standings)));
}
