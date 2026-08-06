"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { TeamChip } from "@/components/TeamChip";
import { useAuth, useDraft } from "@/lib/store";
import { TEAM } from "@/lib/teams";
import { rostersFromPicks, totalWins } from "@/lib/draft";
import { useStandings } from "@/lib/live-data";

function fmtWins(w: number) {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

export default function MyTeamsPage() {
  const router = useRouter();
  const { manager } = useAuth();
  const { picks } = useDraft();
  const { standings, loading } = useStandings();

  const myTeams = useMemo(() => {
    if (!manager) return [];
    return rostersFromPicks(picks)[manager.name] ?? [];
  }, [picks, manager]);

  const wins = totalWins(myTeams, standings);

  return (
    <>
      <div style={{ flex: "none", padding: "18px 20px 12px", borderBottom: "1px solid var(--color-divider)" }}>
        <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>My teams</h4>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
          {loading ? "Loading live wins…" : `${fmtWins(wins)} combined wins`}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "14px" }} className="scr">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myTeams.map((ab) => {
            const team = TEAM[ab];
            const rec = standings[ab];
            return (
              <div
                key={ab}
                onClick={() => router.push(`/team/${ab}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-sm)",
                  cursor: "pointer",
                }}
              >
                <TeamChip ab={ab} size={44} fontSize={12} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontSize: 15, color: "var(--color-text)" }}>{team.full}</div>
                  <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
                    {team.div} · O/U {team.ou.toFixed(1)}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, color: "var(--color-text)" }}>
                  {rec ? fmtWins(rec.wins + rec.ties * 0.5) : "–"}
                </div>
                <div style={{ fontSize: 16, color: "var(--color-neutral-600)" }}>›</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
