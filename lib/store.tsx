"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DRAFT_ORDER, TOTAL_PICKS, type Pick } from "./draft";

const AUTH_KEY = "nfl-pool-auth";
const DRAFT_POLL_MS = 4000;
const HEARTBEAT_MS = 20000;

// ─────────────────────────────────────────── Auth ───────────────────────────────────────────

export type Manager = { name: string; token: string };

type AuthContextValue = {
  hydrated: boolean;
  manager: Manager | null;
  signIn: (phone: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ hydrated, manager }, setInit] = useState<{ hydrated: boolean; manager: Manager | null }>({
    hydrated: false,
    manager: null,
  });
  const setManager = (m: Manager | null) => setInit((s) => ({ ...s, manager: m }));

  useEffect(() => {
    const saved = window.localStorage.getItem(AUTH_KEY);
    let restored: Manager | null = null;
    if (saved) {
      try {
        restored = JSON.parse(saved);
      } catch {
        // ignore corrupt storage
      }
    }
    // One-time hydration from localStorage; SSR has no window, so this can't be a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInit({ hydrated: true, manager: restored });
  }, []);

  // Presence heartbeat: as long as this manager has the app open somewhere, ping every 20s so
  // the lobby's "signed in" list reflects who's actually around right now.
  useEffect(() => {
    if (!manager) return;
    const ping = () => {
      fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { Authorization: `Bearer ${manager.token}` },
      }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [manager]);

  async function signIn(phone: string) {
    let res: Response;
    try {
      res = await fetch("/api/auth/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
    } catch {
      return { ok: false as const, error: "Couldn't reach the server. Check your connection and try again." };
    }
    const data = await res.json();
    if (!data.ok) {
      return { ok: false as const, error: data.error ?? "That number isn't on the pool roster." };
    }
    const found: Manager = { name: data.name, token: data.token };
    setManager(found);
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(found));
    return { ok: true as const };
  }

  function signOut() {
    setManager(null);
    window.localStorage.removeItem(AUTH_KEY);
  }

  const value = { hydrated, manager, signIn, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ─────────────────────────────────────────── Draft ───────────────────────────────────────────
// Fully server-authoritative and asynchronous: picks live in Postgres, not localStorage, so
// every manager's device sees the same draft. Nobody is auto-picked for — a manager's slot just
// waits, however long it takes, until they submit their own pick from their own device.

type PickResult = { ok: true } | { ok: false; error: string };

type DraftContextValue = {
  hydrated: boolean;
  picks: Pick[];
  selectedTeam: string | null;
  takenAbs: Set<string>;
  currentPickIndex: number; // -1 once complete
  currentPickNo: number; // 1-based, TOTAL_PICKS+1 once complete
  onClockManager: string | null;
  draftComplete: boolean;
  selectTeam: (ab: string | null) => void;
  confirmPick: (token: string, teamAb: string) => Promise<PickResult>;
  resetDraft: (token: string) => Promise<void>;
  refetch: () => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [{ hydrated, picks }, setInit] = useState<{ hydrated: boolean; picks: Pick[] }>({
    hydrated: false,
    picks: [],
  });
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const inFlight = useRef(false);

  const fetchState = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/draft/state");
      const data = await res.json();
      setInit({ hydrated: true, picks: data.picks ?? [] });
    } catch {
      setInit((s) => ({ ...s, hydrated: true }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // Kicking off the initial poll is the effect synchronizing with the server, same as the
    // interval/visibility listeners right below it — not deriving state from a render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchState();
    const id = setInterval(fetchState, DRAFT_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchState();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchState]);

  const takenAbs = useMemo(() => new Set(picks.map((p) => p.teamAb)), [picks]);
  const currentPickIndex = picks.length < TOTAL_PICKS ? picks.length : -1;
  const currentPickNo = picks.length < TOTAL_PICKS ? picks.length + 1 : TOTAL_PICKS + 1;
  const onClockManager = currentPickIndex === -1 ? null : DRAFT_ORDER[currentPickIndex];
  const draftComplete = currentPickIndex === -1;

  function selectTeam(ab: string | null) {
    setSelectedTeam(ab);
  }

  async function confirmPick(token: string, teamAb: string): Promise<PickResult> {
    try {
      const res = await fetch("/api/draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teamAb }),
      });
      const data = await res.json();
      if (!data.ok) {
        fetchState(); // our view of who's on the clock may be stale — resync
        return { ok: false, error: data.error ?? "Couldn't submit that pick." };
      }
      setInit({ hydrated: true, picks: data.picks });
      setSelectedTeam(null);
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }
  }

  async function resetDraft(token: string) {
    await fetch("/api/draft/reset", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setSelectedTeam(null);
    await fetchState();
  }

  const value: DraftContextValue = {
    hydrated,
    picks,
    selectedTeam,
    takenAbs,
    currentPickIndex,
    currentPickNo,
    onClockManager,
    draftComplete,
    selectTeam,
    confirmPick,
    resetDraft,
    refetch: fetchState,
  };

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within DraftProvider");
  return ctx;
}
