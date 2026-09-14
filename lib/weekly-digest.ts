// Builds the data + LLM recap for the Tuesday-morning weekly digest email -- one per in-season
// pool. Standings, last week's scoreboard, and the pre-week/post-week Monte Carlo games list are
// all league-wide, so they're fetched/built once and reused across every pool instead of once per
// pool -- only each pool's picks/roster (and therefore its two Monte Carlo runs) differ per pool.
import "server-only";
import { query } from "./db2";
import { getPoolMembers } from "./pools-server";
import { getSeasonPicks, getSeasonManagers } from "./season-server";
import { getTestExclusions } from "./admin-server";
import { rostersFromPicks, totalWins } from "./draft";
import { getCurrentRegularSeasonWeek, getWeekScoreboard, getStandings, getGamePredictor } from "./espn";
import { getSeasonGameData, getHomeWinProbabilityFpi, runSimulationWithGames, type SimGame } from "./simulation";
import { TEAM } from "./teams";
import { generateText } from "./llm";

export type StandingsRow = { name: string; teams: string[]; wins: number; preWinPct: number; postWinPct: number };

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

/** A completed game's pre-game win probability isn't retained on SimGame (completed games there
 * just carry a 0.5 placeholder -- see lib/simulation.ts), so it's re-resolved here the same way
 * a not-yet-started game is: ESPN's Matchup Predictor, falling back to FPI. */
async function getPreGameHomeWinProb(home: string, away: string, gameId: string): Promise<number> {
  const predicted = await getGamePredictor(gameId);
  return predicted ?? getHomeWinProbabilityFpi(home, away);
}

type UpsetCandidate = { winnerAb: string; loserAb: string; winnerScore: number; loserScore: number; winnerPreGamePct: number };

/** Highest-magnitude upset among the week's completed games -- the team that won despite having
 * the lowest pre-game win probability. A cheap proxy for "which result shook up the leaderboard
 * the most" that doesn't require re-simulating the season once per game to measure its literal
 * counterfactual impact. */
function biggestUpset(candidates: UpsetCandidate[]): UpsetCandidate | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.winnerPreGamePct < a.winnerPreGamePct ? b : a));
}

function buildPrompt(
  poolName: string,
  week: number,
  standingsRows: StandingsRow[],
  gameLines: string[],
  best: { name: string; pre: number; post: number } | null,
  worst: { name: string; pre: number; post: number } | null,
  upset: UpsetCandidate | null,
): string {
  const standingsLines = standingsRows.map(
    (r, i) => `${i + 1}. ${r.name} -- ${r.wins} wins, ${r.postWinPct.toFixed(1)}% to win the pool (was ${r.preWinPct.toFixed(1)}% before this week)`,
  );
  const highlightLines = [
    best && `Best week: ${best.name}, pool win probability rose from ${best.pre.toFixed(1)}% to ${best.post.toFixed(1)}%`,
    worst && `Worst week: ${worst.name}, pool win probability fell from ${worst.pre.toFixed(1)}% to ${worst.post.toFixed(1)}%`,
    upset &&
      `Most leaderboard-swinging result: ${TEAM[upset.winnerAb]?.full ?? upset.winnerAb} over ${TEAM[upset.loserAb]?.full ?? upset.loserAb} ${upset.winnerScore}-${upset.loserScore} -- ${TEAM[upset.winnerAb]?.full ?? upset.winnerAb} had been just a ${upset.winnerPreGamePct.toFixed(0)}% favorite`,
  ].filter((l): l is string => Boolean(l));

  return [
    `You are writing a short, punchy recap email for a friend group's NFL "wins pool" fantasy league called "${poolName}".`,
    `Each manager owns a few real NFL teams; a manager's score is the combined win total of their teams. Their "pool win probability" is their current live chance of winning the whole pool at season's end.`,
    "",
    `Standings after Week ${week} (pool win probability shown is AFTER this week's games):`,
    ...standingsLines,
    "",
    `This week's results:`,
    ...gameLines,
    "",
    `Precomputed highlights -- narrate these, don't recompute them:`,
    ...highlightLines,
    "",
    `Write a highly condensed recap (strictly under 100 words). Lead with who had the best and worst week and why, referencing the pool win probability swing -- spend most of the recap here. Then, in one sentence only, call out the upset result that shook up the leaderboard the most. Casual, direct tone, second person plural ("you all"/"the group") is fine. Plain text only -- no markdown, no headers, no preamble like "Here's your recap."`,
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

  const gameLines: string[] = [];
  const upsetCandidates: UpsetCandidate[] = [];
  for (const g of completedWeekGames) {
    const homeScore = g.homeScore as number;
    const awayScore = g.awayScore as number;
    const homeFull = TEAM[g.home]?.full ?? g.home;
    const awayFull = TEAM[g.away]?.full ?? g.away;
    if (homeScore === awayScore) {
      gameLines.push(`${homeFull} tied ${awayFull} ${homeScore}-${awayScore}`);
      continue;
    }
    const homeWon = homeScore > awayScore;
    const winnerAb = homeWon ? g.home : g.away;
    const loserAb = homeWon ? g.away : g.home;
    const winnerScore = homeWon ? homeScore : awayScore;
    const loserScore = homeWon ? awayScore : homeScore;
    const preGameHomeProb = preGameProbByGameId.get(g.id) ?? 0.5;
    const winnerPreGamePct = (homeWon ? preGameHomeProb : 1 - preGameHomeProb) * 100;
    gameLines.push(
      `${TEAM[winnerAb]?.full ?? winnerAb} beat ${TEAM[loserAb]?.full ?? loserAb} ${winnerScore}-${loserScore} (had been a ${winnerPreGamePct.toFixed(0)}% pre-game favorite)`,
    );
    upsetCandidates.push({ winnerAb, loserAb, winnerScore, loserScore, winnerPreGamePct });
  }
  const upset = biggestUpset(upsetCandidates);

  return Promise.all(
    pools.map(async (pool): Promise<PoolDigest> => {
      const [picks, managers, members] = await Promise.all([
        getSeasonPicks(pool.seasonId),
        getSeasonManagers(pool.seasonId),
        getPoolMembers(pool.poolId),
      ]);
      const roster = managers.map((m) => m.userId);
      const rosters = rostersFromPicks(picks, roster);

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

      const recap = await generateText(buildPrompt(pool.name, week, standingsRows, gameLines, best, worst, upset));
      const recipients = members.filter((m) => m.email).map((m) => ({ email: m.email as string, name: m.display_name }));

      return { poolId: pool.poolId, slug: pool.slug, name: pool.name, week, year, standingsRows, recap, recipients };
    }),
  );
}
