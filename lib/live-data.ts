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

export type WeekGame = LiveGame & { homeWinProb: number };

export type WeekResponse = {
  week: number;
  year: number;
  currentWeek: number;
  minWeek: number;
  maxWeek: number;
  games: WeekGame[];
  byeTeams: string[];
};

export function useWeek(week: number | null) {
  const url = week === null ? "/api/nfl/week" : `/api/nfl/week?week=${week}`;
  const { data, loading, error } = useJsonFetch<WeekResponse>(url);
  return { week: data, loading, error };
}

export type SimulationResult = {
  manager: string;
  teams: string[];
  winPct: number;
  avgWins: number;
  medianWins: number;
  p10Wins: number;
  p90Wins: number;
};

/** Pool-winner probabilities from the Elo Monte Carlo simulation — see lib/simulation.ts. */
export function useSimulation() {
  const { data, loading, error } = useJsonFetch<{ results: SimulationResult[] }>("/api/analytics/simulate");
  return { results: data?.results ?? [], loading, error };
}

export type TeamScheduleRowWithProb = TeamScheduleRow & { winProb: number | null };

export function useTeamSchedule(abbr: string | null) {
  const url = abbr ? `/api/nfl/team/${abbr}/schedule` : null;
  const { data, loading, error } = useJsonFetch<{ schedule: TeamScheduleRowWithProb[] }>(url);
  return { schedule: data?.schedule ?? null, loading, error };
}

const PRESENCE_POLL_MS = 8000;

/** Who's currently got the app open — same "online" signal the presence heartbeat feeds. */
export function usePresence() {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = () => {
      fetch("/api/presence")
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
  }, []);

  return online;
}
