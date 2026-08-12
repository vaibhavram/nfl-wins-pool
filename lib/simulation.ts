// Monte Carlo pool-winner simulator: simulates the full 18-week regular season `trials` times
// using per-game win probabilities, tallies each manager's combined wins in every simulated
// season, and reports how often each manager ends up with the most.
//
// Two rating models are implemented side by side:
//   - FPI (lib/fpi.ts)   — ESPN's Football Power Index. Currently ACTIVE: it's already reset
//                           for the current season, so it needs no manual adjustment.
//   - Elo (lib/nfelo.ts) — nfeloapp's power ratings. Kept fully working but unused for now: as
//                           of implementation, nfelo was still carrying raw end-of-last-season
//                           Elo with no preseason regression, which produced an implausibly
//                           lopsided pool (see conversation history for the comparison). Once
//                           nfelo updates for the new season, flip the aliases at the bottom of
//                           this file back to the *Elo functions to switch back.
import "server-only";
import { getCurrentRegularSeasonWeek, getWeekScoreboard } from "./espn";
import { getNfeloRatings, type NfeloRating } from "./nfelo";
import { getFpiRatings } from "./fpi";
import { rostersFromPicks, type Pick } from "./draft";

const TIE_PROBABILITY = 0.006; // ~1 in 165 games — roughly the modern-NFL tie rate
const DEFAULT_TRIALS = 20000;
const REGULAR_SEASON_WEEKS = 18;

type ScheduledGame = { home: string; away: string };

async function getFullSeasonSchedule(year: number): Promise<ScheduledGame[]> {
  const weeks = await Promise.all(
    Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => getWeekScoreboard(i + 1, year)),
  );
  return weeks.flatMap((w) => w.games.map((g) => ({ home: g.home, away: g.away })));
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
  results: SimulationResult[];
};

/** Shared Monte Carlo engine — takes a precomputed home-win probability per game, independent
 * of which rating system produced it. `roster` is the pool's manager list (a userId in v2, a
 * name in the legacy single-tenant path) so everyone appears even before they've picked. */
async function simulateSeason(
  picks: Pick[],
  roster: string[],
  games: { home: string; away: string; pHomeWin: number }[],
  year: number,
  model: string,
  trials: number,
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

  return { trials, year, generatedAt: new Date().toISOString(), model, results };
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

export async function runSimulationFpi(picks: Pick[], roster: string[], trials = DEFAULT_TRIALS): Promise<SimulationSummary> {
  const { year } = await getCurrentRegularSeasonWeek();
  const [schedule, ratings] = await Promise.all([getFullSeasonSchedule(year), getFpiRatings()]);
  const games = schedule.map((g) => ({
    home: g.home,
    away: g.away,
    pHomeWin: fpiWinProbability(ratings[g.home] ?? 0, ratings[g.away] ?? 0),
  }));
  return simulateSeason(picks, roster, games, year, "fpi", trials);
}

// ── Active model — everything in app/api/* imports these three names. Flip to the *Elo
// variants (or a blend) here, in one place, whenever we want to switch. ─────────────────────

export const getHomeWinProbability = getHomeWinProbabilityFpi;
export const attachWinProbabilities = attachWinProbabilitiesFpi;
export const runSimulation = runSimulationFpi;
