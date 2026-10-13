import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason } from "@/lib/pools-server";
import { getSeasonManagers } from "@/lib/season-server";
import { getCachedPoolSimulation } from "@/lib/pool-simulation-cache";

export async function GET(req: Request, ctx: RouteContext<"/api/p/[slug]/analytics/simulate">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });

  const season = await getCurrentSeason(ctxOrError.pool.id);
  if (!season) return NextResponse.json({ ok: false, error: "Season not found." }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const trialsParam = searchParams.get("trials");
  const trials = trialsParam ? Number(trialsParam) : undefined;

  const managers = await getSeasonManagers(season.id);
  const roster = managers.map((m) => m.userId);

  const start = Date.now();
  const summary = await getCachedPoolSimulation(season.id, roster, trials);
  return NextResponse.json({ ...summary, computeMs: Date.now() - start });
}
