import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason } from "@/lib/pools-server";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { runSimulation, type SimulationSummary } from "@/lib/simulation";

// The (CPU-heavy) simulation result is cached rather than re-run on every page load. A plain
// in-memory Map instead of unstable_cache: the right TTL isn't known until *after* the
// simulation runs (whether any game in it is live), which unstable_cache's static `revalidate`
// config can't express. Fine for this single-instance service, same as other manual in-memory
// caches already used elsewhere in this codebase.
//
// This is deliberately much coarser than the Schedule tab's own live data (lib/espn.ts's 15s
// scoreboard revalidate + lib/live-data.ts's 20s poll, both untouched) -- the Monte Carlo is a
// heavier, pool-wide aggregate, not a single number a user is watching tick in real time, so
// re-running it every 5 minutes while something's live is a deliberate complexity/cost tradeoff,
// not an attempt to make it feel as live as the matchup tab.
const LONG_TTL_MS = 21_600_000; // 6h, matching lib/nfelo.ts's own cache window -- nothing's live
const LIVE_TTL_MS = 300_000; // 5 minutes while any game in the result is live

const cache = new Map<string, { summary: SimulationSummary; expiresAt: number }>();

async function getCachedSimulation(seasonId: string, roster: string[], trials?: number): Promise<SimulationSummary> {
  const key = `${seasonId}:${roster.join(",")}:${trials ?? "default"}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.summary;

  const picks = await getSeasonPicks(seasonId);
  const summary = await runSimulation(picks, roster, trials);
  const ttl = summary.hasLiveGame ? LIVE_TTL_MS : LONG_TTL_MS;
  cache.set(key, { summary, expiresAt: Date.now() + ttl });
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
