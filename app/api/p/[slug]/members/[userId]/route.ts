import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { removeMember } from "@/lib/pools-server";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/p/[slug]/members/[userId]">) {
  const { slug, userId } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });
  if (ctxOrError.membership.role !== "commissioner") {
    return NextResponse.json({ ok: false, error: "Only the commissioner can do that." }, { status: 403 });
  }

  const result = await removeMember(ctxOrError.pool.id, userId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true });
}
