"use client";

import { useEffect, useState } from "react";
import type { LiveGame, TeamScheduleRow } from "./espn";
import type { TeamRecord } from "./teams";

type Fetched<T> = { data: T | null; loading: boolean; error: string | null };

function useJsonFetch<T>(url: string | null): Fetched<T> {
  const [state, setState] = useState<Fetched<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // Marking the new request as loading is the effect's job — it's synchronizing with the
    // external fetch it's about to start, not deriving state from a render.
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

export function useStandings() {
  const { data, loading, error } = useJsonFetch<{ standings: Record<string, TeamRecord> }>("/api/nfl/standings");
  return { standings: data?.standings ?? {}, loading, error };
}

export type WeekResponse = {
  week: number;
  year: number;
  currentWeek: number;
  minWeek: number;
  maxWeek: number;
  games: LiveGame[];
  byeTeams: string[];
};

export function useWeek(week: number | null) {
  const url = week === null ? "/api/nfl/week" : `/api/nfl/week?week=${week}`;
  const { data, loading, error } = useJsonFetch<WeekResponse>(url);
  return { week: data, loading, error };
}

export function useTeamSchedule(abbr: string | null) {
  const url = abbr ? `/api/nfl/team/${abbr}/schedule` : null;
  const { data, loading, error } = useJsonFetch<{ schedule: TeamScheduleRow[] }>(url);
  return { schedule: data?.schedule ?? null, loading, error };
}
