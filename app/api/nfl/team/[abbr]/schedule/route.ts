import { NextResponse } from "next/server";
import { getTeamSchedule } from "@/lib/espn";

export async function GET(_req: Request, ctx: RouteContext<"/api/nfl/team/[abbr]/schedule">) {
  const { abbr } = await ctx.params;
  const schedule = await getTeamSchedule(abbr);
  return NextResponse.json({ schedule });
}
