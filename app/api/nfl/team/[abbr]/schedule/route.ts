import { NextResponse } from "next/server";
import { getTeamSchedule, getCurrentRegularSeasonWeek, getWeekScoreboard, type TeamScheduleLive } from "@/lib/espn";
import { getSeasonGameData } from "@/lib/simulation";

export async function GET(_req: Request, ctx: RouteContext<"/api/nfl/team/[abbr]/schedule">) {
  const { abbr } = await ctx.params;
  const ab = abbr.toUpperCase();
  const rows = await getTeamSchedule(ab);

  const { week: currentWeek, year } = await getCurrentRegularSeasonWeek();
  const { games: resolved } = await getSeasonGameData(year);
  const resolvedById = new Map(resolved.map((g) => [g.id, g]));

  // A schedule row knows a game is in progress but carries no score until it's final, so the
  // live score comes from the week scoreboard. Only fetched when this team actually has a game
  // under way -- on every other request the schedule alone is enough.
  const hasLiveRow = rows.some((r) => r.state === "in");
  const liveById = hasLiveRow
    ? new Map((await getWeekScoreboard(currentWeek, year)).games.map((g) => [g.id, g]))
    : new Map();

  const schedule = rows.map((row) => {
    const live: TeamScheduleLive | null = (() => {
      if (row.state !== "in") return null;
      const g = liveById.get(row.id);
      if (!g || g.homeScore === null || g.awayScore === null) return null;
      const home = row.at === "vs"; // this team is the home side
      return {
        myScore: home ? g.homeScore : g.awayScore,
        oppScore: home ? g.awayScore : g.homeScore,
        statusDetail: g.statusDetail,
        hasPossession: g.possession === (home ? "home" : "away"),
      };
    })();

    if (!row.opponentAb) return { ...row, winProb: null, live };
    const match = resolvedById.get(row.id);
    if (!match || match.state === "post") return { ...row, winProb: null, live };
    // pHomeWin is always from the home team's perspective -- flip it for an away game. While a
    // game is live this is ESPN's own in-game win probability, so it keeps moving with the score.
    const winProb = row.at === "vs" ? match.pHomeWin : 1 - match.pHomeWin;
    return { ...row, winProb, live };
  });

  const hasLiveGame = resolved.some((g) => g.state === "in");
  return NextResponse.json({ schedule, hasLiveGame, currentWeek });
}
