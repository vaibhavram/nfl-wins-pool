import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/require-member";
import { revokeInvite } from "@/lib/invites-server";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/p/[slug]/invites/[id]">) {
  const { slug, id } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });
  if (ctxOrError.membership.role !== "commissioner") {
    return NextResponse.json({ ok: false, error: "Only the commissioner can do that." }, { status: 403 });
  }

  await revokeInvite(id, ctxOrError.pool.id);
  // The invite/settings pages fetch this list as a Server Component prop, so the client-side
  // Router Cache can otherwise keep showing the revoked invite as "Pending" until it happens to
  // expire -- invalidate it explicitly so the next visit to either page refetches.
  revalidatePath(`/p/${slug}/invite`);
  revalidatePath(`/p/${slug}/settings`);
  return NextResponse.json({ ok: true });
}
