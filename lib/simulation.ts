// Monte Carlo pool-winner simulator: simulates the full 18-week regular season `trials` times
// using per-game win probabilities, tallies each manager's combined wins in every simulated
// season, and reports how often each manager ends up with the most.
//
// The active model (getFullSeasonGameData, below) is a hybrid, not a single rating system:
//   - Completed games use their actual result, not a probability at all.
//   - Live games use ESPN's own real-time win probability (already fetched for the Schedule
//     tab's live scores -- lib/espn.ts#LiveGame.liveHomeWinProb).
//   - Games that haven't started yet use ESPN's own pre-game "Matchup Predictor"
//     (lib/espn.ts#getGamePredictor), falling back to the FPI model below only if that lookup
//     fails for a given game.
//
// Two standalone rating models are also kept for that pre-game/fallback role and for
// attachWinProbabilities (the Schedule tab's pre-game numbers, which this hybrid model doesn't
// touch):
//   - FPI (lib/fpi.ts)   — ESPN's Football Power Index. Currently ACTIVE for pre-game numbers.
//   - Elo (lib/nfelo.ts) — nfeloapp's power ratings. Kept fully working but unused for now: as
//                           of implementation, nfelo was still carrying raw end-of-last-season
//                           Elo with no preseason regression, which produced an implausibly
//                           lopsided pool (see conversation history for the comparison). Once
//                           nfelo updates for the new season, flip the aliases at the bottom of
//                           this file back to the *Elo functions to switch back.
import "server-only";
import { getCurrentRegularSeasonWeek, getWeekScoreboard, getGamePredictor } from "./espn";
import { getNfeloRatings, type NfeloRating } from "./nfelo";
import { getFpiRatings } from "./fpi";
import { rostersFromPicks, type Pick } from "./draft";

const TIE_PROBABILITY = 0.006; // ~1 in 165 games — roughly the modern-NFL tie rate
const DEFAULT_TRIALS = 10000; // halved from 20k to keep re-simulating cheap while a game is live
const REGULAR_SEASON_WEEKS = 18;
const PREDICTOR_CONCURRENCY = 12; // courtesy cap -- don't fire ~270 requests at ESPN all at once

/** `fixedResult` set means "apply this every trial, don't sample" (a completed game); null means
 * "sample from pHomeWin" (today's behavior) -- used for both pre-game and live games, just with
 * different sources for pHomeWin. `id`/`state` let API routes cross-reference a specific game's
 * resolved probability against this same hybrid data instead of recomputing it independently
 * (see getSeasonGameData). */
export type SimGame = {
  id: string;
  home: string;
  away: string;
  state: "pre" | "in" | "post";
  pHomeWin: number;
  fixedResult: "home" | "away" | "tie" | null;
};

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Builds the full season's games with the hybrid model described above. `hasLiveGame` tells
 * the caller (the API route) whether this result should be cached briefly (something's actively
 * changing) or for the usual several hours (nothing is). */
async function getFullSeasonGameData(year: number): Promise<{ games: SimGame[]; hasLiveGame: boolean }> {
  const weeks = await Promise.all(
    Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => getWeekScoreboard(i + 1, year)),
  );
  const allGames = weeks.flatMap((w) => w.games);

  let hasLiveGame = false;
  const settled: SimGame[] = [];
  const pending: (typeof allGames)[number][] = [];

  for (const g of allGames) {
    if (g.state === "post") {
      const fixedResult: SimGame["fixedResult"] =
        g.homeScore === g.awayScore ? "tie" : (g.homeScore ?? 0) > (g.awayScore ?? 0) ? "home" : "away";
      settled.push({ id: g.id, home: g.home, away: g.away, state: g.state, pHomeWin: 0.5, fixedResult });
    } else if (g.state === "in") {
      hasLiveGame = true;
      settled.push({ id: g.id, home: g.home, away: g.away, state: g.state, pHomeWin: g.liveHomeWinProb ?? 0.5, fixedResult: null });
    } else {
      pending.push(g);
    }
  }

  if (pending.length > 0) {
    const fpiRatings = await getFpiRatings();
    const preGame = await mapWithConcurrency(pending, PREDICTOR_CONCURRENCY, async (g) => {
      const predicted = await getGamePredictor(g.id);
      const pHomeWin = predicted ?? fpiWinProbability(fpiRatings[g.home] ?? 0, fpiRatings[g.away] ?? 0);
      return { id: g.id, home: g.home, away: g.away, state: g.state, pHomeWin, fixedResult: null } satisfies SimGame;
    });
    settled.push(...preGame);
  }

  return { games: settled, hasLiveGame };
}

