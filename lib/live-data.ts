"use client";

import { useEffect, useState } from "react";
import type { LiveGame, TeamScheduleRow } from "./espn";
import type { TeamRecord } from "./teams";
import { GAME_STATE_POLL_MS, IDLE_POLL_MS, isGameActive } from "./game-window";

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

/** Quietly re-fetches in the background: every `activeMs` while `isActive(data)` is true, every
 * `idleMs` otherwise -- it never stops polling entirely while mounted, just slows down. That's
 * the fix for the previous design's core bug: polling used to only continue once a fetch had
 * already come back "live", so a page left open from before kickoff never noticed the game start
 * on its own (nothing was ticking to re-check). Now there's always a timer running; `isActive`
 * only controls its speed. Deliberately bypasses useJsonFetch's `loading` flag (a poll shouldn't
 * flash "Loading…" repeatedly) via a separate `liveData` override that wins once populated.
 * Resets on url change so switching resources doesn't leave a stale poll running against the old
 * one. Shared by every hook below, plus lib/client/pool-live-data.ts's usePoolSimulation. */
export function useLivePolledFetch<T>(
  url: string | null,
  isActive: (data: T) => boolean,
  activeMs: number = GAME_STATE_POLL_MS,
  idleMs: number = IDLE_POLL_MS,
): Fetched<T> {
  const { data, loading, error } = useJsonFetch<T>(url);
  const [liveData, setLiveData] = useState<T | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveData(null);
  }, [url]);

  const current = liveData ?? data;
  const active = Boolean(current && isActive(current));

  useEffect(() => {
    if (!url) return;
    const id = setInterval(() => {
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((fresh) => {
          if (fresh) setLiveData(fresh);
        })
        .catch(() => {});
    }, active ? activeMs : idleMs);
    return () => clearInterval(id);
  }, [url, active, activeMs, idleMs]);

  return { data: current, loading, error };
}

export function useStandings() {
  const { data, loading, error } = useLivePolledFetch<{ standings: Record<string, TeamRecord>; hasLiveGame: boolean }>(
    "/api/nfl/standings",
    (d) => d.hasLiveGame,
  );
  return { standings: data?.standings ?? {}, loading, error };
}

/** Each team's full-season projected wins (completed games as 1/0/0.5, live games via ESPN's
 * live win probability, future games via the same hybrid pre-game model the leaderboard uses --
 * see lib/simulation.ts#getProjectedWinsByTeam). */
export function useProjectedWins() {
  const { data, loading, error } = useLivePolledFetch<{ projectedWins: Record<string, number>; hasLiveGame: boolean }>(
    "/api/nfl/projected-wins",
    (d) => d.hasLiveGame,
  );
  return { projectedWins: data?.projectedWins ?? {}, loading, error };
}

export type WeekGame = LiveGame & { homeWinProb: number | null }; // null once the game is final

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
  const { data, loading, error } = useLivePolledFetch<WeekResponse>(url, (d) =>
    d.games.some((g) => isGameActive(g.state, g.date)),
  );
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
  const { data, loading, error } = useLivePolledFetch<{ schedule: TeamScheduleRowWithProb[]; hasLiveGame: boolean }>(url, (d) =>
    d.schedule.some((g) => g.date && isGameActive(g.state, g.date)),
  );
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
