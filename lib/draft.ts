import type { TeamRecord } from "./teams";

// The pool's actual draft pattern (not a simple snake) — the Bill Simmons / Grantland method.
// Draft position (1-10) gets 3 picks each, spread out so no position is systematically stronger:
//   pos 1: 1,20,26   pos 2: 2,16,29   pos 3: 3,13,30   pos 4: 4,18,25   pos 5: 5,15,27
//   pos 6: 6,19,22   pos 7: 7,11,28   pos 8: 8,17,21   pos 9: 9,14,23   pos 10: 10,12,24
// Expressed here as, for each pick 1-30, which draft position (1-10) is on the clock. Which
// *manager* holds each position is reshuffled on every draft reset (see lib/draft-server.ts),
// so this pattern is applied to a dynamic position order, not a fixed one.
const PICK_POSITIONS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  7, 10, 3, 9, 5, 2, 8, 4, 6, 1,
  8, 6, 9, 10, 4, 1, 5, 7, 2, 3,
];

export const TOTAL_PICKS = PICK_POSITIONS.length; // 30 — 2 of 32 teams go undrafted

/** Turns a position order (10 names, position 1 first) into the full 30-pick draft order. */
export function buildDraftOrder(positionOrder: string[]): string[] {
  return PICK_POSITIONS.map((pos) => positionOrder[pos - 1]);
}

export type Pick = { pickNo: number; manager: string; teamAb: string };

/** `roster` fixes which keys appear in the result (and their order) even before they've picked
 * anything -- pass the pool's manager list so a manager with 0 picks still shows an empty
 * array instead of being absent. Defaults to whatever managers appear in `picks` themselves. */
export function rostersFromPicks(picks: Pick[], roster?: string[]): Record<string, string[]> {
  const rosters: Record<string, string[]> = {};
  const keys = roster ?? Array.from(new Set(picks.map((p) => p.manager)));
  for (const key of keys) rosters[key] = [];
  for (const p of picks) {
    // A pick's manager can be stale relative to a since-changed roster; skip rather than crash.
    if (p.manager in rosters) rosters[p.manager].push(p.teamAb);
  }
  return rosters;
}

/** A tie counts as half a win, per standard wins-pool rules. */
export function totalWins(teamAbs: string[], standings: Record<string, TeamRecord>): number {
  return teamAbs.reduce((sum, ab) => {
    const rec = standings[ab];
    return sum + (rec ? rec.wins + rec.ties * 0.5 : 0);
  }, 0);
}
