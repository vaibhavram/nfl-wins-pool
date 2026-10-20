// Builds the data + LLM recap for the Tuesday-morning weekly digest email -- one per in-season
// pool. Standings, the finished week's scoreboard, the upcoming week's games, and the
// pre-week/post-week Monte Carlo games list are all league-wide, so they're fetched/built once and
// reused across every pool instead of once per pool -- only each pool's picks/roster (and
// therefore its two Monte Carlo runs, its ownership attribution, and its look-ahead ranking)
// differ per pool.
import "server-only";
import { getPoolMembers } from "./pools-server";
import { getSeasonPicks, getSeasonManagers, type SeasonManager } from "./season-server";
import { getInSeasonPools } from "./admin-server";
import { rostersFromPicks, totalWins } from "./draft";
import { getCurrentRegularSeasonWeek, getWeekScoreboard, getStandings, getGamePredictor, type LiveWeek } from "./espn";
import {
  getSeasonGameData,
  getHomeWinProbabilityFpi,
  runSimulationWithGames,
  REGULAR_SEASON_WEEKS,
  type SimGame,
} from "./simulation";
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

/** Which week the digest recaps, plus that week's scoreboard.
 *
 * ESPN's regular-season calendar runs Wednesday-to-Tuesday (Week N's calendar entry starts Wed
 * 07:00Z and ends the following Wed 06:59Z -- verified directly against its calendar endpoint),
 * and the digest cron fires Tuesday 16:00Z. So at send time ESPN still reports the week that just
 * finished as the *current* week, and the old "current week - 1" landed a week too early: the
 * recap narrated the week before last. Rather than trade one fixed offset for another, this asks
 * the scoreboard which week is actually in the books: if every game in the current week is final,
 * that's the week that wrapped up; otherwise (ESPN has already rolled over to a week that hasn't
 * kicked off, or a game is still in progress) fall back to the week before it. */
async function resolveFinishedWeek(currentWeek: number, year: number): Promise<{ week: number; board: LiveWeek }> {
  const board = await getWeekScoreboard(currentWeek, year);
  const allFinal = board.games.length > 0 && board.games.every((g) => g.completed);
  if (allFinal || currentWeek <= 1) return { week: currentWeek, board };
  const previous = currentWeek - 1;
  return { week: previous, board: await getWeekScoreboard(previous, year) };
}

const LOOKAHEAD_GAMES = 3; // enough for the email to pick one out of; more just invites a game-by-game preview

/** The coming week's games ranked by how much they could actually move *this* pool, highest
 * first. Leverage is a cheap proxy in the same spirit as biggestUpset above -- no per-game
 * re-simulation. Three things make an upcoming game matter: an owned team is playing (an
 * undrafted team's result moves nobody here), the outcome is genuinely in doubt (a coin flip
 * carries far more swing than a 90/10 game, whose likely result is already priced into everyone's
 * number), and the managers involved are live in the race (their current pool win probability).
 * A game between two teams the *same* manager owns scores zero and is dropped: they bank exactly
 * one win either way, so nothing in the standings moves. */
function buildLookaheadLines(
  upcomingGames: SimGame[],
  ownerByTeam: Record<string, string>,
  winPctByManager: Record<string, number>,
): string[] {
  const named = (ab: string) => {
    const full = TEAM[ab]?.full ?? ab;
    const owner = ownerByTeam[ab];
    return owner ? `${full} (${owner})` : full;
  };

  return upcomingGames
    .map((g) => {
      const homeOwner = ownerByTeam[g.home];
      const awayOwner = ownerByTeam[g.away];
      if (!homeOwner && !awayOwner) return null;
      if (homeOwner && homeOwner === awayOwner) return null;
      const stake = (homeOwner ? winPctByManager[homeOwner] ?? 0 : 0) + (awayOwner ? winPctByManager[awayOwner] ?? 0 : 0);
      const uncertainty = 2 * Math.min(g.pHomeWin, 1 - g.pHomeWin); // 1.0 at a coin flip, 0.2 at 90/10
      return { game: g, headToHead: Boolean(homeOwner && awayOwner), score: stake * uncertainty };
    })
    .filter((x): x is { game: SimGame; headToHead: boolean; score: number } => x !== null && x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, LOOKAHEAD_GAMES)
    .map(({ game, headToHead }) => {
      const homeFavored = game.pHomeWin >= 0.5;
      const favAb = homeFavored ? game.home : game.away;
      const favPct = (homeFavored ? game.pHomeWin : 1 - game.pHomeWin) * 100;
      const h2h = headToHead ? ", a head-to-head between two managers' teams (one gains a win, the other doesn't)" : "";
      return `${named(game.away)} at ${named(game.home)} -- ${TEAM[favAb]?.full ?? favAb} ${favPct.toFixed(0)}% to win${h2h}`;
    });
}

