import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db2";
import { getTestExclusions } from "@/lib/admin-server";
import { sendEmail } from "@/lib/email";
import { renderEmailHtml, emailParagraph } from "@/lib/email-template";

type TargetPool = { slug: string; name: string; email: string; memberCount: number };

// One-time internal endpoint (same MIGRATE_SECRET bearer gate as the other /api/internal
// routes): emails commissioners of pools that are full-but-undrafted a draft reminder, and
// commissioners of pools still filling an invite reminder. `dryRun: true` returns the exact
// recipient list without sending anything, so it can be checked before the real send.
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
  const dryRun = body?.dryRun === true;

  const { poolIds } = await getTestExclusions();

  const currentSeasonJoin = `
    JOIN pool_seasons ps ON ps.pool_id = p.id
      AND ps.id = (SELECT id FROM pool_seasons WHERE pool_id = p.id ORDER BY season_year DESC LIMIT 1)
    JOIN pool_members pm ON pm.pool_id = p.id AND pm.role = 'commissioner'
    JOIN users u ON u.id = pm.user_id
  `;

  const readyPools = await query<{ slug: string; name: string; email: string; member_count: string }>(
    `SELECT p.slug, p.name, u.email, (SELECT count(*)::text FROM pool_members WHERE pool_id = p.id) AS member_count
     FROM pools p ${currentSeasonJoin}
     WHERE p.id <> ALL($1::uuid[]) AND ps.status = 'ready' AND u.email IS NOT NULL`,
    [poolIds],
  );
  const fillingPools = await query<{ slug: string; name: string; email: string; member_count: string }>(
    `SELECT p.slug, p.name, u.email, (SELECT count(*)::text FROM pool_members WHERE pool_id = p.id) AS member_count
     FROM pools p ${currentSeasonJoin}
     WHERE p.id <> ALL($1::uuid[]) AND ps.status = 'filling' AND u.email IS NOT NULL`,
    [poolIds],
  );

  const toTarget = (rows: typeof readyPools): TargetPool[] =>
    rows.map((r) => ({ slug: r.slug, name: r.name, email: r.email, memberCount: Number(r.member_count) }));

  const draftTargets = toTarget(readyPools);
  const inviteTargets = toTarget(fillingPools);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      draftReminder: draftTargets,
      inviteReminder: inviteTargets,
    });
  }

  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;

  for (const t of draftTargets) {
    const link = `${appUrl}/p/${t.slug}/lobby`;
    const intro = `Every seat in ${t.name} is filled, but the draft hasn't started yet. The season kicks off in about a week, don't forget to start your draft before the season begins!`;
    await sendEmail({
      to: t.email,
      subject: "Your wins pool is ready to draft!",
      text: `${intro}\n\n${link}`,
      html: renderEmailHtml({ title: t.name, subtitle: "Ready to draft", bodyHtml: emailParagraph(intro), ctaText: "Go to your pool", ctaHref: link }),
    });
  }

  for (const t of inviteTargets) {
    const link = `${appUrl}/p/${t.slug}/invite`;
    const intro = `${t.name} has ${t.memberCount} of 10 managers with the season about a week away. Invite the rest of your group before the season kicks off!`;
    await sendEmail({
      to: t.email,
      subject: "Your wins pool still has open seats",
      text: `${intro}\n\n${link}`,
      html: renderEmailHtml({
        title: t.name,
        subtitle: "Still filling",
        bodyHtml: emailParagraph(intro),
        ctaText: "Invite more managers",
        ctaHref: link,
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    sent: { draftReminder: draftTargets.length, inviteReminder: inviteTargets.length },
  });
}
