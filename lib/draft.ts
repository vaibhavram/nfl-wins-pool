import { MANAGER_NAMES } from "./managers";
import { TEAMS, type TeamRecord } from "./teams";

// The pool's actual draft pattern (not a simple snake) — the "Eldorado method". Draft position
// (1-10, matching MANAGER_NAMES order) gets 3 picks each, spread out so no position is
// systematically stronger:
//   pos 1: 1,28,30   pos 2: 2,21,24   pos 3: 3,18,22   pos 4: 4,17,20   pos 5: 5,15,23
//   pos 6: 6,14,26   pos 7: 7,11,29   pos 8: 8,16,19   pos 9: 9,13,25   pos 10: 10,12,27
// Expressed here as, for each pick 1-30, which draft position (1-10) is on the clock.
const PICK_POSITIONS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  7, 10, 9, 6, 5, 8, 4, 3, 8, 4,
  2, 3, 5, 2, 9, 6, 10, 1, 7, 1,
];

export const DRAFT_ORDER: string[] = PICK_POSITIONS.map((pos) => MANAGER_NAMES[pos - 1]);
export const TOTAL_PICKS = DRAFT_ORDER.length; // 30 — 2 of 32 teams go undrafted

export type Pick = { pickNo: number; manager: string; teamAb: string };

/** Deterministic CPU pick: highest Vegas win total among teams not yet taken. */
export function bestAvailableTeam(takenAbs: Set<string>): string {
  const available = TEAMS.filter((t) => !takenAbs.has(t.ab));
  available.sort((a, b) => b.ou - a.ou || a.ab.localeCompare(b.ab));
  return available[0].ab;
}

export function rostersFromPicks(picks: Pick[]): Record<string, string[]> {
  const rosters: Record<string, string[]> = {};
  for (const name of MANAGER_NAMES) rosters[name] = [];
  for (const p of picks) {
    // A pick's manager can be stale (e.g. the roster changed since this pick was made);
    // skip rather than crash — isDraftStale() is what actually resets stale draft state.
    if (rosters[p.manager]) rosters[p.manager].push(p.teamAb);
  }
  return rosters;
}

/** True if any persisted pick no longer matches who's actually on the clock for that slot —
 * i.e. the manager roster changed since this draft was played and the saved picks are stale. */
export function isDraftStale(picks: Pick[]): boolean {
  return picks.some((p, i) => DRAFT_ORDER[i] !== p.manager);
}

/** A tie counts as half a win, per standard wins-pool rules. */
export function totalWins(teamAbs: string[], standings: Record<string, TeamRecord>): number {
  return teamAbs.reduce((sum, ab) => {
    const rec = standings[ab];
    return sum + (rec ? rec.wins + rec.ties * 0.5 : 0);
  }, 0);
}
