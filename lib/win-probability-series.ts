// Each manager's pool win probability through the season, for the chart on a manager's page.
//
// Two sources, because no single one can tell the whole story honestly:
//
//   Pre-W1  the preseason Vegas win totals (lib/preseason-baseline.ts). The season cannot be
//           replayed to recover this: ESPN drops a game's pre-game predictor once it is final, so
//           a replay prices every matchup with today's ratings and "before the season" comes out
//           knowing which teams collapsed.
//   W1..Wn  win_probability_snapshots -- what this app actually computed on the day. Real history,
//           not a reconstruction, but it only begins on 2026-09-14, so early weeks of this season
//           have no row and come back null. The chart leaves those slots empty rather than
//           inventing them.
//
// The two are different models meeting at the left edge, which is the price of the Pre-W1 bar
// being a real preseason number instead of a backwards-looking one.
import "server-only";
import { query } from "./db2";
import { getCurrentRegularSeasonWeek, getRegularSeasonWeeks } from "./espn";
import { getSeasonGameData, REGULAR_SEASON_WEEKS, type SimGame } from "./simulation";
import { getPreseasonWinProbabilities } from "./preseason-baseline";
import type { Pick } from "./draft";

const PRESEASON_TRIALS = 10000;

export type WinProbabilitySeries = {
  /** "Pre-W1", "W1", "W2", ... -- one label per point, in order. */
  checkpoints: string[];
  /** Pool win probability (0-100) per manager id, one entry per checkpoint; null where no
   * snapshot exists for that week. */
  byManager: Record<string, (number | null)[]>;
};

/** YYYY-MM-DD in Pacific time -- the calendar day win_probability_snapshots is keyed by, so week
 * boundaries have to be converted into the same frame before they can be compared. */
function pacificDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

/** The last week whose games are all final. A week still being played would read as a real move
 * in the chart when it is only a partial one. */
function lastCompletedWeek(games: SimGame[]): number {
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
    const inWeek = games.filter((g) => g.week === week);
    if (inWeek.length === 0 || !inWeek.every((g) => g.state === "post")) return week - 1;
  }
  return REGULAR_SEASON_WEEKS;
}

type SnapshotRow = { user_id: string; snapshot_date: string; win_pct: string };

const cache = new Map<string, { data: WinProbabilitySeries; expiresAt: number }>();
const SERIES_TTL_MS = 6 * 60 * 60 * 1000; // only moves when a week finishes or a snapshot lands

export async function getWinProbabilitySeries(seasonId: string, picks: Pick[], roster: string[]): Promise<WinProbabilitySeries> {
  const { year } = await getCurrentRegularSeasonWeek();
  const { games } = await getSeasonGameData(year);
  const weeks = lastCompletedWeek(games);

  const key = `${seasonId}:${weeks}:${roster.join(",")}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const [preseason, calendar, snapshots] = await Promise.all([
    getPreseasonWinProbabilities(picks, roster, games, year, PRESEASON_TRIALS),
    getRegularSeasonWeeks(),
    query<SnapshotRow>(
      `SELECT user_id, snapshot_date::text AS snapshot_date, win_pct
         FROM win_probability_snapshots
        WHERE season_id = $1
        ORDER BY snapshot_date ASC`,
      [seasonId],
    ),
  ]);

  // The end of week N is that week's calendar end (weeks run Wednesday to Tuesday), so the value
  // "after week N" is the last snapshot taken on or before that day. The daily job runs at 11pm
  // Pacific, which puts a snapshot right at each boundary.
  const endOfWeek = new Map(calendar.map((w) => [w.week, pacificDate(w.endDate)]));

  const checkpoints = ["Pre-W1", ...Array.from({ length: weeks }, (_, i) => `W${i + 1}`)];
  const byManager: Record<string, (number | null)[]> = {};
  for (const m of roster) {
    const mine = snapshots.filter((s) => s.user_id === m);
    const points: (number | null)[] = [preseason[m] ?? null];
    for (let week = 1; week <= weeks; week++) {
      const boundary = endOfWeek.get(week);
      const upTo = boundary ? mine.filter((s) => s.snapshot_date <= boundary) : [];
      points.push(upTo.length > 0 ? Number(upTo[upTo.length - 1].win_pct) : null);
    }
    byManager[m] = points;
  }

  const data: WinProbabilitySeries = { checkpoints, byManager };
  cache.set(key, { data, expiresAt: Date.now() + SERIES_TTL_MS });
  return data;
}
