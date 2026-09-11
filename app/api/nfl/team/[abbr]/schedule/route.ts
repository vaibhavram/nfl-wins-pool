import { NextResponse } from "next/server";
import { getTeamSchedule, getCurrentRegularSeasonWeek } from "@/lib/espn";
import { getSeasonGameData } from "@/lib/simulation";

export async function GET(_req: Request, ctx: RouteContext<"/api/nfl/team/[abbr]/schedule">) {
  const { abbr } = await ctx.params;
  const ab = abbr.toUpperCase();
  const rows = await getTeamSchedule(ab);

  const { year } = await getCurrentRegularSeasonWeek();
  const { games: resolved } = await getSeasonGameData(year);
  const resolvedById = new Map(resolved.map((g) => [g.id, g]));

  const schedule = rows.map((row) => {
    if (!row.opponentAb) return { ...row, winProb: null };
    const match = resolvedById.get(row.id);
    if (!match || match.state === "post") return { ...row, winProb: null };
    // pHomeWin is always from the home team's perspective -- flip it for an away game.
    const winProb = row.at === "vs" ? match.pHomeWin : 1 - match.pHomeWin;
    return { ...row, winProb };
  });

  const hasLiveGame = resolved.some((g) => g.state === "in");
  return NextResponse.json({ schedule, hasLiveGame });
}
