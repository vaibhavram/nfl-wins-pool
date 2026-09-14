// Builds the data + LLM recap for the Tuesday-morning weekly digest email -- one per in-season
// pool. Standings, last week's scoreboard, and the pre-week/post-week Monte Carlo games list are
// all league-wide, so they're fetched/built once and reused across every pool instead of once per
// pool -- only each pool's picks/roster (and therefore its two Monte Carlo runs) differ per pool.
import "server-only";
import { query } from "./db2";
import { getPoolMembers } from "./pools-server";
import { getSeasonPicks, getSeasonManagers, type SeasonManager } from "./season-server";
import { getTestExclusions } from "./admin-server";
import { rostersFromPicks, totalWins } from "./draft";
import { getCurrentRegularSeasonWeek, getWeekScoreboard, getStandings, getGamePredictor } from "./espn";
import { getSeasonGameData, getHomeWinProbabilityFpi, runSimulationWithGames, type SimGame } from "./simulation";
import { TEAM, type TeamRecord } from "./teams";
import { generateText } from "./llm";

export type StandingsRow = { name: string; teams: string[]; wins: number; preWinPct: number; postWinPct: number };

export type PoolDigest = {
  poolId: string;
  slug: string;
  name: string;
  week: number;
  year: number;
  standingsRows: StandingsRow[];
  prompt: string;
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

/** A completed game's pre-game win probability isn't retained on SimGame (completed games there
 * just carry a 0.5 placeholder -- see lib/simulation.ts), so it's re-resolved here the same way
 * a not-yet-started game is: ESPN's Matchup Predictor, falling back to FPI. */
async function getPreGameHomeWinProb(home: string, away: string, gameId: string): Promise<number> {
  const predicted = await getGamePredictor(gameId);
  return predicted ?? getHomeWinProbabilityFpi(home, away);
}

export type GameResult =
  | { kind: "tie"; ab1: string; ab2: string; score: number }
  | { kind: "decisive"; winnerAb: string; loserAb: string; winnerScore: number; loserScore: number; winnerPreGamePct: number };

/** Highest-magnitude upset among the week's completed games -- the team that won despite having
 * the lowest pre-game win probability. A cheap proxy for "which result shook up the leaderboard
 * the most" that doesn't require re-simulating the season once per game to measure its literal
 * counterfactual impact. */
function biggestUpset(results: GameResult[]): Extract<GameResult, { kind: "decisive" }> | null {
  const decisive = results.filter((r): r is Extract<GameResult, { kind: "decisive" }> => r.kind === "decisive");
  if (decisive.length === 0) return null;
  return decisive.reduce((a, b) => (b.winnerPreGamePct < a.winnerPreGamePct ? b : a));
}

/** Every mention of a game's outcome names the participant(s) who own the teams involved (a team
 * undrafted in this pool just gets its name, no attribution) -- ownership is pool-specific, so
 * this is called once per pool rather than shared across pools like the raw results are. */
function formatGameResult(r: GameResult, ownerByTeam: Record<string, string>): string {
  const named = (ab: string) => {
    const full = TEAM[ab]?.full ?? ab;
    const owner = ownerByTeam[ab];
    return owner ? `${full} (${owner})` : full;
  };
  if (r.kind === "tie") return `${named(r.ab1)} tied ${named(r.ab2)} ${r.score}-${r.score}`;
  return `${named(r.winnerAb)} beat ${named(r.loserAb)} ${r.winnerScore}-${r.loserScore} (had been a ${r.winnerPreGamePct.toFixed(0)}% pre-game favorite)`;
}

/** Teams still undefeated or still winless partway through the season -- a manager whose whole
 * roster is riding one of those is a genuine multi-week trend, unlike a 1-0 record after just
 * Week 1, which every winner trivially has. Gated to week > 1 for that reason: needs at least two
 * games played to mean anything. Built from the season-long standings this codebase already
 * fetches everywhere else, not a separate history log. */
function buildStreakLines(rosters: Record<string, string[]>, managers: SeasonManager[], standings: Record<string, TeamRecord>, week: number): string[] {
  if (week <= 1) return [];
  const lines: string[] = [];
  for (const m of managers) {
    for (const ab of rosters[m.userId] ?? []) {
      const rec = standings[ab];
      if (!rec || rec.wins + rec.losses + rec.ties < 2) continue;
      if (rec.losses === 0 && rec.ties === 0) lines.push(`${m.displayName}'s ${TEAM[ab]?.full ?? ab} are still undefeated at ${rec.wins}-0`);
      else if (rec.wins === 0 && rec.ties === 0) lines.push(`${m.displayName}'s ${TEAM[ab]?.full ?? ab} are still winless at 0-${rec.losses}`);
    }
  }
  return lines;
}

/** Exported (only) so scripts/preview-digest-prompt.ts can render the exact same prompt against
 * fixture data for fast local iteration -- no DB or deploy needed to workshop the wording. */
export function buildPrompt(
  poolName: string,
  week: number,
  standingsRows: StandingsRow[],
  gameLines: string[],
  best: { name: string; pre: number; post: number } | null,
  worst: { name: string; pre: number; post: number } | null,
  upsetLine: string | null,
  streakLines: string[],
): string {
  const standingsLines = standingsRows.map((r, i) => {
    const delta = r.postWinPct - r.preWinPct;
    const sign = delta >= 0 ? "+" : "";
    return `${i + 1}. ${r.name} -- ${r.wins} wins, ${r.postWinPct.toFixed(1)}% to win the pool (${sign}${delta.toFixed(1)} pts this week)`;
  });
  const optionLines = [
    best && `Biggest riser: ${best.name}, pool win probability up ${(best.post - best.pre).toFixed(1)} points (${best.pre.toFixed(1)}% -> ${best.post.toFixed(1)}%)`,
    worst && `Biggest faller: ${worst.name}, pool win probability down ${(worst.pre - worst.post).toFixed(1)} points (${worst.pre.toFixed(1)}% -> ${worst.post.toFixed(1)}%)`,
    upsetLine && `Biggest upset: ${upsetLine}`,
    ...streakLines,
  ].filter((l): l is string => Boolean(l));

  return [
    `You are writing a short, punchy recap email for a friend group's NFL "wins pool" fantasy league called "${poolName}".`,
    `Each manager owns a few real NFL teams; a manager's score is the combined win total of their teams. Their "pool win probability" is their current live chance of winning the whole pool at season's end.`,
    "",
    `Standings after Week ${week} (pool win probability shown is AFTER this week's games, with the point change from before this week in parens):`,
    ...standingsLines,
    "",
    `This week's results:`,
    ...gameLines,
    "",
    `Things you could mention -- these are options, not a checklist. Pick whichever 1-2 are genuinely the most interesting this week, in whatever order reads best. Ignore the rest. Don't recompute these numbers, just narrate them:`,
    ...optionLines,
    "",
    `Write a highly condensed, casual recap (strictly under 100 words) covering whichever of the above are worth telling this specific group about this week. Whenever you mention a game's outcome, name the participant(s) who own the teams involved (shown in parens above) so the group knows how it affected them -- don't just say "the Cardinals won," say who that helped or hurt. Second person plural ("you all"/"the group") is fine. Plain text only -- no markdown, no headers, no preamble like "Here's your recap."`,
  ].join("\n");
}

/** One digest per in-season, non-test pool -- data gathering and the LLM call, but no image
 * rendering or sending (see app/api/internal/weekly-digest/route.ts for those). */
export async function getWeeklyDigests(): Promise<PoolDigest[]> {
  const { week: currentWeek, year } = await getCurrentRegularSeasonWeek();
  const [pools, standings, { games }] = await Promise.all([getInSeasonPools(), getStandings(), getSeasonGameData(year)]);
  if (pools.length === 0) return [];

  // Tuesday morning always falls just after ESPN's calendar has already rolled over to the
  // upcoming week, so "current week - 1" is the week that just finished.
  const week = Math.max(1, currentWeek - 1);

  const weekBoard = await getWeekScoreboard(week, year);
  const completedWeekGames = weekBoard.games.filter((g) => g.completed && g.homeScore !== null && g.awayScore !== null);

  // Pre-game win probability for this week's games only -- needed both to build the "pre-week"
  // Monte Carlo counterfactual below and to describe each result's upset magnitude in the prompt.
  const preGameProbByGameId = new Map<string, number>();
  await Promise.all(
    completedWeekGames.map(async (g) => {
      preGameProbByGameId.set(g.id, await getPreGameHomeWinProb(g.home, g.away, g.id));
    }),
  );

  // "Pre-week" games: everything unchanged except this week's, which get rolled back from their
  // actual result to their pre-game probability -- simulating the season as it looked right before
  // this week kicked off, using the exact same resolution as every other week.
  const preWeekGames: SimGame[] = games.map((g) =>
    g.week === week ? { ...g, fixedResult: null, pHomeWin: preGameProbByGameId.get(g.id) ?? 0.5 } : g,
  );

  const weekResults: GameResult[] = completedWeekGames.map((g) => {
    const homeScore = g.homeScore as number;
    const awayScore = g.awayScore as number;
    if (homeScore === awayScore) return { kind: "tie", ab1: g.home, ab2: g.away, score: homeScore };
    const homeWon = homeScore > awayScore;
    const preGameHomeProb = preGameProbByGameId.get(g.id) ?? 0.5;
    return {
      kind: "decisive",
      winnerAb: homeWon ? g.home : g.away,
      loserAb: homeWon ? g.away : g.home,
      winnerScore: homeWon ? homeScore : awayScore,
      loserScore: homeWon ? awayScore : homeScore,
      winnerPreGamePct: (homeWon ? preGameHomeProb : 1 - preGameHomeProb) * 100,
    };
  });
  const upset = biggestUpset(weekResults);

  return Promise.all(
    pools.map(async (pool): Promise<PoolDigest> => {
      const [picks, managers, members] = await Promise.all([
        getSeasonPicks(pool.seasonId),
        getSeasonManagers(pool.seasonId),
        getPoolMembers(pool.poolId),
      ]);
      const roster = managers.map((m) => m.userId);
      const rosters = rostersFromPicks(picks, roster);
      const ownerByTeam: Record<string, string> = {};
      for (const m of managers) for (const ab of rosters[m.userId] ?? []) ownerByTeam[ab] = m.displayName;
      const gameLines = weekResults.map((r) => formatGameResult(r, ownerByTeam));
      const upsetLine = upset && formatGameResult(upset, ownerByTeam);

      const [preSim, postSim] = await Promise.all([
        runSimulationWithGames(picks, roster, preWeekGames, year),
        runSimulationWithGames(picks, roster, games, year),
      ]);
      const preWinPctByManager = Object.fromEntries(preSim.results.map((r) => [r.manager, r.winPct]));
      const postWinPctByManager = Object.fromEntries(postSim.results.map((r) => [r.manager, r.winPct]));

      const standingsRows: StandingsRow[] = managers
        .map((m) => ({
          name: m.displayName,
          teams: rosters[m.userId] ?? [],
          wins: totalWins(rosters[m.userId] ?? [], standings),
          preWinPct: preWinPctByManager[m.userId] ?? 0,
          postWinPct: postWinPctByManager[m.userId] ?? 0,
        }))
        .sort((a, b) => b.wins - a.wins);

      let best: { name: string; pre: number; post: number } | null = null;
      let worst: { name: string; pre: number; post: number } | null = null;
      for (const r of standingsRows) {
        const delta = r.postWinPct - r.preWinPct;
        if (!best || delta > best.post - best.pre) best = { name: r.name, pre: r.preWinPct, post: r.postWinPct };
        if (!worst || delta < worst.post - worst.pre) worst = { name: r.name, pre: r.preWinPct, post: r.postWinPct };
      }

      const streakLines = buildStreakLines(rosters, managers, standings, week);
      const prompt = buildPrompt(pool.name, week, standingsRows, gameLines, best, worst, upsetLine, streakLines);
      const recap = await generateText(prompt);
      const recipients = members.filter((m) => m.email).map((m) => ({ email: m.email as string, name: m.display_name }));

      return { poolId: pool.poolId, slug: pool.slug, name: pool.name, week, year, standingsRows, prompt, recap, recipients };
    }),
  );
}
