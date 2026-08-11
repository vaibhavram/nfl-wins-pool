"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/TeamLogo";
import { useAuth, useDraft } from "@/lib/store";
import { TEAM } from "@/lib/teams";
import { buildDraftOrder, TOTAL_PICKS } from "@/lib/draft";

type RoundPick = { pickNo: number; manager: string; teamAb: string | null };

export default function DraftResultsPage() {
  const router = useRouter();
  const { manager } = useAuth();
  const { picks, order } = useDraft();

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

  return (
    <>
      <div style={{ flex: "none", padding: "18px 20px 12px", borderBottom: "1px solid var(--color-divider)" }}>
        <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>Draft results</h4>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
          {picks.length} of {TOTAL_PICKS} picks · Bill Simmons method
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "14px" }} className="scr">
        {rounds.map((rnd) => (
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
                      <div style={{ fontSize: 11, color: mine ? "var(--color-accent-300)" : "var(--color-neutral-500)" }}>
                        {p.manager}
                        {mine ? " (you)" : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
