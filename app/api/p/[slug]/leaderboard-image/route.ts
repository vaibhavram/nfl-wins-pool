import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason } from "@/lib/pools-server";
import { getSeasonPicks, getSeasonManagers } from "@/lib/season-server";
import { getCachedPoolSimulation } from "@/lib/pool-simulation-cache";
import { getStandings } from "@/lib/espn";
import { rostersFromPicks, totalWins } from "@/lib/draft";
import { renderLeaderboardImage, type LeaderboardImageRow } from "@/lib/leaderboard-image";

// The PNG behind the Standings tab's save-to-photos button. Deliberately rendered server-side
// with the same renderLeaderboardImage the weekly digest email uses, rather than rasterizing the
// live DOM client-side: one layout to maintain, an image that looks the same whichever way a
// manager received it, and no html2canvas-style dependency for a once-in-a-while button.
//
// Built from the same inputs, in the same order, as StandingsContent's own rows (live ESPN
// standings for wins, the cached Monte Carlo for win probability, sorted by wins then win
// probability) so the saved image matches the screen it was saved from.
export async function GET(_req: Request, ctx: RouteContext<"/api/p/[slug]/leaderboard-image">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });

  const season = await getCurrentSeason(ctxOrError.pool.id);
  if (!season) return NextResponse.json({ ok: false, error: "Season not found." }, { status: 404 });

  const [picks, managers, standings] = await Promise.all([
    getSeasonPicks(season.id),
    getSeasonManagers(season.id),
    getStandings(),
  ]);
  const roster = managers.map((m) => m.userId);
  const summary = await getCachedPoolSimulation(season.id, roster);
  const winPctByUserId = new Map(summary.results.map((r) => [r.manager, r.winPct]));
  const rosters = rostersFromPicks(picks, roster);

  const rows: LeaderboardImageRow[] = managers
    .map((m) => ({
      name: m.displayName,
      teams: rosters[m.userId] ?? [],
      wins: totalWins(rosters[m.userId] ?? [], standings),
      winPct: winPctByUserId.get(m.userId) ?? null,
    }))
    .sort((a, b) => b.wins - a.wins || (b.winPct ?? 0) - (a.winPct ?? 0));

  const png = await renderLeaderboardImage(ctxOrError.pool.name, rows);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Live numbers: never let a phone or proxy hand back yesterday's standings.
      "Cache-Control": "no-store",
    },
  });
}