// Resolving the full season (up to ~270 pre-game predictor calls) is shared across every pool
// and every caller -- keyed only by year, not roster/pool, so runSimulationHybrid and
// getProjectedWinsByTeam (a team detail page, potentially viewed far more often than the
// leaderboard) don't each independently re-resolve the same games. Same dynamic TTL the
// simulate route already uses: short while something's live, long otherwise.
const SEASON_GAME_DATA_LIVE_TTL_MS = 300_000; // 5 minutes
const SEASON_GAME_DATA_LONG_TTL_MS = 21_600_000; // 6 hours
const seasonGameDataCache = new Map<string, { data: { games: SimGame[]; hasLiveGame: boolean }; expiresAt: number }>();

/** Public so API routes (the week scoreboard, a team's per-game schedule) can cross-reference a
 * specific game's resolved hybrid probability by id, instead of each computing its own
 * (divergent, FPI-only) pre-game number independently. */
export async function getSeasonGameData(year: number): Promise<{ games: SimGame[]; hasLiveGame: boolean }> {
  const key = String(year);
  const cached = seasonGameDataCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const data = await getFullSeasonGameData(year);
  const ttl = data.hasLiveGame ? SEASON_GAME_DATA_LIVE_TTL_MS : SEASON_GAME_DATA_LONG_TTL_MS;
  seasonGameDataCache.set(key, { data, expiresAt: Date.now() + ttl });
  return data;
}

/** Each team's projected wins for the full season: completed games count as 1/0/0.5 (not a
 * probability), live games use ESPN's live win probability, and games that haven't started yet
 * use the same hybrid pre-game model as the leaderboard -- summed per team across the whole
 * schedule, home and away. */
export async function getProjectedWinsByTeam(): Promise<Record<string, number>> {
  const { year } = await getCurrentRegularSeasonWeek();
  const { games } = await getSeasonGameData(year);
  const projected: Record<string, number> = {};
  for (const g of games) {
    let homeShare: number;
    let awayShare: number;
    if (g.fixedResult) {
      homeShare = g.fixedResult === "tie" ? 0.5 : g.fixedResult === "home" ? 1 : 0;
      awayShare = g.fixedResult === "tie" ? 0.5 : g.fixedResult === "away" ? 1 : 0;
    } else {
      homeShare = g.pHomeWin;
      awayShare = 1 - g.pHomeWin;
    }
    projected[g.home] = (projected[g.home] ?? 0) + homeShare;
    projected[g.away] = (projected[g.away] ?? 0) + awayShare;
  }
  return projected;
}

