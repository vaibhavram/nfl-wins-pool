// Monte Carlo pool-winner simulator: simulates the full 18-week regular season `trials` times
// using per-game Elo win probabilities, tallies each manager's combined wins in every simulated
// season, and reports how often each manager ends up with the most.
import "server-only";
import { getCurrentRegularSeasonWeek, getWeekScoreboard } from "./espn";
import { getNfeloRatings, type NfeloRating } from "./nfelo";
import { rostersFromPicks, type Pick } from "./draft";
import { MANAGER_NAMES } from "./managers";

const HOME_FIELD_ADVANTAGE = 30; // flat Elo points added to the home team
const TIE_PROBABILITY = 0.006; // ~1 in 165 games — roughly the modern-NFL tie rate
const DEFAULT_TRIALS = 20000;
const REGULAR_SEASON_WEEKS = 18;
const DEFAULT_ELO = 1500; // fallback if a team is somehow missing from nfelo's table

type ScheduledGame = { home: string; away: string };

async function getFullSeasonSchedule(year: number): Promise<ScheduledGame[]> {
  const weeks = await Promise.all(
    Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => getWeekScoreboard(i + 1, year)),
  );
  return weeks.flatMap((w) => w.games.map((g) => ({ home: g.home, away: g.away })));
}

/** QB-adjusted Elo: nfelo's base rating plus the delta for the current starter. */
function ratedElo(ab: string, ratings: Record<string, NfeloRating>): number {
  return (ratings[ab]?.elo ?? DEFAULT_ELO) + (ratings[ab]?.eloQbAdj ?? 0);
}

function eloWinProbability(eloHome: number, eloAway: number): number {
  return 1 / (1 + Math.pow(10, -(eloHome - eloAway) / 400));
}

/** Pregame home-team win probability for a single matchup (no simulation, just the Elo formula). */
export async function getHomeWinProbability(home: string, away: string): Promise<number> {
  const ratings = await getNfeloRatings();
  return eloWinProbability(ratedElo(home, ratings) + HOME_FIELD_ADVANTAGE, ratedElo(away, ratings));
}

/** Attaches a pregame home-win probability to each game in a list — used for the Schedule tab,
 * as a cheap alternative to running the full season simulation just to show one week's odds. */
export async function attachWinProbabilities<T extends { home: string; away: string }>(
  games: T[],
): Promise<(T & { homeWinProb: number })[]> {
  const ratings = await getNfeloRatings();
  return games.map((g) => ({
    ...g,
    homeWinProb: eloWinProbability(ratedElo(g.home, ratings) + HOME_FIELD_ADVANTAGE, ratedElo(g.away, ratings)),
  }));
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
  results: SimulationResult[];
};

export async function runSimulation(picks: Pick[], trials = DEFAULT_TRIALS): Promise<SimulationSummary> {
  const { year } = await getCurrentRegularSeasonWeek();
  const [schedule, ratings] = await Promise.all([getFullSeasonSchedule(year), getNfeloRatings()]);
  const rosters = rostersFromPicks(picks);

  // Elo is fixed for the whole run — precompute each game's home-win probability once.
  const games = schedule.map((g) => ({
    home: g.home,
    away: g.away,
    pHomeWin: eloWinProbability(ratedElo(g.home, ratings) + HOME_FIELD_ADVANTAGE, ratedElo(g.away, ratings)),
  }));

  const managerRoster = MANAGER_NAMES.map((m) => ({ manager: m, teams: rosters[m] ?? [] }));
  const winsSamples: Record<string, number[]> = {};
  const poolWinCredits: Record<string, number> = {};
  for (const m of MANAGER_NAMES) {
    winsSamples[m] = new Array(trials);
    poolWinCredits[m] = 0;
  }

  const teamWins: Record<string, number> = {};
  for (let t = 0; t < trials; t++) {
    for (const ab in ratings) teamWins[ab] = 0;
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
    for (const { manager, teams } of managerRoster) {
      const total = teams.reduce((sum, ab) => sum + (teamWins[ab] ?? 0), 0);
      totals[manager] = total;
      winsSamples[manager][t] = total;
      if (total > best) best = total;
    }
    const winners = MANAGER_NAMES.filter((m) => totals[m] === best);
    for (const w of winners) poolWinCredits[w] += 1 / winners.length;
  }

  const results: SimulationResult[] = managerRoster.map(({ manager, teams }) => {
    const samples = [...winsSamples[manager]].sort((a, b) => a - b);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    return {
      manager,
      teams,
      winPct: (poolWinCredits[manager] / trials) * 100,
      avgWins: avg,
      medianWins: quantile(samples, 0.5),
      p10Wins: quantile(samples, 0.1),
      p90Wins: quantile(samples, 0.9),
    };
  });
  results.sort((a, b) => b.winPct - a.winPct);

  return { trials, year, generatedAt: new Date().toISOString(), results };
}
