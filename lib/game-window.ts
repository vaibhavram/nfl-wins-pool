// Shared, pure "is this game worth refreshing right now" logic -- no server-only fetch code, so
// both lib/espn.ts (server) and lib/live-data.ts (client) can use the exact same definition of
// "live window" instead of each guessing independently. That divergence (server deciding whether
// to pay for a fresh fetch, client deciding whether to keep polling) is what made the last design
// unreliable: the client only kept polling once a game had already flipped to "in", so a page left
// open across kickoff never started refreshing on its own.
export const GAME_STATE_POLL_MS = 30_000; // score/down-distance/win-prob refresh cadence while a game is imminent or live
export const LEADERBOARD_RECOMPUTE_MS = 5 * 60 * 1000; // pool-wide Monte Carlo recompute cadence
export const IDLE_POLL_MS = LEADERBOARD_RECOMPUTE_MS; // background check cadence when nothing is imminent -- cheap enough to always run

const PRE_GAME_LEAD_MS = 5 * 60 * 1000; // start treating a game as worth fetching fresh 5 min before kickoff

/** True from 5 minutes before kickoff through the final whistle; false before that lead window
 * opens and false again the moment the game is final. `state` always wins when known ("in"/"post"
 * are authoritative); the kickoff-time arithmetic only matters for the "pre" case, deciding
 * whether kickoff is close enough to be worth fetching fresh yet. */
export function isGameActive(state: "pre" | "in" | "post", kickoffIso: string, now: number = Date.now()): boolean {
  if (state === "post") return false;
  if (state === "in") return true;
  return now >= new Date(kickoffIso).getTime() - PRE_GAME_LEAD_MS;
}
