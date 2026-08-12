import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason } from "@/lib/pools-server";
import { submitPick } from "@/lib/season-server";

export async function POST(req: Request, ctx: RouteContext<"/api/p/[slug]/draft/pick">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });

  const body = await req.json().catch(() => null);
  const teamAb = typeof body?.teamAb === "string" ? body.teamAb : null;
  if (!teamAb) return NextResponse.json({ ok: false, error: "Missing teamAb." }, { status: 400 });

  const season = await getCurrentSeason(ctxOrError.pool.id);
  if (!season) return NextResponse.json({ ok: false, error: "Season not found." }, { status: 404 });

  const result = await submitPick(season.id, ctxOrError.user.id, teamAb);
  if (!result.ok) return NextResponse.json(result, { status: result.status });
  return NextResponse.json(result);
}
