import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason } from "@/lib/pools-server";
import { onlineUserIds } from "@/lib/season-presence";

export async function GET(_req: Request, ctx: RouteContext<"/api/p/[slug]/presence">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });

  const season = await getCurrentSeason(ctxOrError.pool.id);
  if (!season) return NextResponse.json({ online: [] });

  const online = await onlineUserIds(season.id);
  return NextResponse.json({ online });
}