function quantile(sorted: number[], q: number): number {
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export type SimulationResult = {
  manager: string;
  teams: string[];
  winPct: number; // share of simulated seasons this manager had the most combined wins (ties split credit)
  avgWins: number;
  medianWins: number;
  p10Wins: number;
  p90Wins: number;
};

export type SimulationSummary = {
  trials: number;
  year: number;
  generatedAt: string;
  model: string;
  hasLiveGame: boolean;
  results: SimulationResult[];
};

/** Shared Monte Carlo engine — takes a precomputed home-win probability per game, independent
 * of which rating system produced it. `roster` is the pool's manager list (a userId in v2, a
 * name in the legacy single-tenant path) so everyone appears even before they've picked.
 * `fixedResult`, when set, means "apply this outcome every trial" (a completed game) instead of
 * sampling from `pHomeWin` -- callers that never set it (the Elo path) get the original
 * always-sample behavior unchanged. */
async function simulateSeason(
  picks: Pick[],
  roster: string[],
  games: { home: string; away: string; pHomeWin: number; fixedResult?: "home" | "away" | "tie" | null }[],
  year: number,
  model: string,
  trials: number,
  hasLiveGame = false,
): Promise<SimulationSummary> {
  const rosters = rostersFromPicks(picks, roster);
  const managerRoster = roster.map((m) => ({ manager: m, teams: rosters[m] ?? [] }));
  const winsSamples: Record<string, number[]> = {};
  const poolWinCredits: Record<string, number> = {};
  for (const m of roster) {
    winsSamples[m] = new Array(trials);
    poolWinCredits[m] = 0;
  }

  const teams = new Set<string>();
  for (const g of games) {
    teams.add(g.home);
    teams.add(g.away);
  }

  const teamWins: Record<string, number> = {};
  for (let t = 0; t < trials; t++) {
    for (const ab of teams) teamWins[ab] = 0;
    for (const g of games) {
      if (g.fixedResult) {
        if (g.fixedResult === "tie") {
          teamWins[g.home] += 0.5;
          teamWins[g.away] += 0.5;
        } else if (g.fixedResult === "home") teamWins[g.home] += 1;
        else teamWins[g.away] += 1;
        continue;
      }
      const r = Math.random();
      if (r < TIE_PROBABILITY) {
        teamWins[g.home] += 0.5;
        teamWins[g.away] += 0.5;
      } else {
        const rNotTie = (r - TIE_PROBABILITY) / (1 - TIE_PROBABILITY);
        if (rNotTie < g.pHomeWin) teamWins[g.home] += 1;
        else teamWins[g.away] += 1;
      }
    }

    let best = -Infinity;
    const totals: Record<string, number> = {};
    for (const { manager, teams: mTeams } of managerRoster) {
      const total = mTeams.reduce((sum, ab) => sum + (teamWins[ab] ?? 0), 0);
      totals[manager] = total;
      winsSamples[manager][t] = total;
      if (total > best) best = total;
    }
    const winners = roster.filter((m) => totals[m] === best);
    for (const w of winners) poolWinCredits[w] += 1 / winners.length;
  }

  const results: SimulationResult[] = managerRoster.map(({ manager, teams: mTeams }) => {
    const samples = [...winsSamples[manager]].sort((a, b) => a - b);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    return {
      manager,
      teams: mTeams,
      winPct: (poolWinCredits[manager] / trials) * 100,
      avgWins: avg,
      medianWins: quantile(samples, 0.5),
      p10Wins: quantile(samples, 0.1),
      p90Wins: quantile(samples, 0.9),
    };
  });
  results.sort((a, b) => b.winPct - a.winPct);

  return { trials, year, generatedAt: new Date().toISOString(), model, hasLiveGame, results };
}

// ── Elo model (lib/nfelo.ts) — kept working, not currently used. See file header. ──────────

const ELO_HOME_FIELD_ADVANTAGE = 30; // flat Elo points added to the home team
const DEFAULT_ELO = 1500; // fallback if a team is somehow missing from nfelo's table

/** QB-adjusted Elo: nfelo's base rating plus the delta for the current starter. */
function ratedElo(ab: string, ratings: Record<string, NfeloRating>): number {
  return (ratings[ab]?.elo ?? DEFAULT_ELO) + (ratings[ab]?.eloQbAdj ?? 0);
}

function eloWinProbability(eloHome: number, eloAway: number): number {
  return 1 / (1 + Math.pow(10, -(eloHome - eloAway) / 400));
}

export async function getHomeWinProbabilityElo(home: string, away: string): Promise<number> {
  const ratings = await getNfeloRatings();
  return eloWinProbability(ratedElo(home, ratings) + ELO_HOME_FIELD_ADVANTAGE, ratedElo(away, ratings));
}

export async function attachWinProbabilitiesElo<T extends { home: string; away: string }>(
  games: T[],
): Promise<(T & { homeWinProb: number })[]> {
  const ratings = await getNfeloRatings();
  return games.map((g) => ({
    ...g,
    homeWinProb: eloWinProbability(ratedElo(g.home, ratings) + ELO_HOME_FIELD_ADVANTAGE, ratedElo(g.away, ratings)),
  }));
}

/** Bare home/away pairs for the whole season, no result/probability data attached -- only the
 * unused Elo path needs this now; the active hybrid model uses getFullSeasonGameData instead. */
async function getFullSeasonSchedule(year: number): Promise<{ home: string; away: string }[]> {
  const weeks = await Promise.all(
    Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => getWeekScoreboard(i + 1, year)),
  );
  return weeks.flatMap((w) => w.games.map((g) => ({ home: g.home, away: g.away })));
}

