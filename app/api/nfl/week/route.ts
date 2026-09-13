import { NextRequest, NextResponse } from "next/server";
import { getCurrentRegularSeasonWeek, getWeekScoreboard, getGamePredictor, type LiveGame } from "@/lib/espn";
import { getHomeWinProbabilityFpi } from "@/lib/simulation";

const MIN_WEEK = 1;
const MAX_WEEK = 18;

// Resolved directly per-game (not via lib/simulation.ts's getSeasonGameData) so this route never
// waits on that function's 5-minute cache -- the Matchup/Schedule tab must reflect a game's real
// win probability the moment it refreshes, not up to 5 minutes stale. Cheap: at most ~16 games,
// vs. the ~270-game full-season resolution that cache exists to bound the cost of.
async function resolveWinProb(g: LiveGame): Promise<number | null> {
  if (g.state === "post") return null;
  if (g.state === "in") return g.liveHomeWinProb;
  const predicted = await getGamePredictor(g.id);
  return predicted ?? (await getHomeWinProbabilityFpi(g.home, g.away));
}

export async function GET(req: NextRequest) {
  const requestedWeek = req.nextUrl.searchParams.get("week");
  const { week: currentWeek, year } = await getCurrentRegularSeasonWeek();

  let week = requestedWeek ? Number(requestedWeek) : currentWeek;
  if (!Number.isFinite(week)) week = currentWeek;
  week = Math.min(MAX_WEEK, Math.max(MIN_WEEK, week));

  const live = await getWeekScoreboard(week, year);
  const games = await Promise.all(live.games.map(async (g) => ({ ...g, homeWinProb: await resolveWinProb(g) })));

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
