import { NextResponse } from "next/server";
import { getProjectedWinsByTeam } from "@/lib/simulation";

export async function GET() {
  const projectedWins = await getProjectedWinsByTeam();
  return NextResponse.json({ projectedWins });
}