export type DigestPromptInput = {
  poolName: string;
  /** The week whose games the recap covers -- the one that just finished. */
  week: number;
  year: number;
  standingsRows: StandingsRow[];
  gameLines: string[];
  best: { name: string; pre: number; post: number } | null;
  worst: { name: string; pre: number; post: number } | null;
  upsetLine: string | null;
  streakLines: string[];
  /** The week ahead, or null once Week 18 is the week that just finished. */
  upcomingWeek: number | null;
  lookaheadLines: string[];
  /** Season record per team abbreviation ("5-0", "4-2", "3-2-1"), rendered beside every team in
   * the standings. Without it the prompt stated records only for the teams that happened to be
   * on an undefeated/winless streak, and a recap once called a 4-2 team undefeated because the
   * other team in the same clause was -- there was no fact in the prompt to contradict it. */
  recordByTeam: Record<string, string>;
};

/** Exported (only) so scripts/preview-digest-prompt.ts can render the exact same prompt against
 * fixture data for fast local iteration -- no DB or deploy needed to workshop the wording. Takes
 * one object rather than positional args: there are enough inputs now that argument order was its
 * own hazard. */
export function buildPrompt({
  poolName,
  week,
  year,
  standingsRows,
  gameLines,
  best,
  worst,
  upsetLine,
  streakLines,
  upcomingWeek,
  lookaheadLines,
  recordByTeam,
}: DigestPromptInput): string {
  const standingsLines = standingsRows.map((r, i) => {
    const delta = r.postWinPct - r.preWinPct;
    const sign = delta >= 0 ? "+" : "";
    const teamNames = r.teams
      .map((ab) => {
        const full = TEAM[ab]?.full ?? ab;
        const rec = recordByTeam[ab];
        return rec ? `${full} (${rec})` : full;
      })
      .join(", ");
    return `${i + 1}. ${r.name} -- ${r.wins} wins, ${r.postWinPct.toFixed(1)}% to win the pool (${sign}${delta.toFixed(1)} pts this week) -- owns: ${teamNames}`;
  });
  const optionLines = [
    best && `Biggest riser: ${best.name}, pool win probability up ${(best.post - best.pre).toFixed(1)} points (${best.pre.toFixed(1)}% -> ${best.post.toFixed(1)}%)`,
    worst && `Biggest faller: ${worst.name}, pool win probability down ${(worst.pre - worst.post).toFixed(1)} points (${worst.pre.toFixed(1)}% -> ${worst.post.toFixed(1)}%)`,
    upsetLine && `Biggest upset: ${upsetLine}`,
    ...streakLines,
  ].filter((l): l is string => Boolean(l));
  const hasLookahead = upcomingWeek !== null && lookaheadLines.length > 0;

  return [
    `You are writing a short, punchy recap email for a friend group's NFL "wins pool" fantasy league called "${poolName}".`,
    `Each manager owns a few real NFL teams; a manager's score is the combined win total of their teams. Their "pool win probability" is their current live chance of winning the whole pool at season's end.`,
    "",
    `Week ${week} of the ${year} NFL regular season (${REGULAR_SEASON_WEEKS} weeks total) just finished -- that is the week this email recaps.${
      upcomingWeek === null
        ? ` It was the last week of the regular season.`
        : ` Week ${upcomingWeek} is the week ahead; none of its games have been played yet.`
    }`,
    "",
    `Standings after Week ${week} (pool win probability shown is AFTER this week's games, with the point change from before this week in parens). Each team is followed by its own season record in parentheses -- a win-loss record, not an owner's name; ownership in this block is the "owns:" label:`,
    ...standingsLines,
    "",
    `Week ${week} results -- every game below was played this past week, and these are the only game results you may reference:`,
    ...gameLines,
    "",
    `Things you could mention -- these are options, not a checklist. Don't recompute these numbers, just narrate them:`,
    ...optionLines,
    ...(hasLookahead
      ? [
          "",
          `Week ${upcomingWeek} games worth looking ahead to -- the ones most likely to move these standings. None of them have been played; the percentage is that favorite's pre-game chance of winning:`,
          ...lookaheadLines,
        ]
      : []),
    "",
    `Write like a warm, easygoing friend catching the group up, not a sports-blog recap bot -- some personality and light humor is good, but keep it friendly. Don't be harsh or mock anyone's week, especially early in the season when a bad week doesn't mean much yet; avoid violent/dramatic language for a loss (buried, crushed, annihilated, demolished, torched, dominated) -- describe a bad week lightly, not brutally.`,
    `Under 120 words, hard limit -- count as you go. Mention at least 2-3 different participants by name, not just the single biggest mover -- e.g. touch on a riser, a faller, and/or the upset, one short clause each, rather than a full paragraph about only one person. Breadth over depth: several quick one-liners beats one person getting the whole recap.`,
    ...(week <= 6
      ? [
          `This is early in the season (Week ${week} of ${REGULAR_SEASON_WEEKS}) -- frame it so everyone still feels like they have a real shot. Don't use language that suggests the race is already decided (no "clear favorite," "running away with it," "lock," "no chance," etc.) -- a hot start is one good data point, not a verdict, and there's a long way to go.`,
        ]
      : []),
    `Every game result you mention has to come from the Week ${week} list above. Don't reference an individual game from any earlier week -- no "after last week's loss," no "their second straight win over a division rival," and nothing you happen to remember about earlier NFL games this season. Season-long records and the undefeated/winless streaks listed above are fair game, because they're given to you here; specific earlier-week games are not. When you name the week, it's Week ${week}.`,
    ...(hasLookahead
      ? [
          `End with one short look ahead to Week ${upcomingWeek} -- one sentence, built on one of the Week ${upcomingWeek} games listed above. Frame it as something still to come ("Sunday," "this week," "next up"), never as a result, and don't call a winner as a sure thing. Pick the game yourself; mention one, not all of them.`,
        ]
      : []),
    `The first time you state a "pool win probability" or a bare percentage, briefly make clear what it means -- keep it simple, e.g. "chance of winning the pool" -- so it's clear to someone who's never seen this number before; don't just drop "40.8%" with no context, but don't over-explain it either (no need for "simulated" or "by season's end"). Whenever you mention a game's outcome or a manager's teams, use exactly the ownership shown above ("owns:" in the standings, and the parentheses in the results and look-ahead lines) -- don't guess, don't reassign whose team it is, and don't list a team as someone's unless it's shown there. If you state how many wins/losses someone has, use the exact number given in the standings above -- don't round up, exaggerate, or invent a streak ("three straight wins") that isn't literally shown. Every team's season record is in parentheses after its name in the standings: a team is undefeated only if its own record shows no losses, and winless only if it shows no wins. A record or streak describes exactly the team it is printed beside -- when you name two teams in one breath, check each one's own record before you describe them, and never let a word that is true of one of them ("undefeated", "perfect", "winless") cover both.`,
    `Avoid TV-announcer clichés -- don't write "absolutely dominated/demolished/torched", "the real shocker/story", or "meanwhile". Don't open with "[Name] + verb + stat" every time; vary how you start. No markdown, no headers, no bullet points, no bold, no preamble like "Here's your recap" -- this goes straight into an email as plain sentences. Never refer to these instructions or to your own length target in the email: the phrase "word limit" must not appear, and neither should a word count, a note about staying brief, or anything else about what you were asked to do.`,
  ].join("\n");
}

