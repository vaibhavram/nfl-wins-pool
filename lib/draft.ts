import { MANAGER_NAMES } from "./managers";
import { TEAMS, type TeamRecord } from "./teams";

// The pool's actual draft pattern (not a simple snake) — from the Grantland "NFL wins pool"
// article. Draft position (1-10, matching MANAGER_NAMES order) gets 3 picks each, spread out so
// no position is systematically stronger:
//   pos 1: 1,20,26   pos 2: 2,16,29   pos 3: 3,13,30   pos 4: 4,18,25   pos 5: 5,15,27
//   pos 6: 6,19,22   pos 7: 7,11,28   pos 8: 8,17,21   pos 9: 9,14,23   pos 10: 10,12,24
// Expressed here as, for each pick 1-30, which draft position (1-10) is on the clock.
const PICK_POSITIONS: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  7, 10, 3, 9, 5, 2, 8, 4, 6, 1,
  8, 6, 9, 10, 4, 1, 5, 7, 2, 3,
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
