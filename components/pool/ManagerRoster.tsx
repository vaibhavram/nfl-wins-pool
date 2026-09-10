"use client";

import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/TeamLogo";
import { SettingsGearLink } from "@/components/pool/SettingsGearLink";
import { PoolSwitcher } from "@/components/pool/PoolSwitcher";
import { TEAM } from "@/lib/teams";
import { totalWins, TOTAL_PICKS } from "@/lib/draft";
import { useStandings, useWeek, useProjectedWins } from "@/lib/live-data";
import { usePoolSimulation } from "@/lib/client/pool-live-data";
import { formatWinPct, formatWins as fmtWins } from "@/lib/format";

/** A manager's 3 drafted teams, with live/projected wins and pool win probability. Shared by
 * the "My teams" tab (viewing yourself) and /manager/[userId] (viewing anyone) so the two can
 * never drift out of sync with each other. */
export function ManagerRoster({
  slug,
  poolName,
  userId,
  teams,
  draftReceipt,
  title,
  isCommissioner,
}: {
  slug: string;
  poolName: string;
  userId: string;
  teams: string[];
  draftReceipt: { teamAb: string; pickNo: number }[];
  title: string;
  isCommissioner: boolean;
}) {
  const router = useRouter();
  const { standings, loading } = useStandings();
  const { results: simResults } = usePoolSimulation(slug);
  const { week } = useWeek(null);
  const { projectedWins } = useProjectedWins();

  const wins = totalWins(teams, standings);
  const sim = simResults.find((r) => r.manager === userId);

  // Any of this manager's teams currently mid-game, keyed by ab -- live score, opponent, and
  // ESPN's own clock/quarter text, for a badge distinct from the season W-L record above it.
  const liveByTeam: Record<string, { myScore: number; oppAb: string; oppScore: number; statusDetail: string }> = {};
  for (const g of week?.games ?? []) {
    if (g.state !== "in") continue;
    if (teams.includes(g.away)) liveByTeam[g.away] = { myScore: g.awayScore ?? 0, oppAb: g.home, oppScore: g.homeScore ?? 0, statusDetail: g.statusDetail };
    if (teams.includes(g.home)) liveByTeam[g.home] = { myScore: g.homeScore ?? 0, oppAb: g.away, oppScore: g.awayScore ?? 0, statusDetail: g.statusDetail };
  }

  return (
    <>
      <div style={{ flex: "none", padding: "12px 20px 0" }}>
        <PoolSwitcher slug={slug} poolName={poolName} />
      </div>
      <div style={{ flex: "none", padding: "10px 20px 12px", borderBottom: "1px solid var(--color-divider)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h4 style={{ margin: 0, fontSize: 19, color: "var(--color-text)" }}>{title}</h4>
          <SettingsGearLink slug={slug} isCommissioner={isCommissioner} />
        </div>
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
            const live = liveByTeam[ab];
            return (
              <div
                key={ab}
                onClick={() => router.push(`/p/${slug}/team/${ab}`)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: live ? 8 : 0,
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-sm)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <TeamLogo ab={ab} size={44} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontSize: 15, color: "var(--color-text)" }}>{team.full}</div>
                    <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
                      {team.div}
                      {projectedWins[ab] !== undefined && ` · Projected ${fmtWins(projectedWins[ab])} wins`}
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: 20, color: "var(--color-text)" }}>
                    {rec ? `${rec.wins}–${rec.losses}${rec.ties ? `–${rec.ties}` : ""}` : "–"}
                  </div>
                  <div style={{ fontSize: 16, color: "var(--color-neutral-600)" }}>›</div>
                </div>
                {live && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--color-accent-900)",
                      border: "1px solid var(--color-accent-700)",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--color-accent-300)", letterSpacing: ".04em", textTransform: "uppercase" }}>
                      ● Live
                    </span>
                    <span style={{ color: "var(--color-neutral-400)" }}>{live.statusDetail}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontFamily: "ui-monospace,monospace", color: "var(--color-text)" }}>
                      {ab} {live.myScore} – {live.oppScore} {live.oppAb}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {draftReceipt.length > 0 && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
              Draft receipt
            </div>
            <div
              style={{
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-surface)",
                overflow: "hidden",
              }}
            >
              {[...draftReceipt]
                .sort((a, b) => a.pickNo - b.pickNo)
                .map((p, i, arr) => {
                  const team = TEAM[p.teamAb];
                  const round = Math.floor((p.pickNo - 1) / 10) + 1;
                  return (
                    <div
                      key={p.pickNo}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderBottom: i < arr.length - 1 ? "1px solid var(--color-divider)" : "none",
                      }}
                    >
                      <TeamLogo ab={p.teamAb} size={22} />
                      <div style={{ flex: 1, fontSize: 13.5, color: "var(--color-text)" }}>{team?.full ?? p.teamAb}</div>
                      <div style={{ fontSize: 12, fontFamily: "ui-monospace,monospace", color: "var(--color-neutral-500)" }}>
                        Round {round} · Pick {p.pickNo} of {TOTAL_PICKS}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
