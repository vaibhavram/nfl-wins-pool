// Each manager's pool win probability at the end of every week so far, plus a Pre-W1 baseline --
// the data behind the win-probability chart on a manager's page.
//
// Computed rather than read back from win_probability_snapshots (migration 006): that table only
// starts on 2026-09-14, when the daily job shipped, which is partway through Week 2, so it has no
// Pre-W1 and no Week 1 row and never will. Recomputing from game data gives the whole season and
// gives the same answer every time it runs.
//
// The method is lib/weekly-digest.ts's "pre-week" counterfactual generalised: for checkpoint k,
// games in weeks <= k keep the result they actually had and everything after is rolled back to
// its pre-game probability, resolved the way any not-yet-played game is (ESPN's Matchup
// Predictor, falling back to FPI). Checkpoint 0 rolls back the whole season, which is the
// preseason picture.
import "server-only";
import { getCurrentRegularSeasonWeek, getGamePredictor } from "./espn";
import {
  getSeasonGameData,
  getHomeWinProbabilityFpi,
  runSimulationWithGames,
  REGULAR_SEASON_WEEKS,
  type SimGame,
} from "./simulation";
import type { Pick } from "./draft";

// A trend line, not a precision instrument: at 4k trials each point carries well under a
// percentage point of noise, and the series needs one simulation per week rather than one.
const SERIES_TRIALS = 4000;
const PREDICTOR_CONCURRENCY = 12; // courtesy cap, matching lib/simulation.ts

export type WinProbabilitySeries = {
  /** "Pre-W1", "W1", "W2", ... -- one label per point, in order. */
  checkpoints: string[];
  /** Pool win probability (0-100) per manager id, one entry per checkpoint. */
  byManager: Record<string, number[]>;
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

/** The last week whose games are all final. Weeks run in order, so a week with a game still to
 * play ends the series -- a half-finished week would read as a real move in the chart when it is
 * only a partial one. */
function lastCompletedWeek(games: SimGame[]): number {
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
    const inWeek = games.filter((g) => g.week === week);
    if (inWeek.length === 0 || !inWeek.every((g) => g.state === "post")) return week - 1;
  }
  return REGULAR_SEASON_WEEKS;
}

const cache = new Map<string, { data: WinProbabilitySeries; expiresAt: number }>();
// A completed week's point never moves again, and the newest point is itself a completed week, so
// the whole series is stable until another week finishes. Cached long and keyed by how many weeks
// are in the books, which is what actually invalidates it.
const SERIES_TTL_MS = 6 * 60 * 60 * 1000;

export async function getWinProbabilitySeries(seasonId: string, picks: Pick[], roster: string[]): Promise<WinProbabilitySeries> {
  const { year } = await getCurrentRegularSeasonWeek();
  const { games } = await getSeasonGameData(year);
  const weeks = lastCompletedWeek(games);

  const key = `${seasonId}:${weeks}:${roster.join(",")}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // A completed game's pre-game probability isn't kept on SimGame (it carries a 0.5 placeholder),
  // so it's re-resolved here. Cheap in practice: getGamePredictor caches for 24h.
  const completed = games.filter((g) => g.fixedResult !== null);
  const preGameProbs = await mapWithConcurrency(completed, PREDICTOR_CONCURRENCY, async (g) => {
    const predicted = await getGamePredictor(g.id);
    return [g.id, predicted ?? (await getHomeWinProbabilityFpi(g.home, g.away))] as const;
  });
  const preGameProbById = new Map(preGameProbs);

  const checkpoints = ["Pre-W1", ...Array.from({ length: weeks }, (_, i) => `W${i + 1}`)];
  const byManager: Record<string, number[]> = Object.fromEntries(roster.map((m) => [m, []]));

  for (let k = 0; k <= weeks; k++) {
    const asOf: SimGame[] = games.map((g) =>
      g.week <= k ? g : { ...g, fixedResult: null, pHomeWin: preGameProbById.get(g.id) ?? g.pHomeWin },
    );
    const summary = await runSimulationWithGames(picks, roster, asOf, year, SERIES_TRIALS);
    for (const r of summary.results) byManager[r.manager]?.push(r.winPct);
  }

  const data: WinProbabilitySeries = { checkpoints, byManager };
  cache.set(key, { data, expiresAt: Date.now() + SERIES_TTL_MS });
  return data;
}
