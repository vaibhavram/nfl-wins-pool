"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/TeamLogo";
import { PoolTabBar } from "@/components/pool/PoolTabBar";
import { TEAM } from "@/lib/teams";
import { rostersFromPicks, type Pick } from "@/lib/draft";
import { useWeek } from "@/lib/live-data";
import type { WeekGame } from "@/lib/live-data";
import { formatKickoff, formatWinPct } from "@/lib/format";
import type { SeasonManager } from "@/lib/season-server";

export function ScheduleContent({
  slug,
  currentUserId,
  picks,
  managers,
}: {
  slug: string;
  currentUserId: string;
  picks: Pick[];
  managers: SeasonManager[];
}) {
  const router = useRouter();
  const [weekOverride, setWeekOverride] = useState<number | null>(null);
  const { week: data, loading, error } = useWeek(weekOverride);

  const nameByUserId = useMemo(() => Object.fromEntries(managers.map((m) => [m.userId, m.displayName])), [managers]);
  const owners: Record<string, string> = {};
  for (const p of picks) owners[p.teamAb] = nameByUserId[p.manager] ?? "Someone";

  const myTeams = useMemo(() => {
    const rosters = rostersFromPicks(picks, managers.map((m) => m.userId));
    return new Set(rosters[currentUserId] ?? []);
  }, [picks, managers, currentUserId]);

  const games = useMemo(() => {
    if (!data) return [];
    const isMine = (g: WeekGame) => myTeams.has(g.away) || myTeams.has(g.home);
    return [...data.games].sort((a, b) => {
      const mineDiff = Number(isMine(b)) - Number(isMine(a));
      if (mineDiff !== 0) return mineDiff;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [data, myTeams]);

  if (error) {
    return (
      <div className="app-shell">
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center", color: "var(--color-neutral-500)" }}>
          Couldn&apos;t load the schedule from ESPN right now.
        </div>
        <PoolTabBar slug={slug} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="app-shell">
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-neutral-500)" }}>Loading schedule…</div>
        <PoolTabBar slug={slug} />
      </div>
    );
  }

  const tag = data.week < data.currentWeek ? "Final" : data.week === data.currentWeek ? "This week" : "Upcoming";
  const weekTagColor = data.week < data.currentWeek ? "var(--color-neutral-500)" : "var(--color-accent-300)";
  const byeLine =
    data.byeTeams.length > 0
      ? `Bye: ${data.byeTeams.map((ab) => TEAM[ab]?.full ?? ab).join(", ")}.`
      : "No byes this week — all 32 teams play.";

  return (
    <div className="app-shell">
      <div style={{ flex: "none", padding: "10px 14px 12px", borderBottom: "1px solid var(--color-divider)", display: "flex", alignItems: "center", gap: 10 }}>
        <button
          className="btn btn-secondary btn-icon"
          style={{ flex: "none" }}
          disabled={data.week <= data.minWeek || loading}
          onClick={() => setWeekOverride(Math.max(data.minWeek, data.week - 1))}
        >
          ‹
        </button>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, color: "var(--color-text)" }}>Week {data.week}</div>
          <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: weekTagColor }}>{loading ? "Loading…" : tag}</div>
        </div>
        <button
          className="btn btn-secondary btn-icon"
          style={{ flex: "none" }}
          disabled={data.week >= data.maxWeek || loading}
          onClick={() => setWeekOverride(Math.min(data.maxWeek, data.week + 1))}
        >
          ›
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 12px 14px" }} className="scr">
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {games.map((g: WeekGame, i: number) => {
            const away = TEAM[g.away];
            const home = TEAM[g.home];
            const awayWon = g.completed && (g.awayScore ?? 0) > (g.homeScore ?? 0);
            const homeWon = g.completed && (g.homeScore ?? 0) > (g.awayScore ?? 0);
            const dim = "var(--color-neutral-600)";
            const mine = myTeams.has(g.away) || myTeams.has(g.home);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "9px 11px",
                  borderRadius: "var(--radius-md)",
                  background: mine ? "var(--color-accent-900)" : "var(--color-surface)",
                  border: `1px solid ${mine ? "var(--color-accent-700)" : "transparent"}`,
                  boxShadow: mine ? "none" : "var(--shadow-sm)",
                }}
              >
                <TeamRow
                  ab={g.away}
                  name={away?.full ?? g.away}
                  owner={owners[g.away]}
                  winProb={1 - g.homeWinProb}
                  score={g.completed ? String(g.awayScore) : ""}
                  textColor={g.completed ? (awayWon ? "var(--color-text)" : dim) : "var(--color-text)"}
                  onOwnerClick={() => router.push(`/p/${slug}/team/${g.away}`)}
                />
                <TeamRow
                  ab={g.home}
                  name={home?.full ?? g.home}
                  owner={owners[g.home]}
                  winProb={g.homeWinProb}
                  score={g.completed ? String(g.homeScore) : ""}
                  textColor={g.completed ? (homeWon ? "var(--color-text)" : dim) : "var(--color-text)"}
                  onOwnerClick={() => router.push(`/p/${slug}/team/${g.home}`)}
                />
                <div style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-neutral-600)", borderTop: "1px solid var(--color-divider)", paddingTop: 5 }}>
                  {g.completed ? "Final" : formatKickoff(g.date)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--color-neutral-600)" }}>{byeLine}</div>
      </div>
      <PoolTabBar slug={slug} />
    </div>
  );
}

function TeamRow({
  ab,
  name,
  owner,
  winProb,
  score,
  textColor,
  onOwnerClick,
}: {
  ab: string;
  name: string;
  owner: string | undefined;
  winProb: number;
  score: string;
  textColor: string;
  onOwnerClick: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <TeamLogo ab={ab} size={26} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", cursor: "pointer" }} onClick={onOwnerClick}>
        <div style={{ fontSize: 13, color: textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: owner ? "var(--color-neutral-500)" : "var(--color-neutral-700)" }}>{owner ?? "undrafted"}</span>
          <span style={{ color: "var(--color-neutral-700)" }}> | </span>
          <span style={{ color: winProb >= 0.5 ? "var(--color-accent-400)" : "var(--color-neutral-600)" }}>{formatWinPct(winProb * 100)}% to win</span>
        </div>
      </div>
      <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 14, color: textColor }}>{score}</div>
    </div>
  );
}
