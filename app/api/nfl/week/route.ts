import { NextRequest, NextResponse } from "next/server";
import { getCurrentRegularSeasonWeek, getSmartWeekScoreboard } from "@/lib/espn";
import { getSeasonGameData } from "@/lib/simulation";

const MIN_WEEK = 1;
const MAX_WEEK = 18;

export async function GET(req: NextRequest) {
  const requestedWeek = req.nextUrl.searchParams.get("week");
  const { week: currentWeek, year } = await getCurrentRegularSeasonWeek();

  let week = requestedWeek ? Number(requestedWeek) : currentWeek;
  if (!Number.isFinite(week)) week = currentWeek;
  week = Math.min(MAX_WEEK, Math.max(MIN_WEEK, week));

  const live = await getSmartWeekScoreboard(week, year);
  // Cross-reference the shared hybrid resolution by game id instead of computing a separate
  // (FPI-only, live-unaware) probability here -- null hides the win-prob line entirely once a
  // game is final, matching every other win-probability display in the app.
  const { games: resolved } = await getSeasonGameData(year);
  const resolvedById = new Map(resolved.map((g) => [g.id, g]));
  const games = live.games.map((g) => {
    const match = resolvedById.get(g.id);
    const homeWinProb = match && match.state !== "post" ? match.pHomeWin : null;
    return { ...g, homeWinProb };
  });

  return NextResponse.json({
    week: live.week,
    year,
    currentWeek,
    minWeek: MIN_WEEK,
    maxWeek: MAX_WEEK,
    games,
    byeTeams: live.byeTeams,
  });
}
