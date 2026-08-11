import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/require-member";
import { getOrCreateShareLink, createEmailInvite, listInvites } from "@/lib/invites-server";
import { sendEmail } from "@/lib/email";

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

  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  const link = `${appUrl}/join/${invite.token}`;
  await sendEmail({
    to: email,
    subject: `${ctxOrError.user.displayName} invited you to ${ctxOrError.pool.name}`,
    text: `You're invited to join "${ctxOrError.pool.name}" on NFL Wins Pool.\n\n${link}`,
    html: `<p>You're invited to join <strong>${ctxOrError.pool.name}</strong> on NFL Wins Pool.</p><p><a href="${link}">Join the pool</a></p>`,
  });

  return NextResponse.json({ ok: true, invite });
}
