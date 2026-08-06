"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { TeamLogo } from "@/components/TeamLogo";
import { useAuth, useDraft } from "@/lib/store";
import { TEAMS } from "@/lib/teams";
import { COMMISSIONER } from "@/lib/managers";
import { buildDraftOrder, TOTAL_PICKS } from "@/lib/draft";

function formatRemaining(deadline: string | null, now: number): string | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return "moments";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function DraftContent() {
  const router = useRouter();
  const { manager } = useAuth();
  const {
    hydrated,
    started,
    picks,
    order,
    deadline,
    selectedTeam,
    takenAbs,
    currentPickNo,
    onClockManager,
    draftComplete,
    selectTeam,
    confirmPick,
  } = useDraft();

  const myTurn = !draftComplete && onClockManager === manager?.name;
  const [pickError, setPickError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sortMode, setSortMode] = useState<"alpha" | "ou">("alpha");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const draftOrder30 = useMemo(() => buildDraftOrder(order), [order]);
  const round = draftComplete ? 3 : Math.floor((currentPickNo - 1) / 10) + 1;
  const nextManager = !draftComplete && currentPickNo < TOTAL_PICKS ? draftOrder30[currentPickNo] : null;
  const remaining = formatRemaining(deadline, now);

  const sortedTeams = useMemo(() => {
    const list = hideDrafted ? TEAMS.filter((t) => !takenAbs.has(t.ab)) : TEAMS;
    return [...list].sort((a, b) =>
      sortMode === "ou" ? b.ou - a.ou || a.city.localeCompare(b.city) : a.city.localeCompare(b.city),
    );
  }, [sortMode, hideDrafted, takenAbs]);

  async function onDraft(teamAb: string) {
    if (!manager) return;
    setSubmitting(true);
    setPickError(null);
    const result = await confirmPick(manager.token, teamAb);
    setSubmitting(false);
    if (!result.ok) setPickError(result.error);
  }

  // Direct-URL edge case: someone visits /draft before the commissioner has started it.
  // Gated on `hydrated` so this doesn't flash for a moment on every load before the first fetch resolves.
  if (hydrated && !started && !draftComplete) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center", gap: 14, padding: 28, textAlign: "center" }}>
        <h3 style={{ margin: 0 }}>Not started yet</h3>
        <p style={{ margin: 0, color: "var(--color-neutral-500)", maxWidth: "32ch" }}>
          Waiting for {COMMISSIONER} to start the draft.
        </p>
        <button className="btn btn-secondary" onClick={() => router.push("/lobby")}>
          Back to lobby
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div style={{ flex: "none", padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: 9, borderBottom: "1px solid var(--color-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-500)" }}>
            Round {round} · Pick {currentPickNo} of {TOTAL_PICKS}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>{32 - TOTAL_PICKS} teams go undrafted</div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: myTurn ? "var(--color-accent-900)" : "var(--color-surface)",
            border: myTurn ? "1px solid var(--color-accent)" : "1px solid var(--color-divider)",
            boxShadow: myTurn ? "0 0 24px rgba(145,132,217,.22)" : "none",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: myTurn ? "var(--color-accent)" : "var(--color-neutral-600)",
              flex: "none",
              animation: myTurn ? "pulse-dot 1.4s ease-in-out infinite" : "none",
            }}
          />
          <div style={{ flex: 1, fontSize: 14.5, fontFamily: "var(--font-heading)", fontWeight: 500, color: myTurn ? "var(--color-accent-200)" : "var(--color-text)" }}>
            {myTurn ? "You're on the clock" : `Waiting on ${onClockManager}`}
          </div>
          {nextManager && <div style={{ fontSize: 11.5, color: "var(--color-accent-400)" }}>{nextManager} is next</div>}
        </div>
        {remaining && !draftComplete && (
          <div style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--color-neutral-500)" }}>
            {myTurn
              ? `Pick whenever you're ready — after ${remaining}, the highest O/U team gets drafted for you automatically.`
              : `Auto-picks for ${onClockManager} in ${remaining} if they haven't picked by then.`}
          </div>
        )}
        {pickError && (
          <div style={{ fontSize: 12.5, color: "var(--color-accent-300)", background: "var(--color-accent-900)", border: "1px solid var(--color-accent-700)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
            {pickError}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }} className="scr">
          {draftOrder30.map((mgr, i) => {
            const pick = picks[i];
            const isOnClock = i === currentPickNo - 1;
            const isMine = mgr === manager?.name;
            return (
              <div
                key={i}
                style={{
                  flex: "none",
                  width: 60,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  padding: "7px 4px",
                  borderRadius: "var(--radius-sm)",
                  background: isOnClock ? "var(--color-accent-900)" : isMine ? "var(--color-accent-900)" : pick ? "var(--color-neutral-900)" : "transparent",
                  border: `1px solid ${isOnClock ? "var(--color-accent)" : isMine ? "var(--color-accent-700)" : pick ? "var(--color-divider)" : "var(--color-neutral-900)"}`,
                }}
              >
                <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 9.5, color: "var(--color-neutral-600)" }}>#{i + 1}</div>
                {pick ? (
                  <TeamLogo ab={pick.teamAb} size={26} />
                ) : (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: isOnClock ? "var(--color-accent-200)" : "var(--color-neutral-700)",
                    }}
                  >
                    {isOnClock ? "NOW" : "—"}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 9.5,
                    color: isMine ? "var(--color-accent-200)" : pick ? "var(--color-neutral-400)" : "var(--color-neutral-500)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 52,
                  }}
                >
                  {mgr}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "10px 14px 12px" }} className="scr">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Sort by</div>
            <div style={{ display: "inline-flex", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
              {(["alpha", "ou"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "5px 10px",
                    fontSize: 11,
                    fontFamily: "var(--font-body)",
                    background: sortMode === mode ? "var(--color-accent-900)" : "transparent",
                    color: sortMode === mode ? "var(--color-accent-200)" : "var(--color-neutral-500)",
                  }}
                >
                  {mode === "alpha" ? "A–Z" : "O/U"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setHideDrafted((v) => !v)}
              style={{
                border: `1px solid ${hideDrafted ? "var(--color-accent)" : "var(--color-divider)"}`,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "var(--font-body)",
                background: hideDrafted ? "var(--color-accent-900)" : "transparent",
                color: hideDrafted ? "var(--color-accent-200)" : "var(--color-neutral-500)",
              }}
            >
              Hide drafted
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sortedTeams.map((tm) => {
            const isTaken = takenAbs.has(tm.ab);
            const takenBy = isTaken ? picks.find((p) => p.teamAb === tm.ab)?.manager : null;
            const isSel = selectedTeam === tm.ab;
            const clickable = myTurn && !isTaken;
            return (
              <div
                key={tm.ab}
                onClick={clickable ? () => selectTeam(isSel ? null : tm.ab) : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 12px",
                  borderRadius: "var(--radius-md)",
                  cursor: clickable ? "pointer" : "default",
                  background: isSel ? "var(--color-accent-900)" : "var(--color-surface)",
                  border: `1px solid ${isSel ? "var(--color-accent)" : "var(--color-divider)"}`,
                  opacity: isTaken ? 0.55 : 1,
                }}
              >
                <TeamLogo ab={tm.ab} size={52} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 15, color: isTaken ? "var(--color-neutral-500)" : "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tm.full}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
                    {tm.div} · O/U{" "}
                    <span style={{ fontFamily: "ui-monospace,monospace", color: tm.ou >= 10 ? "var(--color-accent-300)" : "var(--color-neutral-400)" }}>{tm.ou.toFixed(1)}</span>
                  </div>
                </div>
                {isTaken ? (
                  <div
                    style={{
                      flex: "none",
                      fontSize: 10.5,
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                      color: "var(--color-neutral-300)",
                      background: "var(--color-neutral-800)",
                      borderRadius: 4,
                      padding: "3px 8px",
                    }}
                  >
                    {takenBy}
                  </div>
                ) : (
                  isSel && (
                    <button
                      className="btn btn-primary"
                      style={{ flex: "none", minHeight: 36, paddingInline: 16, fontSize: 13 }}
                      disabled={submitting}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDraft(tm.ab);
                      }}
                    >
                      {submitting ? "Drafting…" : "Draft"}
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DraftPage() {
  return (
    <RequireAuth requireDraftComplete={false}>
      <DraftContent />
    </RequireAuth>
  );
}
