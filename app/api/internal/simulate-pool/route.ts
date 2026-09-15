import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPoolBySlug, getCurrentSeason } from "@/lib/pools-server";
import { getSeasonManagers, getSeasonPicks } from "@/lib/season-server";
import { runSimulation } from "@/lib/simulation";

// Same MIGRATE_SECRET bearer gate as the other /api/internal routes. Debug/ops tool: runs the
// real Monte Carlo simulation for one pool by slug, outside of a logged-in session -- the normal
// /api/p/[slug]/analytics/simulate route requires requireMember(), which needs a real user
// cookie this environment doesn't have. Body: { slug: string, trials?: number }.
export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return NextResponse.json({ error: "MIGRATE_SECRET not configured" }, { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const authorized = a.length === b.length && timingSafeEqual(a, b);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const trials = typeof body?.trials === "number" ? body.trials : undefined;
  if (!slug) return NextResponse.json({ ok: false, error: "slug is required" }, { status: 400 });

  try {
    const pool = await getPoolBySlug(slug);
    if (!pool) return NextResponse.json({ ok: false, error: "Pool not found" }, { status: 404 });
    const season = await getCurrentSeason(pool.id);
    if (!season) return NextResponse.json({ ok: false, error: "Season not found" }, { status: 404 });

    const managers = await getSeasonManagers(season.id);
    const nameByUserId = Object.fromEntries(managers.map((m) => [m.userId, m.displayName]));
    const roster = managers.map((m) => m.userId);
    const picks = await getSeasonPicks(season.id);

    const start = Date.now();
    const summary = await runSimulation(picks, roster, trials);
    const computeMs = Date.now() - start;

    return NextResponse.json({
      ok: true,
      pool: pool.name,
      trials: summary.trials,
      model: summary.model,
      hasLiveGame: summary.hasLiveGame,
      computeMs,
      results: summary.results.map((r) => ({
        manager: nameByUserId[r.manager] ?? r.manager,
        teams: r.teams,
        winPct: r.winPct,
        avgWins: r.avgWins,
        medianWins: r.medianWins,
        p10Wins: r.p10Wins,
        p90Wins: r.p90Wins,
      })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
