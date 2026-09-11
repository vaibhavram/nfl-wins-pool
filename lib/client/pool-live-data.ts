"use client";
// Pool-scoped counterparts to lib/live-data.ts's useSimulation/usePresence -- that file's
// useStandings/useWeek/useTeamSchedule hooks hit pool-agnostic /api/nfl/* routes and are reused
// as-is; only the two that need a `slug` in their URL get new versions here, so live-data.ts
// itself stays untouched.
import { useEffect, useState } from "react";
import { useLivePolledFetch } from "../live-data";

export type PoolSimulationResult = {
  manager: string; // a user_id
  teams: string[];
  winPct: number;
  avgWins: number;
  medianWins: number;
  p10Wins: number;
  p90Wins: number;
};

// Slower than the 20s live-data.ts default: the server itself only re-runs the Monte Carlo every
// 5 minutes while a game is live (a deliberate cost tradeoff -- it's a heavier, pool-wide
// aggregate, not a single number worth hammering), so polling faster than that would mostly just
// re-fetch the same cached result.
const SIM_POLL_MS = 60000;

export function usePoolSimulation(slug: string) {
  const { data, loading, error } = useLivePolledFetch<{ results: PoolSimulationResult[]; hasLiveGame: boolean }>(
    `/api/p/${slug}/analytics/simulate`,
    (d) => d.hasLiveGame,
    SIM_POLL_MS,
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
