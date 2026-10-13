import "server-only";
import { getSeasonPicks } from "./season-server";
import { runSimulation, type SimulationSummary } from "./simulation";
import { LEADERBOARD_RECOMPUTE_MS } from "./game-window";

// The (CPU-heavy) simulation result is cached rather than re-run on every caller. A plain
// in-memory Map instead of unstable_cache: fine for this single-instance service, same as other
// manual in-memory caches already used elsewhere in this codebase. Flat TTL regardless of live
// state -- "leaderboard win probabilities recompute every 5 minutes" is the whole spec, not "5
// minutes while live, else hours"; runSimulation/getSeasonGameData (lib/simulation.ts) already
// carry their own matching 5-minute cache one level down, so this just needs to not be shorter
// than that.
const cache = new Map<string, { summary: SimulationSummary; expiresAt: number }>();

/** Shared by the Standings tab's live leaderboard and its save-to-photos image, which both want
 * the same win probabilities -- a screenshot showing numbers that disagree with the screen it was
 * taken from would be its own bug, and one Monte Carlo run per pool per window is plenty. */
export async function getCachedPoolSimulation(seasonId: string, roster: string[], trials?: number): Promise<SimulationSummary> {
  const key = `${seasonId}:${roster.join(",")}:${trials ?? "default"}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.summary;

  const picks = await getSeasonPicks(seasonId);
  const summary = await runSimulation(picks, roster, trials);
  cache.set(key, { summary, expiresAt: Date.now() + LEADERBOARD_RECOMPUTE_MS });
  return summary;
}
