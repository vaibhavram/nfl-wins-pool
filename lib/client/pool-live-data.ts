"use client";
// Pool-scoped counterparts to lib/live-data.ts's useSimulation/usePresence -- that file's
// useStandings/useWeek/useTeamSchedule hooks hit pool-agnostic /api/nfl/* routes and are reused
// as-is; only the two that need a `slug` in their URL get new versions here, so live-data.ts
// itself stays untouched.
import { useEffect, useState } from "react";
import { useLivePolledFetch } from "../live-data";
import { LEADERBOARD_RECOMPUTE_MS } from "../game-window";

export type PoolSimulationResult = {
  manager: string; // a user_id
  teams: string[];
  winPct: number;
  avgWins: number;
  medianWins: number;
  p10Wins: number;
  p90Wins: number;
};

// Flat 5-minute cadence, active or not: the server itself only re-runs the Monte Carlo every
// LEADERBOARD_RECOMPUTE_MS regardless of live state (it's a heavier, pool-wide aggregate, not a
// single number worth refreshing as fast as a score), so polling faster would just re-fetch the
// same cached result. Passing the same value for both active/idle cadence means this hook doesn't
// need a live/settled distinction of its own.
export function usePoolSimulation(slug: string) {
  const { data, loading, error } = useLivePolledFetch<{ results: PoolSimulationResult[]; hasLiveGame: boolean }>(
    `/api/p/${slug}/analytics/simulate`,
    () => true,
    LEADERBOARD_RECOMPUTE_MS,
    LEADERBOARD_RECOMPUTE_MS,
  );
  return { results: data?.results ?? [], loading, error };
}

const PRESENCE_POLL_MS = 8000;

/** Who's currently got this pool's app open -- user_ids, same "online" signal the presence
 * heartbeat in SeasonProvider feeds. */
export function usePoolPresence(slug: string) {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = () => {
      fetch(`/api/p/${slug}/presence`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setOnline(new Set(data.online ?? []));
        })
        .catch(() => {});
    };
    fetchOnce();
    const id = setInterval(fetchOnce, PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug]);

  return online;
}
