"use client";

// Pool-scoped port of lib/store.tsx's DraftProvider: fully server-authoritative and
// asynchronous (picks live in Postgres, not localStorage), but parameterized by `slug` instead
// of assuming a single global pool, and keyed by user_id instead of a manager name string.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TOTAL_PICKS, type Pick } from "@/lib/draft";

const DRAFT_POLL_MS = 4000;
const HEARTBEAT_MS = 20000;

type PickResult = { ok: true } | { ok: false; error: string };

type SeasonContextValue = {
  hydrated: boolean;
  status: string; // filling | ready | drafting | in_season | final
  picks: Pick[];
  order: string[]; // 30 user_ids -- one per pick slot, matching lib/draft.ts's buildDraftOrder
  deadline: string | null; // ISO timestamp the current on-the-clock pick auto-resolves at
  pickClockSeconds: number;
  selectedTeam: string | null;
  takenAbs: Set<string>;
  currentPickIndex: number; // -1 once complete
  currentPickNo: number; // 1-based, TOTAL_PICKS+1 once complete
  onClockUserId: string | null;
  draftStarted: boolean;
  draftComplete: boolean;
  selectTeam: (ab: string | null) => void;
  confirmPick: (teamAb: string) => Promise<PickResult>;
  startDraft: () => Promise<PickResult>;
  refetch: () => void;
};

const SeasonContext = createContext<SeasonContextValue | null>(null);

type SeasonState = {
  hydrated: boolean;
  status: string;
  picks: Pick[];
  order: string[];
  deadline: string | null;
  pickClockSeconds: number;
};
const EMPTY_STATE: SeasonState = {
  hydrated: false,
  status: "filling",
  picks: [],
  order: [],
  deadline: null,
  pickClockSeconds: 43200,
};

export function SeasonProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [state, setState] = useState<SeasonState>(EMPTY_STATE);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const inFlight = useRef(false);

  const fetchState = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/p/${slug}/draft/state`);
      const data = await res.json();
      setState({
        hydrated: true,
        status: data.status ?? "filling",
        picks: data.picks ?? [],
        order: data.order ?? [],
        deadline: data.deadline ?? null,
        pickClockSeconds: data.pickClockSeconds ?? 43200,
      });
    } catch {
      setState((s) => ({ ...s, hydrated: true }));
    } finally {
      inFlight.current = false;
    }
  }, [slug]);

  const takenAbs = useMemo(() => new Set(state.picks.map((p) => p.teamAb)), [state.picks]);
  const currentPickIndex = state.picks.length < TOTAL_PICKS ? state.picks.length : -1;
  const currentPickNo = state.picks.length < TOTAL_PICKS ? state.picks.length + 1 : TOTAL_PICKS + 1;
  const onClockUserId = currentPickIndex === -1 ? null : (state.order[currentPickIndex] ?? null);
  const draftComplete = state.status === "in_season" || state.status === "final";
  const draftStarted = state.status === "drafting" || draftComplete;

  useEffect(() => {
    // Kicking off the initial poll is the effect synchronizing with the server, same as the
    // interval/visibility listeners right below it -- not deriving state from a render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchState();
    if (draftComplete) return; // picks/order are frozen once the draft's done
    const id = setInterval(fetchState, DRAFT_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchState();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchState, draftComplete]);

  // Presence heartbeat -- session cookie identifies who's pinging, no token to thread through.
  useEffect(() => {
    if (draftComplete) return;
    const ping = () => {
      fetch(`/api/p/${slug}/presence/heartbeat`, { method: "POST" }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [slug, draftComplete]);

  function selectTeam(ab: string | null) {
    setSelectedTeam(ab);
  }

  async function confirmPick(teamAb: string): Promise<PickResult> {
    try {
      const res = await fetch(`/api/p/${slug}/draft/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamAb }),
      });
      const data = await res.json();
      if (!data.ok) {
        fetchState(); // our view of who's on the clock may be stale -- resync
        return { ok: false, error: data.error ?? "Couldn't submit that pick." };
      }
      setState({
        hydrated: true,
        status: data.status,
        picks: data.picks,
        order: data.order ?? [],
        deadline: data.deadline ?? null,
        pickClockSeconds: data.pickClockSeconds ?? 43200,
      });
      setSelectedTeam(null);
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }
  }

  async function startDraft(): Promise<PickResult> {
    try {
      const res = await fetch(`/api/p/${slug}/draft/start`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) return { ok: false, error: data.error ?? "Couldn't start the draft." };
      await fetchState();
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }
  }

  const value: SeasonContextValue = {
    hydrated: state.hydrated,
    status: state.status,
    picks: state.picks,
    order: state.order,
    deadline: state.deadline,
    pickClockSeconds: state.pickClockSeconds,
    selectedTeam,
    takenAbs,
    currentPickIndex,
    currentPickNo,
    onClockUserId,
    draftStarted,
    draftComplete,
    selectTeam,
    confirmPick,
    startDraft,
    refetch: fetchState,
  };

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason() {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error("useSeason must be used within SeasonProvider");
  return ctx;
}
