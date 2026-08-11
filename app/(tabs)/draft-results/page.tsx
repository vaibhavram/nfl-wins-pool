"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/TeamLogo";
import { useAuth, useDraft } from "@/lib/store";
import { TEAM } from "@/lib/teams";
import { buildDraftOrder, TOTAL_PICKS } from "@/lib/draft";
import { ODDS_SOURCES, computeGrades } from "@/lib/odds-sources";

type RoundPick = { pickNo: number; manager: string; teamAb: string | null };

export default function DraftResultsPage() {
  const router = useRouter();
  const { manager } = useAuth();
  const { picks, order } = useDraft();
  const [view, setView] = useState<"picks" | "grades">("picks");

  const draftOrder30 = useMemo(() => buildDraftOrder(order), [order]);

  const rounds = useMemo(() => {
    const perRound = 10;
    const out: { round: number; picks: RoundPick[] }[] = [];
    for (let r = 0; r < 3; r++) {
      const roundPicks: RoundPick[] = [];
      for (let i = 0; i < perRound; i++) {
        const pickNo = r * perRound + i + 1;
        const pick = picks.find((p) => p.pickNo === pickNo);
        roundPicks.push({ pickNo, manager: draftOrder30[pickNo - 1] ?? "", teamAb: pick?.teamAb ?? null });
      }
      out.push({ round: r + 1, picks: roundPicks });
    }
    return out;
  }, [picks, draftOrder30]);

  const grades = useMemo(() => computeGrades(picks), [picks]);

  return (
    <>
      <div style={{ flex: "none", padding: "18px 20px 12px", borderBottom: "1px solid var(--color-divider)" }}>
        <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>Draft results</h4>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
          {picks.length} of {TOTAL_PICKS} picks · Bill Simmons method
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "14px" }} className="scr">
        <div style={{ display: "inline-flex", marginBottom: 14, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          {(["picks", "grades"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "7px 14px",
                fontSize: 12.5,
                fontFamily: "var(--font-heading)",
                fontWeight: 500,
                background: view === v ? "var(--color-accent-900)" : "transparent",
                color: view === v ? "var(--color-accent-200)" : "var(--color-neutral-500)",
              }}
            >
              {v === "picks" ? "Picks" : "Grades"}
            </button>
          ))}
        </div>

        {view === "grades" ? (
          <div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--color-neutral-600)", marginBottom: 12 }}>
              Each manager&apos;s drafted teams&apos; preseason win-total lines, summed per source.
            </div>
            <div
              style={{
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                background: "var(--color-surface)",
              }}
            >
              <div style={{ overflowX: "auto" }} className="scr">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed", minWidth: 320 }}>
                  <colgroup>
                    <col style={{ width: 84 }} />
                    {ODDS_SOURCES.map((s) => (
                      <col key={s} style={{ width: 44 }} />
                    ))}
                    <col style={{ width: 54 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: "var(--color-neutral-900)" }}>
                      <th style={{ textAlign: "left", padding: "8px 4px 8px 12px", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontFamily: "var(--font-heading)", color: "var(--color-neutral-500)", borderBottom: "1px solid var(--color-divider)" }}>
                        Manager
                      </th>
                      {ODDS_SOURCES.map((s) => (
                        <th
                          key={s}
                          style={{ textAlign: "right", padding: "8px 4px", fontSize: 10.5, letterSpacing: ".04em", textTransform: "uppercase", fontFamily: "var(--font-heading)", color: "var(--color-neutral-500)", whiteSpace: "nowrap", borderBottom: "1px solid var(--color-divider)" }}
                        >
                          {s === "DraftKings" ? "DK" : s === "BetMGM" ? "MGM" : s}
                        </th>
                      ))}
                      <th style={{ textAlign: "right", padding: "8px 12px 8px 4px", fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", fontFamily: "var(--font-heading)", color: "var(--color-neutral-500)", borderBottom: "1px solid var(--color-divider)" }}>
                        Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((g, i) => {
                      const isMine = g.manager === manager?.name;
                      const isLeader = i === 0;
                      const isLast = i === grades.length - 1;
                      return (
                        <tr
                          key={g.manager}
                          style={{
                            background: isMine ? "var(--color-accent-900)" : "transparent",
                            borderBottom: isLast ? "none" : "1px solid var(--color-divider)",
                          }}
                        >
                          <td style={{ padding: "9px 4px 9px 12px" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                              <span style={{ flex: "none", fontFamily: "ui-monospace,monospace", fontSize: 11, color: isLeader ? "var(--color-accent-300)" : "var(--color-neutral-600)" }}>
                                {i + 1}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  color: isMine ? "var(--color-accent-200)" : "var(--color-text)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {g.manager}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                              {g.teams.map((ab) => (
                                <TeamLogo key={ab} ab={ab} size={15} />
                              ))}
                            </div>
                          </td>
                          {ODDS_SOURCES.map((s) => (
                            <td key={s} style={{ textAlign: "right", padding: "9px 4px", fontFamily: "ui-monospace,monospace", fontSize: 12, color: "var(--color-neutral-400)" }}>
                              {g.bySource[s]}
                            </td>
                          ))}
                          <td style={{ textAlign: "right", padding: "9px 12px 9px 4px" }}>
                            <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 600, color: isLeader ? "var(--color-accent-300)" : "var(--color-accent-400)" }}>
                              {g.avg.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          rounds.map((rnd) => (
            <div key={rnd.round} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 8 }}>
                Round {rnd.round}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rnd.picks.map((p) => {
                  const team = p.teamAb ? TEAM[p.teamAb] : null;
                  const mine = p.manager === manager?.name;
                  return (
                    <div
                      key={p.pickNo}
                      onClick={p.teamAb ? () => router.push(`/team/${p.teamAb}`) : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 12px",
                        borderRadius: "var(--radius-md)",
                        background: mine ? "var(--color-accent-900)" : "var(--color-surface)",
                        border: `1px solid ${mine ? "var(--color-accent-700)" : "var(--color-divider)"}`,
                        cursor: p.teamAb ? "pointer" : "default",
                      }}
                    >
                      <div style={{ flex: "none", width: 20, fontFamily: "ui-monospace,monospace", fontSize: 11, color: "var(--color-neutral-600)" }}>
                        {p.pickNo}
                      </div>
                      {team ? <TeamLogo ab={p.teamAb!} size={30} /> : <div style={{ width: 30, height: 30, flex: "none" }} />}
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                        <div style={{ fontSize: 13.5, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {team ? team.full : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: mine ? "var(--color-accent-300)" : "var(--color-neutral-500)" }}>
                          {p.manager}
                          {mine ? " (you)" : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
