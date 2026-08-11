"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/TeamLogo";
import { useAuth, useDraft } from "@/lib/store";
import { TEAM } from "@/lib/teams";
import { rostersFromPicks, totalWins } from "@/lib/draft";
import { MANAGER_NAMES } from "@/lib/managers";
import { useStandings, useSimulation } from "@/lib/live-data";

function fmtWins(w: number) {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { manager } = useAuth();
  const { picks } = useDraft();
  const { standings, loading, error } = useStandings();
  const { results: simResults } = useSimulation();

  const winPctByManager = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of simResults) out[r.manager] = r.winPct;
    return out;
  }, [simResults]);

  const rows = useMemo(() => {
    const rosters = rostersFromPicks(picks);
    return MANAGER_NAMES.map((name) => ({
      name,
      teams: rosters[name],
      wins: totalWins(rosters[name], standings),
    })).sort((a, b) => b.wins - a.wins || (winPctByManager[b.name] ?? 0) - (winPctByManager[a.name] ?? 0));
  }, [picks, standings, winPctByManager]);

  const undrafted = useMemo(() => {
    const takenAbs = new Set(picks.map((p) => p.teamAb));
    return Object.values(TEAM).filter((t) => !takenAbs.has(t.ab));
  }, [picks]);

  return (
    <>
      <div style={{ flex: "none", padding: "18px 20px 12px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: "1px solid var(--color-divider)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>Leaderboard</h4>
          <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
            {loading ? "Loading live standings…" : error ? "Standings unavailable" : "Live standings"} · 10 managers
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>Wins</div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "10px 14px 14px" }} className="scr">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r, idx) => {
            const mine = r.name === manager?.name;
            const winPct = winPctByManager[r.name];
            return (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  background: mine ? "var(--color-accent-900)" : "var(--color-surface)",
                  border: `1px solid ${mine ? "var(--color-accent-700)" : "var(--color-divider)"}`,
                }}
              >
                <div style={{ width: 18, fontFamily: "ui-monospace,monospace", fontSize: 14, color: idx === 0 ? "var(--color-accent-300)" : "var(--color-neutral-500)" }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name}
                      {mine && " (you)"}
                    </div>
                    {winPct !== undefined && (
                      <div style={{ fontSize: 10.5, color: "var(--color-accent-400)" }}>
                        {winPct >= 1 ? winPct.toFixed(1) : winPct.toFixed(2)}% win prob
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flex: "none" }}>
                    {r.teams.map((ab) => (
                      <div
                        key={ab}
                        onClick={() => router.push(`/team/${ab}`)}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}
                      >
                        <TeamLogo ab={ab} size={26} />
                        <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 10, color: "var(--color-neutral-400)" }}>
                          {fmtWins(standings[ab] ? standings[ab].wins + standings[ab].ties * 0.5 : 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 500, color: mine ? "var(--color-accent-200)" : "var(--color-text)" }}>
                  {fmtWins(r.wins)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.5, color: "var(--color-neutral-600)" }}>
          Ties count half.{" "}
          {undrafted.length > 0 &&
            `${undrafted.map((t) => t.city).join(" and ")} went undrafted — ${undrafted.length === 1 ? "its" : "their"} wins belong to nobody, which feels correct.`}
        </div>
      </div>
    </>
  );
}
