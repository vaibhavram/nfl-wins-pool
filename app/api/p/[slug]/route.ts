import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { renamePool } from "@/lib/pools-server";

export async function PATCH(req: Request, ctx: RouteContext<"/api/p/[slug]">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });
  if (ctxOrError.membership.role !== "commissioner") {
    return NextResponse.json({ ok: false, error: "Only the commissioner can do that." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ ok: false, error: "Give your pool a name." }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ ok: false, error: "Pool name is too long." }, { status: 400 });

  await renamePool(ctxOrError.pool.id, name);
  return NextResponse.json({ ok: true });
}
