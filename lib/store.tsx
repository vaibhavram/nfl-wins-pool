"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DRAFT_ORDER, TOTAL_PICKS, isDraftStale, type Pick } from "./draft";

const AUTH_KEY = "nfl-pool-auth";
const DRAFT_KEY = "nfl-pool-draft";

// ─────────────────────────────────────────── Auth ───────────────────────────────────────────

export type Manager = { name: string };

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
    const found: Manager = { name: data.name };
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
  confirmPick: (manager: string, teamAb: string) => void;
  resetDraft: () => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [{ hydrated, picks }, setInit] = useState<{ hydrated: boolean; picks: Pick[] }>({
    hydrated: false,
    picks: [],
  });
  const setPicks = (updater: Pick[] | ((prev: Pick[]) => Pick[])) =>
    setInit((s) => ({ ...s, picks: typeof updater === "function" ? updater(s.picks) : updater }));
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(DRAFT_KEY);
    let restored: Pick[] = [];
    if (saved) {
      try {
        restored = JSON.parse(saved);
      } catch {
        // ignore corrupt storage
      }
    }
    // The manager roster can change (names edited, a real number swapped in) after a draft was
    // already played; picks that no longer match who's actually on the clock are stale — drop them.
    if (isDraftStale(restored)) restored = [];
    // One-time hydration from localStorage; SSR has no window, so this can't be a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInit({ hydrated: true, picks: restored });
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(picks));
  }, [picks, hydrated]);

  const takenAbs = useMemo(() => new Set(picks.map((p) => p.teamAb)), [picks]);
  const currentPickIndex = picks.length < TOTAL_PICKS ? picks.length : -1;
  const currentPickNo = picks.length < TOTAL_PICKS ? picks.length + 1 : TOTAL_PICKS + 1;
  const onClockManager = currentPickIndex === -1 ? null : DRAFT_ORDER[currentPickIndex];
  const draftComplete = currentPickIndex === -1;

  function selectTeam(ab: string | null) {
    setSelectedTeam(ab);
  }

  function confirmPick(manager: string, teamAb: string) {
    setPicks((prev) => {
      if (prev.length >= TOTAL_PICKS) return prev;
      if (prev.some((p) => p.teamAb === teamAb)) return prev;
      return [...prev, { pickNo: prev.length + 1, manager, teamAb }];
    });
    setSelectedTeam(null);
  }

  function resetDraft() {
    setPicks([]);
    setSelectedTeam(null);
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
  };

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within DraftProvider");
  return ctx;
}
