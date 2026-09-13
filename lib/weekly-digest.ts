// Builds the data + LLM recap for the Tuesday-morning weekly digest email -- one per in-season
// pool. Standings and last week's scoreboard are league-wide, so both are fetched once and
// reused across every pool instead of once per pool.
import "server-only";
import { query } from "./db2";
import { getPoolMembers } from "./pools-server";
import { getSeasonPicks, getSeasonManagers } from "./season-server";
import { getTestExclusions } from "./admin-server";
import { rostersFromPicks, totalWins } from "./draft";
import { getCurrentRegularSeasonWeek, getWeekScoreboard, getStandings } from "./espn";
import { TEAM } from "./teams";
import { generateText } from "./llm";

export type StandingsRow = { name: string; teams: string[]; wins: number };

export type PoolDigest = {
  poolId: string;
  slug: string;
  name: string;
  week: number;
  year: number;
  standingsRows: StandingsRow[];
  recap: string;
  recipients: { email: string; name: string }[];
};

type InSeasonPool = { poolId: string; slug: string; name: string; seasonId: string };

async function getInSeasonPools(): Promise<InSeasonPool[]> {
  const { poolIds } = await getTestExclusions();
  const rows = await query<{ pool_id: string; slug: string; name: string; season_id: string }>(
    `SELECT ps.pool_id, p.slug, p.name, ps.id AS season_id
     FROM pool_seasons ps JOIN pools p ON p.id = ps.pool_id
     WHERE ps.status = 'in_season' AND p.id <> ALL($1::uuid[])`,
    [poolIds],
  );
  return rows.map((r) => ({ poolId: r.pool_id, slug: r.slug, name: r.name, seasonId: r.season_id }));
}

type TeamWeekResult = { opponentAb: string; result: "W" | "L" | "T"; teamScore: number; oppScore: number } | null;

/** Each team's result in the given week's games, keyed by abbreviation -- null (bye or not yet
 * final) omits that team from the recap prompt rather than describing an incomplete game. */
function buildTeamResults(games: Awaited<ReturnType<typeof getWeekScoreboard>>["games"]): Record<string, TeamWeekResult> {
  const out: Record<string, TeamWeekResult> = {};
  for (const g of games) {
    if (!g.completed || g.homeScore === null || g.awayScore === null) continue;
    const homeResult: TeamWeekResult =
      g.homeScore === g.awayScore
        ? { opponentAb: g.away, result: "T", teamScore: g.homeScore, oppScore: g.awayScore }
        : { opponentAb: g.away, result: g.homeScore > g.awayScore ? "W" : "L", teamScore: g.homeScore, oppScore: g.awayScore };
    const awayResult: TeamWeekResult =
      g.awayScore === g.homeScore
        ? { opponentAb: g.home, result: "T", teamScore: g.awayScore, oppScore: g.homeScore }
        : { opponentAb: g.home, result: g.awayScore > g.homeScore ? "W" : "L", teamScore: g.awayScore, oppScore: g.homeScore };
    out[g.home] = homeResult;
    out[g.away] = awayResult;
  }
  return out;
}

function describeTeamResult(ab: string, teamResults: Record<string, TeamWeekResult>): string {
  const team = TEAM[ab]?.full ?? ab;
  const r = teamResults[ab];
  if (!r) return `${team} (no game or not yet final)`;
  const verb = r.result === "T" ? "tied" : r.result === "W" ? "beat" : "lost to";
  const opp = TEAM[r.opponentAb]?.full ?? r.opponentAb;
  return `${team} ${verb} ${opp} ${r.teamScore}-${r.oppScore}`;
}

function buildPrompt(poolName: string, week: number, standingsRows: StandingsRow[], teamResults: Record<string, TeamWeekResult>): string {
  const lines = standingsRows.map(
    (r, i) => `${i + 1}. ${r.name} (${r.wins} total wins) -- ${r.teams.map((ab) => describeTeamResult(ab, teamResults)).join("; ")}`,
  );
  return [
    `You are writing a short, punchy recap email for a friend group's NFL "wins pool" fantasy league called "${poolName}".`,
    `Each manager owns a few real NFL teams; a manager's score is the combined win total of their teams across the season.`,
    `Standings after Week ${week}, with how each manager's teams did this week:`,
    "",
    ...lines,
    "",
    `Write a highly condensed recap (strictly under 100 words) of the most interesting things that happened this week for this specific group -- standings shakeups, upsets, a manager's team blowing out or getting blown out, a tight race for the lead, etc. Reference actual manager and team names. Casual, direct tone, second person plural ("you all"/"the group") is fine. Plain text only -- no markdown, no headers, no preamble like "Here's your recap."`,
  ].join("\n");
}

/** One digest per in-season, non-test pool -- data gathering and the LLM call, but no image
 * rendering or sending (see app/api/internal/weekly-digest/route.ts for those). */
export async function getWeeklyDigests(): Promise<PoolDigest[]> {
  const [pools, { week: currentWeek, year }, standings] = await Promise.all([
    getInSeasonPools(),
    getCurrentRegularSeasonWeek(),
    getStandings(),
  ]);
  if (pools.length === 0) return [];

  // Tuesday morning always falls just after ESPN's calendar has already rolled over to the
  // upcoming week, so "current week - 1" is the week that just finished.
  const week = Math.max(1, currentWeek - 1);
  const { games } = await getWeekScoreboard(week, year);
  const teamResults = buildTeamResults(games);

  return Promise.all(
    pools.map(async (pool): Promise<PoolDigest> => {
      const [picks, managers, members] = await Promise.all([
        getSeasonPicks(pool.seasonId),
        getSeasonManagers(pool.seasonId),
        getPoolMembers(pool.poolId),
      ]);
      const rosters = rostersFromPicks(
        picks,
        managers.map((m) => m.userId),
      );
      const standingsRows: StandingsRow[] = managers
        .map((m) => ({ name: m.displayName, teams: rosters[m.userId] ?? [], wins: totalWins(rosters[m.userId] ?? [], standings) }))
        .sort((a, b) => b.wins - a.wins);

      const recap = await generateText(buildPrompt(pool.name, week, standingsRows, teamResults));
      const recipients = members.filter((m) => m.email).map((m) => ({ email: m.email as string, name: m.display_name }));

      return { poolId: pool.poolId, slug: pool.slug, name: pool.name, week, year, standingsRows, recap, recipients };
    }),
  );
}
