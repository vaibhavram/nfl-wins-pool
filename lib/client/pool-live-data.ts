"use client";
// Pool-scoped counterparts to lib/live-data.ts's useSimulation/usePresence -- that file's
// useStandings/useWeek/useTeamSchedule hooks hit pool-agnostic /api/nfl/* routes and are reused
// as-is; only the two that need a `slug` in their URL get new versions here, so live-data.ts
// itself stays untouched.
import { useEffect, useState } from "react";

type Fetched<T> = { data: T | null; loading: boolean; error: string | null };

function useJsonFetch<T>(url: string | null): Fetched<T> {
  const [state, setState] = useState<Fetched<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Failed to load" });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

export type PoolSimulationResult = {
  manager: string; // a user_id
  teams: string[];
  winPct: number;
  avgWins: number;
  medianWins: number;
  p10Wins: number;
  p90Wins: number;
};

export function usePoolSimulation(slug: string) {
  const { data, loading, error } = useJsonFetch<{ results: PoolSimulationResult[] }>(`/api/p/${slug}/analytics/simulate`);
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
