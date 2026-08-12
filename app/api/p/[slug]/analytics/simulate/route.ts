import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason } from "@/lib/pools-server";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { runSimulation } from "@/lib/simulation";

// The (CPU-heavy, ~2s for 20k trials) simulation result is cached rather than re-run on every
// page load. Unlike the single-tenant original, `seasonId` is a real argument to the cached
// function -- Next.js folds a cached function's arguments into its cache key, so this is what
// actually keeps one pool's simulation from being served to a completely different pool.
const getCachedSimulation = unstable_cache(
  async (seasonId: string, roster: string[], trials?: number) => {
    const picks = await getSeasonPicks(seasonId);
    return runSimulation(picks, roster, trials);
  },
  ["pool-simulation"],
  { revalidate: 21600 }, // 6h, matching lib/nfelo.ts's own cache window
);

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
  const summary = await getCachedSimulation(season.id, roster, trials);
  return NextResponse.json({ ...summary, computeMs: Date.now() - start });
}
