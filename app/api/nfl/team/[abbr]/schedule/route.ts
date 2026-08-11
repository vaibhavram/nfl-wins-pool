import { NextResponse } from "next/server";
import { getTeamSchedule } from "@/lib/espn";
import { getHomeWinProbability } from "@/lib/simulation";

export async function GET(_req: Request, ctx: RouteContext<"/api/nfl/team/[abbr]/schedule">) {
  const { abbr } = await ctx.params;
  const ab = abbr.toUpperCase();
  const rows = await getTeamSchedule(ab);

  const schedule = await Promise.all(
    rows.map(async (row) => {
      if (!row.opponentAb) return { ...row, winProb: null };
      const winProb =
        row.at === "vs" ? await getHomeWinProbability(ab, row.opponentAb) : 1 - (await getHomeWinProbability(row.opponentAb, ab));
      return { ...row, winProb };
    }),
  );

  return NextResponse.json({ schedule });
}
