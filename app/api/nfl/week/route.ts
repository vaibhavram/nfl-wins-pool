import { NextRequest, NextResponse } from "next/server";
import { getCurrentRegularSeasonWeek, getWeekScoreboard } from "@/lib/espn";

const MIN_WEEK = 1;
const MAX_WEEK = 18;

export async function GET(req: NextRequest) {
  const requestedWeek = req.nextUrl.searchParams.get("week");
  const { week: currentWeek, year } = await getCurrentRegularSeasonWeek();

  let week = requestedWeek ? Number(requestedWeek) : currentWeek;
  if (!Number.isFinite(week)) week = currentWeek;
  week = Math.min(MAX_WEEK, Math.max(MIN_WEEK, week));

  const live = await getWeekScoreboard(week, year);

  return NextResponse.json({
    week: live.week,
    year,
    currentWeek,
    minWeek: MIN_WEEK,
    maxWeek: MAX_WEEK,
    games: live.games,
    byeTeams: live.byeTeams,
  });
}
