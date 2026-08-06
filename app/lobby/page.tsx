"use client";

import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth, useDraft } from "@/lib/store";
import { MANAGER_NAMES } from "@/lib/managers";
import { DRAFT_ORDER } from "@/lib/draft";

function pickNumbersFor(name: string): number[] {
  return DRAFT_ORDER.reduce<number[]>((acc, mgr, i) => {
    if (mgr === name) acc.push(i + 1);
    return acc;
  }, []);
}

function LobbyContent() {
  const router = useRouter();
  const { manager, signOut } = useAuth();
  const { picks, draftComplete, resetDraft } = useDraft();

  const ctaLabel = draftComplete ? "See the leaderboard" : picks.length > 0 ? "Resume the draft" : "Start the draft";

  function onCta() {
    router.push(draftComplete ? "/leaderboard" : "/draft");
  }

  function onReset() {
    if (window.confirm("Reset the draft? Every pick made so far will be cleared for everyone.")) {
      resetDraft();
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
          Each draft position below gets 3 picks, spread across the board (e.g. 1st, 20th, and 26th overall) instead of a
          straight snake — so no position is systematically stronger.
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 16px" }} className="scr">
        <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 8 }}>
          Round 1 order
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MANAGER_NAMES.map((name, i) => {
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
                <div style={{ fontSize: 11.5, color: "var(--color-accent-300)" }}>Ready</div>
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
        <button className="btn btn-primary btn-block" style={{ minHeight: 48, fontSize: 15, marginTop: 0 }} onClick={onCta}>
          {ctaLabel}
        </button>
        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          {picks.length > 0 && (
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
