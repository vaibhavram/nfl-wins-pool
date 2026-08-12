import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getCurrentSeason, updateDraftSettings } from "@/lib/pools-server";
import { PICK_CLOCK_OPTIONS_SECONDS } from "@/lib/pick-clock-options";

export async function PATCH(req: Request, ctx: RouteContext<"/api/p/[slug]/draft-settings">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });
  if (ctxOrError.membership.role !== "commissioner") {
    return NextResponse.json({ ok: false, error: "Only the commissioner can change draft settings." }, { status: 403 });
  }

  const season = await getCurrentSeason(ctxOrError.pool.id);
  if (!season) return NextResponse.json({ ok: false, error: "Season not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const updates: { pickClockSeconds?: number; scheduledDraftAt?: string | null } = {};

  if (body?.pickClockSeconds !== undefined) {
    if (!PICK_CLOCK_OPTIONS_SECONDS.has(body.pickClockSeconds)) {
      return NextResponse.json({ ok: false, error: "Invalid pick clock duration." }, { status: 400 });
    }
    updates.pickClockSeconds = body.pickClockSeconds;
  }

  if (body?.scheduledDraftAt !== undefined) {
    if (body.scheduledDraftAt === null) {
      updates.scheduledDraftAt = null;
    } else if (typeof body.scheduledDraftAt === "string" && !Number.isNaN(Date.parse(body.scheduledDraftAt))) {
      updates.scheduledDraftAt = body.scheduledDraftAt;
    } else {
      return NextResponse.json({ ok: false, error: "Invalid draft date/time." }, { status: 400 });
    }
  }

  const result = await updateDraftSettings(season.id, updates);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true });
}
