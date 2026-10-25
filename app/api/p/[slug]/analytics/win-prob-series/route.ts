import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason } from "@/lib/pools-server";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { getWinProbabilitySeries } from "@/lib/win-probability-series";

// Week-by-week pool win probability for every manager in the pool, for the chart on a manager's
// page. One response covers the whole pool rather than one manager, because the underlying
// simulation computes every manager at once anyway -- asking per manager would redo the same work.
export async function GET(_req: Request, ctx: RouteContext<"/api/p/[slug]/analytics/win-prob-series">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });

  const season = await getCurrentSeason(ctxOrError.pool.id);
  if (!season) return NextResponse.json({ ok: false, error: "Season not found." }, { status: 404 });

  const [picks, managers] = await Promise.all([getSeasonPicks(season.id), getSeasonManagers(season.id)]);
  const roster = managers.map((m) => m.userId);
  const series = await getWinProbabilitySeries(season.id, picks, roster);
  return NextResponse.json(series);
}
