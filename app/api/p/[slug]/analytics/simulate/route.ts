import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason } from "@/lib/pools-server";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { runSimulation, type SimulationSummary } from "@/lib/simulation";
import { LEADERBOARD_RECOMPUTE_MS } from "@/lib/game-window";

// The (CPU-heavy) simulation result is cached rather than re-run on every page load. A plain
// in-memory Map instead of unstable_cache: fine for this single-instance service, same as other
// manual in-memory caches already used elsewhere in this codebase. Flat TTL regardless of live
// state -- "leaderboard win probabilities recompute every 5 minutes" is the whole spec, not "5
// minutes while live, else hours"; runSimulation/getSeasonGameData (lib/simulation.ts) already
// carry their own matching 5-minute cache one level down, so this just needs to not be shorter
// than that.
const cache = new Map<string, { summary: SimulationSummary; expiresAt: number }>();

async function getCachedSimulation(seasonId: string, roster: string[], trials?: number): Promise<SimulationSummary> {
  const key = `${seasonId}:${roster.join(",")}:${trials ?? "default"}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.summary;

  const picks = await getSeasonPicks(seasonId);
  const summary = await runSimulation(picks, roster, trials);
  cache.set(key, { summary, expiresAt: Date.now() + LEADERBOARD_RECOMPUTE_MS });
  return summary;
}

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
