"use client";

import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { TeamChip } from "@/components/TeamChip";
import { useDraft } from "@/lib/store";
import { TEAM } from "@/lib/teams";
import { useStandings, useTeamSchedule } from "@/lib/live-data";
import { formatKickoff } from "@/lib/format";

function TeamDetailContent() {
  const router = useRouter();
  const params = useParams<{ abbr: string }>();
  const { picks } = useDraft();
  const ab = params.abbr.toUpperCase();
  const team = TEAM[ab];
  const owner = picks.find((p) => p.teamAb === ab)?.manager;

  const { standings } = useStandings();
  const { schedule, loading, error } = useTeamSchedule(team ? ab : null);
  const rec = standings[ab];

  if (!team) {
    return (
      <div className="app-shell" style={{ padding: 28 }}>
        <p>Unknown team &ldquo;{params.abbr}&rdquo;.</p>
        <button className="btn btn-ghost" onClick={() => router.back()}>
          ← Back
        </button>
      </div>
    );
  }

  const played = rec ? rec.wins + rec.losses + rec.ties : 0;

  return (
    <div className="app-shell">
      <div style={{ padding: "16px 16px 0" }}>
        <button className="btn btn-ghost" style={{ paddingLeft: 0, fontSize: 14 }} onClick={() => router.back()}>
          ← Back
        </button>
      </div>
      <div style={{ flex: "none", padding: "8px 20px 14px", borderBottom: "1px solid var(--color-divider)", display: "flex", alignItems: "center", gap: 14 }}>
        <TeamChip ab={team.ab} size={54} fontSize={14} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <h4 style={{ margin: 0, fontSize: 20, color: "var(--color-text)" }}>{team.full}</h4>
          <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
            {team.div} · O/U {team.ou.toFixed(1)} {owner && `· ${owner}'s team`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 26, color: "var(--color-text)" }}>
            {rec ? `${rec.wins}–${rec.losses}${rec.ties ? `–${rec.ties}` : ""}` : "–"}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--color-neutral-500)" }}>{18 - played} to play</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "10px 14px 14px" }} className="scr">
        <div style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 8 }}>
          Live schedule
        </div>
        {loading && <div style={{ fontSize: 13, color: "var(--color-neutral-500)" }}>Loading…</div>}
        {error && <div style={{ fontSize: 13, color: "var(--color-neutral-500)" }}>Couldn&apos;t load this team&apos;s schedule.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(schedule ?? []).map((g) => {
            const bye = g.at === "" && g.opponent === "Bye week";
            return (
              <div
                key={g.week}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 11px",
                  borderRadius: "var(--radius-md)",
                  background: bye ? "transparent" : "var(--color-surface)",
                  border: `1px solid ${bye ? "var(--color-neutral-900)" : "var(--color-divider)"}`,
                }}
              >
                <div style={{ width: 26, fontFamily: "ui-monospace,monospace", fontSize: 11.5, color: "var(--color-neutral-600)" }}>W{g.week}</div>
                <div style={{ width: 20, fontSize: 11, color: "var(--color-neutral-600)" }}>{g.at}</div>
                <div style={{ flex: 1, fontSize: 13.5, color: bye ? "var(--color-neutral-600)" : "var(--color-text)" }}>{g.opponent}</div>
                <div
                  style={{
                    width: 22,
                    fontFamily: "var(--font-heading)",
                    fontSize: 13,
                    color: g.result === "W" ? "var(--color-accent-300)" : g.result === "L" || g.result === "T" ? "var(--color-neutral-500)" : "transparent",
                  }}
                >
                  {g.result}
                </div>
                <div style={{ width: 62, textAlign: "right", fontFamily: "ui-monospace,monospace", fontSize: 11.5, color: "var(--color-neutral-500)" }}>
                  {g.result ? g.detail : g.date ? formatKickoff(g.date) : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  return (
    <RequireAuth>
      <TeamDetailContent />
    </RequireAuth>
  );
}
