"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { TeamLogo } from "@/components/TeamLogo";
import { useAuth, useDraft } from "@/lib/store";
import { TEAM } from "@/lib/teams";
import { rostersFromPicks, totalWins } from "@/lib/draft";
import { MANAGER_NAMES } from "@/lib/managers";
import { useStandings, useSimulation } from "@/lib/live-data";

function fmtWins(w: number) {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

function ManagerTeamsContent() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const { manager } = useAuth();
  const { picks } = useDraft();
  const { standings, loading } = useStandings();
  const { results: simResults } = useSimulation();

  const name = decodeURIComponent(params.name);
  const isValidManager = MANAGER_NAMES.includes(name);
  const teams = useMemo(() => (isValidManager ? (rostersFromPicks(picks)[name] ?? []) : []), [picks, name, isValidManager]);
  const wins = totalWins(teams, standings);
  const winPct = simResults.find((r) => r.manager === name)?.winPct;
  const mine = name === manager?.name;

  if (!isValidManager) {
    return (
      <div className="app-shell" style={{ padding: 28 }}>
        <p>Unknown manager &ldquo;{params.name}&rdquo;.</p>
        <button className="btn btn-ghost" onClick={() => router.back()}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div style={{ padding: "16px 16px 0" }}>
        <button className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14 }} onClick={() => router.back()}>
          ← Back
        </button>
      </div>
      <div style={{ flex: "none", padding: "8px 20px 14px", borderBottom: "1px solid var(--color-divider)" }}>
        <h4 style={{ margin: 0, fontSize: 20, color: "var(--color-text)" }}>
          {name}
          {mine && " (you)"}
        </h4>
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
          {loading ? "Loading live wins…" : `${fmtWins(wins)} combined wins`}
          {winPct !== undefined && ` · ${winPct >= 1 ? winPct.toFixed(1) : winPct.toFixed(2)}% win prob`}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "14px" }} className="scr">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {teams.map((ab) => {
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
                <TeamLogo ab={ab} size={44} />
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
    </div>
  );
}

export default function ManagerTeamsPage() {
  return (
    <RequireAuth>
      <ManagerTeamsContent />
    </RequireAuth>
  );
}
