import { NextResponse } from "next/server";
import { getStandings, hasLiveGameThisWeek } from "@/lib/espn";

export async function GET() {
  const [standings, hasLiveGame] = await Promise.all([getStandings(), hasLiveGameThisWeek()]);
  return NextResponse.json({ standings, hasLiveGame });
}
