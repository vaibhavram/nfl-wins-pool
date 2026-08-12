import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getOrCreateShareLink, createEmailInvite, listInvites } from "@/lib/invites-server";
import { issueMagicLink, RateLimitedError } from "@/lib/auth/magic-link";

export async function GET(_req: Request, ctx: RouteContext<"/api/p/[slug]/invites">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });

  const [shareLink, emailInvites] = await Promise.all([
    getOrCreateShareLink(ctxOrError.pool.id, ctxOrError.user.id),
    listInvites(ctxOrError.pool.id),
  ]);
  return NextResponse.json({ ok: true, shareLink, emailInvites });
}

export async function POST(req: Request, ctx: RouteContext<"/api/p/[slug]/invites">) {
  const { slug } = await ctx.params;
  const ctxOrError = await requireMember(slug);
  if ("error" in ctxOrError) return NextResponse.json({ ok: false, error: ctxOrError.error }, { status: ctxOrError.status });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email.includes("@")) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });

  const invite = await createEmailInvite(ctxOrError.pool.id, ctxOrError.user.id, email);

  // The invite link IS a magic link: clicking it (from the recipient's own inbox) verifies their
  // email and signs them in in one step, landing straight on the join-confirm screen -- no
  // separate "now sign in" round-trip on top of the invite itself.
  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  try {
    await issueMagicLink({
      email,
      purpose: "join_pool",
      redirectTo: `/join/${invite.token}`,
      appUrl,
      inviteContext: { inviterName: ctxOrError.user.displayName, poolName: ctxOrError.pool.name },
    });
  } catch (err) {
    if (!(err instanceof RateLimitedError)) throw err;
  }

  return NextResponse.json({ ok: true, invite });
}
