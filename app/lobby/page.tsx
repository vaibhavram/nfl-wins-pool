"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth, useDraft } from "@/lib/store";
import { COMMISSIONER, isCommissioner } from "@/lib/managers";
import { buildDraftOrder } from "@/lib/draft";
import { usePresence } from "@/lib/live-data";

function LobbyContent() {
  const router = useRouter();
  const { manager, signOut } = useAuth();
  const { picks, started, order, draftComplete, startDraft, resetDraft } = useDraft();
  const online = usePresence();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iAmCommissioner = isCommissioner(manager?.name);

  const draftOrder30 = useMemo(() => buildDraftOrder(order), [order]);
  function pickNumbersFor(name: string): number[] {
    return draftOrder30.reduce<number[]>((acc, mgr, i) => {
      if (mgr === name) acc.push(i + 1);
      return acc;
    }, []);
  }

  async function onStart() {
    if (!manager) return;
    setBusy(true);
    setError(null);
    const result = await startDraft(manager.token);
    setBusy(false);
    if (result.ok) router.push("/draft");
    else setError(result.error);
  }

  function onResume() {
    router.push(draftComplete ? "/leaderboard" : "/draft");
  }

  function onReset() {
    if (!manager) return;
    if (window.confirm("Reset the draft? Every pick made so far will be cleared for everyone.")) {
      resetDraft(manager.token);
    }
  }

  return (
    <div className="app-shell" style={{ padding: "0 0 0" }}>
      <div style={{ padding: "20px 20px 4px", display: "flex", flexDirection: "column", gap: 3 }}>
        <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>Draft lobby</h4>
        <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
          3 rounds · 10 managers · signed in as {manager?.name}
        </div>
      </div>
      <div
        style={{
          margin: "12px 20px 14px",
          padding: 14,
          borderRadius: "var(--radius-md)",
          background: "var(--color-accent-900)",
          border: "1px solid var(--color-accent-700)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent-300)" }}>
          Draft order
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--color-accent-200)" }}>
          Each draft position below gets 3 picks, spread across the board (e.g. 1st, 28th, and 30th overall) instead of a
          straight snake — so no position is systematically stronger.
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 16px" }} className="scr">
        <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 8 }}>
          Round 1 order
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {order.map((name, i) => {
            const isMe = name === manager?.name;
            return (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 12px",
                  borderRadius: "var(--radius-md)",
                  background: isMe ? "var(--color-accent-900)" : "var(--color-surface)",
                  border: isMe ? "1px solid var(--color-accent-700)" : "1px solid transparent",
                  boxShadow: isMe ? "none" : "var(--shadow-sm)",
                }}
              >
                <div style={{ width: 22, fontFamily: "ui-monospace,monospace", fontSize: 13, color: isMe ? "var(--color-accent-400)" : "var(--color-neutral-500)" }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: isMe ? "var(--color-accent-200)" : "var(--color-text)" }}>
                    {name} {isMe && "(you)"}
                  </div>
                  <div style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: isMe ? "var(--color-accent-400)" : "var(--color-neutral-500)" }}>
                    Picks {pickNumbersFor(name).join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: online.has(name) ? "var(--color-accent)" : "var(--color-neutral-700)",
                    }}
                  />
                  <div style={{ fontSize: 11.5, color: online.has(name) ? "var(--color-accent-300)" : "var(--color-neutral-600)" }}>
                    {online.has(name) ? "Signed in" : "Offline"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          flex: "none",
          padding: "12px 20px 30px",
          borderTop: "1px solid var(--color-divider)",
          background: "var(--color-bg)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {started || draftComplete ? (
          <button className="btn btn-primary btn-block" style={{ minHeight: 48, fontSize: 15, marginTop: 0 }} onClick={onResume}>
            {draftComplete ? "See the leaderboard" : "Resume the draft"}
          </button>
        ) : iAmCommissioner ? (
          <button className="btn btn-primary btn-block" style={{ minHeight: 48, fontSize: 15, marginTop: 0 }} onClick={onStart} disabled={busy}>
            {busy ? "Starting…" : "Start the draft"}
          </button>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "13px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-divider)",
              fontSize: 14,
              color: "var(--color-neutral-500)",
            }}
          >
            Waiting for {COMMISSIONER} to start the draft
          </div>
        )}
        {error && <div style={{ fontSize: 12.5, color: "var(--color-accent-300)", textAlign: "center" }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          {iAmCommissioner && (started || picks.length > 0) && (
            <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={onReset}>
              Reset draft
            </button>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LobbyPage() {
  return (
    <RequireAuth>
      <LobbyContent />
    </RequireAuth>
  );
}