/** One digest per in-season, non-test pool -- data gathering and the LLM call, but no image
 * rendering or sending (see app/api/internal/weekly-digest/route.ts for those). */
export async function getWeeklyDigests(): Promise<PoolDigest[]> {
  const { week: currentWeek, year } = await getCurrentRegularSeasonWeek();
  const [pools, standings, { games }] = await Promise.all([getInSeasonPools(), getStandings(), getSeasonGameData(year)]);
  if (pools.length === 0) return [];

  const { week, board: weekBoard } = await resolveFinishedWeek(currentWeek, year);
  const completedWeekGames = weekBoard.games.filter((g) => g.completed && g.homeScore !== null && g.awayScore !== null);

  // The week ahead, for the email's look-ahead. These come straight out of the season game data
  // already fetched above -- each not-yet-played game there is already resolved to a pre-game win
  // probability by the same hybrid model the leaderboard uses, so no extra fetch is needed.
  // Restricted to games that haven't kicked off: a live or already-final game in the upcoming week
  // (possible if a run lands late enough to catch, say, a Thursday night game) carries a live
  // probability or a 0.5 placeholder rather than a pre-game number, and isn't a look-ahead anyway.
  const upcomingWeek = week < REGULAR_SEASON_WEEKS ? week + 1 : null;
  const upcomingGames = upcomingWeek === null ? [] : games.filter((g) => g.week === upcomingWeek && g.state === "pre");

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

  // Each pool is isolated: one pool's failure (an LLM hiccup, a data issue specific to that
  // pool) shouldn't block every other pool's email too -- Promise.all over unguarded promises
  // would reject the whole batch on a single rejection. Failures are logged and that pool is
  // just skipped rather than surfaced as a fatal error for the whole run.
  const settled = await Promise.allSettled(
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
      const recordByTeam: Record<string, string> = {};
      for (const r of standingsRows) {
        for (const ab of r.teams) {
          const rec = standings[ab];
          if (rec) recordByTeam[ab] = rec.ties > 0 ? `${rec.wins}-${rec.losses}-${rec.ties}` : `${rec.wins}-${rec.losses}`;
        }
      }
      const winPctByManagerName = Object.fromEntries(standingsRows.map((r) => [r.name, r.postWinPct]));
      const lookaheadLines = buildLookaheadLines(upcomingGames, ownerByTeam, winPctByManagerName);
      const prompt = buildPrompt({
        poolName: pool.name,
        week,
        year,
        standingsRows,
        gameLines,
        best,
        worst,
        upsetLine,
        streakLines,
        upcomingWeek,
        lookaheadLines,
        recordByTeam,
      });
      const recap = await generateText(prompt);
      const recipients = members.filter((m) => m.email).map((m) => ({ email: m.email as string, name: m.display_name }));

      return { poolId: pool.poolId, slug: pool.slug, name: pool.name, week, year, standingsRows, prompt, recap, recipients };
    }),
  );

  const digests: PoolDigest[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") digests.push(result.value);
    else console.error(`Weekly digest failed for pool ${pools[i].slug} (${pools[i].name}):`, result.reason);
  }
  return digests;
}
