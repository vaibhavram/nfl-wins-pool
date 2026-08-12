"use client";

import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/TeamLogo";
import { TEAM } from "@/lib/teams";
import { totalWins } from "@/lib/draft";
import { useStandings } from "@/lib/live-data";
import { usePoolSimulation } from "@/lib/client/pool-live-data";
import { formatWinPct } from "@/lib/format";

function fmtWins(w: number) {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

/** A manager's 3 drafted teams, with live/projected wins and pool win probability. Shared by
 * the "My teams" tab (viewing yourself) and /manager/[userId] (viewing anyone) so the two can
 * never drift out of sync with each other. */
export function ManagerRoster({ slug, userId, teams, title }: { slug: string; userId: string; teams: string[]; title: string }) {
  const router = useRouter();
  const { standings, loading } = useStandings();
  const { results: simResults } = usePoolSimulation(slug);

  const wins = totalWins(teams, standings);
  const sim = simResults.find((r) => r.manager === userId);

  return (
    <>
      <div style={{ flex: "none", padding: "18px 20px 12px", borderBottom: "1px solid var(--color-divider)" }}>
        <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>{title}</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 3 }}>
          <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
            {loading ? "Loading live wins…" : `${fmtWins(wins)} combined wins`}
          </div>
          {sim && (
            <div style={{ fontSize: 12.5, color: "var(--color-accent-400)" }}>
              {fmtWins(sim.avgWins)} projected wins · {formatWinPct(sim.winPct)}% win prob
            </div>
          )}
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
                onClick={() => router.push(`/p/${slug}/team/${ab}`)}
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
                  <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
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
