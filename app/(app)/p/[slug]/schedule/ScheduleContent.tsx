"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeamLogo } from "@/components/TeamLogo";
import { PoolTabBar } from "@/components/pool/PoolTabBar";
import { SettingsGearLink } from "@/components/pool/SettingsGearLink";
import { PoolSwitcher } from "@/components/pool/PoolSwitcher";
import { TEAM, type TeamRecord } from "@/lib/teams";
import { rostersFromPicks, type Pick } from "@/lib/draft";
import { useWeek, useStandings } from "@/lib/live-data";
import type { WeekGame } from "@/lib/live-data";
import { formatKickoff, formatWinPct } from "@/lib/format";
import type { SeasonManager } from "@/lib/season-server";

export function ScheduleContent({
  slug,
  poolName,
  currentUserId,
  picks,
  managers,
  isCommissioner,
}: {
  slug: string;
  poolName: string;
  currentUserId: string;
  picks: Pick[];
  managers: SeasonManager[];
  isCommissioner: boolean;
}) {
  const router = useRouter();
  const [weekOverride, setWeekOverride] = useState<number | null>(null);
  const { week: data, loading, error } = useWeek(weekOverride);
  const { standings } = useStandings();

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
        <div style={{ flex: "none", padding: "12px 20px 0" }}>
          <PoolSwitcher slug={slug} poolName={poolName} />
        </div>
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
        <div style={{ flex: "none", padding: "12px 20px 0" }}>
          <PoolSwitcher slug={slug} poolName={poolName} />
        </div>
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
      <div style={{ flex: "none", padding: "12px 20px 0" }}>
        <PoolSwitcher slug={slug} poolName={poolName} />
      </div>
      <div style={{ flex: "none", padding: "8px 14px 12px", borderBottom: "1px solid var(--color-divider)", display: "flex", alignItems: "center", gap: 10 }}>
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
        <SettingsGearLink slug={slug} isCommissioner={isCommissioner} />
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 12px 14px" }} className="scr">
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {games.map((g: WeekGame, i: number) => {
            const away = TEAM[g.away];
            const home = TEAM[g.home];
            const scored = g.state !== "pre";
            const mine = myTeams.has(g.away) || myTeams.has(g.home);
            const awayWon = g.completed && g.awayScore !== null && g.homeScore !== null && g.awayScore > g.homeScore;
            const homeWon = g.completed && g.awayScore !== null && g.homeScore !== null && g.homeScore > g.awayScore;
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
                  record={standings[g.away]}
                  owner={owners[g.away]}
                  winProb={g.homeWinProb === null ? null : 1 - g.homeWinProb}
                  score={scored ? String(g.awayScore) : ""}
                  scoreWon={awayWon}
                  hasPossession={g.possession === "away"}
                  onOwnerClick={() => router.push(`/p/${slug}/team/${g.away}`)}
                />
                <TeamRow
                  ab={g.home}
                  name={home?.full ?? g.home}
                  record={standings[g.home]}
                  owner={owners[g.home]}
                  winProb={g.homeWinProb}
                  score={scored ? String(g.homeScore) : ""}
                  scoreWon={homeWon}
                  hasPossession={g.possession === "home"}
                  onOwnerClick={() => router.push(`/p/${slug}/team/${g.home}`)}
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    borderTop: "1px solid var(--color-divider)",
                    paddingTop: 5,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: g.state === "in" ? "var(--color-accent-300)" : "var(--color-neutral-600)",
                    }}
                  >
                    {g.state === "in" ? `● Live · ${g.statusDetail}` : g.completed ? "Final" : formatKickoff(g.date)}
                  </div>
                  {g.state === "in" && g.downDistanceText && (
                    <div style={{ fontSize: 11.5, color: g.isRedZone ? "#ef4444" : "var(--color-neutral-500)" }}>
                      {g.isRedZone ? "🔴 " : ""}
                      {g.downDistanceText}
                    </div>
                  )}
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
  record,
  owner,
  winProb,
  score,
  scoreWon,
  hasPossession,
  onOwnerClick,
}: {
  ab: string;
  name: string;
  record: TeamRecord | undefined;
  owner: string | undefined;
  winProb: number | null; // null once the game is final -- no win probability to show anymore
  score: string;
  scoreWon: boolean; // bolds the score -- the only visual distinction between a final game's winner and loser, deliberately no shading/color per an earlier explicit ask
  hasPossession: boolean;
  onOwnerClick: () => void;
}) {
  const recordText = record ? `(${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""})` : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <TeamLogo ab={ab} size={26} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", cursor: "pointer" }} onClick={onOwnerClick}>
        <div style={{ fontSize: 13, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
          {recordText && <span style={{ color: "var(--color-neutral-500)" }}> {recordText}</span>}
        </div>
        <div style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ color: owner ? "var(--color-neutral-500)" : "var(--color-neutral-700)" }}>{owner ?? "undrafted"}</span>
          {winProb !== null && (
            <>
              <span style={{ color: "var(--color-neutral-700)" }}> | </span>
              <span style={{ color: winProb >= 0.5 ? "var(--color-accent-400)" : "var(--color-neutral-600)" }}>{formatWinPct(winProb * 100)}% to win</span>
            </>
          )}
        </div>
      </div>
      {hasPossession && (
        <span
          aria-label="Has possession"
          style={{
            flex: "none",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--color-text)",
          }}
        />
      )}
      <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 14, fontWeight: scoreWon ? 700 : 400, color: "var(--color-text)" }}>{score}</div>
    </div>
  );
}
