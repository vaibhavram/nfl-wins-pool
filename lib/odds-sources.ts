// Preseason win-total lines from 4 sportsbooks/outlets, snapshotted at draft time (static, like
// the Vegas O/U already shown elsewhere — not live odds). Used only for the draft grades view;
// team.ou (lib/teams.ts) stays the single Yahoo-sourced number shown everywhere else.
import { rostersFromPicks, type Pick } from "./draft";

export const ODDS_SOURCES = ["Yahoo", "BetMGM", "DraftKings", "FOX"] as const;
export type OddsSource = (typeof ODDS_SOURCES)[number];

const YAHOO: Record<string, number> = {
  ARI: 4.5, ATL: 7.5, BAL: 11.5, BUF: 10.5, CAR: 7.5, CHI: 9.5, CIN: 10.5, CLE: 5.5,
  DAL: 9.5, DEN: 9.5, DET: 10.5, GB: 9.5, HOU: 9.5, IND: 7.5, JAX: 8.5, KC: 10.5,
  LV: 5.5, LAC: 9.5, LAR: 11.5, MIA: 4.5, MIN: 8.5, NE: 10.5, NO: 7.5, NYG: 7.5,
  NYJ: 5.5, PHI: 10.5, PIT: 8.5, SF: 9.5, SEA: 10.5, TB: 8.5, TEN: 6.5, WSH: 7.5,
};

const BETMGM: Record<string, number> = {
  ARI: 3.5, ATL: 7.5, BAL: 11.5, BUF: 10.5, CAR: 7.5, CHI: 9.5, CIN: 9.5, CLE: 5.5,
  DAL: 9.5, DEN: 9.5, DET: 10.5, GB: 9.5, HOU: 9.5, IND: 7.5, JAX: 9.5, KC: 10.5,
  LV: 5.5, LAC: 10.5, LAR: 11.5, MIA: 4.5, MIN: 8.5, NE: 10.5, NO: 7.5, NYG: 7.5,
  NYJ: 5.5, PHI: 10.5, PIT: 8.5, SF: 10.5, SEA: 10.5, TB: 8.5, TEN: 6.5, WSH: 7.5,
};

const DRAFTKINGS: Record<string, number> = {
  ARI: 4.5, ATL: 6.5, BAL: 10.5, BUF: 10.5, CAR: 6.5, CHI: 9.5, CIN: 9.5, CLE: 6.5,
  DAL: 8.5, DEN: 9.5, DET: 10.5, GB: 10.5, HOU: 9.5, IND: 8.5, JAX: 9.5, KC: 10.5,
  LV: 5.5, LAC: 10.5, LAR: 10.5, MIA: 4.5, MIN: 8.5, NE: 10.5, NO: 7.5, NYG: 7.5,
  NYJ: 5.5, PHI: 10.5, PIT: 8.5, SF: 10.5, SEA: 10.5, TB: 8.5, TEN: 6.5, WSH: 7.5,
};

const FOX: Record<string, number> = {
  ARI: 3.5, ATL: 6.5, BAL: 11.5, BUF: 10.5, CAR: 7.5, CHI: 9.5, CIN: 10.5, CLE: 5.5,
  DAL: 9.5, DEN: 9.5, DET: 10.5, GB: 9.5, HOU: 9.5, IND: 7.5, JAX: 8.5, KC: 10.5,
  LV: 5.5, LAC: 9.5, LAR: 11.5, MIA: 4.5, MIN: 8.5, NE: 10.5, NO: 7.5, NYG: 7.5,
  NYJ: 5.5, PHI: 10.5, PIT: 8.5, SF: 9.5, SEA: 10.5, TB: 8.5, TEN: 6.5, WSH: 7.5,
};

const TABLES: Record<OddsSource, Record<string, number>> = {
  Yahoo: YAHOO,
  BetMGM: BETMGM,
  DraftKings: DRAFTKINGS,
  FOX: FOX,
};

export function ouFrom(source: OddsSource, ab: string): number {
  return TABLES[source][ab] ?? 0;
}

export type GradeRow = {
  manager: string;
  teams: string[];
  bySource: Record<OddsSource, number>;
  avg: number;
};

/** Sums each manager's drafted teams' projected wins per source, sorted best-average first.
 * Managers with fewer than 3 picks so far are still included — their totals just aren't final. */
export function computeGrades(picks: Pick[], roster?: string[]): GradeRow[] {
  const rosters = rostersFromPicks(picks, roster);
  const rows: GradeRow[] = Object.entries(rosters).map(([manager, teams]) => {
    const bySource = {} as Record<OddsSource, number>;
    for (const source of ODDS_SOURCES) {
      bySource[source] = teams.reduce((sum, ab) => sum + ouFrom(source, ab), 0);
    }
    const avg = ODDS_SOURCES.reduce((sum, s) => sum + bySource[s], 0) / ODDS_SOURCES.length;
    return { manager, teams, bySource, avg };
  });
  rows.sort((a, b) => b.avg - a.avg);
  return rows;
}
