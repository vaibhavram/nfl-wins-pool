// Captures one row per manager per in-season pool into win_probability_snapshots (migration 006)
// -- until this existed, every win-probability number in the app was computed on demand and never
// persisted, so there was no way to look back at how a manager's odds moved day to day.
import "server-only";
import { query } from "./db2";
import { getInSeasonPools } from "./admin-server";
import { getSeasonManagers, getSeasonPicks } from "./season-server";
import { getStandings } from "./espn";
import { rostersFromPicks, totalWins } from "./draft";
import { runSimulation } from "./simulation";

/** YYYY-MM-DD for the given instant in Pacific time -- the snapshot's calendar day, independent
 * of whatever timezone the server or the triggering cron happens to run in. */
function pacificDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export type SnapshotRow = {
  poolSlug: string;
  poolName: string;
  manager: string;
  wins: number;
  winPct: number;
  avgWins: number;
  medianWins: number;
  p10Wins: number;
  p90Wins: number;
};

export type SnapshotResult = { snapshotDate: string; poolsProcessed: number; rows: SnapshotRow[]; failedPools: string[] };

/** One row per manager per in-season, non-test pool. `dryRun: true` computes and returns every
 * row without writing anything, for checking the job before it's actually scheduled to run.
 * Each pool is isolated (Promise.allSettled) so one pool's failure doesn't lose every other
 * pool's snapshot for the day -- same pattern as the weekly digest. Idempotent: re-running for a
 * day that already has a snapshot overwrites it (ON CONFLICT ... DO UPDATE) rather than
 * duplicating, so a retried or manually re-triggered run is safe. */
export async function captureWinProbabilitySnapshots(opts: { dryRun?: boolean } = {}): Promise<SnapshotResult> {
  const [pools, standings] = await Promise.all([getInSeasonPools(), getStandings()]);
  const snapshotDate = pacificDateString();
  const rows: SnapshotRow[] = [];

  const settled = await Promise.allSettled(
    pools.map(async (pool) => {
      const [managers, picks] = await Promise.all([getSeasonManagers(pool.seasonId), getSeasonPicks(pool.seasonId)]);
      const roster = managers.map((m) => m.userId);
      const rosters = rostersFromPicks(picks, roster);
      const summary = await runSimulation(picks, roster);
      const resultByManager = Object.fromEntries(summary.results.map((r) => [r.manager, r]));

      for (const m of managers) {
        const r = resultByManager[m.userId];
        if (!r) continue;
        const wins = totalWins(rosters[m.userId] ?? [], standings);
        rows.push({
          poolSlug: pool.slug,
          poolName: pool.name,
          manager: m.displayName,
          wins,
          winPct: r.winPct,
          avgWins: r.avgWins,
          medianWins: r.medianWins,
          p10Wins: r.p10Wins,
          p90Wins: r.p90Wins,
        });
        if (!opts.dryRun) {
          await query(
            `INSERT INTO win_probability_snapshots
               (season_id, user_id, snapshot_date, wins, win_pct, avg_wins, median_wins, p10_wins, p90_wins, trials)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (season_id, user_id, snapshot_date) DO UPDATE SET
               wins = EXCLUDED.wins, win_pct = EXCLUDED.win_pct, avg_wins = EXCLUDED.avg_wins,
               median_wins = EXCLUDED.median_wins, p10_wins = EXCLUDED.p10_wins, p90_wins = EXCLUDED.p90_wins,
               trials = EXCLUDED.trials, captured_at = now()`,
            [pool.seasonId, m.userId, snapshotDate, wins, r.winPct, r.avgWins, r.medianWins, r.p10Wins, r.p90Wins, summary.trials],
          );
        }
      }
    }),
  );

  const failedPools: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Win-probability snapshot failed for pool ${pools[i].slug} (${pools[i].name}):`, result.reason);
      failedPools.push(pools[i].slug);
    }
  });

  return { snapshotDate, poolsProcessed: pools.length, rows, failedPools };
}