export async function runSimulationElo(picks: Pick[], roster: string[], trials = DEFAULT_TRIALS): Promise<SimulationSummary> {
  const { year } = await getCurrentRegularSeasonWeek();
  const [schedule, ratings] = await Promise.all([getFullSeasonSchedule(year), getNfeloRatings()]);
  const games = schedule.map((g) => ({
    home: g.home,
    away: g.away,
    pHomeWin: eloWinProbability(ratedElo(g.home, ratings) + ELO_HOME_FIELD_ADVANTAGE, ratedElo(g.away, ratings)),
  }));
  return simulateSeason(picks, roster, games, year, "elo-nfelo", trials);
}

// ── FPI model (lib/fpi.ts) — ACTIVE. See file header. ───────────────────────────────────────

const FPI_HOME_FIELD_POINTS = 3; // Vegas convention
const FPI_SIGMA = 13.5; // stdev of actual NFL game margin around the point-spread-implied expectation

/** Standard normal CDF (Abramowitz & Stegun approximation). */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) p = 1 - p;
  return p;
}

/** FPI is "expected point margin vs. a league-average team on a neutral field," so the
 * difference between two teams' FPI is their expected margin in a neutral matchup. Converting
 * that margin to a win probability uses the empirical ~13.5-point stdev of actual NFL game
 * margins around their point-spread-implied expectation. */
function fpiWinProbability(fpiHome: number, fpiAway: number): number {
  const margin = fpiHome - fpiAway + FPI_HOME_FIELD_POINTS;
  return normalCdf(margin / FPI_SIGMA);
}

export async function getHomeWinProbabilityFpi(home: string, away: string): Promise<number> {
  const ratings = await getFpiRatings();
  return fpiWinProbability(ratings[home] ?? 0, ratings[away] ?? 0);
}

export async function attachWinProbabilitiesFpi<T extends { home: string; away: string }>(
  games: T[],
): Promise<(T & { homeWinProb: number })[]> {
  const ratings = await getFpiRatings();
  return games.map((g) => ({
    ...g,
    homeWinProb: fpiWinProbability(ratings[g.home] ?? 0, ratings[g.away] ?? 0),
  }));
}

// ── Hybrid model — ACTIVE for the leaderboard's Monte Carlo. See file header. ───────────────

export async function runSimulationHybrid(picks: Pick[], roster: string[], trials = DEFAULT_TRIALS): Promise<SimulationSummary> {
  const { year } = await getCurrentRegularSeasonWeek();
  const { games, hasLiveGame } = await getSeasonGameData(year);
  return simulateSeason(picks, roster, games, year, "espn-hybrid", trials, hasLiveGame);
}

// ── Active model — everything in app/api/* imports these three names. Flip to the *Elo
// variants (or a blend) here, in one place, whenever we want to switch. attachWinProbabilities
// and getHomeWinProbability stay FPI-based -- they power the Schedule tab's pre-game numbers,
// which the hybrid model above doesn't touch. ────────────────────────────────────────────────

export const getHomeWinProbability = getHomeWinProbabilityFpi;
export const attachWinProbabilities = attachWinProbabilitiesFpi;
export const runSimulation = runSimulationHybrid;
